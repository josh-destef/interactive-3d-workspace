import * as THREE from 'three';

// Rigid action-figure joints: the surfaces keep their shape while child joints follow.
export const jointAxes = name => {
  if(name.includes('LowerLeg'))return [['x','Bend knee',-120,0]];
  if(name.includes('UpperLeg'))return [['x','Swing hip',-60,95],['z','Spread leg',-35,35],['y','Twist thigh',-45,45]];
  if(name.includes('Foot'))return [['x','Tilt ankle',-40,40],['z','Roll foot',-25,25]];
  if(name.includes('Forearm'))return [['y','Bend elbow',-120,120],['z','Lift forearm',-120,120]];
  if(name.includes('UpperArm'))return [['z','Raise shoulder',-150,150],['y','Swing arm',-100,100],['x','Twist arm',-90,90]];
  if(name.includes('Hand'))return [['x','Twist wrist',-80,80],['z','Tilt hand',-60,60]];
  if(name==='Head')return [['y','Look left / right',-80,80],['x','Nod',-35,35],['z','Tilt head',-30,30]];
  return [['x','Lean body',-35,35],['y','Turn body',-60,60],['z','Lean sideways',-25,25]];
};

export const presets = {
  // Hello pose authored by the learner, transcribed from their joint readouts.
  'Hello': {
    Torso:{x:-3,y:-4,z:1}, Head:{x:0,y:27,z:4},
    LeftUpperArm:{x:75,y:-1,z:-23}, RightUpperArm:{x:-11,y:-7,z:39},
    LeftForearm:{y:52,z:1}, RightForearm:{y:-35,z:0},
    LeftHand:{x:8,z:2}, RightHand:{x:0,z:0},
    LeftUpperLeg:{x:37,y:5,z:15}, RightUpperLeg:{x:0,y:0,z:0},
    LeftLowerLeg:{x:-44}, RightLowerLeg:{x:-11},
    LeftFoot:{x:5,z:-9}, RightFoot:{x:13,z:0},
  },
  'Ready': {LeftUpperArm:{z:-75},RightUpperArm:{z:75}},
  'Wave': {LeftUpperArm:{z:65},LeftForearm:{z:-20},LeftHand:{z:20},RightUpperArm:{z:75},Head:{z:-12}},
  'Stride': {LeftUpperArm:{z:-70,y:-25},RightUpperArm:{z:70,y:-25},LeftUpperLeg:{x:35},LeftLowerLeg:{x:-25},LeftFoot:{x:-10},RightUpperLeg:{x:-25},RightLowerLeg:{x:-20},RightFoot:{x:25}},
  'Crouch': {Torso:{x:15},LeftUpperArm:{z:-40,y:35},RightUpperArm:{z:40,y:-35},LeftUpperLeg:{x:55},RightUpperLeg:{x:55},LeftLowerLeg:{x:-95},RightLowerLeg:{x:-95},LeftFoot:{x:25},RightFoot:{x:25}},
};

export function createPoser(robot, manifest, parts) {
  let enabled=false, playing=false, start=0, beforePlay=null;
  const values={};
  function clear(){for(const p of manifest.parts){values[p.node]={x:0,y:0,z:0};parts.get(p.node).object.rotation.set(0,0,0);}}
  function apply(pose){
    for(const p of manifest.parts){
      const v=values[p.node]={x:0,y:0,z:0,...pose[p.node]};
      parts.get(p.node).object.rotation.set(...['x','y','z'].map(a=>THREE.MathUtils.degToRad(v[a])));
    }
  }
  function enable(){
    if(enabled)return;
    clear();
    for(const p of manifest.parts){
      const o=parts.get(p.node).object;
      if(p.requires){
        const parent=parts.get(p.requires);parent.object.add(o);
        o.position.fromArray(p.assembledPosition).sub(new THREE.Vector3().fromArray(parent.definition.assembledPosition));
      }
    }
    enabled=true;
  }
  function stop(){if(playing){playing=false;apply(beforePlay);}}
  function disable(){stop();for(const p of manifest.parts)robot.add(parts.get(p.node).object);clear();enabled=false;}
  function set(name,axis,value){stop();const limit=jointAxes(name).find(a=>a[0]===axis);values[name][axis]=THREE.MathUtils.clamp(value,limit[2],limit[3]);apply(values);}
  function preset(name){stop();apply(presets[name]||{});}
  function play(time){if(playing){stop();return false;}beforePlay=JSON.parse(JSON.stringify(values));start=time;playing=true;return true;}
  function tick(time){
    if(!playing)return;
    const t=(time-start)/1000,w=Math.sin(t*3);
    // Animate from the learner's pose, with constrained rotations. Pause restores it.
    const pose=JSON.parse(JSON.stringify(beforePlay));
    pose.Head.y=THREE.MathUtils.clamp(pose.Head.y+w*12,-80,80);
    pose.LeftHand.z=THREE.MathUtils.clamp(pose.LeftHand.z+w*20,-60,60);
    apply(pose);
  }
  clear();
  return {enable,disable,set,preset,play,stop,tick,values,get enabled(){return enabled;},get playing(){return playing;}};
}
