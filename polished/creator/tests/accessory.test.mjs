import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../js/project.js';
import { createTools } from '../js/tools.js';
import { createAccessoryLesson, STEPS } from '../js/lessons/accessory.js';

function harness() {
  const buttons = [];
  const body = { append(...items) { this.items = items; } };
  const tag = { textContent: 'Playground' };
  globalThis.document = {
    title: 'Creation Studio · CreateAccess',
    getElementById: () => ({ hidden: false }),
    querySelector(selector) { return selector === '.prototype-tag' ? tag : selector === '.lesson-guidance-copy > p' ? body : null; },
    createElement(tagName) {
      const element = {
        tagName, children: [], disabled: false, className: '', textContent: '',
        setAttribute() {}, addEventListener(type, fn) { if (type === 'click') this.click = fn; },
        append(...items) { this.children.push(...items); },
        querySelectorAll() { return this.children.filter(child => child.tagName === 'button'); },
      };
      if (tagName === 'button') buttons.push(element);
      return element;
    },
  };
  const guidance = { current: null, complete: false, show(value) { this.current = value; this.complete = !!value.canContinue; }, setComplete(value) { this.complete = value; }, destroy() {} };
  const project = createProject();
  const tools = createTools();
  const capabilities = [];
  const creator = { project, tools, viewport: { ready: Promise.resolve() }, setCapabilities(value) { capabilities.push(value); }, setDock() {}, showGuide() {} };
  const example = { shown: 0, hidden: 0, disposed: 0, async separate() { return true; }, show() { this.shown++; }, hide() { this.hidden++; }, dispose() { this.disposed++; } };
  return { creator, project, tools, guidance, buttons, example, capabilities };
}

test('accessory lesson gates a complete authored hierarchy and preserves it for free play', async () => {
  const h = harness();
  const lesson = await createAccessoryLesson(h.creator, { guidance: h.guidance, example: h.example });
  const advance = () => { assert.equal(h.guidance.complete, true, `step ${lesson.state.step + 1} should be complete`); lesson.next(); };
  assert.equal(h.guidance.complete, false);
  lesson.next();
  assert.equal(lesson.state.step, 0, 'cannot skip seeing the pieces');
  let finishAnimation;
  h.example.separate = () => new Promise(resolve => { finishAnimation = resolve; });
  const viewing = h.guidance.current.onAction();
  assert.equal(h.guidance.complete, false, 'animation must finish before Continue unlocks');
  finishAnimation(true); await viewing;
  advance();
  assert.equal(h.example.shown, 1);
  const body = h.project.addPrimitive('cube');
  advance();
  h.project.updateTransform(body.id, { position: [-2, 1.75, -1] }); advance();
  h.project.updateTransform(body.id, { scale: [1.5, .8, .7] }); advance();
  assert.equal(h.example.hidden, 1);
  assert.equal(h.capabilities.at(-1).tools.move, true, 'step 5 keeps Move available for positioning the smaller detail');
  const detail = h.project.addPrimitive('cube');
  h.project.updateTransform(detail.id, { scale: [.3, .3, .2] }); advance();
  assert.equal(h.guidance.current.target, '.snap-control');
  assert.equal(h.capabilities.at(-1).features.snap, true);
  assert.equal(h.capabilities.at(-1).features.snapSettings, true, 'Accessory introduces the settings side of Snap');
  assert.match(h.guidance.current.body, /Regular increments/i);
  assert.match(h.guidance.current.body, /Nearest surface/i);
  assert.match(h.guidance.current.body, /Surface reach/i);
  h.tools.setSnapSettings({ enabled: true, mode: 'surface' });
  h.project.updateTransform(detail.id, { position: [-1.1, 1.75, -1] }); advance();
  const cylinder = h.project.addPrimitive('cylinder');
  h.project.updateTransform(cylinder.id, { position: [-2, 3.15, -1], scale: [.3, 2, .3] }); advance();
  const sphere = h.project.addPrimitive('sphere');
  h.tools.setSnapping(false);
  h.project.updateTransform(sphere.id, { position: [-2, 4.15, -1], scale: [.3, .3, .3] }); advance();
  assert.equal(STEPS.length, 13);
  assert.equal(STEPS.some(step => step.quiz), false, 'the lesson ends through making, not a quiz');
  assert.equal(h.guidance.current.title, 'Give each piece a material');
  assert.equal(h.guidance.current.target, '.inspector-section[data-section="appearance"]');
  assert.deepEqual(h.guidance.current.references, ['Material Lab']);
  assert.equal(h.capabilities.at(-1).inspectorSections.appearance, true);
  assert.equal(h.capabilities.at(-1).inspectorSections.hierarchy, false);
  assert.equal(h.project.selection.activeId, body.id);
  h.project.updateMaterial(body.id, { color: '#3a91b8' });
  h.project.updateMaterial(detail.id, { color: '#8b5cf6' });
  h.project.updateMaterial(cylinder.id, { color: '#67bd45' });
  assert.equal(h.guidance.complete, false, 'each piece gets its own material before continuing');
  h.project.updateMaterial(sphere.id, { color: '#f2f0eb' });
  advance();

  assert.equal(h.guidance.current.title, 'Connect the Antenna Tip to its Mast');
  assert.equal(h.guidance.current.target, '.parent-select');
  assert.equal(h.project.selection.activeId, sphere.id);
  assert.equal(h.capabilities.at(-1).inspectorSections.hierarchy, true);
  h.project.reparent(sphere.id, body.id);
  assert.equal(h.guidance.complete, false, 'the Tip must be parented to the Mast, not directly to the Body');
  h.project.reparent(sphere.id, cylinder.id); advance();

  assert.equal(h.guidance.current.title, 'Connect the Mast to the Backpack Body');
  assert.equal(h.project.selection.activeId, cylinder.id);
  assert.equal(h.project.get(sphere.id).parentId, cylinder.id, 'the Tip remains nested under the Mast');
  h.project.reparent(cylinder.id, body.id); advance();

  assert.equal(h.guidance.current.title, 'Connect the Detail to the Backpack Body');
  assert.equal(h.project.selection.activeId, detail.id);
  h.project.reparent(detail.id, body.id); advance();

  assert.equal(h.guidance.current.title, 'Move the whole backpack');
  assert.equal(h.project.selection.activeId, body.id);
  assert.match(h.guidance.current.body, /Body carries the Detail and Mast/i);
  h.project.updateTransform(body.id, { position: [-1.7, 1.75, -1] });
  advance();
  assert.equal(lesson.state.finished, true);
  assert.equal(h.capabilities.at(-1).features.snapSettings, true, 'free play keeps Snap settings available');
  assert.equal(h.project.get(detail.id).parentId, body.id);
  assert.equal(h.project.get(cylinder.id).parentId, body.id);
  assert.equal(h.project.get(sphere.id).parentId, cylinder.id);
});

test('undoing and rebuilding the body refreshes the placement practice baseline', async () => {
  const h = harness();
  const lesson = await createAccessoryLesson(h.creator, { guidance: h.guidance, example: h.example });
  await h.guidance.current.onAction();
  lesson.next();
  h.project.addPrimitive('cube');
  h.project.history.undo();
  const replacement = h.project.addPrimitive('cube');
  lesson.next();
  assert.equal(h.guidance.complete, false);
  h.project.updateTransform(replacement.id, { position: [-2, 1.75, -1] });
  assert.equal(h.guidance.complete, true);
  lesson.destroy();
});

test('the break-apart example eases away before the first building step appears', async () => {
  const h = harness();
  let transitions = 0;
  h.example.transitionOut = async () => { transitions++; h.example.hide(); return true; };
  const lesson = await createAccessoryLesson(h.creator, { guidance: h.guidance, example: h.example });
  await h.guidance.current.onAction();
  assert.equal(h.guidance.complete, true);
  const leaving = h.guidance.current.onContinue();
  assert.equal(h.guidance.complete, false, 'Continue is disabled while the example and camera transition');
  await leaving;
  assert.equal(transitions, 1);
  assert.equal(h.example.hidden, 1);
  assert.equal(lesson.state.step, 1, 'the Add step appears after the transition resolves');
  lesson.destroy();
});

test('snap settings support configurable increments and nearest-surface mode', () => {
  const tools = createTools();
  tools.setSnapSettings({ enabled: true, mode: 'surface', surfaceDistance: .35 });
  assert.deepEqual(tools.getSnapSettings(), {
    enabled: true, mode: 'surface', moveStep: .25, rotateStep: 15, scaleStep: .1, surfaceDistance: .35,
  });
  assert.throws(() => tools.setSnapSettings({ moveStep: 0 }), /greater than zero/);
});
