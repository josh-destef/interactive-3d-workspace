import {createAnimation, DOWN, RAISED, hasRaise, hasWave} from './model.js';
import {createScene} from './scene.js';

const $=id=>document.getElementById(id);
const learner=createAnimation(), example=createAnimation();
const wave=[{time:0,pose:DOWN},{time:1,pose:RAISED},{time:2,pose:{arm:65,wrist:-30}},{time:3,pose:{arm:65,wrist:30}},{time:4,pose:DOWN}];
const lessons=[
 ['Hello','Hello, Gizmobot!','Let’s make Gizmobot wave hello. Animation changes a model’s pose over time. Start by watching the little hello you’ll make.'],
 ['Explore','Two poses. One movement.','A keyframe is a saved pose at a particular moment. The timeline shows when it happens. Drag the green playhead between the two diamonds: the computer creates the motion between them.'],
 ['Watch','Make the first movement','Follow each action in the controls below. Moving through time chooses when. Rotating the arm chooses what the pose looks like.'],
 ['Your Turn','Raise the arm','Save an arm-down pose at the beginning, then an arm-up pose a little later. Play your saved movement from the start.'],
 ['Watch','A little back and forth','Keep the arm raised and turn the wrist one way, then the other at later times. Each saved pose adds another part of the wave.'],
 ['Your Turn','Make Gizmobot wave','Keep your first movement. Add two later poses with the arm raised and the wrist tilting back and forth, then play the whole wave.'],
 ['Made by you','Hello, animator!','Keyframes save poses, and the computer creates the motion between them. Replay your wave, or experiment: visit a diamond, change a pose, and update its keyframe.']
];
let stage=0, joint=null, scene, ready=false, demoStep=-1, demoDone=false, explored=false, previewed=false;
let playedKeys='', playStart=null, previousPlaying=false;
const model=()=>[3,5,6].includes(stage)?learner:example;
const signature=()=>JSON.stringify(learner.getState().keys);
function chooseJoint(name){joint=name;scene?.selectJoint(name);render();}
function highlight(id){document.querySelectorAll('.demo-focus').forEach(e=>e.classList.remove('demo-focus'));if(id)$(id).classList.add('demo-focus');}
function say(text){if($('feedback').textContent!==text)$('feedback').textContent=text;}
function guidance(s){
 if(stage===0)return previewed?'That’s the goal! Now discover how two saved poses create movement.':'Press Watch the wave when you’re ready.';
 if(stage===1)return explored?'You found an in-between pose. Only the diamonds are saved; the computer makes the rest.':'Drag the time slider to somewhere between 0 and 1 second.';
 if(stage===2||stage===4)return demoStep<0?'Press Start demonstration. Each click shows one action.':null;
 if(stage===6)return 'You made Gizmobot wave! Choose a saved diamond to change it, or try saving a pose at a different time.';
 if(!joint)return 'Select Arm to show its rotation control. The orange highlight marks the joint you can move.';
 if(s.dirty)return `This pose isn’t saved yet. Press ${s.keys.some(k=>Math.abs(k.time-s.time)<.05)?'Update':'Save'} keyframe to keep it at ${s.time.toFixed(1)} seconds.`;
 if(!s.keys.some(k=>k.time<=.3&&k.pose.arm< -40))return 'Return to Start, lower the arm using the slider, then save your first keyframe.';
 if(!hasRaise(s.keys))return 'Move time to about 1 second. Raise the arm toward Up, then save another keyframe.';
 if(stage===5&&!hasWave(s.keys))return 'At three later moments (try 1, 2 and 3 seconds), keep the arm up and save the wrist tilted right, left, then right. Select Wrist to tilt it.';
 if(playedKeys!==signature())return 'Your saved poses are ready. Press Start, then Play and watch the full animation.';
 return stage===3?'You made the arm move between two saved poses. Ready to turn it into a wave?':'That’s a wave! You saved the poses and the computer joined them together.';
}
function render(){
 const s=model().getState(), practice=[3,5,6].includes(stage), watch=stage===2||stage===4;
 scene?.setPose(s.pose);
 $('time-display').textContent=`${s.time.toFixed(1)} s`;$('playhead').value=s.time;$('playhead-line').style.left=`${s.time/4*100}%`;
 $('play').textContent=s.playing?'Ⅱ Pause':'▶ Play';
 // Rebuild marker buttons only when saved poses change, preserving keyboard focus while scrubbing.
 const markerSignature=JSON.stringify(s.keys);
 if($('key-markers').dataset.keys!==markerSignature){
  $('key-markers').dataset.keys=markerSignature;$('key-markers').replaceChildren();
  s.keys.forEach(k=>{const b=document.createElement('button');b.textContent='◆';b.style.left=`${k.time/4*100}%`;b.dataset.time=k.time;b.setAttribute('aria-label',`Saved pose at ${k.time.toFixed(1)} seconds`);b.onclick=()=>seek(k.time);$('key-markers').append(b);});
 }
 for(const b of $('key-markers').children){b.setAttribute('aria-current',String(Math.abs(Number(b.dataset.time)-s.time)<.05));b.disabled=watch;}
 $('select-arm').setAttribute('aria-pressed',String(joint==='arm'));$('select-wrist').setAttribute('aria-pressed',String(joint==='wrist'));
 const wrist=joint==='wrist';$('rotation').min=wrist?-45:-85;$('rotation').max=wrist?45:75;$('rotation').value=wrist?s.pose.wrist:s.pose.arm;
 $('rotation-label').textContent=wrist?'Tilt the wrist':'Raise the arm';$('rotation-value').textContent=`${Math.round(wrist?s.pose.wrist:s.pose.arm)}°`;
 $('low-label').textContent=wrist?'Left':'Down';$('high-label').textContent=wrist?'Right':'Up';
 $('pose-controls').hidden=stage<2;$('rotation').disabled=!practice||!joint||s.playing;
 $('select-arm').disabled=!practice;$('select-wrist').disabled=!practice;
 $('save').textContent=s.keys.some(k=>Math.abs(k.time-s.time)<.05)?'◆ Update keyframe':'◆ Save keyframe';$('save').disabled=!practice||!joint||s.playing;
 $('undo').disabled=!practice||!s.canUndo;$('delete').disabled=!practice||!s.keys.some(k=>Math.abs(k.time-s.time)<.05);$('reset').disabled=!practice;
 $('pose-note').textContent=s.dirty?'Unsaved pose · save it before moving through time.':'Each diamond saves the arm and wrist together.';
 $('playhead').disabled=!ready||watch;$('beginning').disabled=!ready||watch;$('play').disabled=!ready||watch||s.keys.length<2;
 $('demo').disabled=!ready;$('demo').hidden=![0,2,4].includes(stage);
 $('next').hidden=stage===6;
 $('next').disabled=!ready||(stage===0&&!previewed)||(stage===1&&!explored)||(watch&&!demoDone)||(stage===3&&(!hasRaise(s.keys)||playedKeys!==signature()))||(stage===5&&(!hasWave(s.keys)||playedKeys!==signature()));
 $('stage-status').textContent=s.playing?'Playing saved poses':s.dirty?'Pose changed · not yet saved':joint?`${joint==='arm'?'Arm':'Wrist'} selected`:'Click the waving arm or use the joint buttons';
 const text=guidance(s);if(text)say(text);
}
function seek(t){model().seek(Number(t));if(stage===1&&t>.1&&t<.9)explored=true;render();}
function enter(next){
 model().pause();stage=next;joint=null;scene?.selectJoint(null);demoStep=-1;demoDone=false;playStart=null;previousPlaying=false;highlight(null);
 const [mode,title,body]=lessons[stage];$('mode').textContent=mode;$('title').textContent=title;$('body').textContent=body;$('step-count').textContent=`${stage+1} / 7`;$('progress').value=stage+1;document.body.classList.toggle('success',stage===6);
 $('next').textContent=['Discover keyframes →','Watch how it’s made →','Your turn →','Turn it into a wave →','Make your wave →','Finish →',''][stage];
 $('demo').textContent=stage===0?'Watch the wave':'Start demonstration';
 if(stage===0){example.load(wave);example.seek(0);}if(stage===1){example.load(wave.slice(0,2));example.seek(0);}if(stage===2)example.reset();if(stage===4){example.load(wave.slice(0,2));example.seek(1);}
 render();$('title').focus({preventScroll:true});
}
const raiseDemo=[
 ['select-arm','Select Arm. This is the joint we’ll rotate.',()=>chooseJoint('arm')],
 ['playhead','Move the playhead to 0 seconds. This chooses when our first pose happens.',()=>example.seek(0)],
 ['rotation','Lower the arm. This chooses what the starting pose looks like.',()=>example.setPose(DOWN)],
 ['save','Save keyframe. The first diamond remembers this pose at 0 seconds.',()=>example.saveKey()],
 ['playhead','Move to 1 second. Changing time does not save a pose.',()=>example.seek(1)],
 ['rotation','Raise the arm. It has moved, but this new pose is not saved yet.',()=>example.setPose(RAISED)],
 ['save','Save another keyframe. Now two diamonds hold two different poses.',()=>example.saveKey()],
 ['play','Press Play. The computer creates the motion between our saved poses.',()=>{example.seek(0);example.play();}]
];
const waveDemo=[
 ['select-wrist','Select Wrist. Our arm stays raised while the hand tilts.',()=>chooseJoint('wrist')],
 ['playhead','Move the playhead to 2 seconds for our next pose.',()=>example.seek(2)],
 ['rotation','Tilt the wrist toward Left. The raised arm stays in the pose too.',()=>example.setPose({wrist:-30})],
 ['save','Save keyframe. This diamond remembers the arm and wrist together.',()=>example.saveKey()],
 ['playhead','Move to 3 seconds. Another time, another pose.',()=>example.seek(3)],
 ['rotation','Tilt the wrist back toward Right.',()=>example.setPose({wrist:30})],
 ['save','Save the pose. Three raised poses now tilt right, left, then right.',()=>example.saveKey()],
 ['play','Play from the beginning. The same saved poses make a wave. Next, you’ll add your own.',()=>{example.seek(0);example.play();}]
];
$('demo').onclick=()=>{
 if(stage===0){example.seek(0);example.play();previewed=true;render();return;}
 if(demoDone){demoStep=-1;demoDone=false;if(stage===2)example.reset();else{example.load(wave.slice(0,2));example.seek(1);}}
 const steps=stage===2?raiseDemo:waveDemo;demoStep++;const [control,text,action]=steps[demoStep];action();highlight(control);say(text);demoDone=demoStep===steps.length-1;$('demo').textContent=demoDone?'Replay demonstration':`Next action (${demoStep+2} / ${steps.length})`;render();
};
$('next').onclick=()=>enter(stage+1);
$('restart').onclick=()=>{learner.reset();playedKeys='';previewed=false;explored=false;enter(0);};
$('playhead').oninput=e=>seek(e.target.value);$('beginning').onclick=()=>seek(0);
$('play').onclick=()=>{const m=model(),s=m.getState();if(s.playing)m.pause();else{playStart={signature:signature(),time:s.time>=4?0:s.time};m.play();}render();};
$('select-arm').onclick=()=>chooseJoint('arm');$('select-wrist').onclick=()=>chooseJoint('wrist');
$('rotation').oninput=e=>{if(joint)learner.setPose({[joint]:Number(e.target.value)});};
$('save').onclick=()=>learner.saveKey();$('undo').onclick=()=>learner.undo();$('delete').onclick=()=>learner.removeKey();$('reset').onclick=()=>{learner.reset();playedKeys='';render();};$('reset-view').onclick=()=>scene?.resetView();
learner.subscribe(render);example.subscribe(render);
enter(0);
try{
 scene=await createScene({canvas:$('scene'),viewport:$('viewport'),onSelect:name=>{if([3,5,6].includes(stage))chooseJoint(name);}});ready=true;$('loading').hidden=true;render();
 let last=performance.now();function frame(now){const dt=Math.min((now-last)/1000,.1);last=now;const m=model();m.tick(dt);const s=m.getState();if(previousPlaying&&!s.playing&&s.time>=3.95&&m===learner&&playStart?.time<=.1&&playStart.signature===signature()){playedKeys=signature();render();}previousPlaying=s.playing;scene.render();requestAnimationFrame(frame);}requestAnimationFrame(frame);
}catch(error){console.error(error);$('loading').textContent='Gizmobot couldn’t load. Check your connection, then reload this page.';say('The lesson needs the 3D model to load before you can begin.');}
