import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const lab = path.join(root, 'polished/labs/hierarchy-gizmobot');
const threeUrl = pathToFileURL(path.join(os.tmpdir(), 'fundamentals-3d-qa/node_modules/three/build/three.module.js')).href;
const THREE = await import(threeUrl);
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const stageUrl = moduleUrl(`import * as THREE from '${threeUrl}'; export const scene = new THREE.Scene();`);
const { scene } = await import(stageUrl);
const configUrl = moduleUrl(fs.readFileSync(path.join(lab,'js/config.js'),'utf8').replaceAll('?v=selector5','').replace("import { V3 } from './utils.js';", `import * as THREE from '${threeUrl}'; const V3 = (x,y,z) => new THREE.Vector3(x,y,z);`));
const { START_POSE, POSE_PRESETS, PICKUP_POS } = await import(configUrl);
const glb = fs.readFileSync(path.join(lab,'assets/gizmobot-arm.glb'));
const jsonLength = glb.readUInt32LE(12);
const doc = JSON.parse(glb.subarray(20,20+jsonLength));
// Build the real asset hierarchy without browser-only image decoding.
const loaderUrl = moduleUrl(`import * as THREE from '${threeUrl}';
const doc = ${JSON.stringify(doc)};
export class GLTFLoader { async loadAsync() {
  const nodes = doc.nodes.map(n => {
    const o = n.mesh === undefined ? new THREE.Group() : new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1), new THREE.MeshStandardMaterial());
    o.name=n.name; if(n.translation)o.position.fromArray(n.translation); if(n.scale)o.scale.fromArray(n.scale); return o;
  });
  doc.nodes.forEach((n,i)=>(n.children||[]).forEach(j=>nodes[i].add(nodes[j])));
  const scene=new THREE.Group(); doc.scenes[doc.scene].nodes.forEach(i=>scene.add(nodes[i])); return {scene};
}}`);
const source = fs.readFileSync(path.join(lab,'js/arm.js'),'utf8').replaceAll('?v=selector5','')
  .replace("from 'three'",`from '${threeUrl}'`)
  .replace("from './stage.js'",`from '${stageUrl}'`)
  .replace("from './config.js'",`from '${configUrl}'`)
  .replace("from 'three/addons/loaders/GLTFLoader.js'",`from '${loaderUrl}'`);
const arm = await import(moduleUrl(source));
await arm.armReady;
const get = name => scene.getObjectByName(name);
const world = name => { scene.updateMatrixWorld(true); return get(name).getWorldPosition(new THREE.Vector3()); };
const matrix = name => { scene.updateMatrixWorld(true); return get(name).matrixWorld.clone(); };
assert.deepEqual(get('LeftHand').children.filter(o=>['Mitt','Pointer','Thumb'].includes(o.name)).map(o=>o.name).sort(), ['Mitt','Pointer','Thumb']);
assert.equal(get('LeftHand').parent.name, 'LeftForearm');
assert.equal(get('LeftForearm').parent.name, 'LeftUpperArm');
for (const [key,name] of Object.entries({mitt:'Mitt',pointer:'Pointer',thumb:'Thumb'})) {
  arm.setJoints(START_POSE);
  const pivot=world(name), parent=matrix('LeftHand');
  const siblings=['Mitt','Pointer','Thumb'].filter(n=>n!==name).map(n=>[n,matrix(n)]);
  const before=matrix(name);
  arm.setJoint(key,50);
  assert.ok(world(name).distanceTo(pivot)<1e-7, `${name} hinge moved`);
  assert.ok(!matrix(name).equals(before), `${name} did not rotate`);
  assert.ok(matrix('LeftHand').equals(parent), 'finger moved parent');
  for(const [n,m] of siblings) assert.ok(matrix(n).equals(m), 'finger moved sibling');
}
arm.selectNode('mitt');
const local=arm.localPosition().clone(), before=arm.worldPosition().clone();
arm.setJoint('shoulder',40);
assert.ok(arm.localPosition().equals(local));
assert.ok(arm.worldPosition().distanceTo(before)>.1);
arm.setJoint('grip',100);
assert.deepEqual([arm.joints.mitt,arm.joints.pointer,arm.joints.thumb],[85,85,70]);
arm.setJoint('pointer',0); assert.equal(arm.joints.grip,0);
arm.setJoints(START_POSE); arm.resetPickup();
arm.setJoints(POSE_PRESETS.reach); assert.ok(arm.isHeld(),'Reach preset must catch the block');
const held=get('LeftHand').children.find(o=>o.isMesh && o.geometry.type==='BoxGeometry' && o.geometry.parameters.width===.92);
assert.ok(held); assert.ok(held.getWorldPosition(new THREE.Vector3()).distanceTo(PICKUP_POS)<1e-5,'pickup snapped');
arm.setJoint('base',40); assert.ok(held.getWorldPosition(new THREE.Vector3()).distanceTo(PICKUP_POS)>.2);
arm.setJoint('thumb',0); assert.ok(!arm.isHeld(),'opening a finger must release');
for (const pose of Object.values(POSE_PRESETS)) {
  arm.setJoints(pose);
  for(const name of ['LeftUpperArm','LeftForearm','LeftHand','Mitt','Pointer','Thumb']) assert.ok(matrix(name).elements.every(Number.isFinite));
}
console.log('PASS: three sibling fingers, fixed hinges, independent rotation, inherited transforms, grip coupling, Reach pickup without snapping, release and finite presets.');

const {JSDOM}=await import(pathToFileURL(path.join(os.tmpdir(),'fundamentals-3d-qa/node_modules/jsdom/lib/api.js')).href);
const dom=new JSDOM(fs.readFileSync(path.join(lab,'index.html'),'utf8'));
globalThis.document=dom.window.document;
globalThis.CustomEvent=dom.window.CustomEvent;
const read=name=>fs.readFileSync(path.join(lab,'js',name+'.js'),'utf8').replaceAll('?v=selector5','');
const utilsUrl=moduleUrl(read('utils').replace("from 'three'",`from '${threeUrl}'`));
const animUrl=moduleUrl(read('anim').replace("from './utils.js'",`from '${utilsUrl}'`));
const armUrl=moduleUrl(source);
const controlsUrl=moduleUrl(read('controls').replace("from './config.js'",`from '${configUrl}'`).replace("from './anim.js'",`from '${animUrl}'`).replace("from './arm.js'",`from '${armUrl}'`));
const uiUrl=moduleUrl(read('ui').replace("from './config.js'",`from '${configUrl}'`));
const stateUrl=moduleUrl(read('state'));
const lessonStageUrl=moduleUrl('export function setCam() {} export const orbitCtrl={enabled:true};');
let lessonSource=read('beats');
for(const [name,url] of Object.entries({config:configUrl,state:stateUrl,stage:lessonStageUrl,anim:animUrl,arm:armUrl,controls:controlsUrl,ui:uiUrl})) lessonSource=lessonSource.replace(`from './${name}.js'`,`from '${url}'`);
const lesson=await import(moduleUrl(lessonSource));
const controls=await import(controlsUrl);
const animation=await import(animUrl);

const available=()=>[...document.querySelectorAll('#part-picker button')].filter(b=>!b.hidden).map(b=>b.dataset.part);
assert.equal(document.getElementById('readout'),null);
lesson.runBeat(0); 
assert.equal(document.getElementById('motion-tabs'),null);
assert.equal(document.querySelectorAll('#movement-sliders input').length,3);
lesson.replayBeat(); assert.equal(document.querySelector('#movement-sliders input').disabled,true);
for(let i=0;i<80;i++) animation.tickAnims(.05);
assert.equal(document.querySelector('#movement-sliders input').disabled,false);
lesson.nextBeat(); 
assert.equal(document.querySelectorAll('#movement-sliders input').length,3);
assert.deepEqual(arm.getInfluencedParts('elbow'),['elbow','wrist','mitt','pointer','thumb']);
assert.equal(document.querySelector('[data-chain=elbow]').getAttribute('aria-current'),'step');
assert.ok(document.querySelector('[data-chain=wrist]').classList.contains('following'));
assert.ok(!document.querySelector('[data-chain=shoulder]').classList.contains('following'));
lesson.nextBeat(); 
assert.equal(document.querySelectorAll('#movement-sliders input').length,3);
lesson.nextBeat(); 
lesson.nextBeat(); 
document.getElementById('btn-reach-help').click();
for(let i=0;i<25;i++) animation.tickAnims(.05);
assert.equal(arm.getCatchState(),'ready');
arm.tickArm(.05);
const targetHalo=scene.children.find(o=>o.geometry?.type==='TorusGeometry');
assert.equal(targetHalo.material.color.getHex(),0x26964d);
const gripInput=document.getElementById('slider-grip');gripInput.value='100';gripInput.dispatchEvent(new dom.window.Event('input'));
assert.ok(arm.isHeld());
assert.equal(arm.getCatchState(),'held');
for(let i=0;i<60;i++) arm.tickArm(1/60);
const {GRASP_POS,PARTS,ROTATION_KEYS}=await import(configUrl);
const heldCube=get('LeftHand').children.find(o=>o.isMesh && o.geometry.type==='BoxGeometry' && o.geometry.parameters.width===.92);
assert.ok(heldCube.position.distanceTo(GRASP_POS)<.001,'cube must seat in palm');
assert.ok(heldCube.quaternion.angleTo(new THREE.Quaternion())<.001,'cube must align with glove');
lesson.checkBeatComplete();assert.match(document.getElementById('cap-title').textContent,/follows too/);
lesson.nextBeat();
for(const part of PARTS){
 for(const key of Object.values(ROTATION_KEYS[part])) {arm.setJoint(key,450);assert.equal(arm.joints[key],({mitt:85,pointer:85,thumb:70})[part] ?? 450);}
 for(const axis of ['x','y','z']) {const key=part+'_p'+axis;arm.setJoint(key,.3);assert.equal(arm.joints[key],undefined,'translation must not exist');}
}
console.log('PASS: rotation-only joints with fixed connections, optional demos, all challenge controls, assisted reach and cube seated inside palm.');

arm.resetPickup(); arm.setJoints(START_POSE);
assert.equal(arm.getCatchState(),'far');
arm.setTargetVisible(false); assert.equal(arm.getCatchState(),'hidden');
arm.selectNode('elbow');
const surface=name=>get(name).children.find(o=>o.isMesh);
assert.equal(surface('LeftUpperArm').material.emissive.getHex(),0,'parent must stay neutral');
assert.notEqual(surface('LeftForearm').material.emissive.getHex(),0,'selected surface must highlight');
assert.notEqual(surface('LeftHand').material.emissive.getHex(),0,'child surface must highlight');
arm.selectNode('mitt');assert.equal(surface('Pointer').material.emissive.getHex(),0,'sibling must stay neutral');
console.log('PASS: progressive sliders, connection strip, isolated descendant highlights, and hidden/far/ready/held catch feedback.');

for(const [part,max] of Object.entries({mitt:85,pointer:85,thumb:70})) {
 document.getElementById('part-picker').dispatchEvent(new CustomEvent('partselect',{detail:part}));
 assert.equal(document.querySelectorAll('#movement-sliders input').length,1);
 const input=document.querySelector('#movement-sliders input');assert.equal(input.min,'0');assert.equal(input.max,String(max));
 arm.setJoint(part,-30);assert.equal(arm.joints[part],0);
 for(const axis of ['x','y','z']) {const forbidden=part+'_'+axis;arm.setJoint(forbidden,80);assert.equal(arm.joints[forbidden],undefined);}
}
const replica=arm.createArmReplica();
assert.equal(replica.surfaces.length,6);
assert.deepEqual(Object.keys(replica.parts),PARTS);
assert.ok(replica.surfaces.every(mesh=>PARTS.includes(mesh.userData.part)));
console.log('PASS: replica has selectable original surfaces; fingers only open and close, with unsupported twists rejected.');

// ── Continue is earned, not waited out ──
// main.js is what normally wires the gate to the sliders, so do it by hand here.
controls.onControlChange(lesson.checkBeatComplete);
const continueBtn=document.getElementById('btn-continue'), tryHint=document.getElementById('try-hint');
const unlocked=()=>continueBtn.classList.contains('on');
const pick=part=>document.getElementById('part-picker').dispatchEvent(new CustomEvent('partselect',{detail:part}));
const slide=(key,value)=>{
 const input=[...document.querySelectorAll('#movement-sliders input')].find(i=>i.dataset.key===key);
 input.value=String(value);input.dispatchEvent(new dom.window.Event('input'));
};
lesson.runBeat(0);
assert.ok(!unlocked(),'Continue must be held back until the joint has moved');
assert.equal(tryHint.hidden,false);
assert.match(tryHint.textContent,/shoulder/);
lesson.replayBeat();
for(let i=0;i<80;i++) animation.tickAnims(.05);
assert.ok(!unlocked(),'watching the demo must not count as trying it');
slide('shoulder',-30);
assert.ok(unlocked(),'moving the step joint must unlock Continue');
assert.equal(tryHint.hidden,true);
lesson.runBeat(1);
assert.ok(!unlocked(),'the gate must close again on the next beat');
pick('shoulder');slide('shoulder',-40);
assert.ok(!unlocked(),'a joint from an earlier step must not unlock this one');
pick('elbow');slide('elbow',45);
assert.ok(unlocked());
lesson.runBeat(3);
pick('wrist');slide('wrist',30);
assert.ok(!unlocked(),'the finger step must want a finger');
const fingerGrip=document.getElementById('slider-grip');
fingerGrip.value='60';fingerGrip.dispatchEvent(new dom.window.Event('input'));
assert.ok(unlocked(),'closing the hand curls all three fingers, so it counts');
lesson.runBeat(4);
assert.ok(!unlocked());
pick('base');slide('base',15);
assert.ok(unlocked(),'the challenge takes any joint - reaching is a whole-arm problem');
lesson.runBeat(5);
assert.ok(!unlocked() && tryHint.hidden,'free play offers Finish, not a gate');
assert.ok(document.getElementById('btn-finish').classList.contains('on'));
console.log('PASS: Continue is gated on moving the joint that step teaches, demos do not count, and the gate resets each beat.');
