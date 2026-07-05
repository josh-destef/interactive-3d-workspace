import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export { THREE };

export function createLab({
  canvas = document.querySelector("canvas.webgl"),
  background = 0xf4f4ef,
  cameraPosition = [7, 5, 8],
  target = [0, 1.5, 0],
  fov = 44,
  floor = true
} = {}) {
  const viewport = canvas.parentElement;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);

  const camera = new THREE.PerspectiveCamera(fov, 1, 0.05, 200);
  camera.position.fromArray(cameraPosition);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const orbit = new OrbitControls(camera, canvas);
  orbit.enableDamping = true;
  orbit.target.fromArray(target);
  orbit.minDistance = 2.4;
  orbit.maxDistance = 30;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x657188, 2.35));
  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(6, 10, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  key.shadow.camera.left = -12;
  key.shadow.camera.right = 12;
  key.shadow.camera.top = 12;
  key.shadow.camera.bottom = -12;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x8bb6ff, 1.5);
  rim.position.set(-6, 4, -5);
  scene.add(rim);

  let floorMesh = null;
  if (floor) {
    floorMesh = new THREE.Mesh(
      new THREE.CircleGeometry(12, 72),
      new THREE.MeshStandardMaterial({ color: 0xe7e8e2, roughness: 0.96 })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);
  }

  function resize() {
    const rect = viewport.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  addEventListener("resize", resize);
  resize();

  document.querySelectorAll("input, select").forEach(control => {
    if (control.hasAttribute("aria-label") || control.hasAttribute("aria-labelledby")) return;
    const text = control.closest(".control")?.querySelector(".control-head span")?.textContent?.trim();
    if (text) control.setAttribute("aria-label", text);
  });

  return { scene, camera, renderer, orbit, viewport, canvas, floor: floorMesh, resize };
}

export function startLoop(lab, update = () => {}) {
  let previous = performance.now();
  lab.renderer.setAnimationLoop(now => {
    const dt = Math.min((now - previous) / 1000, 0.05);
    previous = now;
    update(dt, now / 1000);
    lab.orbit?.update();
    lab.renderer.render(lab.scene, lab.camera);
  });
}

export function standardMaterial(color = 0xff9022, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.48,
    metalness: 0.03,
    ...options
  });
}

export function addMesh(scene, geometry, material, position = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.fromArray(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

export function lineBetween(a, b, color = 0x172033, opacity = 1) {
  const geometry = new THREE.BufferGeometry().setFromPoints([a, b]);
  return new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity })
  );
}

export function makeLabel(text, color = "#172033", background = "rgba(255,255,255,.92)") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.fillStyle = background;
  context.roundRect(8, 8, 496, 112, 24);
  context.fill();
  context.fillStyle = color;
  context.font = "600 40px Lexend, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 256, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(2.4, 0.6, 1);
  return sprite;
}

export function bindRange(id, format, callback, valueId = `${id}Value`) {
  const input = document.getElementById(id);
  const output = document.getElementById(valueId);
  const update = () => {
    const value = Number(input.value);
    const formatted = format(value);
    if (output) output.textContent = formatted;
    input.setAttribute("aria-valuetext", formatted);
    callback(value, input);
  };
  input.addEventListener("input", update);
  update();
  return input;
}

export function bindToggle(id, callback, onLabel, offLabel, initial = false) {
  const button = document.getElementById(id);
  let active = initial;
  const update = () => {
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.textContent = active ? onLabel : offLabel;
    callback(active);
  };
  button.addEventListener("click", () => {
    active = !active;
    update();
  });
  update();
  return {
    get active() { return active; },
    set(value) { active = Boolean(value); update(); }
  };
}

export function setChallenge(complete, status, challenge = document.getElementById("challenge")) {
  challenge?.classList.toggle("complete", complete);
  const output = document.getElementById("challengeStatus");
  if (output) output.textContent = status;
}

export function setMeter(id, ratio, warnAt = 0.72) {
  const fill = document.getElementById(id);
  if (!fill) return;
  const clamped = THREE.MathUtils.clamp(ratio, 0, 1);
  fill.style.width = `${clamped * 100}%`;
  fill.style.background = clamped > 0.9 ? "var(--red)" : clamped > warnAt ? "var(--orange)" : "var(--green)";
}

export function disposeObject(object) {
  object.traverse?.(child => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach(material => material.dispose?.());
    else child.material?.dispose?.();
  });
  object.removeFromParent();
}

export function seededRandom(seed = 1) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
