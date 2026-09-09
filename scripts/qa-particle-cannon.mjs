// Uses the same local Three.js QA dependency as qa-gizmobot-posing.mjs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
const dep=path.join(os.tmpdir(),'fundamentals-3d-qa/node_modules/three');
const threeURL=pathToFileURL(path.join(dep,'build/three.module.js')).href;
const loaderURL=pathToFileURL(path.join(dep,'examples/jsm/loaders/GLTFLoader.js')).href;
const THREE=await import(threeURL);
const {GLTFLoader}=await import(loaderURL);
const helperPath=path.join(root,'polished/kit/js/particleCannon.js');
const helper=fs.readFileSync(helperPath,'utf8').replace("from 'three'",`from '${threeURL}'`)
  .replace("from 'three/addons/loaders/GLTFLoader.js'",`from '${loaderURL}'`)
  .replaceAll('import.meta.url',JSON.stringify(pathToFileURL(helperPath).href));
const {attachParticleCannon}=await import('data:text/javascript;base64,'+Buffer.from(helper).toString('base64'));
function read(name){
  const raw=fs.readFileSync(path.join(root,'assets/models',name));
  assert.equal(raw.readUInt32LE(0),0x46546c67);assert.equal(raw.readUInt32LE(4),2);assert.equal(raw.readUInt32LE(8),raw.length);
  const n=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+n));
  const binary=raw.subarray(28+n);
  return {raw,doc,binary};
}
function rows(asset,index){
  const a=asset.doc.accessors[index],v=asset.doc.bufferViews[a.bufferView];
  const size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type]*({5121:1,5123:2,5125:4,5126:4}[a.componentType]);
  const start=(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||size;
  return Array.from({length:a.count},(_,i)=>asset.binary.subarray(start+i*stride,start+i*stride+size));
}
function surfaceHashes(asset){
  const out=[];
  for(const mesh of asset.doc.meshes)for(const p of mesh.primitives){
    const keys=Object.keys(p.attributes).sort();
    const attrs=keys.map(k=>rows(asset,p.attributes[k]));
    const indexRows=rows(asset,p.indices);
    const ids=indexRows.map(b=>b.length===2?b.readUInt16LE():b.readUInt32LE());
    for(let i=0;i<ids.length;i+=3){
      const hash=createHash('sha256');
      for(const id of ids.slice(i,i+3))for(const a of attrs)hash.update(a[id]);
      out.push(hash.digest('hex'));
    }
  }
  return out.sort();
}
const canonical=read('gizmobot.glb'),rig=read('gizmobot-accessory-rig.glb'),cannonAsset=read('particle-cannon.glb');
assert.deepEqual(surfaceHashes(rig),surfaceHashes(canonical),'every source triangle retains all original vertex attributes');
assert.deepEqual(rig.doc.images,canonical.doc.images,'original embedded textures preserved');
assert.deepEqual(rig.doc.materials,canonical.doc.materials);
const sourceReport=JSON.parse(fs.readFileSync(path.join(root,'assets/models/gizmobot-accessory-rig.report.json')));
assert.equal(createHash('sha256').update(canonical.raw).digest('hex'),sourceReport.sourceSha256);
const tris=cannonAsset.doc.meshes.flatMap(m=>m.primitives).reduce((n,p)=>n+cannonAsset.doc.accessors[p.indices].count/3,0);
assert.ok(tris<20000);
assert.ok(cannonAsset.doc.materials.some(m=>m.extensions?.KHR_materials_transmission?.transmissionFactor>.9));
assert.ok(cannonAsset.doc.materials.some(m=>m.emissiveFactor?.some(x=>x>0)));
assert.ok(!cannonAsset.doc.nodes.some(n=>/ball/i.test(n.name)),'cannon does not duplicate retained elbow ball');
for(const a of cannonAsset.doc.accessors){
  if(a.componentType!==5126)continue;
  for(const row of rows(cannonAsset,cannonAsset.doc.accessors.indexOf(a)))for(let i=0;i<row.length;i+=4)assert.ok(Number.isFinite(row.readFloatLE(i)));
}
// Load actual geometry/hierarchy without decoding images in this headless test.
async function graph(asset){
  const doc=structuredClone(asset.doc);
  doc.materials=[{pbrMetallicRoughness:{baseColorFactor:[1,1,1,1]}}];
  for(const m of doc.meshes)for(const p of m.primitives)p.material=0;
  delete doc.extensionsUsed;delete doc.extensionsRequired;
  const json=Buffer.from(JSON.stringify(doc));const js=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
  const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+js.length+asset.binary.length,8);header.writeUInt32LE(js.length,12);header.writeUInt32LE(0x4e4f534a,16);
  const bh=Buffer.alloc(8);bh.writeUInt32LE(asset.binary.length);bh.writeUInt32LE(0x004e4942,4);
  const buffer=Buffer.concat([header,js,bh,asset.binary]);
  return (await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'')).scene;
}
const robot=await graph(rig),cannon=await graph(cannonAsset);
const rootNode=robot.getObjectByName('Gizmobot');
const world=o=>{o.updateWorldMatrix(true,false);return o.matrixWorld.clone();};
const near=(a,b)=>assert.ok(a.distanceTo(b)<1e-6,`${a.toArray()} != ${b.toArray()}`);
let cases=0;
for(const side of ['Left','Right']){
  const elbow=robot.getObjectByName(side+'Forearm');
  const shoulder=robot.getObjectByName(side+'UpperArm');
  const ball=robot.getObjectByName(side+'ElbowJointSurface');
  const shell=robot.getObjectByName(side+'ForearmSurface');
  const hand=robot.getObjectByName(side+'Hand');
  const opposite=robot.getObjectByName((side==='Left'?'Right':'Left')+'UpperArm');
  const initialBall=world(ball),initialShoulder=world(shoulder),initialOpposite=world(opposite);
  const mount=attachParticleCannon(robot,cannon,side);
  assert.ok(ball.visible);assert.ok(!shell.visible&&!hand.visible);
  assert.deepEqual(world(ball).elements,initialBall.elements);
  assert.deepEqual(world(shoulder).elements,initialShoulder.elements);
  assert.throws(()=>attachParticleCannon(robot,cannon,side),/already/);
  const emitterLocal=mount.emitter.position.clone();
  assert.ok(emitterLocal.x>.805&&Math.abs(emitterLocal.y)<1e-7&&Math.abs(emitterLocal.z)<1e-7);
  for(const angle of [-90,-45,0,45,90])for(const axis of ['y','z']){
    elbow.rotation.set(0,0,0);elbow.rotation[axis]=THREE.MathUtils.degToRad(angle);
    const elbowPoint=elbow.getWorldPosition(new THREE.Vector3());
    const {position,direction}=mount.emissionWorld();
    const expected=emitterLocal.clone();if(side==='Right')expected.applyAxisAngle(new THREE.Vector3(0,1,0),Math.PI);
    expected.applyMatrix4(world(elbow));near(position,expected);
    near(elbow.getWorldPosition(new THREE.Vector3()),elbowPoint);
    near(direction,position.clone().sub(elbowPoint).normalize());
    assert.deepEqual(world(opposite).elements,initialOpposite.elements);
    assert.ok(ball.visible);
    cases++;
  }
  const before=mount.emissionWorld().position.clone();shoulder.rotation.z=.3;
  assert.ok(mount.emissionWorld().position.distanceTo(before)>.1,'shoulder moves cannon');
  shoulder.rotation.set(0,0,0);elbow.rotation.set(0,0,0);
  mount.detach();mount.detach();
  assert.ok(shell.visible&&hand.visible&&ball.visible);
  assert.deepEqual(world(ball).elements,initialBall.elements);
  const again=attachParticleCannon(robot,cannon,side);again.detach();
}
// Socket clearance against actual original ball vertices in elbow-local space.
const leftBall=robot.getObjectByName('LeftElbowJointSurface');
const leftElbow=robot.getObjectByName('LeftForearm');
const toElbow=world(leftElbow).invert().multiply(world(leftBall));
const vertices=leftBall.geometry.attributes.position;
let minClearance=Infinity;
for(let i=0;i<vertices.count;i++){
  const p=new THREE.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(toElbow);
  if(p.x>=.04&&p.x<=.176)minClearance=Math.min(minClearance,.095-Math.hypot(p.y,p.z));
}
assert.ok(minClearance>0,'connector bore clears original ball');
assert.deepEqual(rootNode.scale.toArray(),canonical.doc.nodes[0].scale,'authored nonuniform root scale retained');
// Side grip pads must sit proud of the white housing and still meet it. Buried
// inside the shell they only read as black slits on the finished cannon.
const radial=(match,lo,hi)=>{
  let min=Infinity,max=0;const v=new THREE.Vector3();
  cannon.traverse(o=>{
    if(!o.isMesh||!match(o.name))return;
    o.updateWorldMatrix(true,false);
    const p=o.geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);
      if(v.x<lo||v.x>hi)continue;
      const r=Math.hypot(v.y,v.z);min=Math.min(min,r);max=Math.max(max,r);
    }
  });
  return {min,max};
};
const gripSpan=[.367,.512];
const grip=radial(n=>/^Body_side_grip_/.test(n),...gripSpan);
const housing=radial(n=>/window_shell/.test(n),...gripSpan);
assert.ok(grip.max>housing.max+.01,`side grips must stand proud of the housing: ${JSON.stringify({grip,housing})}`);
assert.ok(grip.min<housing.max,'side grips must still be seated in the housing');
const report={triangles:tris,sourceTrianglesPreserved:14840,rotationCases:cases,bothArms:true,
  reversibleSwap:true,sourceSha256:sourceReport.sourceSha256,minimumSampledSocketClearance:minClearance,
  emissionOutsideMuzzle:true,emissionAxis:'+X',originalElbowPreserved:true,
  gripProudOfHousing:+(grip.max-housing.max).toFixed(4)};
fs.mkdirSync(path.join(root,'docs/qa/particle-cannon'),{recursive:true});
fs.writeFileSync(path.join(root,'docs/qa/particle-cannon/checks.json'),JSON.stringify(report,null,2)+'\n');
// Verify the lesson's target is reachable with the actual scaled rig/emitter,
// not merely a synthetic particle origin. A raised aim must hit; default aim misses.
const simSource=fs.readFileSync(path.join(root,'polished/labs/particle-cannon/js/particles.js'),'utf8').replace("from 'three'",`from '${threeURL}'`);
const sim=await import('data:text/javascript;base64,'+Buffer.from(simSource).toString('base64'));
robot.scale.setScalar(1.25);robot.rotation.y=.34;robot.updateMatrixWorld(true);
robot.position.y-=new THREE.Box3().setFromObject(robot).min.y;
const lessonAttachment=attachParticleCannon(robot,cannon,'Left');
function aimTrial(degrees){
  sim.resetParticles();sim.setTarget({x:5.8,y:3.3,z:-1.85,radius:.65});
  for(const [k,v] of Object.entries({rate:0,life:4,speed:6,spread:0,gravity:9}))sim.setParam(k,v);
  lessonAttachment.elbow.rotation.z=THREE.MathUtils.degToRad(degrees);
  for(let i=0;i<8;i++)sim.emit(lessonAttachment);
  for(let i=0;i<120;i++)sim.updateParticles(1/60,null);
  return sim.getHits();
}
assert.equal(aimTrial(22),0,'challenge is not completed by the initial settings');
assert.equal(aimTrial(40),8,'aim adjustment can complete the real hoop challenge');
lessonAttachment.detach();
console.log('PASS',JSON.stringify(report),'Actual rig target reachability PASS');
