import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '../../..');
const deps = path.join(os.tmpdir(), 'fundamentals-3d-qa/node_modules');
const threeURL = pathToFileURL(path.join(deps, 'three/build/three.module.js')).href;
const jsdomURL = pathToFileURL(path.join(deps, 'jsdom/lib/api.js')).href;
const THREE = await import(threeURL);
const { JSDOM } = await import(jsdomURL);
const data = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

const dom = new JSDOM('<div id="canvas-wrap"><canvas id="cv"></canvas></div>', { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.addEventListener = dom.window.addEventListener.bind(dom.window);
globalThis.removeEventListener = dom.window.removeEventListener.bind(dom.window);
globalThis.devicePixelRatio = 1;
globalThis.matchMedia = () => ({ matches: false });
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
globalThis.ResizeObserver = class { observe() {} disconnect() { this.disconnected = true; } };
const canvas = document.getElementById('cv');
const wrap = document.getElementById('canvas-wrap');
Object.defineProperties(wrap, { clientWidth: { value: 800 }, clientHeight: { value: 600 } });
canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 });
canvas.setPointerCapture = () => {};
canvas.releasePointerCapture = () => {};

class OrbitControls extends THREE.EventDispatcher {
  constructor(camera) { super(); this.object = camera; this.target = new THREE.Vector3(); this.enabled = true; this.disposed = false; }
  update() { this.object.lookAt(this.target); this.object.updateMatrixWorld(true); }
  dispose() { this.disposed = true; }
}
class Renderer {
  constructor() { this.shadowMap = {}; this.disposed = false; }
  setPixelRatio() {} setSize() {} setClearColor() {} render() {}
  dispose() { this.disposed = true; }
}
class Clock { getDelta() { return .016; } }
const stageSource = `
  import * as THREE from '${threeURL}';
  export const V3=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
  export function createStage({position=[5.8,4.1,8.2],target=[0,0.9,0]}={}){
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(44,4/3,.01,200);
    camera.position.fromArray(position);const orbitCtrl=new globalThis.__viewportTest.OrbitControls(camera);orbitCtrl.target.fromArray(target);orbitCtrl.update();
    const renderer=new globalThis.__viewportTest.Renderer();const clock=new globalThis.__viewportTest.Clock();
    const resize=()=>{};addEventListener('resize',resize);
    const flyTo=(preset)=>{camera.position.copy(preset.pos);orbitCtrl.target.copy(preset.look);orbitCtrl.update();};
    const stage={scene,camera,orbitCtrl,renderer,clock,resize,flyTo,tickCam(){orbitCtrl.update();}};globalThis.__viewportTest.stage=stage;return stage;
  }`;
class Loader {
  async loadAsync() {
    const scene = new THREE.Group(); scene.name = 'LoadedGizmobot';
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial({ color: 0xff9022 }));
    mesh.name = 'GizmobotMesh'; scene.add(mesh); return { scene };
  }
}
globalThis.__viewportTest = { OrbitControls, Renderer, Clock, Loader, stage: null };
const loaderURL = data('export const GLTFLoader=globalThis.__viewportTest.Loader;');
const orbitURL = data('export const OrbitControls=globalThis.__viewportTest.OrbitControls;');

const gizmoPath = path.join(root, 'polished/kit/js/transformGizmos.js');
const gizmoURL = data(fs.readFileSync(gizmoPath, 'utf8').replace("from 'three'", `from '${threeURL}'`));
const viewportPath = path.join(root, 'polished/creator/js/viewport.js');
const viewportURL = data(fs.readFileSync(viewportPath, 'utf8')
  .replace("from 'three'", `from '${threeURL}'`)
  .replace("from 'three/addons/loaders/GLTFLoader.js'", `from '${loaderURL}'`)
  .replace("from 'three/addons/controls/OrbitControls.js'", `from '${orbitURL}'`)
  .replace("from '../../kit/js/stage.js'", `from '${data(stageSource)}'`)
  .replace("from '../../kit/js/transformGizmos.js'", `from '${gizmoURL}'`)
  .replaceAll('import.meta.url', JSON.stringify(pathToFileURL(viewportPath).href)));

const projectURL = pathToFileURL(path.join(root, 'polished/creator/js/project.js')).href;
const [{ createViewport }, { createProject }] = await Promise.all([import(viewportURL), import(projectURL)]);
const project = createProject();
const toolListeners = new Set();
let activeTool = 'select';
const tools = {
  getActive: () => activeTool, isAllowed: () => true,
  setActive(value) { activeTool = value; toolListeners.forEach(fn => fn(value)); },
  subscribe(fn) { toolListeners.add(fn); return () => toolListeners.delete(fn); },
};
const viewport = createViewport({ project, tools });
await viewport.ready;

assert.deepEqual(viewport.getObject('gizmobot').position.toArray(), [-2, 0, 0], 'initial project transform is reflected');
assert.equal(viewport.getObject('gizmobot').children[0].name, 'LoadedGizmobot', 'Gizmobot loads under one high-level entity');
const cube = project.addPrimitive('cube');
const sphere = project.addPrimitive('sphere');
const group = project.group([cube.id, sphere.id]);
assert.equal(viewport.getObject(cube.id).parent, viewport.getObject(group.id), 'derived hierarchy follows project parents');
project.updateTransform(group.id, { position: [2, 1, -1], rotation: [0, Math.PI / 3, 0], scale: [1, 1, 1] });
viewport.getObject(cube.id).updateWorldMatrix(true, false);
assert.deepEqual(viewport.getObject(group.id).rotation.toArray().slice(0, 3), [0, Math.PI / 3, 0], 'rotation stays in radians');
const cubeObject = viewport.getObject(cube.id);
const cubeGeometry = cubeObject.geometry;
let earlyDisposals = 0;
const originalDispose = cubeGeometry.dispose.bind(cubeGeometry);
cubeGeometry.dispose = () => { earlyDisposals++; originalDispose(); };
project.ungroup(group.id);
assert.equal(viewport.getObject(cube.id), cubeObject, 'ungroup reparents a surviving object instead of rebuilding it');
assert.equal(earlyDisposals, 0, 'removing an ancestor does not dispose a surviving descendant');

// Renderer-attached helpers and future component visuals must survive a mesh
// rebuild even though geometry and material resources are replaced.
const childBefore = new THREE.Object3D();
childBefore.name = 'ComponentVisual';
viewport.getObject(cube.id).add(childBefore);
project.updateGeometry(cube.id, { width: 2 });
assert.equal(viewport.getObject(cube.id).getObjectByName('ComponentVisual'), childBefore, 'geometry rebuild preserves an attached component visual');
assert.equal(childBefore.parent, viewport.getObject(cube.id), 'preserved child is attached to replacement mesh');
project.updateMaterial(cube.id, { color: '#123456' });
assert.equal(viewport.getObject(cube.id).getObjectByName('ComponentVisual'), childBefore, 'material rebuild also preserves attached children');

// Hiding an ancestor hides selection feedback and prevents click-through.
project.selection.set(sphere.id);
project.setVisible('creation', false);
const outline = viewport.stage.scene.getObjectByName('CreatorSelectionOutline');
assert.equal(outline.visible, false, 'outline respects inherited visibility');
const click = type => canvas.dispatchEvent(new dom.window.MouseEvent(type, { clientX: 400, clientY: 300, button: 0, bubbles: true }));
click('pointerdown'); click('pointerup');
assert.notEqual(project.selection.activeId, sphere.id, 'picking cannot select through an invisible ancestor');

const gizmoCopy = project.duplicate('gizmobot');
assert.equal(viewport.getObject(gizmoCopy.id).getObjectByName('GizmobotMesh').isMesh, true, 'duplicated Gizmobot gets an independent loaded mesh');
project.remove(gizmoCopy.id);
assert.equal(viewport.getObject(gizmoCopy.id), null, 'removed Gizmobot leaves the derived scene');
project.history.undo();
assert.equal(viewport.getObject(gizmoCopy.id).getObjectByName('GizmobotMesh').isMesh, true, 'undo restores Gizmobot render content');

const renderer = viewport.stage.renderer, orbit = viewport.stage.orbitCtrl;
viewport.dispose();
assert.equal(renderer.disposed, true, 'renderer is disposed');
assert.equal(orbit.disposed, true, 'orbit controls are disposed');
assert.equal(viewport.getObject('gizmobot'), null, 'derived object registry is cleared');
dom.window.close();
delete globalThis.__viewportTest;
console.log('PASS viewport derives hierarchy/resources, respects inherited visibility, restores Gizmobot and disposes cleanly');
