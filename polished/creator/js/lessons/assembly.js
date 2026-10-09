import { ASSEMBLY_PARTS, ASSEMBLY_PART_IDS, ASSEMBLY_ROOT_POSITION, HAND_START_OFFSET } from '../assemblyData.js';
import { createGuidance } from './guidance.js';

const D = Math.PI / 180;
const HEAD = ASSEMBLY_PARTS.find(part => part.id === 'part-head');
const HAND = ASSEMBLY_PARTS.find(part => part.id === 'part-right-hand');
const shortNumber = value => String(Number(value.toFixed(2)));
const handValues = {
  x: shortNumber(HAND.targetTransform.position[0]),
  y: shortNumber(HAND.targetTransform.position[1]),
  z: shortNumber(HAND.targetTransform.position[2]),
};
const AXES = ['x', 'y', 'z'];
// After its size and direction are fixed, the Hand is placed one Position axis
// at a time from a locked, flat (orthographic) camera. Each view looks straight
// along the axes still wrong, and a flat view shows no depth or size change,
// so the Hand looks exactly placed until the camera turns: Z, then Y, then X.
export const HAND_AXIS_ORDER = Object.freeze(['z', 'y', 'x']);
const HAND_VIEW_DISTANCE = 5.4;
// Pan inward and down so the Body stays in frame; panning keeps the view
// direction, which is all that decides what a flat view hides.
const HAND_VIEW_PAN = Object.freeze([.3, -.2, 0]);
export function handAxisView(axis) {
  const remaining = HAND_AXIS_ORDER.slice(HAND_AXIS_ORDER.indexOf(axis) + 1);
  const hidden = AXES.map((name, index) => remaining.includes(name) ? HAND_START_OFFSET[index] : 0);
  const length = Math.hypot(...hidden);
  // The last axis has nothing left to hide: look along the first axis fixed.
  const direction = length ? hidden.map(value => value / length)
    : AXES.map((name, index) => name === HAND_AXIS_ORDER[0] ? Math.sign(HAND_START_OFFSET[index]) : 0);
  const target = HAND.targetTransform.position.map((value, index) => value + ASSEMBLY_ROOT_POSITION[index] + HAND_VIEW_PAN[index]);
  return { position: target.map((value, index) => value + direction[index] * HAND_VIEW_DISTANCE), target, orthographic: true };
}
// A three-quarter perspective view from the Hand's side confirms the placement.
const HAND_CHECK_VIEW = Object.freeze({ position: [-3.6, 2.7, -3.4], target: [-.55, 1.35, .15] });
// A Head dragged before Snap is on starts off the 0.25 grid. Snapped drags can
// still bring each axis within half a step (0.125), so the catch is a little
// wider than that. One full step away (0.25) stays outside it.
const POSITION_CATCH = .15;
const maxDifference = (a, b) => Math.max(...a.map((value, index) => Math.abs(value - b[index])));
const angleDistance = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const rotationDistance = (a, b) => Math.max(...a.map((value, index) => angleDistance(value, b[index])));

// Only steps that introduce a new control or region use a spotlight, which
// asks for Okay before practice. Read-only and repeat steps go straight to the
// task or Continue.
export const STEPS = Object.freeze([
  { kind: 'viewport', title: 'Meet the Viewport', target: '.viewport',
    terms: ['Viewport'],
    body: 'Look at Gizmobot, its loose Head, and its oversized Hand in this large area. This is the Viewport: your view into the 3D scene, where you select and position objects.' },
  { kind: 'scene', title: 'Find the Head in the Outliner', target: '.scene-panel', spotlight: true,
    terms: ['Outliner'],
    body: 'Choose Head in the Outliner on the right. Notice how its name selects the same frowning, disconnected piece in the Viewport.' },
  { kind: 'reveal', title: 'Every part is its own object', target: '.scene-panel',
    body: 'Gizmobot looks like one robot, but each part is a separate object with its own name in the Outliner: Head, Body, arms, hands, and feet. That is why you can repair the Head and Hand without disturbing anything else.', continueLabel: 'Repair the Head' },
  // Snap, then Move, then the drag: one short card each. Turning on Snap ends
  // with Continue, so the learner sees it lit before moving on; choosing Move
  // moves on by itself.
  { kind: 'headSnap', part: HEAD, title: 'Turn on Snap', target: '.snap-toggle', spotlight: true,
    terms: ['Snap'],
    body: 'Choose Snap at the top right. It makes each drag jump in even steps, so parts line up exactly.' },
  { kind: 'headMoveTool', part: HEAD, title: 'Choose Move', target: '[data-tool="move"]', spotlight: true, autoAdvance: true,
    terms: ['Move'], references: ['Navigate & Transform'],
    body: 'Choose Move, which you used in Navigate & Transform.' },
  { kind: 'headMove', part: HEAD, title: 'Move the Head into place',
    body: 'Drag the Head’s arrows into the orange guide.', continueLabel: 'Straighten the Head' },
  { kind: 'headRotate', part: HEAD, title: 'Straighten the Head', target: '[data-tool="rotate"]', spotlight: true,
    terms: ['Rotate'], references: ['Navigate & Transform'],
    body: 'Choose Rotate, also from Navigate & Transform, and drag its coloured rings to turn the Head upright. Snap turns it in 15° steps. When the Head fits, it reconnects.', continueLabel: 'Repair the Hand' },
  { kind: 'handScale', part: HAND, title: 'Resize the Hand', target: '.inspector-panel', spotlight: true,
    terms: ['Scale', 'Inspector'],
    body: 'In the Inspector, set Scale X, Y, and Z to 1 so the Hand matches the orange outline: type each number, or drag across it. The tool handles step aside while you work with exact numbers.', continueLabel: 'Set its direction' },
  { kind: 'handRotation', part: HAND, title: 'Straighten the Hand', target: '.inspector-panel',
    terms: ['Rotation'],
    body: 'Set Rotation X, Y, and Z to 0° so the fingers point forward like the outline.', continueLabel: 'Place the Hand' },
  { kind: 'handAxis', axis: 'z', part: HAND, title: 'Place the Hand: Position Z', target: '.inspector-panel', spotlight: true,
    terms: ['Position'],
    body: `Set Position Z to ${handValues.z}. The camera is locked to one view for now.`, continueLabel: 'Turn the camera' },
  { kind: 'handAxis', axis: 'y', part: HAND, title: 'Place the Hand: Position Y', target: '.inspector-panel',
    body: `Set Position Y to ${handValues.y}. From the side, the Hand is still too high: the last view looked straight along that gap, so it stayed hidden.`, continueLabel: 'Turn the camera' },
  { kind: 'handAxis', axis: 'x', part: HAND, title: 'Place the Hand: Position X', target: '.inspector-panel',
    body: `Set Position X to ${handValues.x}. From the front, the Hand is still too far from its wrist: the side view hid that gap the same way.`, continueLabel: 'Check every angle' },
  { kind: 'done', title: 'You can build in Creation Studio!',
    body: 'Gizmobot is back online and smiling. You placed the Head by eye with Move and Rotate, and set the Hand exactly with Inspector numbers. Orbit around the Hand: it meets its wrist from every side.', continueLabel: 'Back to Home' },
]);
// Like Material Lab and Navigate + Transform, the closing celebration is not a numbered step.
const NUMBERED_STEPS = STEPS.length - 1;
const HOME_URL = '../';

// Axes already placed stay editable; the ones still ahead stay locked.
const handAxesThrough = axis => HAND_AXIS_ORDER.slice(0, HAND_AXIS_ORDER.indexOf(axis) + 1);

// Each tool joins the rail on the step that first uses it and then stays.
const introducedAt = kind => STEPS.findIndex(step => step.kind === kind);
const TOOL_INTRODUCTIONS = Object.freeze({ move: introducedAt('headMoveTool'), rotate: introducedAt('headRotate'), scale: introducedAt('handScale') });
const SNAP_INTRODUCTION = introducedAt('headSnap');

function lessonCapabilities(index, targetSelected = true, snapping = false) {
  const kind = STEPS[index].kind;
  const handRepair = ['handAxis', 'handRotation', 'handScale'].includes(kind) && targetSelected;
  const handKind = kind === 'handAxis' ? 'position' : kind === 'handRotation' ? 'rotation' : 'scale';
  const handAxis = handRepair && handKind === 'position';
  const inspectorVisible = handRepair;
  // The Hand is repaired with Inspector numbers only, so the tool handles
  // step aside for all of it. They return for the finale.
  const toolsUsable = targetSelected && !['handScale', 'handRotation', 'handAxis'].includes(kind);
  // The Head only moves once Snap is on, so every drag lands on the 0.25 grid.
  const tool = name => toolsUsable && index >= TOOL_INTRODUCTIONS[name] && !(name === 'move' && ['headMoveTool', 'headMove'].includes(kind) && !snapping);
  return {
    tools: { select: true, move: tool('move'), rotate: tool('rotate'), scale: tool('scale'), add: false },
    panels: { scene: true, inspector: inspectorVisible, bottomEditor: false },
    inspectorSections: { transform: inspectorVisible, geometry: false, appearance: false, hierarchy: false },
    transformFields: {
      position: handAxis, rotation: handRepair && handKind === 'rotation', scale: handRepair && handKind === 'scale',
      axes: handAxis ? { position: handAxesThrough(STEPS[index].axis) } : null,
      currentAxis: handAxis ? { position: STEPS[index].axis } : null,
      scrub: handAxis ? { position: true } : null,
    },
    actions: { duplicate: false, delete: false, visibility: false, rename: false, group: false, ungroup: false, reparent: false },
    features: { studio: false, snap: index >= SNAP_INTRODUCTION, snapSettings: false, view: false },
  };
}

const finishedCapabilities = {
  tools: { select: true, move: true, rotate: true, scale: true, add: false },
  panels: { scene: true, inspector: true, bottomEditor: false },
  inspectorSections: { transform: true, geometry: false, appearance: false, hierarchy: true },
  transformFields: { position: true, rotation: true, scale: true, axes: null, currentAxis: null, scrub: null },
  actions: { duplicate: false, delete: false, visibility: true, rename: true, group: true, ungroup: true, reparent: true },
  features: { studio: false, snap: true, snapSettings: false, view: false },
};

const cloneTransform = transform => ({
  position: [...transform.position], rotation: [...transform.rotation], scale: [...transform.scale],
});

export async function createAssemblyLesson(creationStudio, {
  guidance: suppliedGuidance, guide: suppliedGuide, onFinish,
  // A short beat after a setup step is done, so the learner sees it work.
  pause = ms => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  if (!creationStudio?.project || !creationStudio?.setCapabilities) throw new TypeError('A ready Creation Studio instance is required');
  await creationStudio.viewport?.ready;

  const { project, tools, viewport } = creationStudio;
  const guidance = suppliedGuidance || createGuidance();
  const guide = suppliedGuide || (viewport?.stage ? (await import('./assemblyGuide.js')).createAssemblyGuide(creationStudio) : null);
  const helpButton = document.getElementById('help-toggle');
  const priorTitle = document.title;
  const repairIds = new Set([HEAD.id, HAND.id]);
  const assembled = new Set(ASSEMBLY_PART_IDS.filter(id => !repairIds.has(id)));
  let scenePicked = null;
  let index = 0;
  let complete = false;
  let finished = false;
  let connecting = false;
  let capabilityKey = null;
  // Where the Head was when Snap was turned on: the click needs a snapped drag.
  let snapStart = null;
  let advancing = false;

  const current = () => STEPS[index];

  function isAtTarget(part, tolerance = .001) {
    const transform = project.get(part.id)?.components.transform;
    return Boolean(transform && maxDifference(transform.position, part.targetTransform.position) <= tolerance && rotationDistance(transform.rotation, part.targetTransform.rotation) <= tolerance && maxDifference(transform.scale, part.targetTransform.scale) <= tolerance);
  }

  // Accept displayed two-decimal values and settle on the exact target so the
  // Hand lines up precisely with its outline.
  function settleField(part, field) {
    const transform = project.get(part.id)?.components.transform;
    if (!transform || maxDifference(transform[field], part.targetTransform[field]) > .01) return false;
    if (maxDifference(transform[field], part.targetTransform[field]) > 0) project.updateTransform(part.id, { [field]: [...part.targetTransform[field]] });
    return true;
  }

  function settleAxis(part, axis) {
    const position = project.get(part.id)?.components.transform.position;
    const index = AXES.indexOf(axis);
    const target = part.targetTransform.position[index];
    if (!position || Math.abs(position[index] - target) > .01) return false;
    if (position[index] !== target) {
      const next = [...position]; next[index] = target;
      project.updateTransform(part.id, { position: next });
    }
    return true;
  }

  function snapIntoPlace(part) {
    const position = project.get(part.id)?.components.transform.position;
    if (position && maxDifference(position, part.targetTransform.position) === 0) return true;
    if (!position || !tools.getSnapping()) { snapStart = null; return false; }
    snapStart ||= [...position];
    if (maxDifference(position, snapStart) === 0 || maxDifference(position, part.targetTransform.position) > POSITION_CATCH) return false;
    project.updateTransform(part.id, { position: [...part.targetTransform.position] });
    return true;
  }

  function maybeConnect(part) {
    if (connecting) return;
    if (assembled.has(part.id) && isAtTarget(part)) return;
    assembled.delete(part.id);
    if (part.id === HEAD.id) viewport?.setAssemblyHeadExpression?.('frown');
    const entity = project.get(part.id);
    if (!entity) return;
    const closePosition = maxDifference(entity.components.transform.position, part.targetTransform.position) <= POSITION_CATCH;
    const closeRotation = rotationDistance(entity.components.transform.rotation, part.targetTransform.rotation) <= 2 * D;
    if (!closePosition || !closeRotation || maxDifference(entity.components.transform.scale, part.targetTransform.scale) > .001) {
      return;
    }
    connecting = true;
    project.updateTransform(part.id, cloneTransform(part.targetTransform));
    assembled.add(part.id);
    if (part.id === HEAD.id) viewport?.setAssemblyHeadExpression?.('smile');
    connecting = false;
  }

  async function autoAdvance(step) {
    if (advancing) return;
    advancing = true;
    await pause(450);
    advancing = false;
    if (finished || current() !== step || !complete) return;
    index++;
    showStep();
  }

  function decorateScene() {
    for (const part of ASSEMBLY_PARTS) {
      const row = document.querySelector(`[data-entity-id="${part.id}"]`);
      if (!row) continue;
      delete row.dataset.assembled;
      row.dataset.currentTarget = String(current().part?.id === part.id && !assembled.has(part.id));
    }
  }

  function evaluate() {
    if (finished) return;
    const step = current();
    applyCapabilities();
    if (step.part === HEAD) maybeConnect(step.part);
    let next = false;
    if (['viewport', 'reveal', 'done'].includes(step.kind)) next = true;
    else if (step.kind === 'scene') next = scenePicked === HEAD.id;
    else if (step.kind === 'headSnap') next = tools.getSnapping();
    else if (step.kind === 'headMoveTool') next = tools.getSnapping() && tools.getActive() === 'move';
    else if (step.kind === 'headMove') next = snapIntoPlace(step.part);
    else if (step.kind === 'headRotate') next = assembled.has(step.part.id) || isAtTarget(step.part);
    else if (step.kind === 'handScale') next = settleField(step.part, 'scale');
    else if (step.kind === 'handRotation') next = settleField(step.part, 'rotation');
    else if (step.kind === 'handAxis') {
      next = handAxesThrough(step.axis).map(axis => settleAxis(step.part, axis)).every(Boolean);
      if (next && handAxesThrough(step.axis).length === AXES.length) maybeConnect(step.part);
    }
    if (next !== complete) {
      complete = next;
      // Setup steps move on by themselves; they never show Continue.
      if (!step.autoAdvance) guidance.setComplete(next);
      else if (next) autoAdvance(step);
    }
    decorateScene();
  }

  function applyCapabilities() {
    const targetId = current().part?.id;
    const targetSelected = !targetId || (project.selection.activeId === targetId && project.selection.ids.length === 1);
    const snapping = tools.getSnapping();
    const key = targetId ? `${index}:${targetSelected}:${snapping}` : String(index);
    if (key === capabilityKey) return;
    capabilityKey = key;
    creationStudio.setCapabilities(lessonCapabilities(index, targetSelected, snapping));
  }

  function showStep() {
    const step = current();
    complete = false;
    snapStart = null;
    creationStudio.setDock?.('pinned');
    const targetId = step.part?.id || (step.kind === 'reveal' ? HEAD.id : null);
    if (targetId) project.selection.set(targetId);
    if (step.kind === 'headSnap') tools.setSnapSettings({ enabled: false, mode: 'increment', moveStep: .25, rotateStep: 15, scaleStep: .1, surfaceDistance: .5 });
    applyCapabilities();
    // While the Hand is placed by eye from locked views, the outline would
    // show where it truly belongs and give the hidden gap away. The finale
    // shows the connected Hand itself, with no outline over it.
    if (step.part && step.kind !== 'handAxis') {
      // While a step asks only for Position or size, the outline keeps the
      // part's current tilt so it reads as "put it here as it is".
      guide?.show?.(step.part, {
        headSnap: { match: ['rotation', 'scale'] },
        headMoveTool: { match: ['rotation', 'scale'] },
        headMove: { match: ['rotation', 'scale'] },
        handScale: { match: ['rotation'] },
      }[step.kind]);
    } else guide?.hide?.();
    if (step.kind === 'handAxis') {
      viewport?.setCameraLocked?.(true);
      setHandShadow(false);
      const { orthographic, ...view } = handAxisView(step.axis);
      viewport?.moveCamera?.(view, { orthographic });
    } else if (viewport?.getCameraLocked?.()) {
      viewport.setCameraLocked(false);
      setHandShadow(true);
      viewport.moveCamera?.(step.kind === 'done' ? HAND_CHECK_VIEW : 'home', { duration: 1.4 });
    }

    showCard(step.target);
    evaluate();
  }

  function showCard(target) {
    const step = current();
    complete = false;
    guidance.show({
      step: step.kind === 'done' ? '' : index + 1, total: NUMBERED_STEPS, celebrate: step.kind === 'done', title: step.title, body: step.body, terms: step.terms, references: step.references,
      target, placement: step.placement, spotlight: step.spotlight, fixedHome: true, dim: false,
      callout: Boolean(step.target), anchorCallout: step.kind !== 'viewport',
      continueLabel: step.continueLabel || 'Continue', canContinue: ['viewport', 'reveal', 'done'].includes(step.kind),
      // Show me where reopens a spotlight, so it only exists on spotlit steps.
      secondaryLabel: step.spotlight ? 'Show me where' : null,
      onSecondary: () => {
        guidance.showTarget?.();
      },
      onContinue: () => {
        if (!complete) return;
        if (index < STEPS.length - 1) { index++; showStep(); return; }
        finish();
        if (onFinish) onFinish();
        else location.assign(new URL(HOME_URL, location.href));
      },
    });
  }

  // The Hand's ground shadow would reveal its depth while the camera is locked.
  function setHandShadow(enabled) {
    viewport?.getObject?.(HAND.id)?.traverse(node => { if (node.isMesh) node.castShadow = enabled; });
  }

  function finish() {
    if (finished) return;
    finished = true;
    unsubscribeProject?.(); unsubscribeTools?.();
    document.removeEventListener('click', onDocumentClick, true);
    document.removeEventListener('keydown', onSceneKey, true);
    guide?.hide?.(); guide?.dispose?.(); guidance.destroy();
    viewport?.setCameraLocked?.(false);
    setHandShadow(true);
    creationStudio.setCapabilities(finishedCapabilities);
    if (helpButton) helpButton.hidden = false;
    document.title = priorTitle;
  }

  function onDocumentClick(event) {
    const row = event.target.closest?.('.scene-row');
    if (row && current().kind === 'scene') { scenePicked = row.dataset.entityId; queueMicrotask(evaluate); }
  }

  function onSceneKey(event) {
    if (['Enter', ' '].includes(event.key)) onDocumentClick(event);
  }

  const unsubscribeProject = project.subscribe(evaluate);
  const unsubscribeTools = tools.subscribe(evaluate);
  document.addEventListener('click', onDocumentClick, true);
  document.addEventListener('keydown', onSceneKey, true);

  const api = Object.freeze({
    get state() { return { step: index, total: STEPS.length, complete, finished, assembled: assembled.size }; },
    next() { if (complete && !finished) index < STEPS.length - 1 ? (index++, showStep()) : finish(); },
    destroy: finish,
  });
  creationStudio.lesson = api;
  creationStudio.showGuide?.(false);
  if (helpButton) helpButton.hidden = true;
  document.title = 'Build Gizmobot · CreateAccess Creation Studio';
  creationStudio.setCapabilities(lessonCapabilities(0));
  creationStudio.setDock?.('pinned');
  viewport?.setAssemblyHeadExpression?.('frown');
  if (guidance.welcome) {
    guidance.welcome({
      eyebrow: 'BUILD GIZMOBOT',
      title: 'Get Gizmobot back online',
      body: 'Gizmobot’s Head has come loose and one Hand is the wrong size. You’ll repair both in Creation Studio, where you build and edit 3D scenes.',
      terms: ['Creation Studio'],
      startLabel: 'Start the repair',
      onStart: () => { if (!finished) showStep(); },
    });
  } else showStep();
  return api;
}
