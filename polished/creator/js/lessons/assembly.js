import { ASSEMBLY_PARTS, ASSEMBLY_PART_IDS } from '../assemblyData.js';
import { createGuidance } from './guidance.js';

const D = Math.PI / 180;
const HEAD = ASSEMBLY_PARTS.find(part => part.id === 'part-head');
const HAND = ASSEMBLY_PARTS.find(part => part.id === 'part-right-hand');
const shortNumber = value => String(Number(value.toFixed(3)));
const handValues = {
  x: shortNumber(HAND.targetTransform.position[0]),
  y: shortNumber(HAND.targetTransform.position[1]),
  z: shortNumber(HAND.targetTransform.position[2]),
};
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
  { kind: 'reveal', title: 'One character, fourteen objects', target: '.scene-panel', spotlight: true,
    body: 'The Head and Hand each have their own name because they are separate objects. So do the Body, arms and feet. We can repair just those two pieces without disturbing the rest.', continueLabel: 'Meet the tools' },
  { kind: 'tools', title: 'Move, Rotate, and Scale', target: '#tool-rail', spotlight: true,
    terms: ['Move', 'Rotate', 'Scale'], references: ['Navigate & Transform'],
    body: 'You met Move, Rotate, and Scale in Navigate & Transform. Here they work the same way: Move changes position, Rotate changes direction, and Scale changes size. Their coloured handles follow X, Y, and Z.', continueLabel: 'Set up the repair' },
  { kind: 'snap', title: 'Make each move precise', target: '.snap-toggle', spotlight: true,
    terms: ['Snap', 'Regular increments'],
    body: 'Choose Snap. Its default Regular increments make moves land on consistent 0.25-unit steps and turns land on 15° steps. Keep these defaults for this repair.' },
  { kind: 'head', part: HEAD, title: 'Restore Gizmobot’s Head', target: '[data-tool="move"]', spotlight: true,
    terms: ['Move', 'Rotate', 'Snap', 'Viewport'],
    body: 'Gizmobot cannot run a systems check without its Head. With Snap on, use Move to fit it into the orange guide, then Rotate it upright. When it is close enough, the connection completes.', continueLabel: 'Repair the Hand' },
  { kind: 'hand', part: HAND, title: 'Resize and reconnect the Hand', target: '.inspector-panel', spotlight: true,
    terms: ['Transform', 'Inspector', 'Position', 'Rotation', 'Scale'],
    body: `The Hand is too large as well as misplaced. Use only Transform in the Inspector. Enter Position X ${handValues.x}, Y ${handValues.y}, Z ${handValues.z}; Rotation X 0°, Y 0°, Z 0°; and Scale X 1, Y 1, Z 1.`, continueLabel: 'Run systems check' },
  { kind: 'done', title: 'Connection restored',
    terms: ['Outliner', 'Inspector', 'Viewport'],
    body: 'Gizmobot is back online. You repaired the Head with Viewport tools and restored the oversized Hand with exact Inspector values. The Outliner still keeps every piece separate, even though they read as one character.', continueLabel: 'Finish lesson' },
]);

function lessonCapabilities(index, targetSelected = true) {
  const kind = STEPS[index].kind;
  const toolIntro = kind === 'tools' && targetSelected;
  const snapIntro = kind === 'snap' && targetSelected;
  const headRepair = kind === 'head' && targetSelected;
  const handRepair = kind === 'hand' && targetSelected;
  const inspectorVisible = handRepair;
  return {
    tools: { select: true, move: toolIntro || snapIntro || headRepair, rotate: toolIntro || snapIntro || headRepair, scale: toolIntro, add: false },
    panels: { scene: true, inspector: inspectorVisible, bottomEditor: false },
    inspectorSections: { transform: inspectorVisible, geometry: false, appearance: false, hierarchy: false },
    transformFields: { position: handRepair, rotation: handRepair, scale: handRepair },
    actions: { duplicate: false, delete: false, visibility: false, rename: false, group: false, ungroup: false, reparent: false },
    features: { studio: false, snap: ['snap', 'head'].includes(kind), snapSettings: false, view: true },
  };
}

const finishedCapabilities = {
  tools: { select: true, move: true, rotate: true, scale: true, add: false },
  panels: { scene: true, inspector: true, bottomEditor: false },
  inspectorSections: { transform: true, geometry: false, appearance: false, hierarchy: true },
  transformFields: { position: true, rotation: true, scale: true },
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

  function isAtTarget(part) {
    const transform = project.get(part.id)?.components.transform;
    return Boolean(transform && maxDifference(transform.position, part.targetTransform.position) <= .001 && rotationDistance(transform.rotation, part.targetTransform.rotation) <= .001 && maxDifference(transform.scale, part.targetTransform.scale) <= .001);
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
    if (step.part) maybeConnect(step.part);
    let next = false;
    if (['viewport', 'reveal', 'tools', 'done'].includes(step.kind)) next = true;
    else if (step.kind === 'scene') next = scenePicked === HEAD.id;
    else if (step.kind === 'snap') next = tools.getSnapping();
    else if (step.kind === 'head') next = tools.getSnapping() && (assembled.has(step.part.id) || isAtTarget(step.part));
    else if (step.kind === 'hand') next = assembled.has(step.part.id) || isAtTarget(step.part);
    if (next !== complete) { complete = next; guidance.setComplete(next); }
    decorateScene();
  }

  function applyCapabilities() {
    const targetId = current().part?.id || (['tools', 'snap'].includes(current().kind) ? HEAD.id : null);
    const targetSelected = !targetId || (project.selection.activeId === targetId && project.selection.ids.length === 1);
    const selectionSensitive = ['tools', 'snap', 'head', 'hand'].includes(current().kind);
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
    if (step.part) {
      guide?.show?.(step.part);
    } else guide?.hide?.();

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

  function finish() {
    if (finished) return;
    finished = true;
    unsubscribeProject?.(); unsubscribeTools?.();
    document.removeEventListener('click', onDocumentClick, true);
    document.removeEventListener('keydown', onSceneKey, true);
    guide?.hide?.(); guide?.dispose?.(); guidance.destroy();
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
      body: 'Creation Studio is CreateAccess’s workspace for building and editing 3D scenes. You’ll locate Gizmobot’s missing Head and oversized Hand, revisit Move, Rotate, and Scale from Navigate & Transform, use Snap with its default Regular increments, and make an exact repair with the Transform Inspector.',
      terms: ['Creation Studio', 'Move', 'Rotate', 'Scale', 'Snap', 'Regular increments', 'Transform Inspector'],
      references: ['Navigate & Transform'],
      startLabel: 'Meet Creation Studio',
      onStart: () => { if (!finished) showStep(); },
    });
  } else showStep();
  return api;
}
