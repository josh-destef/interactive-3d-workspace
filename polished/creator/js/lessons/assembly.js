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
const HAND_VIEW_DISTANCE = 4.2;
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
const maxDifference = (a, b) => Math.max(...a.map((value, index) => Math.abs(value - b[index])));
const angleDistance = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const rotationDistance = (a, b) => Math.max(...a.map((value, index) => angleDistance(value, b[index])));

export const STEPS = Object.freeze([
  { kind: 'viewport', title: 'Meet the Viewport', target: '.viewport', spotlight: true,
    terms: ['Viewport'],
    body: 'Look at Gizmobot, its loose Head, and its oversized Hand in this large area. This is the Viewport: your view into the 3D scene, where you select and position objects.' },
  { kind: 'scene', title: 'Find the Head in the Outliner', target: '.scene-panel', spotlight: true,
    terms: ['Outliner', 'Viewport'],
    body: 'Choose Head in the Outliner on the right. Notice how its name selects the same frowning, disconnected piece in the Viewport.' },
  { kind: 'reveal', title: 'Every part is its own object', target: '.scene-panel', spotlight: true,
    body: 'Gizmobot looks like one robot, but each part is a separate object with its own name in the Outliner: Head, Body, arms, hands, and feet. That is why you can repair the Head and Hand without disturbing anything else.', continueLabel: 'Meet the tools' },
  { kind: 'tools', title: 'Move, Rotate, and Scale', target: '#tool-rail', spotlight: true,
    terms: ['Move', 'Rotate', 'Scale'], references: ['Navigate & Transform'],
    body: 'You met Move, Rotate, and Scale in Navigate & Transform. Here they work the same way: Move changes position, Rotate changes direction, and Scale changes size. Their coloured handles follow X, Y, and Z.', continueLabel: 'Set up the repair' },
  { kind: 'snap', title: 'Make each move precise', target: '.snap-toggle', spotlight: true,
    terms: ['Snap', 'Regular increments'],
    body: 'Choose Snap. Its default Regular increments make moves land on consistent 0.25-unit steps and turns land on 15° steps. Keep these defaults for this repair.' },
  { kind: 'headMove', part: HEAD, title: 'Place the Head', target: '[data-tool="move"]', spotlight: true,
    terms: ['Move', 'Snap', 'Viewport'],
    body: 'With Snap on, move the Head into the orange guide. Notice how its position lines up with the neck.', continueLabel: 'Straighten the Head' },
  { kind: 'headRotate', part: HEAD, title: 'Straighten the Head', target: '[data-tool="rotate"]', spotlight: true,
    terms: ['Rotate', 'Snap', 'Viewport'],
    body: 'Rotate the Head upright. When its position and direction fit, the connection completes.', continueLabel: 'Repair the Hand' },
  { kind: 'handScale', part: HAND, title: 'Resize the Hand', target: '.inspector-panel', spotlight: true,
    terms: ['Scale', 'Inspector'],
    body: 'Scale handles are useful when comparing size in the Viewport; Scale numbers are useful when you need a precise size. Set Scale X 1, Y 1, Z 1 so the Hand matches the orange outline and the other hand.', continueLabel: 'Set its direction' },
  { kind: 'handRotation', part: HAND, title: 'Straighten the Hand', target: '.inspector-panel', spotlight: true,
    terms: ['Rotate', 'Inspector', 'Rotation'],
    body: 'Rotate handles help you turn an object by eye; Rotation numbers help when you need a precise angle. Set Rotation X 0°, Y 0°, Z 0° so the fingers point forward like the outline.', continueLabel: 'Place the Hand' },
  { kind: 'handAxis', axis: 'z', part: HAND, title: 'Place the Hand: Position Z', target: '.inspector-panel', spotlight: true,
    terms: ['Inspector', 'Position'],
    body: `The camera is locked to one view for now. In the Inspector, set Position Z to ${handValues.z}: type it, or drag left or right across the Z value. Watch the Hand meet its wrist.`, continueLabel: 'Turn the camera' },
  { kind: 'handAxis', axis: 'y', part: HAND, title: 'Place the Hand: Position Y', target: '.inspector-panel', spotlight: true,
    terms: ['Inspector', 'Position'],
    body: `From the side, the Hand is still too high. The first view looked straight along that gap, and a flat, locked view cannot show depth, so the Hand looked perfectly placed. Set Position Y to ${handValues.y}.`, continueLabel: 'Turn the camera' },
  { kind: 'handAxis', axis: 'x', part: HAND, title: 'Place the Hand: Position X', target: '.inspector-panel', spotlight: true,
    terms: ['Inspector', 'Position'],
    body: `From the front, the Hand is still too far from its wrist. The side view hid this gap the same way. Set Position X to ${handValues.x}.`, continueLabel: 'Check every angle' },
  { kind: 'done', title: 'Connection restored',
    terms: ['Outliner', 'Viewport'],
    body: 'Gizmobot is back online. Orbit around the Hand: it meets its wrist from every side. One locked view can hide a whole axis, so check a placement from more than one angle. In the Outliner, every part is still its own object.', continueLabel: 'Finish lesson' },
]);

// Axes already placed stay editable; the ones still ahead stay locked.
const handAxesThrough = axis => HAND_AXIS_ORDER.slice(0, HAND_AXIS_ORDER.indexOf(axis) + 1);

function lessonCapabilities(index, targetSelected = true) {
  const kind = STEPS[index].kind;
  const toolIntro = kind === 'tools' && targetSelected;
  const snapIntro = kind === 'snap' && targetSelected;
  const headMove = kind === 'headMove' && targetSelected;
  const headRotate = kind === 'headRotate' && targetSelected;
  const headRepair = headMove || headRotate;
  const handRepair = ['handAxis', 'handRotation', 'handScale'].includes(kind) && targetSelected;
  const handKind = kind === 'handAxis' ? 'position' : kind === 'handRotation' ? 'rotation' : 'scale';
  const handAxis = handRepair && handKind === 'position';
  const inspectorVisible = handRepair;
  return {
    // Position is typed or slid one axis at a time; Move handles would let a
    // drag change the other axes while the camera hides them.
    tools: { select: true, move: toolIntro || snapIntro || headMove, rotate: toolIntro || snapIntro || headRotate || (handRepair && handKind === 'rotation'), scale: toolIntro || (handRepair && handKind === 'scale'), add: false },
    panels: { scene: true, inspector: inspectorVisible, bottomEditor: false },
    inspectorSections: { transform: inspectorVisible, geometry: false, appearance: false, hierarchy: false },
    transformFields: {
      position: handAxis, rotation: handRepair && handKind === 'rotation', scale: handRepair && handKind === 'scale',
      axes: handAxis ? { position: handAxesThrough(STEPS[index].axis) } : null,
      currentAxis: handAxis ? { position: STEPS[index].axis } : null,
      scrub: handAxis ? { position: true } : null,
    },
    actions: { duplicate: false, delete: false, visibility: false, rename: false, group: false, ungroup: false, reparent: false },
    features: { studio: false, snap: ['snap', 'headMove', 'headRotate'].includes(kind), snapSettings: false, view: kind !== 'handAxis' },
  };
}

const finishedCapabilities = {
  tools: { select: true, move: true, rotate: true, scale: true, add: false },
  panels: { scene: true, inspector: true, bottomEditor: false },
  inspectorSections: { transform: true, geometry: false, appearance: false, hierarchy: true },
  transformFields: { position: true, rotation: true, scale: true, axes: null, currentAxis: null, scrub: null },
  actions: { duplicate: false, delete: false, visibility: true, rename: true, group: true, ungroup: true, reparent: true },
  features: { studio: false, snap: true, snapSettings: false, view: true },
};

const cloneTransform = transform => ({
  position: [...transform.position], rotation: [...transform.rotation], scale: [...transform.scale],
});

export async function createAssemblyLesson(creationStudio, { guidance: suppliedGuidance, guide: suppliedGuide } = {}) {
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

  function maybeConnect(part) {
    if (connecting) return;
    if (assembled.has(part.id) && isAtTarget(part)) return;
    assembled.delete(part.id);
    if (part.id === HEAD.id) viewport?.setAssemblyHeadExpression?.('frown');
    const entity = project.get(part.id);
    if (!entity) return;
    const closePosition = maxDifference(entity.components.transform.position, part.targetTransform.position) <= .035;
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
    if (['viewport', 'reveal', 'tools', 'done'].includes(step.kind)) next = true;
    else if (step.kind === 'scene') next = scenePicked === HEAD.id;
    else if (step.kind === 'snap') next = tools.getSnapping();
    else if (step.kind === 'headMove') {
      const transform = project.get(step.part.id)?.components.transform;
      next = tools.getSnapping() && Boolean(transform && maxDifference(transform.position, step.part.targetTransform.position) <= .035);
    }
    else if (step.kind === 'headRotate') next = tools.getSnapping() && (assembled.has(step.part.id) || isAtTarget(step.part));
    else if (step.kind === 'handScale') next = settleField(step.part, 'scale');
    else if (step.kind === 'handRotation') next = settleField(step.part, 'rotation');
    else if (step.kind === 'handAxis') {
      next = handAxesThrough(step.axis).map(axis => settleAxis(step.part, axis)).every(Boolean);
      if (next && handAxesThrough(step.axis).length === AXES.length) maybeConnect(step.part);
    }
    if (next !== complete) { complete = next; guidance.setComplete(next); }
    decorateScene();
  }

  function applyCapabilities() {
    const targetId = current().part?.id || (['tools', 'snap'].includes(current().kind) ? HEAD.id : null);
    const targetSelected = !targetId || (project.selection.activeId === targetId && project.selection.ids.length === 1);
    const selectionSensitive = ['tools', 'snap', 'headMove', 'headRotate', 'handAxis', 'handRotation', 'handScale'].includes(current().kind);
    const key = selectionSensitive ? `${index}:${targetSelected}` : String(index);
    if (key === capabilityKey) return;
    capabilityKey = key;
    creationStudio.setCapabilities(lessonCapabilities(index, targetSelected));
  }

  function showStep() {
    const step = current();
    complete = false;
    creationStudio.setDock?.('pinned');
    const targetId = step.part?.id || (['reveal', 'tools', 'snap'].includes(step.kind) ? HEAD.id : null);
    if (targetId) project.selection.set(targetId);
    if (step.kind === 'snap') tools.setSnapSettings({ enabled: false, mode: 'increment', moveStep: .25, rotateStep: 15, scaleStep: .1, surfaceDistance: .5 });
    applyCapabilities();
    // While the Hand is placed by eye from locked views, the outline would
    // show where it truly belongs and give the hidden gap away. It returns
    // for the final check, wrapping the connected Hand from every angle.
    if (step.kind === 'done') guide?.show?.(HAND, { floor: false, marker: false });
    else if (step.part && step.kind !== 'handAxis') {
      // While a step asks only for Position or size, the outline keeps the
      // part's current tilt so it reads as "put it here as it is".
      guide?.show?.(step.part, {
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

    guidance.show({
      step: index + 1, total: STEPS.length, title: step.title, body: step.body, terms: step.terms, references: step.references,
      target: step.target, placement: step.placement, spotlight: step.spotlight, fixedHome: true, dim: false,
      callout: Boolean(step.target), anchorCallout: step.kind !== 'viewport',
      continueLabel: step.continueLabel || 'Continue', canContinue: ['viewport', 'reveal', 'tools', 'done'].includes(step.kind),
      secondaryLabel: step.target ? 'Show me where' : null,
      onSecondary: () => {
        guidance.showTarget?.();
      },
      onContinue: () => {
        if (!complete) return;
        if (index < STEPS.length - 1) { index++; showStep(); }
        else finish();
      },
    });
    evaluate();
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
      title: 'Welcome to Creation Studio',
      body: 'Creation Studio is where you build and edit 3D scenes. You’ll reconnect Gizmobot’s Head with Move and Rotate, then restore the Hand’s size, direction, and position one step at a time.',
      terms: ['Creation Studio', 'Move', 'Rotate', 'Scale', 'Snap', 'Regular increments', 'Transform Inspector'],
      references: ['Navigate & Transform'],
      startLabel: 'Meet Creation Studio',
      onStart: () => { if (!finished) showStep(); },
    });
  } else showStep();
  return api;
}
