import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const workspace = path.resolve(import.meta.dirname, "..");
const qaNodeModules = process.env.QA_NODE_MODULES
  || path.join(os.tmpdir(), "fundamentals-3d-qa", "node_modules");
const threePath = path.join(qaNodeModules, "three", "build", "three.module.js");
const jsdomPath = path.join(qaNodeModules, "jsdom", "lib", "api.js");

if (!fs.existsSync(threePath) || !fs.existsSync(jsdomPath)) {
  console.error("Polished-lab QA dependencies are missing.");
  console.error(`Install them with: npm.cmd install --prefix "${path.dirname(qaNodeModules)}" jsdom@26.1.0 three@0.158.0`);
  process.exit(1);
}

const { JSDOM } = await import(pathToFileURL(jsdomPath).href);
const threeUrl = pathToFileURL(threePath).href;
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "polished-labs-qa-"));

const orbitMock = `
class OrbitControls {
  constructor(camera, canvas) {
    this.object = camera;
    this.domElement = canvas;
    this.target = new THREE.Vector3();
    this.enabled = true;
    this.enableDamping = false;
    this.enablePan = false;
    this.minDistance = 0;
    this.maxDistance = Infinity;
    this.minPolarAngle = 0;
    this.maxPolarAngle = Math.PI;
  }
  update() {}
}
`;

const rendererMock = `
class MockRenderer {
  constructor({ canvas }) {
    this.domElement = canvas;
    this.shadowMap = { enabled: false, type: null };
    this.outputColorSpace = THREE.SRGBColorSpace;
  }
  setPixelRatio() {}
  setSize(width, height) {
    this.domElement.width = width;
    this.domElement.height = height;
  }
  setClearColor() {}
  render(scene) { scene.updateMatrixWorld(true); }
}
`;

function fakeContext() {
  return {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
    setTransform() {},
    clearRect() {},
    fillRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fill() {},
    arc() {},
    createRadialGradient() { return { addColorStop() {} }; },
    createLinearGradient() { return { addColorStop() {} }; },
    measureText(text) { return { width: String(text).length * 8 }; },
  };
}

function installDom(html) {
  const dom = new JSDOM(html, {
    url: "http://qa.local/",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.HTMLCanvasElement.prototype.getContext = () => fakeContext();
  window.HTMLElement.prototype.getBoundingClientRect = () => ({
    x: 0, y: 0, top: 0, left: 0, right: 240, bottom: 48,
    width: 240, height: 48, toJSON() { return this; },
  });
  window.requestAnimationFrame = () => 1;
  window.cancelAnimationFrame = () => {};
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Object.defineProperty(window, "innerWidth", { value: 1440, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 900, configurable: true });
  Object.defineProperty(window, "devicePixelRatio", { value: 1, configurable: true });

  const globals = {
    window,
    self: window,
    document: window.document,
    navigator: window.navigator,
    location: window.location,
    HTMLElement: window.HTMLElement,
    HTMLCanvasElement: window.HTMLCanvasElement,
    Event: window.Event,
    MouseEvent: window.MouseEvent,
    CustomEvent: window.CustomEvent,
    getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: window.requestAnimationFrame,
    cancelAnimationFrame: window.cancelAnimationFrame,
    ResizeObserver: window.ResizeObserver,
    devicePixelRatio: 1,
  };
  for (const [name, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  return dom;
}

function prepareLab(name) {
  const sourceDir = path.join(workspace, "polished", "labs", name);
  const outputDir = path.join(tempRoot, name);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.cpSync(path.join(sourceDir, "js"), path.join(outputDir, "js"), { recursive: true });

  for (const filename of fs.readdirSync(path.join(outputDir, "js"))) {
    if (!filename.endsWith(".js")) continue;
    const filepath = path.join(outputDir, "js", filename);
    let source = fs.readFileSync(filepath, "utf8")
      .replaceAll("from 'three';", `from ${JSON.stringify(threeUrl)};`)
      .replaceAll('from "three";', `from ${JSON.stringify(threeUrl)};`);

    if (filename === "stage.js") {
      source = source
        .replace(/import \{ OrbitControls \} from ['"]three\/addons\/controls\/OrbitControls\.js['"];?\s*/, `${orbitMock}\n${rendererMock}\n`)
        .replace("new THREE.WebGLRenderer({ canvas, antialias: true })", "new MockRenderer({ canvas })");
    }
    fs.writeFileSync(filepath, source);
  }
  return { sourceDir, outputDir };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function countScene(scene, predicate) {
  let count = 0;
  scene.traverse(object => { if (predicate(object)) count += 1; });
  return count;
}

async function testHierarchy() {
  const { sourceDir, outputDir } = prepareLab("hierarchy");
  const dom = installDom(fs.readFileSync(path.join(sourceDir, "index.html"), "utf8"));
  const arm = await import(pathToFileURL(path.join(outputDir, "js", "arm.js")).href);
  const stage = await import(pathToFileURL(path.join(outputDir, "js", "stage.js")).href);
  const config = await import(pathToFileURL(path.join(outputDir, "js", "config.js")).href);

  assert(countScene(stage.scene, object => object.isMesh) >= 30, "hierarchy model is missing its detailed parts");
  arm.setJoints(config.POSE_PRESETS.reach);
  assert(arm.isHeld(), "Reach preset no longer catches the pickup block");
  arm.selectNode("wrist");
  assert(arm.worldPosition().distanceTo(arm.localPosition()) > 0.5, "local/world readout does not distinguish inherited motion");
  dom.window.close();
}

async function testKeyframes() {
  const { sourceDir, outputDir } = prepareLab("keyframes");
  const dom = installDom(fs.readFileSync(path.join(sourceDir, "index.html"), "utf8"));
  const animation = await import(pathToFileURL(path.join(outputDir, "js", "animation.js")).href);
  const stage = await import(pathToFileURL(path.join(outputDir, "js", "stage.js")).href);

  animation.seed({ keys: [
    { frame: 0, pose: { y: 0, turn: 0, size: 1 } },
    { frame: 100, pose: { y: 6, turn: 180, size: 0.8 } },
  ] });
  animation.setFrame(50);
  const midpoint = animation.poseAt(50);
  assert(midpoint.y > 2.9 && midpoint.y < 3.1, "keyframe interpolation midpoint is wrong");
  assert(countScene(stage.scene, object => object.isMesh) >= 28, "keyframe scene is missing its detailed actor or ghosts");

  stage.setCam("side", true);
  const bottom = new (await import(threeUrl)).Vector3(0, 0, 0).project(stage.camera);
  const top = new (await import(threeUrl)).Vector3(0, 9, 0).project(stage.camera);
  assert(Math.abs(bottom.y) < 1 && Math.abs(top.y) < 1, "side camera clips the authored height range");
  dom.window.close();
}

async function testParticles() {
  const { sourceDir, outputDir } = prepareLab("particles");
  const dom = installDom(fs.readFileSync(path.join(sourceDir, "index.html"), "utf8"));
  const particles = await import(pathToFileURL(path.join(outputDir, "js", "particles.js")).href);
  const stage = await import(pathToFileURL(path.join(outputDir, "js", "stage.js")).href);

  particles.setSoloMode(true);
  particles.updateParticles(1 / 60);
  assert(particles.getSoloTelemetry(), "solo particle telemetry is not available");

  particles.setSoloMode(false);
  particles.setParams({ life: 1.6, rate: 90, speed: 4, drag: 0.2, gravity: true, colorLife: true });
  for (let frame = 0; frame < 240; frame++) particles.updateParticles(1 / 60);
  assert(particles.getLive() >= 80 && particles.getLive() <= 220, "particle challenge settings do not reach their promised budget");
  assert(countScene(stage.scene, object => object.isPoints) === 2, "particle core/glow render passes are missing");
  assert(countScene(stage.scene, object => object.isMesh) >= 4, "particle emitter is missing its modelled parts");
  dom.window.close();
}

try {
  await testHierarchy();
  await testKeyframes();
  await testParticles();
  console.log("PASS polished labs: hierarchy pickup, keyframe interpolation/framing, particle budget/telemetry");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
