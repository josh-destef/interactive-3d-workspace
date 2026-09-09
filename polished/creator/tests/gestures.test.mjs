import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { connect } from './browser-session.mjs';

const root = path.resolve(import.meta.dirname, '../../..');
const output = path.join(root, 'polished/creator/qa/gesture-results.json');
const session = await connect();
const checks = [];
const check = (condition, label) => { assert.ok(condition, label); checks.push(label); };
const near = (a, b, epsilon = 1e-5) => Math.abs(a - b) < epsilon;
const changed = (a, b, epsilon = 1e-4) => Math.abs(a - b) > epsilon;
const evaluate = session.evaluate;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

try {
  await session.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  // A previous QA script may have removed the public API. A navigation always
  // creates a fresh module graph and authoritative project before gestures.
  await session.send('Page.navigate', { url: 'http://127.0.0.1:8000/polished/creator/' });
  await session.wait('window.creator && document.querySelector("#loading").hidden', 20000);
  await session.wait('window.creator.viewport.getObject("gizmobot")?.children.length > 0', 20000);

  const cameraState = () => evaluate(`({pos:creator.viewport.stage.camera.position.toArray(),target:creator.viewport.stage.orbitCtrl.target.toArray()})`);
  const canvasRect = await evaluate(`(()=>{const r=document.querySelector('#cv').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()`);
  const empty = { x: canvasRect.x + canvasRect.w * .78, y: canvasRect.y + canvasRect.h * .32 };
  let before = await cameraState();
  await session.mouse('mousePressed', empty.x, empty.y, { button: 'left', buttons: 1, clickCount: 1 });
  await session.mouse('mouseMoved', empty.x + 95, empty.y + 45, { button: 'left', buttons: 1 });
  await session.mouse('mouseReleased', empty.x + 95, empty.y + 45, { button: 'left', buttons: 0, clickCount: 1 });
  await pause(150);
  let after = await cameraState();
  check(after.pos.some((value, i) => changed(value, before.pos[i])), 'Left drag orbits the camera');
  check((await evaluate('creator.project.selection.activeId')) === null, 'Orbit drag does not create a selection');

  before = after;
  await session.mouse('mousePressed', empty.x, empty.y, { button: 'right', buttons: 2, clickCount: 1 });
  await session.mouse('mouseMoved', empty.x + 75, empty.y + 30, { button: 'right', buttons: 2 });
  await session.mouse('mouseReleased', empty.x + 75, empty.y + 30, { button: 'right', buttons: 0, clickCount: 1 });
  await pause(120);
  after = await cameraState();
  check(after.target.some((value, i) => changed(value, before.target[i])), 'Right drag pans the orbit target');

  const distanceBefore = Math.hypot(...before.pos.map((v, i) => v - before.target[i]));
  await session.mouse('mouseWheel', empty.x, empty.y, { deltaY: -240, deltaX: 0 });
  await pause(150);
  after = await cameraState();
  const distanceAfter = Math.hypot(...after.pos.map((v, i) => v - after.target[i]));
  check(changed(distanceAfter, distanceBefore), 'Mouse wheel zooms the camera');
  await session.click('#reset-view'); await pause(80);
  after = await cameraState();
  check(after.pos.every((v, i) => near(v, [5.8, 4.1, 8.2][i], .025)), 'Reset View restores the home camera');

  await session.click('[data-tool="add"]');
  await session.click('[data-shape="cube"]');
  await session.wait('creator.project.selection.activeId?.startsWith("cube-")');
  const cubeId = await evaluate('creator.project.selection.activeId');
  check((await evaluate('creator.project.entities.filter(e=>e.type!=="group"&&e.type!=="gizmobot").length')) === 1, 'Gesture scene starts with one fresh cube');
  await session.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'f', code: 'KeyF' });
  await session.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'f', code: 'KeyF' });
  await pause(80);
  after = await cameraState();
  const cubeWorld = await evaluate(`creator.viewport.getObject(${JSON.stringify(cubeId)}).getWorldPosition(new creator.viewport.stage.camera.position.constructor()).toArray()`);
  check(Math.hypot(...after.target.map((v, i) => v - cubeWorld[i])) < .01, 'F focuses the selected object');

  // Returns an unambiguous screen point on the requested shared gizmo hit
  // region, plus useful projected directions for the drag itself.
  const handleInfo = (kind, axis = null) => evaluate(`(async()=>{
    const THREE=await import('three');const stage=creator.viewport.stage,layer=stage.scene.getObjectByName('TransformGizmos');
    stage.scene.updateMatrixWorld(true);stage.camera.updateMatrixWorld(true);
    let handle=null;layer.traverse(h=>{if(!handle&&h._kind===${JSON.stringify(kind)}&&(${JSON.stringify(axis)}===null||h._axKey===${JSON.stringify(axis)}))handle=h;});
    if(!handle)throw Error('Missing handle ${kind} ${axis}');
    let world;
    if(handle._kind==='rotate')world=handle.localToWorld(new THREE.Vector3(.85,0,0));
    else if(handle._kind==='scaleUniform')world=handle.localToWorld(new THREE.Vector3(.955,.955,0));
    else world=handle.children.find(n=>n._isHit).getWorldPosition(new THREE.Vector3());
    const pivot=handle.position.clone(),axis=new THREE.Vector3(${axis === 'x' ? 1 : 0},${axis === 'y' ? 1 : 0},${axis === 'z' ? 1 : 0});
    if(handle._kind==='scaleAxis')axis.applyQuaternion(creator.viewport.getObject(${JSON.stringify(cubeId)}).getWorldQuaternion(new THREE.Quaternion()));
    const rect=document.querySelector('#cv').getBoundingClientRect();
    const screen=v=>{v=v.clone().project(stage.camera);return {x:rect.x+(v.x+1)*rect.width/2,y:rect.y+(1-v.y)*rect.height/2}};
    const p=screen(world),c=screen(pivot),a=screen(pivot.clone().add(axis));const len=Math.hypot(a.x-c.x,a.y-c.y)||1;
    return {x:p.x,y:p.y,cx:c.x,cy:c.y,dx:(a.x-c.x)/len,dy:(a.y-c.y)/len};
  })()`);
  const transform = () => evaluate(`structuredClone(creator.project.get(${JSON.stringify(cubeId)}).components.transform)`);
  const inspectorValues = () => evaluate(`[...document.querySelectorAll('.transform-group')].map(g=>[...g.querySelectorAll('input')].map(i=>Number(i.value)))`);
  const dragHandle = async (kind, axis, destination) => {
    const info = await handleInfo(kind, axis);
    const end = destination(info);
    await session.mouse('mouseMoved', info.x, info.y, { button: 'none', buttons: 0 });
    await session.mouse('mousePressed', info.x, info.y, { button: 'left', buttons: 1, clickCount: 1 });
    await session.mouse('mouseMoved', end.x, end.y, { button: 'left', buttons: 1 });
    return { info, end };
  };

  await session.click('[data-tool="move"]');
  for (const [axis, index] of [['x', 0], ['y', 1], ['z', 2]]) {
    const start = await transform();
    const { end } = await dragHandle('move', axis, h => ({ x: h.x + h.dx * 55, y: h.y + h.dy * 55 }));
    const live = await transform(), fields = await inspectorValues();
    check(changed(live.position[index], start.position[index]), `Move ${axis.toUpperCase()} gesture updates the project live`);
    check(near(fields[0][index], live.position[index], .011), `Move ${axis.toUpperCase()} updates the numeric Inspector during drag`);
    await session.mouse('mouseReleased', end.x, end.y, { button: 'left', buttons: 0, clickCount: 1 });
    await session.click('#undo');
    check(near((await transform()).position[index], start.position[index]), `Move ${axis.toUpperCase()} is one undo action`);
    await session.click('#redo');
  }

  await session.click('[data-tool="rotate"]');
  for (const [axis, index] of [['x', 0], ['y', 1], ['z', 2]]) {
    const start = await transform();
    const { end } = await dragHandle('rotate', axis, h => {
      const vx=h.x-h.cx,vy=h.y-h.cy,a=.42;return {x:h.cx+vx*Math.cos(a)-vy*Math.sin(a),y:h.cy+vx*Math.sin(a)+vy*Math.cos(a)};
    });
    const live = await transform(), fields = await inspectorValues();
    check(changed(live.rotation[index], start.rotation[index]), `Rotate ${axis.toUpperCase()} gesture writes radians live`);
    check(near(fields[1][index], live.rotation[index] * 180 / Math.PI, .11), `Rotate ${axis.toUpperCase()} updates Inspector degrees during drag`);
    await session.mouse('mouseReleased', end.x, end.y, { button: 'left', buttons: 0, clickCount: 1 });
  }

  await session.click('[data-tool="scale"]');
  for (const [axis, index] of [['x', 0], ['y', 1], ['z', 2]]) {
    const start = await transform();
    const { end } = await dragHandle('scaleAxis', axis, h => ({ x: h.x + h.dx * 45, y: h.y + h.dy * 45 }));
    const live = await transform(), fields = await inspectorValues();
    check(changed(live.scale[index], start.scale[index]), `Scale ${axis.toUpperCase()} gesture updates one axis live`);
    check(near(fields[2][index], live.scale[index], .011), `Scale ${axis.toUpperCase()} updates numeric Inspector during drag`);
    await session.mouse('mouseReleased', end.x, end.y, { button: 'left', buttons: 0, clickCount: 1 });
  }
  let start = await transform();
  let result = await dragHandle('scaleUniform', null, h => ({ x: h.cx + (h.x-h.cx)*1.3, y: h.cy + (h.y-h.cy)*1.3 }));
  let live = await transform();
  check(live.scale.every((value, i) => changed(value, start.scale[i])), 'Uniform scale gesture changes all axes');
  await session.mouse('mouseReleased', result.end.x, result.end.y, { button: 'left', buttons: 0, clickCount: 1 });

  await session.click('[data-tool="move"]');
  start = await transform();
  result = await dragHandle('move', 'x', h => ({ x: h.x + h.dx * 70, y: h.y + h.dy * 70 }));
  check(changed((await transform()).position[0], start.position[0]), 'Transform changes before Escape');
  await session.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await session.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
  check(near((await transform()).position[0], start.position[0]), 'Escape cancels the active gizmo transaction');

  const countBefore = await evaluate('creator.project.entities.length');
  await session.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'd', code: 'KeyD', modifiers: 2 });
  await session.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'd', code: 'KeyD', modifiers: 2 });
  check((await evaluate('creator.project.entities.length')) === countBefore + 1, 'Ctrl+D duplicates through the keyboard handler');
  await session.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Delete', code: 'Delete' });
  await session.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Delete', code: 'Delete' });
  check((await evaluate('creator.project.entities.length')) === countBefore, 'Delete removes the keyboard-selected duplicate');
  await session.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'z', code: 'KeyZ', modifiers: 2 });
  await session.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'z', code: 'KeyZ', modifiers: 2 });
  check((await evaluate('creator.project.entities.length')) === countBefore + 1, 'Ctrl+Z undoes Delete');
  await session.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'y', code: 'KeyY', modifiers: 2 });
  await session.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'y', code: 'KeyY', modifiers: 2 });
  check((await evaluate('creator.project.entities.length')) === countBefore, 'Ctrl+Y redoes Delete');

  await evaluate(`creator.project.selection.set(${JSON.stringify(cubeId)})`);
  const enterNumber = async (selector, value) => {
    const point = await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await session.mouse('mousePressed', point.x, point.y, { button: 'left', buttons: 1, clickCount: 3 });
    await session.mouse('mouseReleased', point.x, point.y, { button: 'left', buttons: 0, clickCount: 3 });
    await session.send('Input.insertText', { text: String(value) });
  };
  await enterNumber('.transform-group:nth-of-type(1) .axis-x input', 20);
  await enterNumber('.transform-group:nth-of-type(1) .axis-y input', 12);
  await enterNumber('.transform-group:nth-of-type(1) .axis-z input', 0);
  check((await transform()).position.every((v, i) => near(v, [20, 12, 0][i], .01)), 'Inspector places an object beyond lesson bounds');
  await session.click('#focus-selected');
  await pause(80);
  const far = await cameraState();
  check(Math.hypot(far.target[0] - 20, far.target[1] - 12, far.target[2]) < .05, 'Focus reaches a selected object outside lesson camera limits');

  check(session.errors.length === 0, 'No browser runtime errors during gestures');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify({ checks, errors: session.errors }, null, 2) + '\n');
  console.log(`PASS ${checks.length} real pointer and keyboard gesture checks`);
} catch (error) {
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify({ checks, errors: [...session.errors, String(error.stack || error)] }, null, 2) + '\n');
  throw error;
} finally {
  session.close();
}
