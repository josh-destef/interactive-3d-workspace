import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { accessoryRigURL, particleCannonURL, attachParticleCannon } from '../../../kit/js/particleCannon.js';
import { configureUI, setMode, setProgressPercent, trackSurfaceHeight } from '../../../kit/js/ui.js';
import { createAttachmentInteraction } from './attachmentInteraction.js';
import { paintSlider } from '../../../kit/js/controls.js';
import { points, params, setParam, updateParticles, resetParticles, getLive, fireBurst } from './particles.js';

const $ = id => document.getElementById(id);
const renderer = new THREE.WebGLRenderer({canvas:$('stage'),antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=.95;
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene(); scene.background=new THREE.Color('#f8f8f6');
scene.fog=new THREE.Fog('#f8f8f6',24,48);
const environment=new RoomEnvironment(), pmrem=new THREE.PMREMGenerator(renderer);
const environmentTarget=pmrem.fromScene(environment);scene.environment=environmentTarget.texture;
environment.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xffffff,0x8b94a8,.8));
const key=new THREE.DirectionalLight(0xffffff,1.6);key.position.set(3,8,-5);key.castShadow=true;
key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-8,right:8,top:8,bottom:-8});key.shadow.bias=-.0002;scene.add(key);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:'#f8f8f6',roughness:.95}));
floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const grid=new THREE.GridHelper(24,48,0xc9c9c6,0xe3e3df);grid.position.y=.005;scene.add(grid,points);

const camera=new THREE.PerspectiveCamera(36,1,.1,120);
const orbit=new OrbitControls(camera,$('stage'));orbit.enableDamping=true;orbit.enablePan=false;
orbit.minDistance=6;orbit.maxDistance=60;orbit.maxPolarAngle=Math.PI/2-.04;
const frameCenter=new THREE.Vector3(1.5,1.8,-.5);
// The canonical robot faces -Z: show its face and the open muzzle.
const viewDirection=new THREE.Vector3(3.5,2.2,-12).normalize();
function frameView(){
  orbit.target.copy(frameCenter);
  const v=THREE.MathUtils.degToRad(camera.fov)/2,h=Math.atan(Math.tan(v)*camera.aspect);
  camera.position.copy(frameCenter).addScaledVector(viewDirection,3.3/Math.sin(Math.min(v,h)));orbit.update();
}
function resize(){const {width,height}=$('stage').getBoundingClientRect();if(!width||!height)return;
  renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();frameView();}
new ResizeObserver(resize).observe($('stage'));$('view-reset').onclick=()=>{interaction?.cancel();frameView();};


// The shared attachment helper preserves the elbow ball and original upper arm.
// Lesson state is separate from playback: demonstrations never earn student progress.
let robot, cannonAsset, attachment = null, preview;
let ready = false, paused = false, currentStep = 0, unlocked = 0, learned = 0;
const demoSteps = new Set([0,1,5]);
let removed = false, selected = false, demo = null, finalPending = false;
const done = new Set();
let trials = [], changed = new Set(), singleFired = false, burstFired = false;
let predictionBaseline = null;
const defaults = {aim:35,count:80,speed:4,spread:45,gravity:3,life:30,size:16,palette:'party',shape:'square'};
const formats = {aim:v=>`${v}°`,count:v=>`${v}`,speed:v=>`${v} units/s`,spread:v=>`${v}°`,gravity:v=>`${v} units/s²`,life:v=>`${(v/10).toFixed(1)} s`,size:v=>`${(v/100).toFixed(2)} units`};
const lessons = [
 ['Give Gizmo a new attachment.', 'The cannon replaces only the forearm and hand; the elbow joint stays put.', 'Grab the forearm or hand and drag the assembly away. Then drag the cannon’s connection end to the highlighted elbow and release to snap it on.'],
 ['One particle. Lots of possibilities.', 'The emitter is where each particle begins, while the system supplies the shared rules.', 'Try Fire One, then Fire Burst. Orbit to see where the pieces begin. You are setting rules, not animating every piece.'],
 ['Aim the emitter.', 'Turning the cannon redirects new particles while pieces already in the air keep their paths.', 'Rotate the elbow with Aim, then fire toward the broad celebration area. Upward or outward is fine.'],
 ['A little confetti. A lot of confetti.', 'Count changes how many particles appear at once in a burst.', 'Fire a small burst, then increase Count and fire a noticeably larger burst. All other rules can stay the same.'],
 ['Shape the launch.', 'Speed changes the launch pace, and Spread opens the fan of directions.', 'Try Speed, then compare a narrower shot with a wider fan using Spread. Choose the feeling you like.'],
 ['Float, fall, and fade away.', 'Gravity bends the path and Lifetime decides when each piece disappears.', 'Change Gravity and Lifetime, then fire to observe both rules. Try a floaty effect or a quicker falling burst.'],
 ['Make it look like a celebration.', 'Appearance can change while the motion rules stay the same.', 'Choose a multicolor palette and adjust Size, then fire. You can also try squares, circles or stars.'],
 ['Change one rule at a time.', 'A fair comparison changes one rule so you can see its effect.', 'Choose a question and write a prediction. Capture a first burst, change only that rule, then compare with another burst.'],
 ["Gizmo’s confetti blast!", 'Your chosen rules make the effect.', 'Choose multiple particles, an outward spread and your favorite palette. Aim up or out, then press Blast! Let your confetti play out.']
];
const emitterMarker = new THREE.Mesh(new THREE.SphereGeometry(.065,16,12),new THREE.MeshBasicMaterial({color:'#007c80',wireframe:true}));
const emitterArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(),.7,0x007c80,.16,.09);
const connectionMarker = new THREE.Mesh(new THREE.SphereGeometry(.15,16,12),new THREE.MeshBasicMaterial({color:'#e69128',wireframe:true}));
const celebrationArea = new THREE.Mesh(new THREE.CircleGeometry(2.3,64),new THREE.MeshBasicMaterial({color:'#7bbeb1',transparent:true,opacity:.18,depthWrite:false}));
celebrationArea.rotation.x=-Math.PI/2;celebrationArea.position.set(4,.012,-1.5);scene.add(celebrationArea);
function snapshot(){return Object.fromEntries(Object.keys(defaults).map(id=>[id,typeof defaults[id]==='number'?Number($(id).value):$(id).value]));}
function syncControl(id){const value=snapshot()[id];
 if(id==='aim'){if(robot)robot.getObjectByName('LeftForearm').rotation.z=THREE.MathUtils.degToRad(value);}
 else setParam(id,id==='life'?value/10:id==='size'?value/100:value);
 if(formats[id])paintSlider($(id));
 if(formats[id])$(id+'Val').textContent=formats[id](value);
}
function restore(values){for(const [id,value] of Object.entries(values)){$(id).value=value;syncControl(id);}}
function feedback(text){$('feedback').textContent=text;}
function attachmentFeedback(text){$('attachment-state').textContent=text;}
const discoveries = [
 'The cannon is attached at the elbow. The upper arm and joint stayed in place.',
 'One emitter created a single piece and a burst. The system supplies the rules.',
 'Changing the cannon’s direction changes where new particles go.',
 'Same system, different count: more pieces make a bigger burst.',
 'Speed sets the launch pace; Spread opens up the fan.',
 'Gravity changes the path. Lifetime sets when each piece disappears.',
 'You changed the appearance while keeping control of the motion.',
 'You isolated one rule. Compare the result with your prediction.',
 'Your rules created a confetti celebration.'
];
function complete(){done.add(currentStep);unlocked=Math.max(unlocked,Math.min(8,currentStep+1));feedback(discoveries[currentStep]);refresh();}
function removeAssembly(){if(attachment){attachment.detach();attachment=null;}
 robot.getObjectByName('LeftForearmSurface').visible=false;robot.getObjectByName('LeftHand').visible=false;removed=true;}
function restoreAssembly(){interaction?.reset();if(attachment){attachment.detach();attachment=null;}
 robot.getObjectByName('LeftForearmSurface').visible=true;robot.getObjectByName('LeftHand').visible=true;removed=false;selected=false;
 robot.getObjectByName('LeftForearm').rotation.z=0;preview.position.set(3,1.3,0);preview.visible=true;attachmentFeedback('');}
function attach(){attachment=attachParticleCannon(robot,cannonAsset,'Left');attachment.emitter.add(emitterMarker,emitterArrow);preview.visible=false;removed=true;selected=true;syncControl('aim');}
function refresh(){
 const busy=!ready||!!demo;
 setMode(!ready?null:demo?'watch':'interact');
 $('status-badge').hidden=!demo;
 setProgressPercent(done.size/9*100);$('prog').setAttribute('aria-valuenow',String(done.size));
 $('kbd-hint').classList.toggle('on',done.has(currentStep)&&!busy&&currentStep<8);
 $('playback').hidden=currentStep===0;
 // The dock is the stable home for the attachment keyboard alternative first,
 // then for playback and the particle controls.
 $('dock').classList.add('on');
 $('console').classList.add('has-dock');
 document.querySelectorAll('.step').forEach((button,i)=>{button.disabled=busy||i>unlocked;button.setAttribute('aria-current',i===currentStep?'step':'false');button.dataset.complete=String(done.has(i));});
 document.querySelectorAll('[data-unlock]').forEach(el=>{el.hidden=Number(el.dataset.unlock)>learned;el.querySelectorAll('input,select').forEach(input=>input.disabled=busy);});
 $('attachment-panel').hidden=currentStep!==0;$('explore-panel').hidden=currentStep!==7;
 $('fire-one').hidden=currentStep!==1;$('fire-one').disabled=busy||!attachment;
 $('fire').hidden=currentStep===0;$('fire').disabled=busy||!attachment||finalPending;$('fire').textContent=currentStep===8?'Blast!':'Fire Burst';
 for(const id of ['compare','prediction','prediction-note'])$(id).disabled=busy;
 for(const id of ['pause','clear','reset'])$(id).disabled=busy;
 $('watch').hidden=!demoSteps.has(currentStep)||!!demo;
 $('watch').textContent=currentStep===0?'Show the swap':currentStep===1?'See how an emitter works':'Compare gravity and lifetime';$('watch').disabled=busy;
 $('your-turn').hidden=!demo;$('your-turn').disabled=!ready;
 $('remove-arm').disabled=busy||removed;$('select-cannon').disabled=busy||!removed||selected;$('attach-cannon').disabled=busy||!selected||!!attachment;
 $('next').hidden=currentStep===8;$('next').disabled=busy||!done.has(currentStep);
 $('pause').textContent=paused?'Play':'Pause';$('pause').setAttribute('aria-pressed',String(paused));
 $('status').textContent=!ready?'Loading model…':demo?'Watch':paused?'Paused':'Your Turn';
 $('progress-text').textContent=`Step ${currentStep+1} of 9`;
 emitterMarker.visible=emitterArrow.visible=!!attachment&&(currentStep===1||currentStep===2||!!demo);
 connectionMarker.visible=currentStep===0;celebrationArea.visible=currentStep>=2;
}
for(const id of Object.keys(defaults))$(id).oninput=()=>{if(!ready||demo)return;changed.add(id);syncControl(id);};
$('remove-arm').onclick=()=>{removeAssembly();attachmentFeedback('The elbow ball stays. Select the Particle Cannon.');refresh();};
$('select-cannon').onclick=()=>{selected=true;attachmentFeedback('Cannon selected. Attach it to the highlighted elbow connection.');refresh();};
$('attach-cannon').onclick=()=>{attach();complete();};
function clear(){resetParticles();finalPending=false;$('live').textContent='0';}
$('clear').onclick=()=>{clear();refresh();};
$('pause').onclick=()=>{paused=!paused;refresh();};
function fire(count,student=true){if(!attachment)return;clear();paused=false;fireBurst(attachment,count);$('live').textContent=getLive();
 if(student){const values=snapshot();trials.push(values);
  if(currentStep===1){if(count===1)singleFired=true;else burstFired=true;if(singleFired&&burstFired)complete();}
  if(currentStep===2&&changed.has('aim'))complete();
  if(currentStep===3&&trials.length>1){const counts=trials.map(t=>t.count);if(Math.max(...counts)>=Math.min(...counts)*1.5&&Math.max(...counts)-Math.min(...counts)>=10)complete();else feedback('Try a bigger difference in Count, then fire again.');}
  if(currentStep===4&&changed.has('speed')&&trials.length>1&&Math.max(...trials.map(t=>t.spread))-Math.min(...trials.map(t=>t.spread))>=20)complete();
  if(currentStep===5&&changed.has('gravity')&&changed.has('life'))complete();
  if(currentStep===6&&changed.has('palette')&&changed.has('size'))complete();
  if(currentStep===8){$('completion').hidden=true;if(count>1&&values.spread>0){finalPending=true;feedback('Let your confetti play out…');}else feedback('Use more than one particle and some Spread, then Blast again.');}
 }refresh();}
$('fire').onclick=()=>fire(params.count);$('fire-one').onclick=()=>fire(1);
$('compare').onclick=()=>{
 if(demo||!ready)return;
 if(!$('prediction-note').value.trim()){feedback('Write your prediction first. There is no single right wording.');return;}
 const values=snapshot(),key=$('prediction').value;
 if(!predictionBaseline){predictionBaseline={values,key};fire(params.count,false);feedback(`First burst captured. Change only ${key==='life'?'Lifetime':key==='spread'?'Spread':'Speed'}, then Compare again.`);return;}
 if(key!==predictionBaseline.key){predictionBaseline=null;feedback('Question changed. Capture a new first burst.');return;}
 const differences=Object.keys(values).filter(id=>values[id]!==predictionBaseline.values[id]);
 if(differences.length!==1||differences[0]!==key){feedback('Change only the rule in your prediction. Restore other settings, or choose a new question to start over.');return;}
 fire(params.count,false);predictionBaseline=null;complete();feedback('Compare this burst with the first: did the result match your prediction? You changed just one rule.');
};
$('prediction').onchange=()=>{predictionBaseline=null;};
function cancelDemo(){if(!demo)return;const saved=demo.saved;demo=null;clear();restore(saved);if(currentStep===0){restoreAssembly();done.delete(0);}paused=false;$('demo-caption').textContent='';$('demo-caption').hidden=true;refresh();}
function showStep(index){interaction?.cancel();cancelDemo();currentStep=index;learned=Math.max(learned,index);trials=[];changed=new Set();singleFired=false;burstFired=false;predictionBaseline=null;clear();paused=false;
 if(index===0&&ready){restoreAssembly();done.delete(0);}
 $('lesson-menu').open=false;document.querySelector('.lesson').scrollTop=0;$('completion').hidden=true;$('lesson-title').textContent=lessons[index][0];
 const [, observation, action] = lessons[index];
 $('instruction').innerHTML=`<b>${action}</b> ${observation}`;
 feedback('');attachmentFeedback('');interaction?.setVisible(index===0);refresh();}
 document.querySelectorAll('.step').forEach((button,index)=>button.onclick=()=>{if(index<=unlocked){if(index>0&&!attachment&&ready)attach();showStep(index);}});
$('next').onclick=()=>{if(done.has(currentStep))showStep(currentStep+1);};
$('reset').onclick=()=>{interaction?.cancel();clear();restore(defaults);trials=[];changed.clear();predictionBaseline=null;singleFired=false;burstFired=false;paused=false;done.delete(currentStep);$('completion').hidden=true;if(currentStep===0)restoreAssembly();feedback('This experiment is reset. Your other lesson progress is saved.');refresh();};
$('replay').onclick=()=>fire(params.count);$('keep-experimenting').onclick=()=>{$('completion').hidden=true;feedback('All controls are yours. Change a rule and Blast again.');};
$('your-turn').onclick=cancelDemo;
function demoFire(overrides={},count){restore({...snapshot(),...overrides});fire(count??params.count,false);}
function startDemo(){if(!ready||demo||!demoSteps.has(currentStep))return;interaction?.cancel();const saved=snapshot();clear();paused=false;
 const sets=[
  [[0,'Keep the shoulder, upper arm and elbow ball.',()=>restoreAssembly()],[1.8,'Remove just the forearm and hand.',removeAssembly],[3.4,'Select the prebuilt cannon.',()=>{selected=true;}],[4.8,'Snap the cannon directly to the elbow.',attach]],
  [[0,'Emitter: the marker at the muzzle. Particle: one small piece.',()=>demoFire({speed:2,life:60},1)],[.45,'Pause and look: this is one particle.',()=>{paused=true;}],[2.2,'The system makes several pieces automatically.',()=>demoFire({},5)],[4.1,'One set of rules creates a whole burst.',()=>demoFire({},40)]],
  [[0,'The emitter points outward.',()=>demoFire({aim:5},35)],[2.3,'Rotate the elbow: the muzzle and launch direction follow.',()=>demoFire({aim:55},35)]],
  [[0,'A small burst: few pieces.',()=>demoFire({count:12})],[2.3,'Same motion rules, more particles.',()=>demoFire({count:150})]],
  [[0,'Slow and narrow.',()=>demoFire({speed:2,spread:8})],[2,'Faster, with the same narrow spread.',()=>demoFire({speed:7})],[4,'Same speed, wider directions.',()=>demoFire({spread:85})]],
  [[0,'Little gravity: floating.',()=>demoFire({aim:55,gravity:0,life:60})],[2,'More gravity: falling.',()=>demoFire({gravity:7})],[4,'Short lifetime: pieces disappear sooner.',()=>demoFire({life:7})],[6,'Long lifetime: pieces stay longer.',()=>demoFire({life:50})]],
  [[0,'Same motion, party colors and small squares.',()=>demoFire({palette:'party',size:10,shape:'square'})],[2.2,'New colors, bigger pieces and stars. Motion stays the same.',()=>demoFire({palette:'sunset',size:25,shape:'star'})]],
  [[0,'Predict: what if Speed increases?',()=>demoFire({speed:2})],[2.3,'Test: only Speed changes. Compare how far pieces travel.',()=>demoFire({speed:6})]]
 ];
 $('demo-caption').hidden=false;demo={saved,time:0,cursor:0,events:sets[currentStep],end:currentStep===5?9:7};refresh();}
$('watch').onclick=startDemo;
configureUI({steps:9,beats:9});
document.addEventListener('keydown',event=>{
 if(event.code!=='Space')return;
 if(['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName))return;
 if(!demo&&done.has(currentStep)&&currentStep<8){event.preventDefault();$('next').click();}
});
let interaction = createAttachmentInteraction({
 canvas:$('stage'),camera,orbit,scene,
 getState:()=>({enabled:ready&&currentStep===0&&!demo&&!attachment,removed,preview,
  shell:robot?.getObjectByName('LeftForearmSurface'),hand:robot?.getObjectByName('LeftHand'),elbow:robot?.getObjectByName('LeftForearm')}),
 onRemove:()=>{removeAssembly();attachmentFeedback('The elbow ball stays. Now drag the cannon onto that connection.');refresh();},
 onAttach:()=>{attachmentFeedback('');selected=true;attach();complete();},
 onHint:attachmentFeedback,
 onNear:near=>{connectionMarker.material.color.set(near?'#00aa00':'#e69128');connectionMarker.scale.setScalar(near?1.5:1);}
});
trackSurfaceHeight(resize);
async function boot(){const loader=new GLTFLoader();const [rig,cannon]=await Promise.all([loader.loadAsync(accessoryRigURL.href),loader.loadAsync(particleCannonURL.href)]);
 robot=rig.scene;cannonAsset=cannon.scene;robot.scale.setScalar(1.25);robot.rotation.y=.34;robot.updateMatrixWorld(true);robot.position.y-=new THREE.Box3().setFromObject(robot).min.y;
 robot.traverse(node=>{if(node.isMesh)node.castShadow=true;});scene.add(robot);
 robot.getObjectByName('LeftForearm').add(connectionMarker);
 preview=cannonAsset.getObjectByName('ParticleCannon').clone(true);preview.scale.setScalar(1.25);preview.position.set(3,1.3,0);scene.add(preview);
 ready=true;restore(defaults);restoreAssembly();$('loading').hidden=true;refresh();}
restore(defaults);showStep(0);resize();
boot().catch(error=>{$('loading').textContent='Gizmobot could not load. Reload to try the bundled model again.';$('status').textContent='Model unavailable';console.error(error);});
const clock=new THREE.Clock();let readoutTime=0;
renderer.setAnimationLoop(()=>{const dt=Math.min(clock.getDelta(),.05);
 if(demo){demo.time+=dt;while(demo&&demo.cursor<demo.events.length&&demo.events[demo.cursor][0]<=demo.time){const event=demo.events[demo.cursor++];$('demo-caption').textContent=event[1];event[2]();}if(demo&&demo.time>=demo.end)cancelDemo();}
 if(ready&&!paused)updateParticles(dt,null);
 if(finalPending&&getLive()===0){finalPending=false;done.add(8);$('completion').hidden=false;$('completion').scrollIntoView?.({block:'nearest',behavior:'instant'});feedback('You made a particle system! Your rules created Gizmo’s confetti celebration.');refresh();}
 readoutTime+=dt;if(readoutTime>.1){$('live').textContent=getLive();readoutTime=0;}orbit.update();renderer.render(scene,camera);
});


