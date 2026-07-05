import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const workspace = path.resolve(import.meta.dirname, "..");
const qaNodeModules = process.env.QA_NODE_MODULES
  || path.join(os.tmpdir(), "fundamentals-3d-qa", "node_modules");

const jsdomUrl = pathToFileURL(path.join(qaNodeModules, "jsdom", "lib", "api.js")).href;
const threeUrl = pathToFileURL(path.join(qaNodeModules, "three", "build", "three.module.js")).href;

if (!fs.existsSync(path.join(qaNodeModules, "jsdom", "lib", "api.js"))
  || !fs.existsSync(path.join(qaNodeModules, "three", "build", "three.module.js"))) {
  console.error("Advanced QA dependencies are missing.");
  console.error(`Install them with: npm.cmd install --prefix "${path.dirname(qaNodeModules)}" jsdom@26.1.0 three@0.158.0`);
  process.exit(1);
}

const { JSDOM, VirtualConsole } = await import(jsdomUrl);

const pages = [
  "mesh-editing-lab.html",
  "rigging-skinning-lab.html",
  "texture-baking-lab.html",
  "raycasting-lab.html",
  "optimization-lab.html",
  "particle-vfx-lab.html",
  "shader-graph-lab.html",
  "navigation-pathfinding-lab.html",
  "sculpt-retopology-lab.html",
  "rendering-pipeline-lab.html",
  "asset-pipeline-lab.html",
  "accessibility-3d-lab.html"
];

const mockRuntime = `
  class MockRenderer {
    constructor({ canvas }) {
      this.domElement = canvas;
      this.shadowMap = { enabled: false, type: null };
      this.capabilities = { getMaxAnisotropy: () => 8 };
      this.toneMapping = THREE.NoToneMapping;
      this.toneMappingExposure = 1;
      this.outputColorSpace = THREE.SRGBColorSpace;
      this.qaTime = performance.now();
      globalThis.__qaRenderers.push(this);
    }
    setPixelRatio() {}
    setSize(width, height) {
      this.domElement.width = Math.max(1, Math.round(width));
      this.domElement.height = Math.max(1, Math.round(height));
    }
    setAnimationLoop(callback) { this.callback = callback; }
    render(scene) { scene.updateMatrixWorld(true); }
    setClearColor() {}
    setScissorTest() {}
    setViewport() {}
    setScissor() {}
    clear() {}
  }

  class MockOrbitControls {
    constructor(camera, canvas) {
      this.object = camera;
      this.domElement = canvas;
      this.target = new THREE.Vector3();
      this.enabled = true;
      this.enableDamping = false;
      this.minDistance = 0;
      this.maxDistance = Infinity;
    }
    update() {}
  }
`;

const productionCore = fs.readFileSync(path.join(workspace, "shared", "advanced-lab-core.js"), "utf8");
const coreSource = productionCore
  .replace('import * as THREE from "three";', `import * as THREE from ${JSON.stringify(threeUrl)};\n${mockRuntime}`)
  .replace(/import \{ OrbitControls \} from "three\/addons\/controls\/OrbitControls\.js";\s*/, "")
  .replace("new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })", "new MockRenderer({ canvas })")
  .replace("new OrbitControls(camera, canvas)", "new MockOrbitControls(camera, canvas)");

const coreUrl = `data:text/javascript;base64,${Buffer.from(coreSource).toString("base64")}`;

function fakeContext() {
  return {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
    roundRect() {},
    fill() {},
    fillText() {},
    fillRect() {},
    beginPath() {},
    arc() {},
    stroke() {},
    putImageData() {},
    createLinearGradient() {
      return { addColorStop() {} };
    },
    createImageData(width, height) {
      return { width, height, data: new Uint8ClampedArray(width * height * 4) };
    },
    measureText(text) {
      return { width: String(text).length * 10 };
    }
  };
}

function installDom(html, width, height, errors) {
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", error => errors.push(error.message));
  const dom = new JSDOM(html, {
    url: "http://qa.local/",
    pretendToBeVisual: true,
    virtualConsole
  });
  const { window } = dom;

  window.HTMLCanvasElement.prototype.getContext = function getContext() {
    return fakeContext();
  };
  window.HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    const isSidebar = this.classList?.contains("sidebar");
    const viewportWidth = width <= 820 ? width : width - 360;
    const rectWidth = isSidebar ? Math.min(360, width) : viewportWidth;
    const rectHeight = width <= 820 ? Math.max(560, height * 0.72) : height;
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: rectWidth,
      bottom: rectHeight,
      width: rectWidth,
      height: rectHeight,
      toJSON() { return this; }
    };
  };
  window.matchMedia = query => ({
    matches: query.includes("prefers-reduced-motion") ? false : false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() { return false; }
  });
  window.requestAnimationFrame = () => 1;
  window.cancelAnimationFrame = () => {};
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
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
    matchMedia: window.matchMedia,
    requestAnimationFrame: window.requestAnimationFrame,
    cancelAnimationFrame: window.cancelAnimationFrame,
    ResizeObserver: window.ResizeObserver,
    devicePixelRatio: 1,
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window),
    dispatchEvent: window.dispatchEvent.bind(window)
  };
  for (const [name, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  globalThis.__qaRenderers = [];
  window.addEventListener("error", event => errors.push(event.error?.stack || event.message));
  return dom;
}

function moduleScript(html) {
  const matches = [...html.matchAll(/<script\s+type="module"[^>]*>([\s\S]*?)<\/script>/g)];
  if (!matches.length) throw new Error("No module script found");
  return matches.at(-1)[1].replace(
    /from\s+["']\.\/advanced-lab-core\.js["']/g,
    `from ${JSON.stringify(coreUrl)}`
  );
}

function setRange(id, value) {
  const input = document.getElementById(id);
  if (!input) throw new Error(`Missing range #${id}`);
  input.value = String(value);
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
}

function click(id, times = 1) {
  const button = document.getElementById(id);
  if (!button) throw new Error(`Missing button #${id}`);
  for (let index = 0; index < times; index++) button.click();
}

function clickData(attribute, value) {
  const button = document.querySelector(`[${attribute}="${value}"]`);
  if (!button) throw new Error(`Missing [${attribute}="${value}"]`);
  button.click();
}

function tick(frames = 1, dt = 1 / 30) {
  for (let frame = 0; frame < frames; frame++) {
    for (const renderer of globalThis.__qaRenderers) {
      renderer.qaTime += dt * 1000;
      renderer.callback?.(renderer.qaTime);
    }
  }
}

const completeChallenge = {
  "mesh-editing-lab.html": () => {
    setRange("extrude", 12);
    setRange("inset", 70);
    setRange("bevel", 12);
    setRange("loops", 3);
  },
  "rigging-skinning-lab.html": () => {
    click("reachPreset");
    setRange("blend", 45);
    tick(4);
  },
  "texture-baking-lab.html": () => click("bake"),
  "raycasting-lab.html": () => {
    click("layers");
    click("selectNext", 3);
  },
  "optimization-lab.html": () => clickData("data-preset", "balanced"),
  "particle-vfx-lab.html": () => {
    setRange("rate", 50);
    tick(80, 0.04);
  },
  "shader-graph-lab.html": () => {
    setRange("noise", 35);
    click("emission");
  },
  "navigation-pathfinding-lab.html": () => {
    clickData("data-layout", "islands");
    click("run");
    tick(500, 0.05);
  },
  "sculpt-retopology-lab.html": () => {
    click("sampleStroke", 6);
    clickData("data-brush", "smooth");
    click("sampleStroke", 2);
  },
  "rendering-pipeline-lab.html": () => {
    clickData("data-mode", "path");
    setRange("samples", 6);
    click("denoise");
  },
  "asset-pipeline-lab.html": () => {
    click("transforms");
    click("compression");
    click("validate");
  },
  "accessibility-3d-lab.html": () => {
    setRange("contrast", 70);
    setRange("targetSize", 10);
    click("reducedMotion");
    click("alternateCues");
  }
};

async function loadPage(file, width, height, exercise) {
  const errors = [];
  const html = fs.readFileSync(path.join(workspace, "labs", file), "utf8");
  const dom = installDom(html, width, height, errors);
  const source = moduleScript(html);
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(`${source}\n//# sourceURL=${file}`).toString("base64")}#${Date.now()}-${Math.random()}`;
  await import(moduleUrl);
  tick(3);

  const canvas = document.querySelector("canvas.webgl");
  if (!canvas || canvas.width < 1 || canvas.height < 1) {
    throw new Error(`${file}: canvas did not initialize at ${width}x${height}`);
  }
  const challenge = document.getElementById("challenge");
  if (!challenge) throw new Error(`${file}: challenge is missing`);
  if (challenge.classList.contains("complete")) {
    throw new Error(`${file}: challenge starts complete`);
  }
  const unnamed = [...document.querySelectorAll("input, select")].filter(control =>
    !control.hasAttribute("aria-label") && !control.hasAttribute("aria-labelledby")
  );
  if (unnamed.length) {
    throw new Error(`${file}: ${unnamed.length} form controls lack accessible names`);
  }

  if (exercise) {
    completeChallenge[file]();
    tick(5);
    if (!challenge.classList.contains("complete")) {
      const status = document.getElementById("challengeStatus")?.textContent;
      throw new Error(`${file}: challenge path failed (${status})`);
    }
  }
  if (errors.length) throw new Error(`${file}: ${errors.join(" | ")}`);
  dom.window.close();
}

const failures = [];
for (const file of pages) {
  try {
    await loadPage(file, 1280, 720, true);
    await loadPage(file, 390, 844, false);
    console.log(`PASS ${file}`);
  } catch (error) {
    failures.push(error.stack || error.message);
    console.error(`FAIL ${file}: ${error.message}`);
  }
}

if (failures.length) {
  console.error(`\n${failures.length} advanced module QA failure(s).`);
  process.exitCode = 1;
} else {
  console.log(`\nPASS: initialized ${pages.length} modules at desktop and mobile sizes.`);
  console.log(`PASS: completed all ${pages.length} authored challenge paths through DOM controls.`);
}
