import { createPoser, jointAxes } from './posing.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const $ = id => document.getElementById(id);
const canvas = $('scene'), viewport = $('viewport');
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-5,5,4,-4,.1,100);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer, robot, manifest, selected, dragging = null, started = false, snapping = null, sideView = false;
let ghost, ring, ghostGroup, poser;
const parts = new Map(), locked = new Set(['Torso']), ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane(), grabOffset = new THREE.Vector3();
const local = a => new THREE.Vector3().fromArray(a);
const home = p => local(p.assembledPosition);
const away = p => home(p).add(local(p.explodedOffset));
const ready = p => !p.requires || locked.has(p.requires);

function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  renderer.setSize(w,h,false);
  const aspect = w/h, height = Math.max(6.1,8.5/aspect);
  camera.left=-height*aspect/2;camera.right=height*aspect/2;camera.top=height/2;camera.bottom=-height/2;
  camera.updateProjectionMatrix();
}
function setView() {
  camera.position.set(sideView?4:0,2.5,sideView?-9:-12);
  camera.lookAt(0,1.55,0);
  $('view-label').textContent=sideView?'Front view':'Turn the view';
}
function updateButtons() {
  for (const p of manifest.parts) {
    const b = $(p.node);
    b.disabled=locked.has(p.node)||!ready(p)||!!snapping;
    b.classList.toggle('connected',locked.has(p.node));
    b.textContent=(locked.has(p.node)?'✓ ':!ready(p)?'○ ':'')+p.label;
    b.setAttribute('aria-pressed',String(selected===p));
    b.title=!ready(p)?`Connect ${parts.get(p.requires).definition.label.toLowerCase()} first`:p.label;
  }
  $('count').textContent=`${locked.size} / ${manifest.parts.length}`;$('progress').value=locked.size;
}
function disposeGhost() {
  if(ghost){ghostGroup.remove(ghost);ghost.traverse(o=>{if(o.isMesh)o.material.dispose();});ghost=null;}
}
function select(p) {
  if(!started||locked.has(p.node)||!ready(p)||snapping)return;
  selected=p;
  $('part-title').textContent=p.label;
  $('instruction').textContent=p.instruction;
  $('step').textContent=`${String(locked.size).padStart(2,'0')} · MAKE A CONNECTION`;
  disposeGhost();
  ghost=parts.get(p.node).object.clone(true);ghost.position.copy(home(p));
  ghost.traverse(o=>{if(o.isMesh)o.material=new THREE.MeshBasicMaterial({color:0xf19536,wireframe:true,transparent:true,opacity:.18,depthWrite:false});});
  ghostGroup.add(ghost);ring.position.copy(home(p));ring.visible=true;
  $('target-label').style.display='block';
  $('position').disabled=false;
  updateSlider();updateButtons();
}
function updateSlider() {
  if(!selected)return;
  const d=parts.get(selected.node).object.position.distanceTo(home(selected));
  const t=Math.max(0,Math.min(100,100*(1-d/local(selected.explodedOffset).length())));
  $('position').value=t;$('position-value').textContent=`${Math.round(t)}%`;
}
function attemptSnap() {
  if(!selected||snapping)return;
  const object=parts.get(selected.node).object;
  if(object.position.distanceTo(home(selected))<=selected.snapDistance) {
    snapping={part:selected,from:object.position.clone(),time:performance.now()};
    dragging=null;ring.material.color.set(0x29a85a);$('position').disabled=true;updateButtons();
  }
}
function completeSnap() {
  const p=snapping.part,object=parts.get(p.node).object;
  object.position.fromArray(p.assembledPosition);object.quaternion.fromArray(p.assembledQuaternion);object.scale.fromArray(p.assembledScale);
  locked.add(p.node);snapping=null;
  const explanations={2:'Notice how the head settled into place? You changed its position: where an object is in 3D space.',4:'Both upper arms are connected. Each is a separate object with its own position.',6:'The forearms kept the same rotation as they moved. Rotation describes which way an object faces.',8:'All those little fingers travelled together. A useful part can contain lots of smaller shapes.',10:'The thighs are in. Add the lower legs to make knees that can bend.',12:'Both knees are connected. Now add the feet at the ankles.'};
  $('feedback').textContent=explanations[locked.size]||`${p.label} connected. It is locked in place. Pick the next part.`;
  ring.material.color.set(0xee922f);
  if(locked.size===manifest.parts.length) {
    selected=null;disposeGhost();ring.visible=false;$('target-label').style.display='none';
    poser.enable();poser.preset('Hello');camera.zoom=1.2;camera.updateProjectionMatrix();document.querySelector('main').classList.add('posing');buildPoseControls();$('lesson').hidden=true;$('finish').hidden=false;$('explore').hidden=false;updateButtons();
  }else{select(manifest.parts.find(q=>!locked.has(q.node)&&ready(q)));}
}
function reset() {
  dragging=null;snapping=null;selected=null;locked.clear();locked.add('Torso');
  camera.zoom=1;camera.updateProjectionMatrix();
  document.querySelector('main').classList.remove('posing');
  if(poser)poser.disable();$('animate-pose').textContent='Animate this pose';
  robot.rotation.set(0,0,0);$('turn').value=0;
  for(const p of manifest.parts){const o=parts.get(p.node).object;o.position.copy(away(p));o.quaternion.fromArray(p.assembledQuaternion);o.scale.fromArray(p.assembledScale);}
  $('intro').hidden=started;$('lesson').hidden=!started;$('finish').hidden=true;
  $('quiz').hidden=false;$('explore').hidden=true;$('quiz-feedback').textContent='';
  $('feedback').textContent='The body is already in place. Your first connection is the neck.';
  if(started)select(manifest.parts[1]);else updateButtons();
}
function pointerRay(event) {
  const b=canvas.getBoundingClientRect();pointer.set((event.clientX-b.left)/b.width*2-1,-(event.clientY-b.top)/b.height*2+1);ray.setFromCamera(pointer,camera);
}
canvas.addEventListener('pointerdown',e=>{
  if(!started||snapping||locked.size===manifest.parts.length||e.button!==0)return;
  pointerRay(e);
  const hit=ray.intersectObjects([...parts.values()].filter(p=>!locked.has(p.definition.node)&&ready(p.definition)).map(p=>p.object),true)[0];
  if(!hit)return;
  let o=hit.object;while(o.parent!==robot)o=o.parent;
  select(parts.get(o.name).definition);
  const world=o.getWorldPosition(new THREE.Vector3());
  dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),world);
  const point=ray.ray.intersectPlane(dragPlane,new THREE.Vector3());
  if(!point)return;
  grabOffset.copy(world).sub(point);dragging=e.pointerId;canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
  if(dragging!==e.pointerId||!selected)return;
  pointerRay(e);const point=ray.ray.intersectPlane(dragPlane,new THREE.Vector3());
  if(!point)return;
  const o=parts.get(selected.node).object;o.position.copy(robot.worldToLocal(point.add(grabOffset)));
  // Keep the beginner's movement on the assembly plane. Depth and rotation align automatically.
  o.position.z=selected.assembledPosition[2];
  updateSlider();attemptSnap();
});
function release(e){if(dragging===e.pointerId)dragging=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',()=>{dragging=null;});
$('position').addEventListener('input',()=>{
  if(!selected||snapping)return;
  parts.get(selected.node).object.position.lerpVectors(away(selected),home(selected),Number($('position').value)/100);
  updateSlider();attemptSnap();
});
$('start').onclick=()=>{started=true;$('intro').hidden=true;$('lesson').hidden=false;select(manifest.parts[1]);$('position').focus();};
$('view').onclick=()=>{dragging=null;sideView=!sideView;setView();};
$('reset').onclick=reset;$('again').onclick=()=>{reset();$('position').focus();};
$('turn').oninput=()=>{robot.rotation.y=THREE.MathUtils.degToRad(Number($('turn').value));};
for(const b of document.querySelectorAll('[data-answer]'))b.onclick=()=>{
  if(b.dataset.answer==='position'){$('quiz-feedback').textContent='Yes. Position is where it is. Now try rotation: change which way the whole robot faces.';$('explore').hidden=false;}
  else $('quiz-feedback').textContent='Its facing direction stayed the same. Think about where the hand started and where it ended. Try again.';
};

function buildPoseControls() {
  $('joint-controls').replaceChildren();
  for(const part of manifest.parts){
    const name=part.node,section=document.createElement('fieldset'),legend=document.createElement('legend');
    section.className='joint-section';legend.textContent=part.label;section.append(legend);
    for(const [axis,label,min,max] of jointAxes(name)){
      const wrap=document.createElement('div'),caption=document.createElement('label'),input=document.createElement('input'),readout=document.createElement('output');
      input.id=`pose-${name}-${axis}`;input.type='range';input.min=min;input.max=max;input.step=1;input.value=poser.values[name][axis];
      input.dataset.joint=name;input.dataset.axis=axis;input.setAttribute('aria-label',`${part.label}: ${label}`);
      caption.htmlFor=input.id;caption.textContent=label;readout.htmlFor=input.id;readout.textContent=input.value+'\u00b0';caption.append(readout);
      input.oninput=()=>{poser.set(name,axis,Number(input.value));syncPoseControls();$('animate-pose').textContent='Animate this pose';$('pose-status').textContent=`${part.label}: ${label.toLowerCase()} adjusted.`;};
      wrap.append(caption,input);section.append(wrap);
    }
    $('joint-controls').append(section);
  }
}
function syncPoseControls(){
  for(const input of $('joint-controls').querySelectorAll('input')){
    input.value=poser.values[input.dataset.joint][input.dataset.axis];
    input.previousElementSibling.querySelector('output').textContent=input.value+'\u00b0';
  }
}
$('reset-pose').onclick=()=>{poser.preset('Hello');syncPoseControls();$('animate-pose').textContent='Animate this pose';$('pose-status').textContent='Hello pose restored.';};
$('animate-pose').onclick=()=>{const playing=poser.play(performance.now());$('animate-pose').textContent=playing?'Stop animation':'Animate this pose';$('pose-status').textContent=playing?'Gizmobot looks around and waves from your pose. Stop to keep editing.':'Your pose is restored.';};

async function init() {
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  const pmrem=new THREE.PMREMGenerator(renderer), room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.04).texture;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff,0xc9c9b8,2));
  const light=new THREE.DirectionalLight(0xfff7eb,2.5);light.position.set(-3,7,-6);scene.add(light);
  const grid=new THREE.GridHelper(12,24,0xcdd0c4,0xdfe1d8);grid.position.y=-1.45;grid.material.transparent=true;grid.material.opacity=.45;scene.add(grid);
  const response=await fetch('assets/assembly-manifest.json');if(!response.ok)throw new Error('The assembly instructions could not be loaded.');manifest=await response.json();
  const gltf=await new GLTFLoader().loadAsync('assets/gizmobot-assembly.glb');robot=gltf.scene.getObjectByName(manifest.parent);scene.add(robot);
  for(const p of manifest.parts){const object=robot.getObjectByName(p.node);if(!object)throw new Error(`Missing part: ${p.label}`);parts.set(p.node,{object,definition:p});const b=document.createElement('button');b.id=p.node;b.onclick=()=>select(p);$('parts').append(b);}
  poser=createPoser(robot,manifest,parts);$('progress').max=manifest.parts.length;
  ghostGroup=new THREE.Group();ghostGroup.position.copy(robot.position);ghostGroup.scale.copy(robot.scale);scene.add(ghostGroup);
  ring=new THREE.Mesh(new THREE.TorusGeometry(.12,.014,8,40),new THREE.MeshBasicMaterial({color:0xee922f,depthTest:false,transparent:true}));ring.renderOrder=5;ghostGroup.add(ring);ring.visible=false;
  setView();resize();new ResizeObserver(resize).observe(viewport);reset();
  $('loading').hidden=true;for(const id of ['start','reset','view'])$(id).disabled=false;
  renderer.setAnimationLoop(time=>{
    if(snapping){const t=reducedMotion?1:Math.min(1,(time-snapping.time)/320);parts.get(snapping.part.node).object.position.lerpVectors(snapping.from,home(snapping.part),1-(1-t)**3);if(t===1)completeSnap();}
    if(selected){ring.scale.setScalar(reducedMotion?1:1+Math.sin(time*.005)*.1);ring.quaternion.copy(camera.quaternion);const p=robot.localToWorld(home(selected)).project(camera);$('target-label').style.left=`${(p.x*.5+.5)*viewport.clientWidth}px`;$('target-label').style.top=`${(-p.y*.5+.5)*viewport.clientHeight+viewport.offsetTop}px`;}
    poser.tick(time);
    renderer.render(scene,camera);
  });
}
init().catch(error=>{$('loading').textContent='Gizmobot could not load. Check your connection and reload this page.';console.error(error);});
