import * as THREE from 'three';

export const connections=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,31],[28,32],[0,7],[0,8]];
const v=p=>new THREE.Vector3(p.x,-p.y,p.z);
const valid=p=>p && [p.x,p.y,p.z].every(Number.isFinite) && (p.visibility??1)>.55;
const midpoint=(a,b)=>v(a).add(v(b)).multiplyScalar(.5);
const clamp=THREE.MathUtils.clamp;

export function createRetargeter(robot,manifest) {
  const parts=new Map(manifest.parts.map(p=>[p.node,robot.getObjectByName(p.node)]));
  // The assembly model is authored with rigid pieces at real joint pivots.
  for(const p of manifest.parts){
    const o=parts.get(p.node);if(!o)throw new Error(`Missing joint: ${p.node}`);
    o.position.fromArray(p.assembledPosition);o.quaternion.fromArray(p.assembledQuaternion);o.scale.fromArray(p.assembledScale);
  }
  for(const p of manifest.parts)if(p.requires){const o=parts.get(p.node),parent=parts.get(p.requires);parent.add(o);o.position.sub(new THREE.Vector3().fromArray(manifest.parts.find(x=>x.node===p.requires).assembledPosition));}
  const bindings=[['LeftUpperArm','LeftForearm',11,13],['RightUpperArm','RightForearm',12,14],['LeftForearm','LeftHand',13,15],['RightForearm','RightHand',14,16],['LeftUpperLeg','LeftLowerLeg',23,25],['RightUpperLeg','RightLowerLeg',24,26],['LeftLowerLeg','LeftFoot',25,27],['RightLowerLeg','RightFoot',26,28]];
  const targets=new Map([...parts].map(([name])=>[name,new THREE.Quaternion()]));
  const rest=new Map(bindings.map(([name,child])=>[name,parts.get(child).position.clone().normalize()]));
  const base=robot.position.clone(), move=base.clone();let anchor=null;
  function neutral(){
    for(const q of targets.values())q.identity();
    targets.get('LeftUpperArm').setFromAxisAngle(new THREE.Vector3(0,0,1),-1.3);
    targets.get('RightUpperArm').setFromAxisAngle(new THREE.Vector3(0,0,1),1.3);
  }
  neutral();for(const [name,q] of targets)parts.get(name).quaternion.copy(q);
  function update(world,image,legs=true){
    if(!world||![11,12,23,24].every(i=>valid(world[i])))return false;
    neutral();
    // Mirror convention: camera looks along +Z, so screen-right is model -X.
    const up=midpoint(world[11],world[12]).sub(midpoint(world[23],world[24])).normalize();
    const right=v(world[11]).sub(v(world[12])).normalize();
    const forward=new THREE.Vector3().crossVectors(right,up).normalize();
    right.crossVectors(up,forward).normalize();
    if(forward.lengthSq()<.5||up.lengthSq()<.5)return false;
    targets.get('Torso').setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,forward));
    // Resolve children against their TARGET parent orientation, not a delayed rendered pose.
    const absolute=new Map([['Torso',targets.get('Torso').clone()]]);
    for(const [name,,a,b] of bindings){
      const o=parts.get(name),parent=absolute.get(o.parent.name)||targets.get('Torso');
      if((legs||!name.includes('Leg'))&&valid(world[a])&&valid(world[b])){
        const direction=v(world[b]).sub(v(world[a]));
        if(direction.lengthSq()>.0001){direction.normalize().applyQuaternion(parent.clone().invert());targets.get(name).setFromUnitVectors(rest.get(name),direction);}
      }
      absolute.set(name,parent.clone().multiply(targets.get(name)));
    }
    if(valid(world[7])&&valid(world[8])){
      const ears=v(world[7]).sub(v(world[8])).normalize().applyQuaternion(targets.get('Torso').clone().invert());
      const roll=clamp(Math.atan2(ears.y,ears.x),-.5,.5),yaw=clamp(-Math.atan2(ears.z,ears.x),-.8,.8);
      targets.get('Head').setFromEuler(new THREE.Euler(0,yaw,roll));
    }
    if(image&&[11,12].every(i=>valid(image[i]))){
      const x=(image[11].x+image[12].x)/2,y=(image[11].y+image[12].y)/2;
      const width=Math.max(.1,Math.abs(image[11].x-image[12].x));
      if(!anchor)anchor={x,y,width};
      move.set(base.x+clamp((x-anchor.x)/anchor.width*.85,-1.25,1.25),base.y+clamp((anchor.y-y)/anchor.width*.65,-.4,.5),base.z);
    }
    return true;
  }
  function tick(dt,smoothing=.55){const a=1-Math.exp(-dt/(.035+smoothing*.22));for(const [name,q] of targets)parts.get(name).quaternion.slerp(q,a);robot.position.lerp(move,a);}
  function reset(){neutral();move.copy(base);anchor=null;}
  return {update,tick,reset,recenter(){anchor=null;move.copy(base);},parts,targets};
}

// A synthetic landmark sequence exercises the same retargeting path as the webcam.
export function demoPose(t){
  const p=Array.from({length:33},()=>({x:0,y:0,z:0,visibility:1}));
  const set=(i,x,y,z=0)=>p[i]={x,y,z,visibility:1};
  const lean=Math.sin(t*.8)*.1;
  set(23,.15,0);set(24,-.15,0);set(11,.24+lean,-.5);set(12,-.24+lean,-.5);
  set(0,lean,-.81,-.1);set(7,.09+lean,-.76);set(8,-.09+lean,-.76);
  set(13,.46+lean,-.7);set(15,.47+lean+Math.sin(t*4)*.13,-1.03,-.08);
  set(14,-.39+lean,-.23);set(16,-.46+lean,.03,-.08);
  set(25,.17,.4);set(27,.19,.8);set(26,-.17,.4-Math.max(0,Math.sin(t*1.5))*.18,-.08);set(28,-.19,.8-Math.max(0,Math.sin(t*1.5))*.2,-.03);
  set(31,.2,.85,-.12);set(32,-.2,.85,-.12);
  return {world:p,landmarks:p.map(q=>({...q,x:.5+q.x*.48,y:.53+q.y*.43}))};
}
