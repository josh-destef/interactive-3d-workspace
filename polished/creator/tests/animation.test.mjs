import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createAnimation, evaluateKeys, interpolateTransform } from '../js/animation.js';
import { createProject } from '../js/project.js';
import { createTimeline } from '../js/timeline.js';

const transform = x => ({ position:[x,0,0], rotation:[0,0,0], scale:[1,1,1] });

test('interpolates linear, smooth, and step segments', () => {
  assert.equal(interpolateTransform(transform(0), transform(10), .25, 'linear').position[0], 2.5);
  assert.equal(interpolateTransform(transform(0), transform(10), .25, 'smooth').position[0], 1.5625);
  assert.equal(interpolateTransform(transform(0), transform(10), .75, 'step').position[0], 0);
  assert.equal(evaluateKeys([{frame:0,transform:transform(0),interpolation:'linear'},{frame:10,transform:transform(10),interpolation:'smooth'}], 5, transform(99)).position[0], 5);
});

function fixture() {
  let history = 0;
  const item = { id:'cube', name:'Cube', components:{ transform:transform(0) } };
  const project = { entities:[item], selection:{activeId:'cube'}, animationSettings:{fps:24,duration:120,loop:true}, get:id => id === 'cube' ? item : null,
    updateAnimation(id, value) { item.components.animation = value; history++; } };
  const previews = [];
  const animation = createAnimation({ project, viewport:{ setPreviewTransforms:value => previews.push(value) } });
  return { animation, item, previews, get history() { return history; } };
}

test('scrubbing previews animation without writing history or base transform', () => {
  const f = fixture();
  f.item.components.animation = { keys:[{frame:0,transform:transform(0),interpolation:'linear'},{frame:20,transform:transform(20),interpolation:'linear'}] };
  f.animation.setEditingEnabled(true);
  f.animation.setFrame(10);
  assert.equal(f.history, 0);
  assert.equal(f.item.components.transform.position[0], 0);
  assert.equal(f.previews.at(-1).get('cube').position[0], 10);
});

test('adding a key commits pending pose through one undoable project mutation', () => {
  const f = fixture();
  f.animation.setFrame(12);
  f.animation.setEditingEnabled(true);
  f.animation.updateTransform('cube', { position:[4,0,0] });
  assert.equal(f.history, 1);
  assert.equal(f.item.components.animation.keys[0].frame, 12);
  assert.equal(f.item.components.animation.keys[0].transform.position[0], 4);
  f.animation.setFrame(20);
  f.animation.addKey();
  assert.equal(f.history, 2);
  assert.equal(f.item.components.animation.keys[1].frame, 20);
});

test('a keyed pose is restored by project undo', () => {
  const project = createProject();
  const cube = project.addPrimitive('cube');
  project.history.clear();
  const animation = createAnimation({ project, viewport:{ setPreviewTransforms() {} } });
  animation.setEditingEnabled(true);
  animation.updateTransform(cube.id, { position:[7, .5, 0] });
  assert.equal(project.get(cube.id).components.animation.keys[0].transform.position[0], 7);
  project.history.undo();
  assert.equal(project.get(cube.id).components.animation, undefined);
});

test('leaving Animate mode clears preview and undo refreshes it', () => {
  const project = createProject();
  const cube = project.addPrimitive('cube'); project.history.clear();
  const previews = [];
  const animation = createAnimation({ project, viewport:{ setPreviewTransforms:value => previews.push(value) } });
  animation.setEditingEnabled(true);
  animation.updateTransform(cube.id, { position:[3,.5,0] });
  project.history.undo();
  assert.equal(previews.at(-1), null);
  animation.setEditingEnabled(false);
  assert.equal(previews.at(-1), null);
  assert.equal(animation.isEditingEnabled, false);
});

test('moving a key refuses to overwrite an occupied frame', () => {
  const f = fixture();
  f.item.components.animation = { keys:[
    {frame:0,transform:transform(0),interpolation:'linear'},
    {frame:10,transform:transform(10),interpolation:'linear'},
  ] };
  assert.throws(() => f.animation.moveKey('cube', 0, 10), /already has a key/);
  assert.equal(f.history, 0);
});

test('timeline selects and edits keys, and restores invalid settings', async () => {
  const { JSDOM } = await import(pathToFileURL(path.join(os.tmpdir(), 'fundamentals-3d-qa/node_modules/jsdom/lib/api.js')));
  const dom = new JSDOM('<section id="timeline"></section>', { pretendToBeVisual:true });
  const previous = { window:globalThis.window, document:globalThis.document, Option:globalThis.Option };
  Object.assign(globalThis, { window:dom.window, document:dom.window.document, Option:dom.window.Option });
  try {
    const project = createProject(), cube = project.addPrimitive('cube');
    project.updateAnimation(cube.id, { keys:[
      { frame:0, transform:transform(0), interpolation:'smooth' },
      { frame:20, transform:transform(20), interpolation:'linear' },
    ] });
    project.history.clear();
    const statuses = [], animation = createAnimation({ project, viewport:{ setPreviewTransforms() {} } });
    const timeline = createTimeline({ root:document.querySelector('#timeline'), animation, project, onStatus:value => statuses.push(value) });
    document.querySelector('.timeline-key[data-frame="0"]').click();
    assert.match(document.querySelector('.timeline-selected-editor strong').textContent, /Cube key/);
    const move = document.querySelector('.timeline-selected-editor input[type="number"]'); move.value = '8'; move.dispatchEvent(new dom.window.Event('change'));
    assert.deepEqual(project.get(cube.id).components.animation.keys.map(key => key.frame), [8,20]);
    const interpolation = document.querySelector('.timeline-selected-editor select'); interpolation.value = 'step'; interpolation.dispatchEvent(new dom.window.Event('change'));
    assert.equal(project.get(cube.id).components.animation.keys[0].interpolation, 'step');
    project.history.undo();
    assert.equal(project.get(cube.id).components.animation.keys[0].interpolation, 'smooth');
    const fps = [...document.querySelectorAll('.timeline-settings input[type="number"]')][0]; fps.value = '99'; fps.dispatchEvent(new dom.window.Event('change'));
    assert.equal(fps.value, '24'); assert.match(statuses.at(-1), /FPS|fps|60/);
    const end = [...document.querySelectorAll('.timeline-settings input[type="number"]')][1]; end.value = '5'; end.dispatchEvent(new dom.window.Event('change'));
    assert.equal(end.value, '120');
    timeline.dispose();
  } finally { Object.assign(globalThis, previous); dom.window.close(); }
});
