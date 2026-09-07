// One movement at a time. Demonstrations are optional and progress is self-paced.
import { START_POSE, TOTAL_BEATS, PARTS, ROTATION_KEYS } from './config.js?v=selector5';
import { state } from './state.js?v=selector5';
import { setCam, orbitCtrl } from './stage.js?v=selector5';
import { clearAnims, runSequence } from './anim.js?v=selector5';
import { joints, setJoints, selectNode, setAxesVisible, resetPickup, isHeld, setTargetVisible } from './arm.js?v=selector5';
import { revealControls, setFreePlay, setResetPose, syncFromValues, lockDock, choosePart, setLessonFocus } from './controls.js?v=selector5';
import { setCaption, showContinue, hideContinue, setProgress, showFinishButton } from './ui.js?v=selector5';
const STEPS=[
 {title:'Start at the shoulder',body:'Bend the shoulder. The highlighted parts follow. The shoulder is a parent: it carries the parts connected after it.',controls:['shoulder'],node:'shoulder',pose:{...START_POSE,shoulder:-15},demo:40,needs:['shoulder'],gate:'Bend the shoulder to continue'},
 {title:'Next comes the elbow',body:'Bend the elbow. It carries the hand, but leaves the shoulder still. The elbow is a child of the shoulder: it follows its parent.',controls:['shoulder','elbow'],node:'elbow',pose:{...START_POSE,shoulder:-25,elbow:30},demo:75,needs:['elbow'],gate:'Bend the elbow to continue'},
 {title:'The wrist carries the hand',body:'Now try bending, turning and twisting the wrist. The highlighted hand and fingers follow. The elbow stays still.',controls:['shoulder','elbow','wrist'],node:'wrist',pose:{...START_POSE,shoulder:-25,elbow:30},demo:45,needs:['wrist'],gate:'Move a wrist slider to continue'},
 {title:'Three children of one hand',body:'Curl the mitt, pointer or thumb. Each finger turns on its own; turning the wrist carries all three. Children of the same parent are siblings.',controls:['shoulder','elbow','wrist','mitt','pointer','thumb','grip'],node:'mitt',pose:{...START_POSE,shoulder:-20,elbow:30},demo:65,needs:['mitt','pointer','thumb','grip'],gate:'Curl a finger to continue'},
 {title:'Your turn: catch the block',body:'Rotate the arm to reach the block. When its ring turns green, close the hand to catch it.',controls:['base','shoulder','elbow','wrist','mitt','pointer','thumb','grip'],node:'wrist',pose:{...START_POSE},demo:null,needs:null,gate:'Move a slider to continue'},
 {title:'You have built a hierarchy',body:'Parents carry children. Each joint turns at its connection, and the parts after it follow. Try your own poses.',controls:['base','shoulder','elbow','wrist','mitt','pointer','thumb','grip'],node:'wrist',demo:null}
];
const demoButton=document.getElementById('btn-replay'), tryHint=document.getElementById('try-hint');
/* Which part each slider key drives, so the gate can tell this step's joint from
   one the student already met. `needs:null` on the challenge takes any of them -
   reaching the block is a whole-arm problem and naming one joint would be a lie. */
const KEY_PART={grip:'grip'};
for(const part of PARTS) for(const key of Object.values(ROTATION_KEYS[part])) KEY_PART[key]=part;
export function runBeat(idx){
 clearAnims();state.beatIdx=idx;state.beatLocked=false;state.pickupTold=false;
 lockDock(false);hideContinue();setAxesVisible(false);
 const step=STEPS[idx];
 setLessonFocus(step.node,idx>=2);
 if(step.pose){resetPickup();setJoints(step.pose);}
 setTargetVisible(idx>=4);setResetPose(step.pose||START_POSE);setFreePlay(idx===TOTAL_BEATS-1);
 if(step.controls.length)revealControls(step.controls,idx===3?'Try a finger':idx===4?'Reach & catch':'Try it');
 choosePart(step.node);setCaption(idx<5?idx+1:'',step.title,step.body);setProgress(idx);
 setCam('hero',idx===0);orbitCtrl.enabled=true;
 demoButton.classList.toggle('on',step.demo!==null);demoButton.disabled=false;demoButton.textContent='Show me';
 document.getElementById('btn-reach-help').hidden=idx!==4;
 document.getElementById('status-badge').className='';
 /* Continue is earned, not waited out. Reading the caption and clicking through
    teaches nothing about a hierarchy; moving the joint and watching its children
    follow is the entire lesson, so the button only arrives once that has
    happened. The last beat is free play and has nothing left to gate. */
 state.moved=false;tryHint.hidden=true;
 if(idx===5)showFinishButton();
 else{tryHint.textContent=step.gate;tryHint.hidden=false;}
 syncFromValues();
}
export function replayBeat(){
 if(state.beatLocked)return;const step=STEPS[state.beatIdx];if(step.demo===null)return;
 const key=step.node,from=joints[key];clearAnims();choosePart(step.node);state.beatLocked=true;lockDock(true);
 demoButton.disabled=true;demoButton.textContent='Watch the arm...';
 const slide=(a,b)=>({duration:1.1,fn:t=>{setJoints({[key]:a+(b-a)*t});syncFromValues();}});
 runSequence([slide(from,step.demo),{duration:.6,fn:()=>{}},slide(step.demo,from)],()=>{
 state.beatLocked=false;lockDock(false);demoButton.disabled=false;demoButton.textContent='Show me';
 });
}
export function checkBeatComplete(key){
 const step=STEPS[state.beatIdx];
 if(!state.moved&&step.gate&&(!step.needs||step.needs.includes(KEY_PART[key]))){
  state.moved=true;tryHint.hidden=true;showContinue();
 }
 if(state.beatIdx===4&&isHeld()&&!state.pickupTold){state.pickupTold=true;setCaption(5,'Now the block follows too','The block is now a child of the hand. Turn the shoulder or elbow to carry it along. Open the hand to let go.');}
}
export function nextBeat(){if(!state.beatLocked&&state.beatIdx<TOTAL_BEATS-1)runBeat(state.beatIdx+1);}

