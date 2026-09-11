import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../js/project.js';

const rounded = values => values.map(value => Math.round(value * 1e8) / 1e8 || 0);

function matrix({ position: p, rotation: r, scale: s }) {
  const [x,y,z]=r,[sx,sy,sz]=s,a=Math.cos(x),b=Math.sin(x),c=Math.cos(y),d=Math.sin(y),e=Math.cos(z),f=Math.sin(z),ae=a*e,af=a*f,be=b*e,bf=b*f;
  return [c*e*sx,(af+be*d)*sx,(bf-ae*d)*sx,0,-c*f*sy,(ae-bf*d)*sy,(be+af*d)*sy,0,d*sz,-b*c*sz,a*c*sz,0,p[0],p[1],p[2],1];
}
function mul(a,b){const o=Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
function world(project,id){const e=project.get(id),local=matrix(e.components.transform);return e.parentId?mul(world(project,e.parentId),local):local;}

test('starts with stable roots and no history', () => {
  const project=createProject();
  assert.deepEqual(project.entities.map(e=>e.id),['gizmobot','creation']);
  assert.deepEqual(project.get('gizmobot').components.transform.rotation,[0,Math.PI,0]);
  assert.equal(project.history.canUndo,false);
});

test('primitive creation selects and is undoable with selection restoration', () => {
  const project=createProject();
  const cube=project.addPrimitive('cube');
  assert.equal(cube.parentId,'creation');
  assert.deepEqual(cube.components.transform.position,[0,.5,0]);
  assert.deepEqual(project.selection.ids,[cube.id]);
  project.history.undo();
  assert.equal(project.get(cube.id),undefined);
  assert.deepEqual(project.selection.ids,[]);
  project.history.redo();
  assert.equal(project.get(cube.id).type,'cube');
  assert.deepEqual(project.selection.ids,[cube.id]);
});

test('primitives spawn on the ground in distinct grid positions', () => {
  const project=createProject();
  const shapes=['cube','sphere','cylinder','cone','plane'].map(type=>project.addPrimitive(type));
  assert.equal(new Set(shapes.map(shape=>`${shape.components.transform.position[0]},${shape.components.transform.position[2]}`)).size,5);
  assert.deepEqual(shapes[1].components.transform.position,[1.5,.6,0]);
  assert.equal(shapes[4].components.transform.position[1],.01);
  assert.equal(shapes[4].components.transform.rotation[0],-Math.PI/2);
});

test('selection alone never creates history', () => {
  const project=createProject();
  project.selection.set('gizmobot');
  project.selection.clear();
  assert.equal(project.history.canUndo,false);
});

test('transactions coalesce live updates and cancel restores snapshot', () => {
  const project=createProject(), cube=project.addPrimitive('cube');
  project.beginTransaction('Move Cube');
  project.updateTransform(cube.id,{position:[1,0,0]});
  project.updateTransform(cube.id,{position:[3,2,1]});
  project.commitTransaction();
  project.history.undo();
  assert.deepEqual(project.get(cube.id).components.transform.position,[0,.5,0]);
  project.history.redo();
  assert.deepEqual(project.get(cube.id).components.transform.position,[3,2,1]);
  project.beginTransaction('Cancelled');
  project.updateTransform(cube.id,{scale:[2,2,2]});
  assert.equal(project.history.undo(),false);
  assert.deepEqual(project.get(cube.id).components.transform.scale,[2,2,2]);
  project.cancelTransaction();
  assert.deepEqual(project.get(cube.id).components.transform.scale,[1,1,1]);
});

test('invalid numeric/component updates are rejected without history', () => {
  const project=createProject(), cube=project.addPrimitive('cube');
  project.history.undo(); project.history.redo();
  assert.throws(()=>project.updateTransform(cube.id,{position:[NaN,0,0]}),/Invalid transform/);
  assert.throws(()=>project.updateTransform(cube.id,{scale:[1,0,1]}),/positive/);
  assert.throws(()=>project.updateGeometry(cube.id,{radius:2}),/Invalid geometry/);
  assert.throws(()=>project.updateMaterial(cube.id,{roughness:Infinity}),/Invalid material/);
});

test('duplicate copies an entire subtree with stable distinct IDs', () => {
  const project=createProject(), a=project.addPrimitive('cube'), b=project.addPrimitive('sphere');
  project.selection.set([a.id,b.id]);
  const group=project.group();
  const duplicate=project.duplicate(group.id);
  assert.deepEqual(duplicate.components.transform.position,[.35,0,.35]);
  const originalKids=project.children(group.id), copiedKids=project.children(duplicate.id);
  assert.equal(copiedKids.length,2);
  assert.equal(new Set([...originalKids,...copiedKids].map(e=>e.id)).size,4);
  assert.deepEqual(copiedKids.map(e=>e.type),originalKids.map(e=>e.type));
  project.history.undo();
  assert.equal(project.get(duplicate.id),undefined);
  project.history.redo();
  assert.equal(project.children(duplicate.id).length,2);
});

test('reparent preserves world transform through rotated uniformly-scaled parents', () => {
  const project=createProject(), cube=project.addPrimitive('cube'), anchor=project.group([cube.id]);
  project.updateTransform(anchor.id,{position:[3,1,-2],rotation:[.3,.5,-.2],scale:[2,2,2]});
  project.updateTransform(cube.id,{position:[1,2,3],rotation:[.1,-.2,.4],scale:[.8,.8,.8]});
  const before=rounded(world(project,cube.id));
  project.reparent(cube.id,'creation');
  assert.deepEqual(rounded(world(project,cube.id)),before);
  project.history.undo();
  assert.equal(project.get(cube.id).parentId,anchor.id);
  assert.deepEqual(rounded(world(project,cube.id)),before);
});

test('Gizmobot is a valid hierarchy container', () => {
  const project=createProject(), cube=project.addPrimitive('cube');
  const before=rounded(world(project,cube.id));
  project.reparent(cube.id,'gizmobot');
  assert.equal(project.get(cube.id).parentId,'gizmobot');
  assert.deepEqual(rounded(world(project,cube.id)),before);
});

test('a primitive can parent another primitive while preserving world placement', () => {
  const project=createProject(), body=project.addPrimitive('cube'), mast=project.addPrimitive('cylinder');
  project.updateTransform(body.id,{position:[-2,1.75,-1],scale:[1.5,.8,.7]});
  project.updateTransform(mast.id,{position:[-2,3,-1],scale:[.3,2,.3]});
  const before=rounded(world(project,mast.id));
  project.reparent(mast.id,body.id);
  assert.equal(project.get(mast.id).parentId,body.id);
  assert.deepEqual(rounded(world(project,mast.id)),before);
});

test('reparent rejects a world-preserving local transform that would shear', () => {
  const project=createProject(), cube=project.addPrimitive('cube'), target=project.group([cube.id]);
  project.reparent(cube.id,'creation');
  project.updateTransform(cube.id,{rotation:[.2,.4,.1]});
  project.updateTransform(target.id,{rotation:[.1,.7,.2],scale:[2,1,3]});
  assert.throws(()=>project.reparent(cube.id,target.id),/shear/);
  assert.equal(project.get(cube.id).parentId,'creation');
});

test('ungroup preserves child world placement and is undoable', () => {
  const project=createProject(), cube=project.addPrimitive('cube'), group=project.group([cube.id]);
  project.updateTransform(group.id,{position:[1,2,3],rotation:[0,.5,0],scale:[2,2,2]});
  const before=rounded(world(project,cube.id));
  project.ungroup(group.id);
  assert.equal(project.get(cube.id).parentId,'creation');
  assert.deepEqual(rounded(world(project,cube.id)),before);
  project.history.undo();
  assert.equal(project.get(cube.id).parentId,group.id);
});

test('restore validates structure, clears selection and history', () => {
  const project=createProject(); project.addPrimitive('plane');
  const data=project.serialize();
  project.restore(data);
  assert.equal(project.history.canUndo,false);
  assert.deepEqual(project.selection.ids,[]);
  const invalid=structuredClone(data); invalid.entities[1].components.transform.position[0]=Infinity;
  assert.throws(()=>project.restore(invalid),/Invalid transform/);
  const cycle=structuredClone(data); cycle.entities[0].parentId='gizmobot';
  assert.throws(()=>project.restore(cycle),/Hierarchy cycle/);
  const parentedRoot=structuredClone(data); parentedRoot.entities.find(e=>e.id==='creation').parentId='gizmobot';
  assert.throws(()=>project.restore(parentedRoot),/unparented creation root/);
  const primitiveParent=structuredClone(data);
  const plane=primitiveParent.entities.find(e=>e.type==='plane');
  primitiveParent.entities.push({...structuredClone(plane),id:'child-plane',parentId:plane.id});
  assert.doesNotThrow(()=>project.restore(primitiveParent));
  assert.equal(project.get('child-plane').parentId,plane.id);
});

test('history bounds full snapshots to the latest 100 actions', () => {
  const project=createProject();
  for(let i=0;i<105;i++) project.rename('gizmobot',`Gizmobot ${i}`);
  let undos=0;
  while(project.history.undo()) undos++;
  assert.equal(undos,100);
  assert.equal(project.get('gizmobot').name,'Gizmobot 4');
});

test('protected creation root cannot be structurally changed', () => {
  const project=createProject();
  assert.throws(()=>project.remove('creation'),/protected/);
  assert.throws(()=>project.reparent('creation',null),/protected/);
  assert.throws(()=>project.ungroup('creation'),/protected/);
});
