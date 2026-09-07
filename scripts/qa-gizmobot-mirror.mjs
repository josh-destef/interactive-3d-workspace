import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
const threeURL=pathToFileURL(path.join(os.tmpdir(),'fundamentals-3d-qa/node_modules/three/build/three.module.js')).href;
const THREE=await import(threeURL);
const source=fs.readFileSync(path.join(root,'polished/labs/gizmobot-mirror/retarget.js'),'utf8').replace("from 'three'",`from '${threeURL}'`);
const {createRetargeter,demoPose}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'polished/labs/robot-assembly/assets/assembly-manifest.json')));
const robot=new THREE.Group();for(const p of manifest.parts){const o=new THREE.Group();o.name=p.node;robot.add(o);}
const rig=createRetargeter(robot,manifest),pose=demoPose(0);
assert.ok(rig.update(pose.world,pose.landmarks));rig.tick(10,0);robot.updateMatrixWorld(true);
assert.equal(rig.parts.get('LeftHand').parent.name,'LeftForearm');
for(const [joint,child,a,b] of [['LeftUpperArm','LeftForearm',11,13],['LeftForearm','LeftHand',13,15],['RightUpperArm','RightForearm',12,14],['LeftUpperLeg','LeftLowerLeg',23,25],['LeftLowerLeg','LeftFoot',25,27]]){
  const actual=rig.parts.get(child).getWorldPosition(new THREE.Vector3()).sub(rig.parts.get(joint).getWorldPosition(new THREE.Vector3())).normalize();
  const expected=new THREE.Vector3(pose.world[b].x-pose.world[a].x,pose.world[a].y-pose.world[b].y,pose.world[b].z-pose.world[a].z).normalize();
  assert.ok(actual.dot(expected)>.999,`${joint} must follow the detected 3D direction`);
}
const length=rig.parts.get('LeftForearm').position.length();
for(let t=0;t<8;t+=.1){const p=demoPose(t);rig.update(p.world,p.landmarks);rig.tick(.1,.5);for(const q of rig.targets.values())assert.ok(q.toArray().every(Number.isFinite));}
assert.equal(rig.parts.get('LeftForearm').position.length(),length,'Limb length must stay fixed');
const moved=pose.landmarks.map(p=>({...p,x:p.x+.2}));rig.update(pose.world,moved);rig.tick(10,0);assert.ok(robot.position.x>0,'Mirror motion should use model +X for image +X');
rig.recenter();rig.update(pose.world,moved);rig.tick(10,0);assert.ok(Math.abs(robot.position.x)<1e-8,'Recenter must establish a new neutral origin');
rig.update(demoPose(1).world,pose.landmarks,false);assert.equal(rig.targets.get('LeftUpperLeg').angleTo(new THREE.Quaternion()),0,'Legs off must restore neutral legs');
const hidden=pose.world.map(p=>({...p,visibility:0}));assert.equal(rig.update(hidden,pose.landmarks),false);assert.equal(rig.update(null,null),false);
const broken=pose.world.map(p=>({...p,x:NaN}));assert.equal(rig.update(broken,pose.landmarks),false);
rig.reset();rig.tick(10,0);assert.ok(robot.position.length()<1e-8);
console.log('PASS: 3D joint directions, attached limbs, fixed lengths, finite animation, mirror translation, recenter, legs off, tracking loss and reset.');
