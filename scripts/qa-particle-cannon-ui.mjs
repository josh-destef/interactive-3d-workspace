// Non-rendering DOM integration test of the shipped main.js. GPU, orbit input
// and asset transport are mocked; real Three transforms, attachment helper,
// particle simulation and DOM event handlers run unchanged.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
const deps=path.join(os.tmpdir(),'fundamentals-3d-qa/node_modules');
const threeURL=pathToFileURL(path.join(deps,'three/build/three.module.js')).href;
const THREE=await import(threeURL);
const {JSDOM}=await import(pathToFileURL(path.join(deps,'jsdom/lib/api.js')).href);
const url=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const simURL=url(fs.readFileSync(path.join(root,'polished/labs/particle-cannon/js/particles.js'),'utf8').replace("from 'three'",`from '${threeURL}'`));
const sim=await import(simURL); // no canvas API needed in Node
const dom=new JSDOM(fs.readFileSync(path.join(root,'polished/labs/particle-cannon/index.html'),'utf8'));
globalThis.document=dom.window.document;globalThis.devicePixelRatio=1;
globalThis.ResizeObserver=class{observe(){}};
const $=id=>document.getElementById(id);
assert.ok(document.querySelector('script[src^="js/main.js"]'),'entry module is wired');
assert.ok($('pause').disabled,'pause is disabled until assets are ready');
let tick;
class Renderer{constructor(){this.shadowMap={};}setPixelRatio(){}setSize(){}setAnimationLoop(fn){tick=fn;}render(){}}
class Orbit{constructor(){this.target=new THREE.Vector3();}update(){}}
const robot=new THREE.Group(), shoulder=new THREE.Group(),upper=new THREE.Group(),elbow=new THREE.Group();
shoulder.name='LeftShoulder';upper.name='LeftUpperArm';elbow.name='LeftForearm';
robot.add(shoulder);shoulder.add(upper);upper.add(elbow);
const shell=new THREE.Group();shell.name='LeftForearmSurface';elbow.add(shell);
const hand=new THREE.Group();hand.name='LeftHand';elbow.add(hand);
const joint=new THREE.Group();elbow.add(joint);
const ball=new THREE.Group();ball.name='LeftElbowJointSurface';joint.add(ball);
robot.add(new THREE.Mesh(new THREE.BoxGeometry(1,3,1)));
const cannonScene=new THREE.Group(),cannon=new THREE.Group();cannon.name='ParticleCannon';cannonScene.add(cannon);
const emitter=new THREE.Group();emitter.name='MuzzleEmission';emitter.position.x=.816;cannon.add(emitter);
class Loader{async loadAsync(name){return {scene:name.includes('accessory-rig')?robot:cannonScene};}}
globalThis.__cannonUITest={Renderer,Orbit,Loader};
const facade=url(`export * from '${threeURL}';export const WebGLRenderer=globalThis.__cannonUITest.Renderer;export class Clock{getDelta(){return .05}}export class PMREMGenerator{fromScene(){return {texture:null}}dispose(){}}`);
const loaderURL=url('export const GLTFLoader=globalThis.__cannonUITest.Loader;');
const helperPath=path.join(root,'polished/kit/js/particleCannon.js');
const helper=url(fs.readFileSync(helperPath,'utf8').replace("from 'three'",`from '${threeURL}'`).replace("from 'three/addons/loaders/GLTFLoader.js'",`from '${loaderURL}'`).replaceAll('import.meta.url',JSON.stringify(pathToFileURL(helperPath).href)));
let main=fs.readFileSync(path.join(root,'polished/labs/particle-cannon/js/main.js'),'utf8');
main=main.replace("from 'three'",`from '${facade}'`)
 .replace("from 'three/addons/loaders/GLTFLoader.js'",`from '${loaderURL}'`)
 .replace("from 'three/addons/controls/OrbitControls.js'",`from '${url('export const OrbitControls=globalThis.__cannonUITest.Orbit;')}'`)
 .replace("from 'three/addons/environments/RoomEnvironment.js'",`from '${url('export class RoomEnvironment{dispose(){}}')}'`)
 .replace("from '../../../kit/js/particleCannon.js'",`from '${helper}'`)
 .replace("from '../../../kit/js/controls.js'",`from '${url(fs.readFileSync(path.join(root,'polished/kit/js/controls.js'),'utf8'))}'`)
 .replace("from '../../../kit/js/ui.js'",`from '${url(fs.readFileSync(path.join(root,'polished/kit/js/ui.js'),'utf8'))}'`)
 .replace("from './attachmentInteraction.js'",`from '${url(fs.readFileSync(path.join(root,'polished/labs/particle-cannon/js/attachmentInteraction.js'),'utf8').replace("from 'three'",`from '${threeURL}'`))}'`)
 .replace("from './particles.js'",`from '${simURL}'`);
await import(url(main));await new Promise(resolve=>setImmediate(resolve));
assert.ok($('loading').hidden,'model loads');
assert.ok(!$('read-layer')?.classList.contains('on'),'lesson starts without a mandatory Read card');
assert.ok(!$('remove-arm').disabled,'attachment is immediately actionable');

const input=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new dom.window.Event('input'));};
const frames=(n=150)=>{for(let i=0;i<n;i++)tick();};
const steps=[...document.querySelectorAll('.step')];
let stepIndex=0;
const checkPrompt=()=>{
 assert.equal(steps[stepIndex].getAttribute('aria-current'),'step');
 assert.ok($('instruction').querySelector('b'),'instruction leads with its action in bold');
 assert.ok($('instruction').textContent.trim().length>$('instruction').querySelector('b').textContent.trim().length,'instruction pairs the action with an observation');
 assert.equal($('voice'),null,'instruction has one home');
 assert.equal($('watch').hidden,![0,1,5].includes(stepIndex),'demonstrations are selective and optional');
 for(const field of document.querySelectorAll('[data-unlock]'))assert.equal(field.hidden,Number(field.dataset.unlock)>stepIndex,'controls unlock at their teaching step');
};
const next=async()=>{assert.ok(!$('next').disabled,'student exploration earns next step');$('next').click();stepIndex++;checkPrompt();};
const watch=()=>{$('watch').click();tick();assert.ok(!$('status-badge').hidden,'Watch badge appears only while a demonstration runs');assert.ok(!$('demo-caption').hidden,'demo caption visible');frames(190);assert.ok($('status-badge').hidden,'Watch badge clears after the demonstration');assert.ok($('demo-caption').hidden,'demo finishes');};
assert.equal(steps.length,9);assert.ok(steps[1].disabled);
checkPrompt();
assert.ok(shell.visible&&hand.visible&&ball.visible,'starts with original arm');
assert.ok($('status-badge').hidden,'Your Turn does not compete with the CreateAccess wordmark');
assert.ok($('dock').classList.contains('on')&&!$('attachment-panel').hidden,'attachment keyboard alternative stays in the initial dock');
assert.ok([...document.querySelectorAll('[data-unlock]')].every(el=>el.hidden),'no controls before concepts');
watch();assert.ok($('next').disabled,'attachment demo does not earn progress');assert.ok(shell.visible&&hand.visible,'demo restores original arm');
$('remove-arm').click();assert.ok(!shell.visible&&!hand.visible&&ball.visible&&upper.visible&&shoulder.visible,'only forearm shell and hand removed');
assert.equal(elbow.parent,upper);assert.equal(upper.parent,shoulder);assert.equal(ball.parent,joint,'original elbow ball hierarchy preserved');
$('select-cannon').click();$('attach-cannon').click();assert.ok(elbow.getObjectByName('LeftParticleCannonMount'),'cannon mounted at existing elbow');await next();
assert.ok($('dock').classList.contains('on')&&!$('playback').hidden,'playback is visible in the dock from the first particle step');
watch();assert.ok($('next').disabled,'emitter demo does not satisfy student actions');
$('fire-one').click();assert.equal(sim.getLive(),1);assert.ok($('next').disabled);
$('fire').click();assert.equal(sim.getLive(),80);await next();
assert.ok(!document.querySelector('[data-unlock="2"]').hidden);assert.ok(document.querySelector('[data-unlock="3"]').hidden,'count not exposed before its step');
input('aim',50);$('fire').click();
const emitted=sim.emit({emissionWorld(a,b){a.set(0,2,0);b.set(1,0,0);}});$('pause').click();const position=emitted.position.clone();frames(5);assert.ok(emitted.position.equals(position),'pause freezes simulation');input('aim',55);assert.ok(emitted.position.equals(position),'aim does not move old particles');
$('clear').click();assert.equal(sim.getLive(),0);await next();
$('fire').click();assert.ok($('next').disabled);input('count',160);$('fire').click();await next();
input('speed',5);input('spread',40);$('fire').click();assert.ok($('next').disabled);input('spread',70);$('fire').click();await next();
watch();assert.ok($('next').disabled,'gravity demonstration does not complete student exploration');assert.equal(sim.params.gravity,3);assert.equal(sim.params.life,3);
input('gravity',2);$('fire').click();assert.ok($('next').disabled);input('life',40);$('fire').click();await next();
input('palette','ocean');input('size',22);$('fire').click();await next();
$('compare').click();assert.ok($('next').disabled,'comparison requires a prediction');
$('prediction-note').value='The confetti will travel farther.';$('compare').click();input('speed',6);input('spread',60);$('compare').click();assert.ok($('next').disabled,'comparison rejects changes to two rules');input('spread',70);$('compare').click();await next();
assert.ok($('watch').hidden,'final challenge has no demonstration');assert.equal($('fire').textContent,'Blast!');
input('count',1);$('fire').click();frames();assert.ok($('completion').hidden,'single piece is not confetti challenge');input('count',100);input('spread',0);$('fire').click();frames();assert.ok($('completion').hidden,'zero spread does not complete');
input('spread',55);$('fire').click();assert.ok($('completion').hidden,'completion waits for actual particles');$('clear').click();frames();assert.ok($('completion').hidden,'clear cannot prematurely complete challenge');
$('fire').click();$('pause').click();frames();assert.ok($('completion').hidden,'pause cannot complete challenge');$('pause').click();frames();assert.ok(!$('completion').hidden,'natural expiry completes celebration');
$('replay').click();assert.ok($('completion').hidden&&sim.getLive()===100,'replay fires selected effect');frames();$('keep-experimenting').click();assert.ok($('completion').hidden);
$('reset').click();assert.equal(sim.params.count,80);assert.equal(sim.params.life,3);assert.equal(sim.params.speed,4);assert.equal(sim.params.spread,45);assert.equal(sim.params.gravity,3);assert.equal(sim.params.size,.16);assert.equal(sim.params.palette,'party');assert.equal(sim.params.shape,'square');assert.equal(sim.getLive(),0);assert.equal($('aim').value,'35');assert.equal($('pause').textContent,'Pause');
steps[0].click();watch();assert.ok(shell.visible&&hand.visible&&ball.visible);assert.ok($('next').disabled,'revisiting intro still requires attachment');
delete globalThis.__cannonUITest;dom.window.close();
console.log('PASS nine-step shipped UI: swap, demonstrations, student gates, progressive controls, pause/clear/reset, prediction comparison, natural final completion and replay');

