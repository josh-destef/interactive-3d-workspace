import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createRetargeter, connections, demoPose } from './retarget.js';

const $=id=>document.getElementById(id), video=$('video'), overlay=$('skeleton'), ctx=overlay.getContext('2d');
const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(34,1,.1,100);
let renderer,rig,worker,workerReady=false,stream=null,busy=false,session=0,modelTimer,frameTimer;
let mode='idle',frozen=false,lastVideo=-1,lastFrame=0,lastSeen=0,lastTick=performance.now(),latest=null,hadPose=false;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;

function status(text){if($('status').textContent!==text)$('status').textContent=text;}
function setMode(next){
  mode=next;
  $('mode').textContent={idle:'CAMERA OFF',starting:'CONNECTING',camera:'LIVE MIRROR',demo:'DEMO MODE'}[mode];
  $('status-dot').classList.toggle('live',mode==='camera'||mode==='demo');
  $('camera').innerHTML=mode==='starting'?'Cancel':mode==='camera'?'Stop camera <span>■</span>':'Start camera <span>↗</span>';
  $('demo').textContent=mode==='demo'?'Stop demo':'Try a demo first';
  $('freeze').disabled=!['camera','demo'].includes(mode);$('center').disabled=mode!=='camera';
  $('preview-label').textContent=mode==='demo'?'DEMO · NO CAMERA':mode==='camera'?'YOU · MIRRORED':'CAMERA OFF';
  $('camera-placeholder').hidden=mode==='camera'||mode==='demo';
  $('stage-hint').textContent=mode==='demo'?'A little wave. A little groove. Your turn?':mode==='camera'?'Move like you’re looking in a mirror.':'Your moves look good in metal.';
}
function clearOverlay(){ctx.clearRect(0,0,overlay.width,overlay.height);}
function stop(message='Camera off. Come back for another dance anytime.'){
  ++session;clearTimeout(modelTimer);clearTimeout(frameTimer);worker?.terminate();worker=null;workerReady=false;busy=false;
  stream?.getTracks().forEach(t=>t.stop());stream=null;video.pause();video.srcObject=null;
  frozen=false;$('freeze').textContent='Freeze pose';latest=null;hadPose=false;lastSeen=0;lastVideo=-1;rig?.reset();
  clearOverlay();setMode('idle');$('fps').textContent='LIVE INPUT';status(message);
}
function fail(error){
  console.error(error);
  const messages={NotAllowedError:'Camera access was blocked. Allow it in your browser’s site settings, then try again.',NotFoundError:'No camera found. Connect a webcam, or try the demo.',NotReadableError:'Your camera is busy. Close other camera apps, then try again.'};
  stop(messages[error.name]||error.message||'The camera could not start. Try again, or play the demo.');
}
function startWorker(token){
  const current=new Worker(new URL('./pose-worker.js',import.meta.url));worker=current;
  modelTimer=setTimeout(()=>{if(token===session)fail(new Error('The pose model took too long to load. Check your connection and try again.'));},60000);
  current.onerror=()=>{if(token===session)fail(new Error('Pose tracking could not load. Check your connection and try again.'));};
  current.onmessage=({data})=>{
    if(token!==session)return;
    if(data.type==='ready'){
      clearTimeout(modelTimer);workerReady=true;setMode('camera');status('Find your frame. Show your face, shoulders and hands.');
    }else if(data.type==='error'){fail(new Error('Pose tracking stopped. Try starting the camera again.'));}
    else if(data.type==='pose'){
      clearTimeout(frameTimer);busy=false;latest=data.landmarks;
      const tracked= data.world && (frozen ? true : rig.update(data.world,data.landmarks,$('legs').checked));
      if(tracked){lastSeen=performance.now();hadPose=true;status(frozen?'Pose frozen. Unfreeze to move again.':data.landmarks?.[27]?.visibility>.55&&$('legs').checked?'Got you. Wave, lean, or lift a knee!':'Got you. Your upper body is driving Gizmobot.');}
      else if(performance.now()-lastSeen>800){status(hadPose?'Lost you for a moment. Step into the frame.':'Show your shoulders and hips. Step back a little if needed.');latest=null;}
      $('fps').textContent=tracked?'POSE FOUND':'FINDING YOU';
    }
  };
  current.postMessage({type:'init'});
}
async function startCamera(){
  stop('Waiting for camera permission…');const token=session;setMode('starting');
  try{
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('Camera access needs HTTPS or localhost. Open this lab from a local server or a secure site.');
    const next=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:480},frameRate:{ideal:30,max:30}}});
    if(token!==session){next.getTracks().forEach(t=>t.stop());return;}
    stream=next;video.srcObject=stream;
    stream.getVideoTracks()[0].onended=()=>{if(token===session)stop('Camera disconnected. Reconnect it and try again.');};
    await video.play();if(token!==session)return;
    overlay.width=video.videoWidth;overlay.height=video.videoHeight;$('preview').style.aspectRatio=`${video.videoWidth}/${video.videoHeight}`;
    $('camera-placeholder').hidden=true;$('preview-label').textContent='YOU · CONNECTING';status('Loading pose tracking. First visit takes a few seconds…');startWorker(token);
  }catch(error){if(token===session)fail(error);}
}
function drawPose(points){
  clearOverlay();if(!points||!$('dots').checked)return;
  const w=overlay.width,h=overlay.height;
  ctx.lineWidth=3;ctx.strokeStyle=mode==='demo'?'#719747':'#c8f578';ctx.fillStyle=mode==='demo'?'#466e40':'#fbfff0';
  for(const [a,b] of connections){if((points[a]?.visibility??0)<.55||(points[b]?.visibility??0)<.55)continue;ctx.beginPath();ctx.moveTo(points[a].x*w,points[a].y*h);ctx.lineTo(points[b].x*w,points[b].y*h);ctx.stroke();}
  for(const i of new Set(connections.flat())){const p=points[i];if((p?.visibility??0)<.55)continue;ctx.beginPath();ctx.arc(p.x*w,p.y*h,4,0,Math.PI*2);ctx.fill();}
}
async function sendFrame(time){
  if(mode!=='camera'||!workerReady||busy||video.readyState<2||video.currentTime===lastVideo||time-lastFrame<50||document.hidden)return;
  busy=true;lastVideo=video.currentTime;lastFrame=time;const token=session,current=worker;
  try{
    const frame=await createImageBitmap(video);
    if(token!==session){frame.close();return;}
    current.postMessage({type:'frame',frame,timestamp:time},[frame]);
    frameTimer=setTimeout(()=>{if(token===session)fail(new Error('Pose tracking is not responding. Restart the camera to reconnect.'));},10000);
  }catch(error){if(token===session)fail(error);}
}
$('camera').onclick=()=>mode==='camera'||mode==='starting'?stop():startCamera();
$('demo').onclick=()=>{
  if(mode==='demo'){stop('Your turn. Start the camera to be the bot.');return;}
  stop();setMode('demo');overlay.width=640;overlay.height=480;$('preview').style.aspectRatio='4/3';status('A sample dance, using the same pose mapping. Start your camera to take over.');
};
$('freeze').onclick=()=>{frozen=!frozen;$('freeze').textContent=frozen?'Unfreeze pose':'Freeze pose';status(frozen?'Pose frozen. Unfreeze to move again.':mode==='demo'?'Demo is moving again.':'Back to you. Keep moving!');};
$('center').onclick=()=>{rig.recenter();status('Centre reset. Your next tracked pose is the new starting point.');};
$('smooth').oninput=()=>{$('smooth-value').textContent=$('smooth').value<30?'Snappy':$('smooth').value>75?'Floaty':'Balanced';};
$('dots').onchange=()=>drawPose(latest);
window.addEventListener('pagehide',()=>stop());
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(mode==='camera'||mode==='starting'))stop('Camera stopped while you were away. Start it again when you’re ready.');});

async function init(){
  renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.04).texture;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff,0xb0c895,2));const key=new THREE.DirectionalLight(0xfff2d7,3);key.position.set(-3,6,-5);scene.add(key);
  const rim=new THREE.DirectionalLight(0xd4ecc6,2);rim.position.set(3,3,4);scene.add(rim);
  const [manifest,gltf]=await Promise.all([fetch('../robot-assembly/assets/assembly-manifest.json').then(r=>{if(!r.ok)throw new Error('Model manifest unavailable');return r.json();}),new GLTFLoader().loadAsync('../robot-assembly/assets/gizmobot-assembly.glb')]);
  const robot=gltf.scene.getObjectByName(manifest.parent);if(!robot)throw new Error('Gizmobot model missing');
  robot.position.set(0,0,0);robot.rotation.set(0,0,0);robot.scale.setScalar(1);scene.add(robot);rig=createRetargeter(robot,manifest);
  const bounds=new THREE.Box3().setFromObject(robot),floorY=bounds.min.y-.015;
  const platform=new THREE.Mesh(new THREE.CylinderGeometry(1.25,1.32,.07,96),new THREE.MeshStandardMaterial({color:0xd6dfbf,roughness:.95}));platform.position.set(0,floorY-.035,0);scene.add(platform);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.2,.008,8,96),new THREE.MeshBasicMaterial({color:0x93b578}));ring.rotation.x=Math.PI/2;ring.position.y=floorY+.003;scene.add(ring);
  const grid=new THREE.GridHelper(24,48,0xd2dbc3,0xdce4cf);grid.position.y=floorY-.08;grid.material.transparent=true;grid.material.opacity=.4;scene.add(grid);
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=128;const s=shadowCanvas.getContext('2d'),gradient=s.createRadialGradient(64,64,2,64,64,64);gradient.addColorStop(0,'rgba(48,66,31,.28)');gradient.addColorStop(1,'rgba(48,66,31,0)');s.fillStyle=gradient;s.fillRect(0,0,128,128);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(1.8,1.2),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.set(0,floorY+.004,0);scene.add(shadow);
  function resize(){const {clientWidth:w,clientHeight:h}=$('scene').parentElement;renderer.setSize(w,h,false);camera.aspect=w/h;camera.position.set(0,2.8,-Math.max(8,6.4/camera.aspect));camera.lookAt(0,1.4,0);camera.updateProjectionMatrix();}
  new ResizeObserver(resize).observe($('scene').parentElement);resize();$('loading').hidden=true;$('camera').disabled=false;$('demo').disabled=false;
  renderer.setAnimationLoop(time=>{
    const dt=Math.min(.1,(time-lastTick)/1000);lastTick=time;
    if(mode==='demo'){
      if(!frozen){const pose=demoPose(time/1000);rig.update(pose.world,pose.landmarks,$('legs').checked);latest=pose.landmarks;}drawPose(latest);
    }else if(mode==='camera'){
      sendFrame(time);drawPose(latest);
      if(hadPose&&time-lastSeen>1800&&!frozen){rig.reset();hadPose=false;}
    }
    if(!frozen)rig.tick(dt,Number($('smooth').value)/100);
    if(mode==='idle'&&!reducedMotion)rig.parts.get('Head').rotation.y=Math.sin(time*.0006)*.12;
    shadow.position.x=robot.position.x;renderer.render(scene,camera);
  });
}
init().catch(error=>{console.error(error);$('loading').textContent='Gizmobot could not load. Check your connection, then reload.';status('The 3D stage needs WebGL and an internet connection for its libraries.');});
