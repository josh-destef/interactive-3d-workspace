import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createProject } from '../js/project.js';
import { createTools } from '../js/tools.js';
import { ASSEMBLY_MODEL_SCALE, ASSEMBLY_PARTS, ASSEMBLY_PART_IDS, createAssemblyProjectData } from '../js/assemblyData.js';
import { createAssemblyLesson, STEPS } from '../js/lessons/assembly.js';

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
  const guide = { shown: [], show(part) { this.shown.push(part.id); }, hide() {}, dispose() {} };
  const project = createProject(); project.restore(createAssemblyProjectData());
  const tools = createTools();
  const previews = [];
  const expressions = [];
  const capabilities = [];
  const creator = {
    project, tools,
    viewport: {
      ready: Promise.resolve(),
      setPreviewTransforms(value) { previews.push(value); },
      setInteractionEnabled() {},
      setAssemblyHeadExpression(value) { expressions.push(value); },
    },
    dock: { inspector: { revealSection() {} } },
    setCapabilities(value) { capabilities.push(value); }, setDock() {}, showGuide() {},
  };
  return { creator, project, tools, guidance, guide, listeners, inputs, previews, expressions, dock, capabilities };
}

test('Gizmobot starts with its Head and oversized Hand disconnected', () => {
  assert.equal(ASSEMBLY_PARTS.length, 14);
  assert.equal(new Set(ASSEMBLY_PART_IDS).size, 14);
  const head = ASSEMBLY_PARTS.find(part => part.id === 'part-head');
  const hand = ASSEMBLY_PARTS.find(part => part.id === 'part-right-hand');
  assert.equal(ASSEMBLY_PARTS.filter(part => part.startTransform !== part.targetTransform).length, 2);
  assert.equal(head.startTransform, head.challengeTransform);
  assert.equal(hand.startTransform, hand.challengeTransform);
  assert.equal(head.challengeTransform.position[1], .1, 'the Head starts at a snap-safe height beside Gizmobot');
  assert.equal(head.challengeTransform.rotation[2], Math.PI / 6, 'the disconnected face stays visible with a snap-safe tilt');
  for (let axis = 0; axis < 3; axis++) {
    const moves = (head.targetTransform.position[axis] - head.challengeTransform.position[axis]) / .25;
    assert.ok(Math.abs(moves - Math.round(moves)) < 1e-9, 'Head target is reachable with the lesson’s snapped moves');
  }
  assert.deepEqual(hand.challengeTransform.scale, [1.6, 1.6, 1.6]);
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
  assert.equal(STEPS.length, 8);
  assert.equal(STEPS.some(step => /explode|reassemble/.test(step.kind)), false);
  assert.equal(lesson.state.assembled, 12);
  assert.equal(h.guidance.welcomeCard.title, 'Welcome to Creation Studio');
  assert.match(h.guidance.welcomeCard.body, /Move, Rotate, and Scale from Navigate & Transform/i);
  assert.match(h.guidance.welcomeCard.body, /missing Head and oversized Hand/i);
  assert.match(h.guidance.welcomeCard.body, /Snap/i);
  assert.match(h.guidance.welcomeCard.body, /default Regular increments/i);
  assert.match(h.guidance.welcomeCard.body, /Transform Inspector/i);
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
  assert.equal(STEPS[lesson.state.step].kind, 'head');
  assert.equal(STEPS[lesson.state.step].title, 'Restore Gizmobot’s Head');
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
  assert.equal(h.capabilities.at(-1).tools.rotate, true);
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
  h.project.updateTransform(head.id, { position: [...headPart.targetTransform.position] });
  assert.equal(h.guidance.complete, false, 'position alone must not connect');
  h.project.updateTransform(head.id, structuredClone(headPart.targetTransform));
  assert.equal(h.guidance.complete, true);
  assert.equal(h.expressions.at(-1), 'smile', 'reconnecting the Head restores its smile');
  advance();
  assert.equal(STEPS[lesson.state.step].kind, 'hand');
  assert.equal(STEPS[lesson.state.step].title, 'Resize and reconnect the Hand');
  assert.equal(h.project.selection.activeId, handPart.id);
  assert.equal(h.capabilities.at(-1).tools.move, false);
  assert.equal(h.capabilities.at(-1).tools.rotate, false);
  assert.equal(h.capabilities.at(-1).tools.scale, false);
  assert.equal(h.capabilities.at(-1).panels.inspector, true);
  assert.equal(h.capabilities.at(-1).inspectorSections.transform, true);
  assert.deepEqual(h.capabilities.at(-1).transformFields, { position: true, rotation: true, scale: true });
  assert.match(h.guidance.current.body, /Use only Transform in the Inspector/);
  assert.match(h.guidance.current.body, /Scale X 1, Y 1, Z 1/);

  const hand = h.project.get(handPart.id);
  h.project.updateTransform(hand.id, {
    position: [...handPart.targetTransform.position],
    rotation: [...handPart.targetTransform.rotation],
    scale: [...handPart.challengeTransform.scale],
  });
  assert.equal(h.guidance.complete, false, 'the oversized Hand cannot connect until its scale is corrected');
  h.project.updateTransform(hand.id, structuredClone(handPart.targetTransform));
  assert.equal(h.guidance.complete, true);
  assert.equal(lesson.state.assembled, 14);
  advance();
  assert.equal(STEPS[lesson.state.step].kind, 'done');
  assert.equal(h.capabilities.at(-1).features.snap, false);
  for (const part of ASSEMBLY_PARTS) assert.deepEqual(h.project.get(part.id).components.transform, part.targetTransform);
  advance();

  assert.equal(lesson.state.finished, true);
  assert.equal(h.capabilities.at(-1).features.snap, true);
  assert.equal(h.capabilities.at(-1).features.snapSettings, false);
  assert.deepEqual(h.guide.shown, ['part-head', 'part-right-hand']);
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
        const assembled = part.target[axis] + (value + surface.translation[axis]) * ASSEMBLY_MODEL_SCALE[axis];
        assert.ok(Math.abs(assembled - value * normalized[axis]) < 1e-9, `${part.name} axis ${axis} keeps the source silhouette and joint alignment`);
      });
    }
  }
});
