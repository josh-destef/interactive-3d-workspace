import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createProject } from '../js/project.js';
import { createTools } from '../js/tools.js';
import { ASSEMBLY_MODEL_SCALE, ASSEMBLY_PARTS, ASSEMBLY_PART_IDS, ASSEMBLY_ROOT_POSITION, HAND_TARGET, createAssemblyProjectData } from '../js/assemblyData.js';
import { createAssemblyLesson, handAxisView, HAND_AXIS_ORDER, STEPS } from '../js/lessons/assembly.js';

function harness() {
  const listeners = new Map();
  const inputs = [];
  const dock = { children: [], append(...items) { this.children.push(...items); } };
  const help = { hidden: false };
  globalThis.matchMedia = () => ({ matches: true });
  globalThis.document = {
    title: 'Creation Studio · CreateAccess',
    getElementById(id) { return id === 'help-toggle' ? help : id === 'editor-dock' ? dock : null; },
    querySelector() { return null; },
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
    createElement(tagName) {
      const element = {
        tagName, children: [], disabled: false, className: '', textContent: '', innerHTML: '', value: '',
        setAttribute() {},
        addEventListener(type, fn) { this[`on${type}`] = fn; },
        append(...items) { this.children.push(...items); },
        remove() { this.removed = true; dock.children = dock.children.filter(item => item !== this); },
        querySelectorAll() { return []; },
      };
      if (tagName === 'input') inputs.push(element);
      return element;
    },
  };
  const guidance = {
    current: null, complete: false, messages: [], controls: [], targetShows: 0, welcomeCard: null,
    welcome(value) { this.welcomeCard = value; value.onStart(); },
    show(value) { this.current = value; this.complete = Boolean(value.canContinue); },
    setComplete(value) { this.complete = Boolean(value); },
    mountControl(value) { this.controls = [value]; },
    status(value) { this.messages.push(value); },
    showTarget() { this.targetShows++; },
    destroy() {},
  };
  const guide = { shown: [], options: [], visible: false, show(part, options) { this.shown.push(part.id); this.options.push(options); this.visible = true; }, hide() { this.visible = false; }, dispose() {} };
  const project = createProject(); project.restore(createAssemblyProjectData());
  const tools = createTools();
  const previews = [];
  const expressions = [];
  const capabilities = [];
  const camera = { locked: false, moves: [] };
  const creator = {
    project, tools,
    viewport: {
      ready: Promise.resolve(),
      setPreviewTransforms(value) { previews.push(value); },
      setInteractionEnabled() {},
      setAssemblyHeadExpression(value) { expressions.push(value); },
      setCameraLocked(value) { camera.locked = value; },
      getCameraLocked() { return camera.locked; },
      moveCamera(value, options = {}) { camera.moves.push({ ...value, ...options }); },
      getObject() { return null; },
    },
    dock: { inspector: { revealSection() {} } },
    setCapabilities(value) { capabilities.push(value); }, setDock() {}, showGuide() {},
  };
  return { creator, project, tools, guidance, guide, listeners, inputs, previews, expressions, dock, capabilities, camera };
}

test('Gizmobot starts with its Head and oversized Hand disconnected', () => {
  assert.equal(ASSEMBLY_PARTS.length, 14);
  assert.equal(new Set(ASSEMBLY_PART_IDS).size, 14);
  const head = ASSEMBLY_PARTS.find(part => part.id === 'part-head');
  const hand = ASSEMBLY_PARTS.find(part => part.id === 'part-right-hand');
  assert.equal(ASSEMBLY_PARTS.filter(part => part.startTransform !== part.targetTransform).length, 2);
  assert.equal(head.startTransform, head.challengeTransform);
  assert.equal(hand.startTransform, hand.challengeTransform);
  assert.ok(Math.abs(head.challengeTransform.position[1] + ASSEMBLY_ROOT_POSITION[1] - .1) < 1e-9, 'the Head starts at a snap-safe height beside Gizmobot');
  assert.equal(head.challengeTransform.rotation[2], Math.PI / 6, 'the disconnected face stays visible with a snap-safe tilt');
  for (let axis = 0; axis < 3; axis++) {
    const moves = (head.targetTransform.position[axis] - head.challengeTransform.position[axis]) / .25;
    assert.ok(Math.abs(moves - Math.round(moves)) < 1e-9, 'Head target is reachable with the lesson’s snapped moves');
  }
  assert.deepEqual(hand.challengeTransform.scale, [1.6, 1.6, 1.6]);
  assert.deepEqual(hand.targetTransform.position, HAND_TARGET);
  assert.deepEqual(HAND_TARGET, [-1, 1.6, .2], 'the Hand’s Position values are round numbers');
  for (const value of hand.challengeTransform.position) assert.equal(value, Number(value.toFixed(1)), 'the Hand starts on round tenths');
  const project = createAssemblyProjectData();
  assert.deepEqual(project.entities[0].components.transform.position, ASSEMBLY_ROOT_POSITION, 'the parts group keeps the robot where the model puts it');
  assert.notDeepEqual(hand.challengeTransform.position, hand.targetTransform.position);
  assert.notDeepEqual(hand.challengeTransform.rotation, hand.targetTransform.rotation);
});

test('Scene lesson requires choosing the Head during its prompt and accepts keyboard activation', async () => {
  for (const key of ['Enter', ' ']) {
    const h = harness();
    const lesson = await createAssemblyLesson(h.creator, { guidance: h.guidance, guide: h.guide });
    const choose = (id, key) => ({ key, target: { closest: selector => selector === '.scene-row' ? { dataset: { entityId: id } } : null } });
    h.listeners.get('click')(choose('part-head'));
    await new Promise(resolve => queueMicrotask(resolve));
    lesson.next();
    assert.equal(STEPS[lesson.state.step].kind, 'scene');
    assert.equal(h.guidance.complete, false, 'a previous selection must not complete this practice');
    h.listeners.get('keydown')(choose('part-body', key));
    await new Promise(resolve => queueMicrotask(resolve));
    assert.equal(h.guidance.complete, false, 'another object does not complete Head selection');
    h.listeners.get('keydown')(choose('part-head', 'ArrowDown'));
    await new Promise(resolve => queueMicrotask(resolve));
    assert.equal(h.guidance.complete, false, 'moving focus is not activation');
    h.listeners.get('keydown')(choose('part-head', key));
    await new Promise(resolve => queueMicrotask(resolve));
    assert.equal(h.guidance.complete, true, `${JSON.stringify(key)} can activate the Head row`);
    lesson.destroy();
    assert.equal(h.listeners.has('keydown'), false, 'keyboard listener is cleaned up');
  }
});

test('Creation Studio repairs the Head with tools and the oversized Hand with the Inspector', async () => {
  const h = harness();
  const lesson = await createAssemblyLesson(h.creator, { guidance: h.guidance, guide: h.guide });
  const advance = () => {
    assert.equal(h.guidance.complete, true, `step ${lesson.state.step + 1} should be complete`);
    lesson.next();
  };

  const headPart = ASSEMBLY_PARTS.find(part => part.id === 'part-head');
  const handPart = ASSEMBLY_PARTS.find(part => part.id === 'part-right-hand');
  assert.equal(STEPS.length, 13);
  assert.equal(STEPS.some(step => /explode|reassemble/.test(step.kind)), false);
  assert.equal(lesson.state.assembled, 12);
  assert.equal(h.guidance.welcomeCard.title, 'Welcome to Creation Studio');
  assert.match(h.guidance.welcomeCard.body, /one step at a time/i);
  assert.equal(h.guidance.welcomeCard.startLabel, 'Meet Creation Studio');
  assert.deepEqual(h.project.get('part-head').components.transform, headPart.challengeTransform);
  assert.deepEqual(h.project.get('part-right-hand').components.transform, handPart.challengeTransform);
  assert.equal(h.expressions.at(-1), 'frown');
  for (const part of ASSEMBLY_PARTS.filter(part => !['part-head', 'part-right-hand'].includes(part.id))) {
    assert.deepEqual(h.project.get(part.id).components.transform, part.targetTransform, `${part.name} starts assembled`);
  }

  assert.equal(h.guidance.current.target, '.viewport');
  assert.equal(h.guidance.current.spotlight, true, 'step 2 outlines the viewport');
  assert.equal(h.guidance.current.callout, true, 'targeted steps use the reusable location card');
  assert.equal(h.guidance.current.anchorCallout, false, 'the large viewport keeps the card in its fixed instruction home');
  assert.equal(h.guidance.current.secondaryLabel, 'Show me where');
  advance();
  h.listeners.get('click')({ target: { closest: selector => selector === '.scene-row' ? { dataset: { entityId: 'part-head' } } : null } });
  await new Promise(resolve => queueMicrotask(resolve)); advance();
  advance();
  assert.equal(STEPS[lesson.state.step].kind, 'tools');
  assert.equal(h.guidance.current.target, '#tool-rail');
  assert.equal(h.capabilities.at(-1).tools.move, true);
  assert.equal(h.capabilities.at(-1).tools.rotate, true);
  assert.equal(h.capabilities.at(-1).tools.scale, true);
  assert.equal(h.capabilities.at(-1).panels.inspector, false, 'the tool step introduces one interface region at a time');
  assert.equal(h.capabilities.at(-1).features.snap, false, 'Snap stays hidden until its own introduction');
  assert.match(h.guidance.current.body, /Navigate & Transform/);
  advance();
  assert.equal(STEPS[lesson.state.step].kind, 'snap');
  assert.equal(h.guidance.current.target, '.snap-toggle');
  assert.equal(h.capabilities.at(-1).features.snap, true);
  assert.equal(h.capabilities.at(-1).features.snapSettings, false, 'Build introduces the default toggle without advanced settings');
  assert.deepEqual(h.tools.getSnapSettings(), {
    enabled: false, mode: 'increment', moveStep: .25, rotateStep: 15, scaleStep: .1, surfaceDistance: .5,
  });
  assert.match(h.guidance.current.body, /0\.25-unit steps/i);
  assert.match(h.guidance.current.body, /15° steps/i);
  assert.equal(h.guidance.complete, false);
  h.tools.setSnapping(true);
  assert.equal(h.guidance.complete, true);
  advance();
  assert.equal(STEPS[lesson.state.step].kind, 'headMove');
  assert.equal(STEPS[lesson.state.step].title, 'Place the Head');
  assert.equal(lesson.state.assembled, 12);
  assert.equal(h.tools.getSnapping(), true);
  assert.match(h.guidance.current.body, /Snap/i);
  for (const part of ASSEMBLY_PARTS.filter(part => part.id !== 'part-head')) {
    h.project.selection.set(part.id);
    const capability = h.capabilities.at(-1);
    assert.equal(capability.tools.move, false, `${part.name} cannot be moved during Head repair`);
    assert.equal(capability.tools.rotate, false, `${part.name} cannot be rotated during Head repair`);
    assert.equal(capability.panels.inspector, false, `${part.name} has no editable Inspector during Head repair`);
  }
  h.project.selection.set('part-head');
  assert.equal(h.capabilities.at(-1).tools.move, true);
  assert.equal(h.capabilities.at(-1).tools.rotate, false);
  assert.equal(h.capabilities.at(-1).tools.scale, false);
  assert.equal(h.capabilities.at(-1).panels.inspector, false, 'Head repair must use viewport tools, not numeric fields');
  for (const part of ASSEMBLY_PARTS.filter(part => !['part-head', 'part-right-hand'].includes(part.id))) {
    assert.deepEqual(h.project.get(part.id).components.transform, part.targetTransform, `${part.name} stays assembled`);
  }

  const head = h.project.get('part-head');
  h.guidance.current.onSecondary();
  assert.equal(h.guidance.targetShows, 1, 'the optional action only reopens the visual location highlight');
  assert.equal(h.guidance.messages.length, 0, 'the assembly lesson does not add green hint messages');
  assert.equal(h.guidance.complete, false, 'showing the target must not place the Head');
  assert.deepEqual(h.guide.options.at(-1).match, ['rotation', 'scale'], 'the Head outline keeps the tilted Head’s rotation while it is moved');
  h.project.updateTransform(head.id, { position: [...headPart.targetTransform.position] });
  assert.equal(h.guidance.complete, true);
  assert.equal(h.expressions.at(-1), 'frown', 'placing the Head alone does not restore its expression');
  advance();
  assert.equal(STEPS[lesson.state.step].kind, 'headRotate');
  assert.equal(h.capabilities.at(-1).tools.move, false);
  assert.equal(h.capabilities.at(-1).tools.rotate, true);
  assert.equal(h.capabilities.at(-1).tools.scale, false);
  assert.equal(h.guidance.complete, false, 'rotation remains a separate learner action');
  assert.equal(h.guide.options.at(-1), undefined, 'the rotation step shows the upright destination');
  h.project.updateTransform(head.id, { rotation: [...headPart.targetTransform.rotation] });
  assert.equal(h.guidance.complete, true);
  assert.equal(h.expressions.at(-1), 'smile', 'reconnecting the Head restores its smile');
  advance();
  const hand = h.project.get(handPart.id);
  assert.equal(STEPS[lesson.state.step].kind, 'handScale');
  assert.equal(STEPS[lesson.state.step].title, 'Resize the Hand');
  assert.equal(h.project.selection.activeId, handPart.id);
  assert.equal(h.camera.locked, false);
  assert.equal(h.capabilities.at(-1).tools.scale, true);
  assert.equal(h.capabilities.at(-1).tools.move, false);
  assert.deepEqual(h.capabilities.at(-1).transformFields, { position: false, rotation: false, scale: true, axes: null, currentAxis: null, scrub: null });
  assert.deepEqual(h.guide.options.at(-1), { match: ['rotation'] }, 'the outline keeps the Hand’s tilt so only size is compared');
  assert.match(h.guidance.current.body, /Scale handles are useful.*Scale numbers are useful/i);
  h.project.updateTransform(hand.id, { scale: [1.2, 1.2, 1.2] });
  assert.equal(h.guidance.complete, false, 'an off-target scale cannot pass the Scale gate');
  h.project.updateTransform(hand.id, { scale: [1, 1, 1.004] });
  assert.equal(h.guidance.complete, true);
  assert.deepEqual(hand.components.transform.scale, [1, 1, 1], 'a close scale settles exactly');
  advance();
  assert.equal(STEPS[lesson.state.step].kind, 'handRotation');
  assert.equal(h.capabilities.at(-1).tools.rotate, true);
  assert.deepEqual(h.capabilities.at(-1).transformFields, { position: false, rotation: true, scale: false, axes: null, currentAxis: null, scrub: null });
  assert.equal(h.guide.options.at(-1), undefined, 'the outline shows the upright, full-size destination');
  assert.match(h.guidance.current.body, /Rotate handles help.*Rotation numbers help/i);
  h.project.updateTransform(hand.id, { rotation: [0, 0, 0.2] });
  assert.equal(h.guidance.complete, false, 'an off-target rotation cannot pass the Rotation gate');
  h.project.updateTransform(hand.id, { rotation: [0, 0, 0] });
  assert.equal(h.guidance.complete, true);
  advance();

  // In a flat view, an offset along the view direction is invisible.
  const sub = (a, b) => a.map((value, index) => value - b[index]);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const hiddenFrom = view => Math.hypot(...cross(sub(hand.components.transform.position, HAND_TARGET), sub(view.target, view.position))) < 1e-9;
  assert.deepEqual(HAND_AXIS_ORDER, ['z', 'y', 'x']);
  for (const [order, axis] of HAND_AXIS_ORDER.entries()) {
    const index = 'xyz'.indexOf(axis);
    assert.equal(STEPS[lesson.state.step].kind, 'handAxis');
    assert.equal(STEPS[lesson.state.step].axis, axis);
    assert.equal(STEPS[lesson.state.step].title, `Place the Hand: Position ${axis.toUpperCase()}`);
    assert.equal(h.project.selection.activeId, handPart.id);
    assert.equal(h.camera.locked, true, 'the camera stays on one view while an axis is placed');
    assert.deepEqual(h.camera.moves.at(-1), handAxisView(axis));
    assert.equal(h.camera.moves.at(-1).orthographic, true, 'locked views are flat, so depth cannot show as size');
    assert.equal(h.capabilities.at(-1).tools.move, false, 'Move handles could change the hidden axes');
    assert.equal(h.capabilities.at(-1).tools.rotate, false);
    assert.equal(h.capabilities.at(-1).tools.scale, false);
    assert.equal(h.capabilities.at(-1).features.view, false, 'view presets cannot unlock the camera');
    assert.equal(h.capabilities.at(-1).panels.inspector, true);
    const fields = h.capabilities.at(-1).transformFields;
    assert.equal(fields.position, true); assert.equal(fields.rotation, false); assert.equal(fields.scale, false);
    assert.deepEqual(fields.axes.position, HAND_AXIS_ORDER.slice(0, order + 1), 'placed axes stay editable while later axes wait');
    assert.equal(fields.currentAxis.position, axis);
    assert.deepEqual(fields.scrub, { position: true }, 'Position values can be dragged like a Blender field');
    assert.match(h.guidance.current.body, new RegExp(`Position ${axis.toUpperCase()} to ${HAND_TARGET[index]}\\b`));
    assert.equal(h.guide.visible, false, 'the outline would give the hidden gap away while placing');
    assert.equal(h.guidance.complete, false);
    assert.ok(!hiddenFrom(handAxisView(axis)), 'the current axis is visibly wrong in its own view');

    const position = [...hand.components.transform.position];
    position[index] = HAND_TARGET[index] + .1;
    h.project.updateTransform(hand.id, { position });
    assert.equal(h.guidance.complete, false, 'an off-target value cannot pass the axis gate');
    position[index] = HAND_TARGET[index] + .004;
    h.project.updateTransform(hand.id, { position });
    assert.equal(h.guidance.complete, true, 'a close value is accepted');
    assert.equal(hand.components.transform.position[index], HAND_TARGET[index], 'the accepted axis settles on the exact joint');
    assert.ok(hiddenFrom(handAxisView(axis)), 'from the locked view, the remaining gap points straight at the camera');
    if (order < 2) assert.ok(!hiddenFrom(handAxisView(HAND_AXIS_ORDER[order + 1])), 'the next view reveals the gap');
    advance();
  }
  assert.deepEqual(hand.components.transform, handPart.targetTransform, 'size, direction, and position reconnect the Hand exactly');
  assert.equal(lesson.state.assembled, 14);
  assert.equal(STEPS[lesson.state.step].kind, 'done');
  assert.equal(h.camera.locked, false, 'the camera is free again to check every angle');
  assert.equal(h.camera.moves.at(-1).orthographic, undefined, 'the check returns to a normal perspective view');
  assert.equal(h.guide.visible, true, 'the outline returns to confirm the fit from every angle');
  assert.deepEqual(h.guide.options.at(-1), { floor: false, marker: false });
  assert.match(h.guidance.current.body, /every side/i);
  assert.equal(h.capabilities.at(-1).features.snap, false);
  for (const part of ASSEMBLY_PARTS) assert.deepEqual(h.project.get(part.id).components.transform, part.targetTransform);
  advance();

  assert.equal(lesson.state.finished, true);
  assert.equal(h.capabilities.at(-1).features.snap, true);
  assert.equal(h.capabilities.at(-1).features.snapSettings, false);
  assert.deepEqual(h.guide.shown, ['part-head', 'part-head', 'part-right-hand', 'part-right-hand', 'part-right-hand']);
  assert.ok(!STEPS.some(step => /fourteen/i.test(`${step.title} ${step.body}`)));
  assert.equal(h.camera.locked, false);
});


test('assembled joints and geometry preserve the original GLB proportions', () => {
  const readGLB = url => {
    const bytes = fs.readFileSync(url);
    return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
  };
  const original = readGLB(new URL('../../../assets/models/gizmobot.glb', import.meta.url));
  const split = readGLB(new URL('../../labs/robot-assembly/assets/gizmobot-assembly.glb', import.meta.url));
  const authoredScale = original.nodes[0].scale;
  const normalized = authoredScale.map(value => value / authoredScale[1]);
  assert.deepEqual(ASSEMBLY_MODEL_SCALE, normalized);
  assert.ok(normalized[0] < .9, 'source asset has a meaningful authored width correction');
  for (const part of ASSEMBLY_PARTS) {
    const joint = split.nodes.find(node => node.name === part.node);
    const surface = split.nodes[joint.children[0]];
    const primitive = split.meshes[surface.mesh].primitives[0];
    const bounds = split.accessors[primitive.attributes.POSITION];
    for (const point of [bounds.min, bounds.max]) {
      point.forEach((value, axis) => {
        const assembled = ASSEMBLY_ROOT_POSITION[axis] + part.target[axis] + (value + surface.translation[axis]) * ASSEMBLY_MODEL_SCALE[axis];
        assert.ok(Math.abs(assembled - value * normalized[axis]) < 1e-9, `${part.name} axis ${axis} keeps the source silhouette and joint alignment`);
      });
    }
  }
});
