import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../js/project.js';
import { createMaterialLesson } from '../js/lessons/material.js';
import { assessMaterial, assessRgb } from '../js/lessons/materialChallenge.js';

async function harness() {
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
  const lesson = await createMaterialLesson(creator, { guidance, studio, controls: false, reducedMotion: true, pause: async ms => { pauses.push(ms); }, random: () => .25 });
  const change = patch => project.updateMaterial('gizmobot', patch);
  const next = () => { assert.equal(lesson.state.complete, true, `${lesson.state.step} must be complete`); lesson.next(); };
  return { project, lesson, guidance, studio, pauses, change, next, capabilities: () => capabilities };
}
async function throughSurfaces(h, beforeChallenge = () => {}) {
  h.change({ roughness: .3 }); h.change({ roughness: .65 }); h.next();
  h.change({ metalness: 1 }); h.next();
  const material = structuredClone(h.project.get('gizmobot').components.material);
  assert.equal(h.lesson.state.step, 'light');
  const pauseCount = h.pauses.length;
  await h.lesson.demo();
  assert.deepEqual(h.pauses.slice(pauseCount), [900, 900, 900, 900], 'the reduced-motion light holds use the slower half-speed pacing');
  assert.equal(h.lesson.state.complete, true);
  assert.equal(new Set(h.studio.angles).size >= 3, true, 'the light demonstration circles through several positions');
  assert.equal(h.studio.angle, 38, 'the demonstration returns to the fixed light position');
  assert.equal(h.studio.lightVisible, false, 'the demonstration light is not left as an interactive scene object');
  h.next();
  assert.equal(h.lesson.state.step, 'emission', 'the sequence skips light temperature controls');
  assert.deepEqual(h.project.get('gizmobot').components.material, material);
  h.lesson.setRoomLights(false); assert.equal(h.lesson.state.complete, true);
  h.next();
  h.change({ emissiveIntensity: .8 }); h.next(); beforeChallenge(); h.next();
}
function match(h) {
  const t = h.lesson.state.target;
  h.change({ color: t.color, roughness: t.roughness, metalness: t.metalness }); h.lesson.check();
}
function review(h) {
  for (const step of ['reviewRoughness', 'reviewMetalness', 'reviewEmission']) {
    assert.equal(h.lesson.state.step, step);
    h.lesson.next(); assert.equal(h.lesson.state.step, step);
    h.guidance.current.onSecondary(); assert.equal(h.lesson.state.complete, false);
    assert.ok(h.guidance.message.length > 30);
    h.guidance.current.onAction(); h.next();
  }
}
test('required journey uses selected shared material, demos cannot pass practice, matching and free creation work', async () => {
  const h = await harness();
  assert.equal(h.lesson.state.complete, false); h.lesson.next(); assert.equal(h.lesson.state.step, 'intro');
  h.project.selection.set('gizmobot'); h.next(); assert.equal(h.capabilities().appearance.roughness, false);
  h.change({ color: '#3a6fa8' }); h.next();
  const before = h.project.serialize(); await h.lesson.demo();
  assert.deepEqual(h.project.serialize(), before); assert.equal(h.lesson.state.complete, false);
  await throughSurfaces(h); assert.equal(h.lesson.state.step, 'challenge'); assert.equal(h.capabilities().appearance.rgb, false);
  match(h); assert.equal(h.lesson.state.complete, true);
  h.lesson.newTarget(); assert.equal(h.lesson.state.complete, false);
  match(h); h.next(); review(h); assert.equal(h.lesson.state.step, 'done');
  assert.equal(h.capabilities().appearance.emissive, true); assert.equal(h.capabilities().appearance.rgb, false); h.lesson.dispose();
});
test('optional RGB writes normal Base Color and returns to main lesson, then offers RGB-only match', async () => {
  const h = await harness(); h.project.selection.set('gizmobot'); h.next(); h.lesson.exploreRgb();
  assert.equal(h.lesson.state.step, 'rgb'); assert.equal(h.capabilities().appearance.baseColor, true);
  await h.lesson.demo(); assert.equal(h.lesson.state.complete, false);
  h.change({ color: '#8b5cf6' }); h.next(); assert.equal(h.lesson.state.step, 'roughness');
  assert.equal(h.project.get('gizmobot').components.material.color, '#8b5cf6'); assert.equal(h.lesson.state.rgbLearned, true);
  await throughSurfaces(h); match(h); h.next(); assert.equal(h.lesson.state.step, 'rgbOffer'); h.lesson.tryRgbChallenge();
  assert.equal(h.capabilities().appearance.roughness, false); assert.equal(h.capabilities().appearance.baseColor, true);
  h.change({ color: '#8b5cf6' }); h.lesson.check(); h.next(); review(h); assert.equal(h.lesson.state.step, 'done'); h.lesson.dispose();
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
  const h = await harness(); h.project.selection.set('gizmobot'); h.next(); h.lesson.exploreRgb();
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
  match(h); h.next(); h.lesson.tryRgbChallenge();
  const rgbBaseline = structuredClone(h.project.get('gizmobot').components.material);
  assert.equal(rgbBaseline.roughness, .5); assert.equal(rgbBaseline.metalness, 0); assert.equal(rgbBaseline.emissiveIntensity, 0);
  assert.equal(h.project.history.canUndo, false); assert.equal(h.project.history.canRedo, false);
  assert.equal(h.project.history.undo(), false);
  h.change({ color: '#000000' }); assert.equal(h.project.history.undo(), true);
  assert.deepEqual(h.project.get('gizmobot').components.material, rgbBaseline);
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

test('changed matches need checking again and free play restores the authored material and lighting', async () => {
  const h = await harness(); h.project.selection.set('gizmobot'); h.next();
  h.change({ color: '#3a6fa8' }); h.next();
  let authored;
  await throughSurfaces(h, () => {
    h.change({ color: '#c0453a', roughness: .72, metalness: .15, emissiveIntensity: .9 });
    h.lesson.setRoomLights(false);
    authored = structuredClone(h.project.get('gizmobot').components.material);
  });
  match(h); assert.equal(h.lesson.state.complete, true);
  h.change({ color: '#000000' }); assert.equal(h.lesson.state.complete, false);
  h.lesson.next(); assert.equal(h.lesson.state.step, 'challenge');
  match(h); h.next(); review(h);
  assert.deepEqual(h.project.get('gizmobot').components.material, authored);
  assert.equal(h.studio.angle, 38); assert.equal(h.studio.roomOn, false);
  assert.equal(h.project.history.canUndo, false);
  h.lesson.dispose();
});
