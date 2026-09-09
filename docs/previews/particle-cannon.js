import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { accessoryRigURL, loadParticleCannon, attachParticleCannon } from '../../polished/kit/js/particleCannon.js';

const $ = id => document.getElementById(id);
const renderer = new THREE.WebGLRenderer({canvas:$('scene'),antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .95;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e8edf2');
const pmrem = new THREE.PMREMGenerator(renderer);
const environment = new RoomEnvironment();
const environmentTarget = pmrem.fromScene(environment);
scene.environment = environmentTarget.texture;
environment.dispose(); pmrem.dispose();
const camera = new THREE.PerspectiveCamera(34,1,.01,100);
const controls = new OrbitControls(camera,renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff,0x768398,.8));
const light = new THREE.DirectionalLight(0xffffff,1.5);light.position.set(2,4,-3);scene.add(light);
let mode='solo', side='Left', attachment, robot, cannon, solo, original=false;
const guide = new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(),.13,0x05bfd4,.025,.012);scene.add(guide);
function frame(){
  if(mode==='solo'){camera.position.set(1.8,1,-1.65);controls.target.set(.35,0,0);}
  else{camera.position.set(4.1,2.9,-7);controls.target.set(.15,1.45,0);}
  controls.update();
}
function refresh(){
  if(!robot)return;
  solo.visible=mode==='solo';robot.visible=mode==='robot';
  $('solo').classList.toggle('active',mode==='solo');$('robot').classList.toggle('active',mode==='robot');
  $('swap').textContent=original?'Fit particle cannon':'Show original forearm + hand';
  $('bend-value').textContent=$('bend').value+'°';$('shoulder-value').textContent=$('shoulder').value+'°';
  robot.getObjectByName(side+'Forearm').rotation.y=THREE.MathUtils.degToRad(Number($('bend').value));
  robot.getObjectByName(side+'UpperArm').rotation.z=THREE.MathUtils.degToRad(Number($('shoulder').value));
}
try{
  [cannon,robot] = await Promise.all([loadParticleCannon(),new GLTFLoader().loadAsync(accessoryRigURL.href).then(g=>g.scene)]);
  solo=cannon.clone(true);scene.add(solo,robot);
  attachment=attachParticleCannon(robot,cannon,side);
  $('status').textContent='Ready · Original elbow geometry retained';
  $('solo').onclick=()=>{mode='solo';refresh();frame();};
  $('robot').onclick=()=>{mode='robot';refresh();frame();};
  $('bend').oninput=$('shoulder').oninput=refresh;
  $('side').onchange=()=>{
    attachment?.detach();
    robot.getObjectByName(side+'Forearm').rotation.set(0,0,0);
    robot.getObjectByName(side+'UpperArm').rotation.set(0,0,0);
    side=$('side').value;original=false;attachment=attachParticleCannon(robot,cannon,side);refresh();
  };
  $('swap').onclick=()=>{original=!original;if(original){attachment.detach();attachment=null;}else attachment=attachParticleCannon(robot,cannon,side);refresh();};
  $('reset').onclick=()=>{$('bend').value=0;$('shoulder').value=0;refresh();frame();};
  refresh();frame();
}catch(error){$('status').textContent='Unable to load asset: '+error.message;console.error(error);}
const position=new THREE.Vector3(),direction=new THREE.Vector3();
renderer.setAnimationLoop(()=>{
  if(renderer.domElement.width!==Math.round(innerWidth*renderer.getPixelRatio())||renderer.domElement.height!==Math.round(innerHeight*renderer.getPixelRatio())){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
  controls.update();
  const emitter=mode==='solo'?solo?.getObjectByName('MuzzleEmission'):attachment?.emitter;
  guide.visible=!!emitter;
  if(emitter){emitter.updateWorldMatrix(true,false);position.setFromMatrixPosition(emitter.matrixWorld);direction.set(1,0,0).transformDirection(emitter.matrixWorld);guide.position.copy(position);guide.setDirection(direction);}
  renderer.render(scene,camera);
});
