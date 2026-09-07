import { START_POSE, POSE_PRESETS, PARTS, ROTATION_KEYS, NODE_LABELS, FINGER_LIMITS } from './config.js?v=selector5';
import { animate01, clearAnims } from './anim.js?v=selector5';
import { joints, setJoint, setJoints, selectNode, resetPickup, getInfluencedParts } from './arm.js?v=selector5';
const dock=document.getElementById('dock'), picker=document.getElementById('part-picker');
const sliderBox=document.getElementById('movement-sliders');
const grip=document.getElementById('slider-grip'), listeners=[];
let selected='shoulder', resetPose=START_POSE, fullRotation=false;
const chainPart=part=>['mitt','pointer','thumb'].includes(part)?'fingers':part;
export function setLessonFocus(part,expanded) {
 fullRotation=expanded;
 document.querySelectorAll('[data-chain]').forEach(el=>{
  if(el.dataset.chain===chainPart(part)) el.setAttribute('aria-current','step'); else el.removeAttribute('aria-current');
 });
}
export function onControlChange(fn){listeners.push(fn);}
function emit(key){listeners.forEach(fn=>fn(key));}
picker.addEventListener('partselect',event=>choosePart(event.detail));
export function choosePart(part){
 selected=part;selectNode(part);
 const influenced=getInfluencedParts(part).map(chainPart);
 document.querySelectorAll('[data-chain]').forEach(el=>{
  el.classList.toggle('selected',el.dataset.chain===chainPart(part));
  el.classList.toggle('following',influenced.includes(el.dataset.chain));
 });
 picker.dispatchEvent(new CustomEvent('selectionchange',{detail:part}));
 document.getElementById('selected-part').textContent=part==='base'?'Whole arm':NODE_LABELS[part];
 buildSliders();
}
function buildSliders(){
 sliderBox.replaceChildren();
 const labels=selected==='thumb'?['Bend','Turn','Twist']:['Twist','Turn','Bend'];
 const axes=['x','y','z'];
 const primary=axes.find(axis=>ROTATION_KEYS[selected][axis]===selected);
 const finger=selected in FINGER_LIMITS;
 for(const axis of [primary,...axes.filter(axis=>axis!==primary)]){
  if(finger && axis!==primary) continue;
  const i=axes.indexOf(axis);
  const key=ROTATION_KEYS[selected][axis];
  const row=document.createElement('div');row.className='ctl on';
  const label=document.createElement('label');label.className='ctl-label';label.htmlFor='motion-'+axis;label.textContent=finger?'Open / close':labels[i];
  const input=document.createElement('input');input.id='motion-'+axis;input.type='range';input.dataset.key=key;
  input.min=finger?'0':'-180';input.max=finger?String(FINGER_LIMITS[selected]):'180';input.step='1';
  input.setAttribute('aria-label',(finger?'Open / close':labels[i])+' '+(selected==='base'?'whole arm':NODE_LABELS[selected]));
  input.addEventListener('input',()=>{clearAnims();setJoint(key,Number(input.value));syncFromValues();emit(key);});
  const ends=document.createElement('div');ends.className='ctl-ends';ends.innerHTML=finger?'<span>open</span><span>closed</span>':'<span>one way</span><span>the other</span>';
  row.classList.toggle('finger-control',finger);
  row.append(label,input,ends);sliderBox.append(row);
 }
 syncFromValues();
}
grip.addEventListener('input',()=>{clearAnims();setJoint('grip',Number(grip.value));syncFromValues();emit('grip');});
export function syncFromValues(){
 for(const input of sliderBox.querySelectorAll('input')){
  const v=joints[input.dataset.key];input.value=(v < -180 || v > 180)?((v+180)%360+360)%360-180:v;paint(input);
 }
 grip.value=joints.grip;paint(grip);
}
function paint(input){input.style.setProperty('--fill',((Number(input.value)-Number(input.min))/(Number(input.max)-Number(input.min))*100)+'%');}
export function revealControls(parts,title='Choose a part'){
 const available=parts.filter(p=>PARTS.includes(p));

 dock.querySelector('.dock-heading').textContent=title;dock.classList.add('on');
 document.getElementById('grip-control').hidden=!parts.includes('grip');
 choosePart(available.includes(selected)?selected:available[0]);
}
export function setFreePlay(on){document.getElementById('pose-presets').hidden=!on;}
export function lockDock(on){dock.classList.toggle('locked',on);dock.querySelectorAll('input,button').forEach(el=>{el.disabled=on;});}
export function moveTo(pose){
 clearAnims();const from={...joints}, target={...START_POSE,...pose};
 animate01(.8,t=>{const patch={};Object.entries(target).forEach(([key,v])=>{if(typeof v==='number')patch[key]=from[key]+(v-from[key])*t;});setJoints(patch);syncFromValues();});
}
export function setResetPose(pose){resetPose=pose;}
document.getElementById('btn-reset-pose').addEventListener('click',()=>{resetPickup();moveTo(resetPose);});
document.getElementById('btn-reach-help').addEventListener('click',()=>{resetPickup();moveTo({...POSE_PRESETS.reach,grip:0});});
for(const [key,pose] of Object.entries(POSE_PRESETS)){
 const b=document.createElement('button');b.type='button';b.textContent=pose.label;
 b.addEventListener('click',()=>{resetPickup();moveTo(pose);});document.getElementById('pose-presets').append(b);
}

