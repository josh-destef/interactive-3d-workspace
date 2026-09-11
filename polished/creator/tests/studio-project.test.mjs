import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../js/project.js';
import { primitiveToMesh, extrudeFace } from '../js/mesh.js';
import { createEditingProject } from '../js/editingProject.js';
import { createAnimation } from '../js/animation.js';

test('edited topology and animation survive files, undo and redo', () => {
  const project = createProject();
  const cube = project.addPrimitive('cube');
  const base = primitiveToMesh(cube);
  project.setMesh(cube.id, base);
  project.setMesh(cube.id, extrudeFace(base, 4, .5));
  assert.equal(project.get(cube.id).components.mesh.faces.length, 10);
  project.history.undo();
  assert.equal(project.get(cube.id).components.mesh.faces.length, 6);
  project.history.redo();
  project.setAnimationSettings({ duration: 48, fps: 24 });
  project.updateAnimation(cube.id, { keys: [
    { frame: 0, interpolation: 'linear', transform: cube.components.transform },
    { frame: 24, interpolation: 'smooth', transform: { ...cube.components.transform, position: [0, 2, 0] } },
  ] });
  const saved = project.serialize();
  const restored = createProject(); restored.restore(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(restored.serialize(), saved);
  assert.throws(() => restored.setAnimationSettings({ duration: 12 }), /keys/);
  assert.equal(restored.animationSettings.duration, 48);
});

test('invalid imported topology, animation and settings preserve the current project', () => {
  const project = createProject(); const cube = project.addPrimitive('cube');
  const original = project.serialize();
  const badMesh = structuredClone(original);
  badMesh.entities.find(e => e.id === cube.id).components.mesh = { vertices: [[0,0,0]], faces: [[0,1,2]] };
  assert.throws(() => project.restore(badMesh));
  const badKeys = structuredClone(original);
  badKeys.entities.find(e => e.id === cube.id).components.animation = { keys: [{ frame: -1, transform: cube.components.transform, interpolation: 'linear' }] };
  assert.throws(() => project.restore(badKeys));
  assert.throws(() => project.restore({ ...original, animationSettings: { fps: 0, duration: 24, loop: true } }));
  assert.deepEqual(project.serialize(), original);
});

test('Inspector edits use evaluated poses while base transforms stay intact', () => {
  const project = createProject(); const cube = project.addPrimitive('cube');
  const base = structuredClone(cube.components.transform);
  const editing = createEditingProject(project);
  const animation = createAnimation({ project, viewport: { setPreviewTransforms() {} } });
  editing.connect(animation); animation.setEditingEnabled(true);
  animation.addKey(cube.id, 'linear'); animation.setFrame(24);
  project.beginTransaction('Pose');
  editing.project.updateTransform(cube.id, { position: [0, 2.5, 0] });
  editing.project.updateTransform(cube.id, { position: [0, 3.5, 0] });
  project.commitTransaction();
  animation.setFrame(12);
  assert.equal(editing.project.get(cube.id).components.transform.position[1], 2);
  assert.deepEqual(project.get(cube.id).components.transform, base);
  project.history.undo();
  assert.equal(project.get(cube.id).components.animation.keys.length, 1);
  animation.setEditingEnabled(false);
  assert.deepEqual(editing.project.get(cube.id).components.transform, base);
  animation.dispose(); editing.dispose();
});
