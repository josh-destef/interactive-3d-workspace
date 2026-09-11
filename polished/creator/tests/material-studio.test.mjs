import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const deps = path.join(os.tmpdir(), 'fundamentals-3d-qa/node_modules');
const threeURL = pathToFileURL(path.join(deps, 'three/build/three.module.js')).href;
const THREE = await import(threeURL);
const { JSDOM } = await import(pathToFileURL(path.join(deps, 'jsdom/lib/api.js')).href);
const dom = new JSDOM('<div id="wrap"><canvas></canvas></div>');
globalThis.document = dom.window.document;
globalThis.window = dom.window;
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
const data = text => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const modelPath = path.resolve(import.meta.dirname, '../js/materialModel.js');
const modelURL = data(fs.readFileSync(modelPath, 'utf8').replace("from 'three'", `from '${threeURL}'`).replaceAll('import.meta.url', JSON.stringify(pathToFileURL(modelPath).href)));
const { cloneMaterialModel } = await import(modelURL);
let environmentDisposed = false;
const generatedEnvironment = { texture: new THREE.Texture(), dispose() { environmentDisposed = true; } };
globalThis.__materialPMREM = class { fromScene() { return generatedEnvironment; } dispose() {} };
const roomURL = data('export class RoomEnvironment { dispose() {} }');
const studioPath = path.resolve(import.meta.dirname, '../js/lessons/materialStudio.js');
const studioURL = data(fs.readFileSync(studioPath, 'utf8')
  .replace("from 'three'", `from '${threeURL}'`)
  .replace("from 'three/addons/environments/RoomEnvironment.js'", `from '${roomURL}'`)
  .replace("from '../materialModel.js'", `from '${modelURL}'`)
  .replace('new THREE.PMREMGenerator(renderer)', 'new globalThis.__materialPMREM(renderer)'));
const { createMaterialStudio } = await import(studioURL);

const canvas = document.querySelector('canvas');
const rect = { left: 30, top: 70, width: 800, height: 600 };
canvas.getBoundingClientRect = () => rect;
canvas.parentElement.getBoundingClientRect = () => rect;
const photo = new Blob(['photo'], { type: 'image/png' });
canvas.toBlob = callback => callback(photo);
const scene = new THREE.Scene();
const originalEnvironment = new THREE.Texture();
scene.environment = originalEnvironment;
scene.background = new THREE.Color('#eeeeee');
const key = new THREE.PointLight('#ffcc99', 42);
key.position.set(2, 4, 6);
scene.add(key);
const camera = new THREE.PerspectiveCamera(44, 800 / 600, .01, 200);
const orbitCtrl = new THREE.EventDispatcher();
orbitCtrl.enabled = true;
const original = new THREE.Group();
original.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial({ name: 'Shell_Paint' })));
original.add(new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial({ name: 'Face_Glow' })));
const record = { color: '#336699', roughness: .7, metalness: .2, emissiveIntensity: .4 };
const student = cloneMaterialModel(original, record);
const host = new THREE.Group(); host.add(student); scene.add(host);
const outline = new THREE.Group(); outline.name = 'CreatorSelectionOutline'; scene.add(outline);
let photoWasClean = false, selectionRefreshes = 0, unsubscribed = false;
const renderer = { domElement: canvas, render() { photoWasClean = !outline.visible && !scene.getObjectByName('Scene light').visible; } };
const originalReset = () => {};
const viewport = {
  resetView: originalReset,
  setSelectionOutline(enabled) { outline.visible = enabled; },
  getSelectionOutline: () => outline.visible,
  getObject: () => host,
  cloneModel: material => cloneMaterialModel(original, material),
  refreshSelection() { selectionRefreshes++; },
  stage: { scene, renderer, camera, orbitCtrl, lights: { key }, flyTo({ pos, look }) {
    camera.position.copy(pos); camera.lookAt(look); camera.updateMatrixWorld(); orbitCtrl.dispatchEvent({ type: 'change' });
  } },
};
const studio = createMaterialStudio({ viewport, project: { subscribe: () => () => { unsubscribed = true; } } });
assert.ok(camera.view.offsetX < 0 && camera.view.offsetY > 0, 'desktop hero framing clears the lower-left card');
assert.ok(camera.position.length() < 7.2, 'hero framing brings material details closer');
window.innerWidth = 600;
studio.resetView();
assert.equal(camera.view.enabled, false, 'narrow framing has no projection offsets because guidance is below the viewport');
window.innerWidth = 1024;
studio.resetView();
const material = student.children[0].material;
const materialState = () => [material.color.getHexString(), material.roughness, material.metalness, material.emissiveIntensity];
const before = materialState();
studio.setRoomLights(false);
assert.equal(scene.environment, null, 'dark room removes all environment illumination');
assert.equal(key.intensity, 0, 'dark room disables direct light');
assert.equal(outline.visible, false, 'dark room does not make the selection outline look emissive');
assert.equal(student.children[1].material.emissiveIntensity, 1.6, 'face remains emissive in the dark');
studio.setLightAngle(90);
assert.equal(studio.getLightAngle(), 90, 'the scripted demonstration can read its current angle');
assert.deepEqual(materialState(), before, 'lighting never mutates the selected material');
assert.equal(typeof studio.setLightColor, 'undefined', 'the lesson does not expose light color controls');
studio.showReference({ color: '#cc6633', roughness: .2, metalness: 1 });
assert.ok(camera.view.offsetX === 0 && camera.view.offsetY > 80, 'comparison is centered above the lesson card');
assert.equal(outline.visible, false, 'comparison omits the learner-only orange outline');
assert.equal(key.position.x, 0, 'comparison light is centered between the subjects');
assert.equal(studio.getLightAngle(), 0, 'UI can resync after comparison centers the light');
assert.equal(key.color.getHexString(), 'ffffff', 'comparison uses neutral daylight');
assert.equal(student.position.x, 1.72);
assert.equal(scene.getObjectByName('Reference Gizmobot').position.x, -1.72);
assert.deepEqual(materialState(), before, 'reference creation preserves learner material');
const labels = [...document.querySelectorAll('.material-model-label')];
assert.deepEqual(labels.map(label => label.textContent), ['Reference', 'Your material']);
assert.ok(labels.every(label => !label.hidden && Number.isFinite(parseFloat(label.style.left))), 'visible labels are projected into the viewport');
studio.hideReference();
assert.equal(student.position.x, 0);
assert.equal(outline.visible, true, 'normal studio restores the selected-object outline');
assert.ok(labels.every(label => label.hidden), 'comparison labels disappear outside matching');
assert.equal(selectionRefreshes, 2, 'selection outline tracks both comparison layouts');
studio.setLightVisible(true);
assert.ok(camera.position.z >= 10 && camera.view.offsetY <= 16, 'light handle gets wider framing without excessive upward shift');
for (const angle of [-180, -135, -90, -45, 0, 45, 90, 135, 180]) {
  studio.setLightAngle(angle);
  const projected = scene.getObjectByName('Scene light').position.clone().project(camera);
  assert.ok(Math.abs(projected.x) < .9 && Math.abs(projected.y) < .9, `light orbit remains inside the viewport at ${angle} degrees`);
}
window.innerWidth = 600;
rect.width = 360; rect.height = 400;
camera.aspect = rect.width / rect.height;
studio.resetView();
for (const angle of [-180, -90, 0, 90, 180]) {
  studio.setLightAngle(angle);
  const projected = scene.getObjectByName('Scene light').position.clone().project(camera);
  assert.ok(Math.abs(projected.x) < .9 && Math.abs(projected.y) < .9, `narrow light orbit remains visible at ${angle} degrees`);
}
window.innerWidth = 1024;
rect.width = 800; rect.height = 600;
studio.resetView();
assert.equal(await studio.capture({ download: false }), photo);
assert.equal(photoWasClean, true, 'capture omits editing overlays');
assert.equal(outline.visible, true, 'capture restores selection overlay');
canvas.toBlob = callback => callback(null);
await assert.rejects(studio.capture({ download: false }), /could not be captured/);
assert.equal(outline.visible, true, 'failed capture also restores overlays');
studio.showReference(record);
studio.dispose();
assert.equal(student.position.x, 0, 'disposing during matching restores the student pose');
assert.equal(scene.environment, originalEnvironment);
assert.equal(key.intensity, 42);
assert.deepEqual(key.position.toArray(), [2, 4, 6]);
assert.equal(key.color.getHexString(), 'ffcc99');
assert.equal(viewport.resetView, originalReset);
assert.equal(document.querySelectorAll('.material-model-label').length, 0);
assert.equal(environmentDisposed && unsubscribed, true, 'owned environment and listeners are released');
studio.dispose();
dom.window.close();
console.log('PASS material studio isolates lighting, compares semantic models, labels subjects, captures cleanly and restores resources');
