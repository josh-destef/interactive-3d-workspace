import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createProject } from '../js/project.js';
import { createMaterialLesson } from '../js/lessons/material.js';
import { assessMaterial, assessRgb } from '../js/lessons/materialChallenge.js';

async function harness(options = {}) {
  const project = createProject(), seed = project.serialize();
  seed.entities[0].components.material = { color: '#f2f0eb', roughness: .5, metalness: 0, emissiveIntensity: 0 }; project.restore(seed);
  const guidance = { show(v) { this.current = v; this.complete = v.canContinue; }, setComplete(v) { this.complete = v; }, status(v) { this.message = v; }, destroy() {} };
  const studio = {
    setLightVisible(on) { this.lightVisible = on; }, setRoomLights(on) { this.roomOn = on; },
    hideReference() {}, showReference(value) { this.reference = value; },
    setLightAngle(angle) { this.angle = angle; (this.angles ||= []).push(angle); },
    capture: async () => {}, dispose() {},
  };
  let capabilities;
  const creator = { project, setCapabilities(v) { capabilities = v; }, viewport: { ready: Promise.resolve() } };
  const pauses = [];
  const lesson = await createMaterialLesson(creator, { guidance, studio, controls: false, reducedMotion: true, pause: async ms => { pauses.push(ms); }, random: () => .25, ...options });
  const change = patch => project.updateMaterial('gizmobot', patch);
  const next = () => { assert.equal(lesson.state.complete, true, `${lesson.state.step} must be complete`); lesson.next(); };
  return { project, lesson, guidance, studio, pauses, change, next, capabilities: () => capabilities };
}
async function throughSurfaces(h, beforeChallenge = () => {}) {
  h.change({ roughness: .3 }); h.change({ roughness: .65 }); h.next();
  h.change({ metalness: 1 }); h.next();
  const material = structuredClone(h.project.get('gizmobot').components.material);
  assert.equal(h.lesson.state.step, 'emission', 'the learner goes directly from surface finishes to switching the lights off');
  assert.equal(h.guidance.current.actionLabel, 'Turn off the lights', 'the lights switch is the step action, not a separate control');
  assert.equal(h.guidance.current.spotlight, false, 'no Okay pop-up before switching off the lights');
  assert.equal(h.guidance.current.hideActionWhenComplete, true, 'the switch becomes Continue once pressed');
  assert.equal(new Set(h.studio.angles).size, 1, 'room lighting stays fixed through the surface comparisons');
  assert.equal(h.studio.lightVisible, false);
  assert.doesNotMatch(h.guidance.current.body, /emission|face stays visible/i, 'the explanation follows the visible result');
  assert.deepEqual(h.project.get('gizmobot').components.material, material);
  const emissionBody = h.guidance.current.body;
  h.guidance.current.onAction(); assert.equal(h.lesson.state.complete, true);
  assert.equal(h.studio.roomOn, false);
  assert.equal(h.guidance.current.body, emissionBody, 'finishing a step never rewrites its instruction');
  h.next();
  assert.match(h.guidance.current.body, /face stayed visible.*Emission/i, 'emission is named after the learner sees it');
  assert.equal(h.studio.roomOn, false, 'the room stays dark while the learner tries emission');
  h.change({ emissiveIntensity: .8 }); h.next();
  assert.equal(h.studio.roomOn, true, 'normal lighting returns for the authored design');
  assert.equal(h.project.get('gizmobot').components.material.emissiveIntensity, 0, 'the dark-room emission does not wash out the design');
  assert.doesNotMatch(h.guidance.current.body, /lighting/i, 'this lab no longer teaches lighting');
  assert.equal(h.guidance.current.actionLabel, '', 'saving a picture waits for the finale');
  assert.equal(h.guidance.message, undefined, 'the instruction text is never swapped for status messages');
  beforeChallenge(); h.next();
}
function match(h) {
  const t = h.lesson.state.target;
  h.change({ color: t.color, roughness: t.roughness, metalness: t.metalness }); h.lesson.check();
}
test('required journey uses selected shared material, demos cannot pass practice, matching and free creation work', async () => {
  let finished = false;
  const h = await harness({ onFinish: () => { finished = true; } });
  assert.equal(h.lesson.state.complete, false); h.lesson.next(); assert.equal(h.lesson.state.step, 'intro');
  h.project.selection.set('gizmobot'); h.next(); assert.equal(h.capabilities().appearance.roughness, false);
  assert.equal(h.guidance.current.actionLabel, 'Watch comparison');
  assert.equal(h.guidance.current.hideActionWhenComplete, true, 'Watch comparison gives way to Continue once practice passes');
  const colorBefore = h.project.serialize(); await h.lesson.demo();
  assert.deepEqual(h.project.serialize(), colorBefore, 'the first color example restores the learner’s material');
  assert.equal(h.lesson.state.complete, false, 'watching the color comparison cannot pass practice');
  h.change({ color: '#3a6fa8' }); h.next();
  const before = h.project.serialize(); await h.lesson.demo();
  assert.deepEqual(h.project.serialize(), before); assert.equal(h.lesson.state.complete, false);
  await throughSurfaces(h); assert.equal(h.lesson.state.step, 'challenge'); assert.equal(h.capabilities().appearance.rgb, false);
  assert.equal(h.capabilities().appearance.colorPicker, false);
  match(h); assert.equal(h.lesson.state.complete, true);
  h.lesson.newTarget(); assert.equal(h.lesson.state.complete, false);
  match(h); h.next(); assert.equal(h.lesson.state.step, 'done');
  assert.equal(h.capabilities().appearance.emissive, true); assert.equal(h.capabilities().appearance.rgb, false);
  assert.equal(h.guidance.current.step, '', 'the closing celebration is not a numbered step');
  assert.equal(h.guidance.current.celebrate, true);
  assert.equal(h.guidance.current.total, 8);
  assert.equal(h.guidance.current.canContinue, true);
  assert.equal(h.guidance.current.continueLabel, 'Back to Home');
  assert.equal(h.guidance.current.actionLabel, 'Save picture', 'the finale invites learners to keep and share a picture');
  h.guidance.current.onContinue(); assert.equal(finished, true, 'the finale leads back to the course hub');
  h.lesson.dispose();
});
test('Explore RGB opens a brief popup beside the button and keeps the learner on the color step', async () => {
  const { JSDOM } = await import(pathToFileURL(path.join(os.tmpdir(), 'fundamentals-3d-qa/node_modules/jsdom/lib/api.js')));
  const dom = new JSDOM('<aside id="editor-dock"><input class="color-input" type="color"><button class="appearance-explore-rgb">Explore RGB</button></aside>');
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  globalThis.document = dom.window.document; globalThis.innerWidth = 1440;
  let h;
  try {
    h = await harness({ controls: true }); h.project.selection.set('gizmobot'); h.next();
    const instruction = h.guidance.current;
    h.lesson.exploreRgb();
    assert.equal(h.lesson.state.step, 'color', 'RGB is not a separate lesson step');
    assert.equal(h.guidance.current, instruction, 'the bottom-left instruction does not change');
    const tip = document.querySelector('.material-rgb-tip');
    assert.ok(tip, 'a popup explains mixing a color');
    assert.match(tip.textContent, /red, green, and blue/);
    tip.querySelector('[data-rgb-open]').click();
    assert.equal(document.querySelector('.material-rgb-tip'), null, 'opening the picker closes the popup');
    h.change({ color: '#8b5cf6' }); assert.equal(h.lesson.state.complete, true, 'a picked color completes the color step');
    h.lesson.exploreRgb(); h.next();
    assert.equal(document.querySelector('.material-rgb-tip'), null, 'moving on closes an open popup');
  } finally {
    h?.lesson.dispose(); dom.window.close(); delete globalThis.document; delete globalThis.innerWidth;
  }
});
test('perceptual feedback corrects roughness direction and accepts close matches without numeric target hints', () => {
  const t = { color: '#3a6fa8', roughness: .4, metalness: 1 };
  const exact = assessMaterial(t, t);
  assert.deepEqual(exact.scores, { color: 100, roughness: 100, metalness: 100 });
  assert.equal(exact.percentage, 100);
  const forgiving = assessMaterial({ ...t, roughness: .63, metalness: .72 }, t);
  assert.equal(forgiving.passed, true, 'a recognisably close finish passes without exact slider values');
  assert.equal(forgiving.percentage >= 70, true);
  assert.equal(Object.values(forgiving.scores).every(score => score >= 45), true);
  assert.match(assessMaterial({ ...t, roughness: .95 }, t).hint, /lower Roughness/);
  assert.match(assessMaterial({ ...t, roughness: 0 }, t).hint, /raise Roughness/);
  assert.equal(assessRgb('#8b5cf6').passed, true); assert.equal(assessRgb('#000000').passed, false);
});

test('assessment baselines prevent undo restoring hidden glow or finish while preserving challenge edits', async () => {
  const h = await harness(); h.project.selection.set('gizmobot'); h.next();
  h.change({ color: '#8b5cf6' }); h.next(); await throughSurfaces(h);
  assert.equal(h.lesson.state.step, 'challenge');
  const standard = structuredClone(h.project.get('gizmobot').components.material);
  assert.equal(standard.emissiveIntensity, 0);
  assert.equal(h.project.history.canUndo, false); assert.equal(h.project.history.canRedo, false);
  assert.equal(h.project.history.undo(), false);
  h.change({ color: '#22252b', roughness: .1 });
  assert.equal(h.project.history.undo(), true);
  assert.deepEqual(h.project.get('gizmobot').components.material, standard);
  assert.equal(h.project.history.redo(), true);
  match(h); h.next(); assert.equal(h.lesson.state.step, 'done');
  assert.equal(h.project.history.canUndo, false, 'the finale starts a fresh history for the restored design');
  h.lesson.dispose();
});

test('public history clear preserves active transactions and announces successful history reset', () => {
  const project = createProject(); const cube = project.addPrimitive('cube');
  project.updateMaterial(cube.id, { color: '#000000' }); project.history.undo();
  assert.equal(project.history.canUndo, true); assert.equal(project.history.canRedo, true);
  const events = []; project.subscribe(event => events.push(event));
  project.beginTransaction('Live edit');
  assert.equal(project.history.clear(), false);
  assert.equal(project.history.canUndo, true); assert.equal(project.history.canRedo, true);
  assert.equal(events.length, 0);
  project.cancelTransaction(); events.length = 0;
  assert.equal(project.history.clear(), true);
  assert.equal(project.history.canUndo, false); assert.equal(project.history.canRedo, false);
  assert.deepEqual(events, [{ kind: 'history' }]);
});

test('changed matches update live after the first check and free play restores the authored material under normal lighting', async () => {
  const h = await harness(); h.project.selection.set('gizmobot'); h.next();
  h.change({ color: '#3a6fa8' }); h.next();
  let authored;
  await throughSurfaces(h, () => {
    h.change({ color: '#c0453a', roughness: .72, metalness: .15, emissiveIntensity: .9 });
    h.lesson.setRoomLights(false);
    assert.equal(h.studio.roomOn, true, 'the lighting toggle is limited to the emission step');
    authored = structuredClone(h.project.get('gizmobot').components.material);
  });
  match(h); assert.equal(h.lesson.state.complete, true);
  h.change({ color: '#000000' }); assert.equal(h.lesson.state.complete, false);
  h.lesson.next(); assert.equal(h.lesson.state.step, 'challenge');
  match(h); h.next();
  assert.deepEqual(h.project.get('gizmobot').components.material, authored);
  assert.equal(h.studio.angle, 38); assert.equal(h.studio.roomOn, true);
  assert.equal(h.project.history.canUndo, false);
  h.lesson.dispose();
});

test('matching actions stay together beside the finish controls and update feedback live after the first check', async () => {
  const { JSDOM } = await import(pathToFileURL(path.join(os.tmpdir(), 'fundamentals-3d-qa/node_modules/jsdom/lib/api.js')));
  const dom = new JSDOM('<aside id="editor-dock"></aside>');
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  globalThis.document = dom.window.document;
  let h;
  try {
    h = await harness({ controls: true });
    h.project.selection.set('gizmobot'); h.next();
    h.change({ color: '#3a6fa8' }); h.next();
    await throughSurfaces(h);
    assert.equal(document.querySelectorAll('.material-match-actions button').length, 0, 'no separate match button row');
    assert.equal(h.guidance.current.actionLabel, 'Check match', 'Check match sits in the card action row');
    assert.equal(h.guidance.current.actionTone, 'primary');
    assert.equal(h.guidance.current.hideActionWhenComplete, true, 'Check match gives way to Continue once the match passes');
    const target = h.lesson.state.target;
    h.change({ color: target.color, roughness: target.roughness, metalness: target.metalness });
    const instruction = h.guidance.current.body;
    h.guidance.current.onAction();
    assert.equal(h.guidance.current.body, instruction, 'match feedback never replaces the instruction');
    assert.equal(h.lesson.state.complete, true);
    assert.equal(document.querySelector('.material-match-score').textContent, '100% match');
    assert.match(document.querySelector('.material-match-summary').textContent, /^100% match/, 'the score is shown next to Check match');
    assert.equal(document.querySelector('[data-metric="roughness"] [role="meter"]').getAttribute('aria-valuenow'), '100');
    h.change({ color: '#000000' });
    assert.equal(h.lesson.state.complete, false);
    assert.doesNotMatch(document.querySelector('.material-match-score').textContent, /100%|Last check/);
    h.change({ color: target.color });
    assert.equal(h.lesson.state.complete, true, 'restoring the match passes without another check');
    assert.equal(document.querySelector('.material-match-score').textContent, '100% match');
    h.lesson.newTarget();
    assert.equal(document.querySelector('.material-match-feedback').hidden, true);
    assert.equal(h.lesson.state.complete, false);
  } finally {
    h?.lesson.dispose(); dom.window.close(); delete globalThis.document;
  }
});
