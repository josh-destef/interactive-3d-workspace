import { createGuidance } from './guidance.js';

const PRIMITIVES = new Set(['cube', 'sphere', 'cylinder', 'cone', 'plane']);
const BODY_TARGET = [-2, 1.75, -1];
const copy = value => structuredClone(value);
const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
const maxDifference = (a, b) => Math.max(...a.map((value, index) => Math.abs(value - b[index])));

const STEPS = [
  {
    title: 'See simple shapes become an accessory',
    terms: ['Viewport'],
    body: 'See how this back module is made. Break it apart and look for two cubes, a cylinder, and a sphere.',
    target: '.viewport', placement: 'right', spotlight: false, ready: context => context.exampleSeen,
  },
  {
    title: 'Add the Backpack Body',
    terms: ['Cube'],
    body: 'Add one Cube. This first cube is the Backpack Body and will become the parent that carries every other piece.',
    target: '#add-toggle', placement: 'right', spotlight: true,
    ready: context => Boolean(context.bodyId),
  },
  {
    title: 'Place it behind Gizmobot',
    terms: ['Move', 'Transform', 'Inspector'], references: ['Build Gizmobot'],
    body: 'Move the Backpack Body behind Gizmobot to Position X -2, Y 1.75, Z -1. Drag the Move handles, or enter the values in Inspector → Transform. As in Build Gizmobot, use the Inspector to fine-tune an approximate drag.',
    target: '.inspector-section[data-section="transform"]', placement: 'left', spotlight: true,
    ready: context => context.bodyAtTarget(),
  },
  {
    title: 'Shape the Backpack Body',
    terms: ['Scale'],
    body: 'Scale the Backpack Body to the size and proportions you want. Notice that the Position stays behind Gizmobot while the cube changes shape.',
    target: '[data-tool="scale"]', placement: 'right', spotlight: false,
    ready: context => context.bodyScaled(),
  },
  {
    title: 'Add a smaller detail',
    terms: ['Cube', 'Scale'],
    body: 'Add a second Cube and scale it smaller than the Backpack Body. This could become a panel, pocket, button, or any detail you invent.',
    target: '#add-toggle', placement: 'right', spotlight: false,
    ready: context => Boolean(context.detailId) && context.detailScaled(),
  },
  {
    title: 'Choose how Snap behaves',
    terms: ['Snap', 'Regular increments', 'Nearest surface', 'Surface reach', 'Move'],
    body: 'Open the arrow beside Snap. Regular increments use fixed move, rotate, and scale steps; Nearest surface lines up nearby faces, and Surface reach sets how close they must be. Choose Nearest surface, turn Snap on, then move the small cube toward the Backpack Body until it sits flush.',
    target: '.snap-control', placement: 'right', spotlight: true,
    ready: context => context.surfaceSnapOn() && context.detailTouchesBody(),
  },
  {
    title: 'Shape the Antenna Mast',
    terms: ['Cylinder', 'Scale'],
    body: 'Add a Cylinder. Scale it down across X and Z, then stretch Y to make a narrow, longer Antenna Mast. Move it onto the backpack when its silhouette looks right.',
    target: '#add-toggle', placement: 'right', spotlight: false,
    ready: context => Boolean(context.cylinderId) && context.cylinderShaped(),
  },
  {
    title: 'Add the Antenna Tip',
    terms: ['Sphere', 'Snap'],
    body: 'Turn Snap off, add a Sphere, and scale it down. Move this Antenna Tip onto the top of the mast. Objects may overlap a little—snapping is a choice, not a requirement.',
    target: '#add-toggle', placement: 'right', spotlight: false,
    ready: context => Boolean(context.sphereId) && context.antennaTipPlaced(),
  },
  {
    title: 'Give each piece a material',
    terms: ['Material', 'Appearance', 'Base Color', 'Roughness', 'Metalness'], references: ['Material Lab'],
    body: 'Select each accessory piece in the Outliner and use Appearance to give it a material of your own. Choose any Base Color and surface finish. Each piece keeps its own look when we connect them.',
    target: '.inspector-section[data-section="appearance"]', placement: 'left', spotlight: true, selectEntity: 'body',
    ready: context => context.materialsStyled(),
  },
  {
    title: 'Connect the Antenna Tip to its Mast',
    terms: ['Child', 'Parent', 'Hierarchy', 'Outliner'],
    body: 'The Antenna Tip is selected. In Hierarchy, choose Antenna Mast as its Parent. Watch the Tip become a child nested beneath the Mast in the Outliner: moving the Mast will now carry its Tip.',
    target: '.parent-select', placement: 'left', spotlight: true, selectEntity: 'sphere',
    ready: context => context.tipParented(),
  },
  {
    title: 'Connect the Mast to the Backpack Body',
    terms: ['Child', 'Parent', 'Hierarchy', 'Outliner'],
    body: 'The Antenna Mast is selected. Choose Backpack Body as its Parent. The Mast moves beneath the Body in the Outliner, carrying its Antenna Tip along as a nested child.',
    target: '.parent-select', placement: 'left', spotlight: true, selectEntity: 'cylinder',
    ready: context => context.mastParented(),
  },
  {
    title: 'Connect the Detail to the Backpack Body',
    terms: ['Child', 'Parent', 'Hierarchy', 'Outliner'],
    body: 'The Backpack Detail is selected. Choose Backpack Body as its Parent. The Body now has two direct children—the Detail and Mast—and the Tip remains a child of the Mast.',
    target: '.parent-select', placement: 'left', spotlight: true, selectEntity: 'detail',
    ready: context => context.detailParented(),
  },
  {
    title: 'Move the whole backpack',
    terms: ['Parent', 'Child', 'Move'],
    body: 'The Backpack Body is selected. Move it a little and notice the chain: the Body carries the Detail and Mast, while the Mast carries the Tip. Every child follows, but each piece remains separately editable.',
    target: '[data-tool="move"]', placement: 'right', spotlight: false, selectEntity: 'body', continueLabel: 'Finish lesson',
    ready: context => context.hierarchyBuilt() && context.bodyMovedAsParent(),
  },
];

function lessonCapabilities(index) {
  return {
    tools: {
      select: true, move: [2, 4, 5, 6, 7, 12].includes(index), rotate: false, scale: [3, 4, 6, 7].includes(index), add: [1, 4, 6, 7].includes(index),
    },
    shapes: {
      cube: [1, 4].includes(index), cylinder: index === 6, sphere: index === 7, cone: false, plane: false,
    },
    shapeNames: {
      cube: index === 1 ? 'Backpack Body' : index === 4 ? 'Backpack Detail' : null,
      cylinder: index === 6 ? 'Antenna Mast' : null,
      sphere: index === 7 ? 'Antenna Tip' : null,
      cone: null, plane: null,
    },
    panels: { scene: index >= 1, inspector: index >= 1, bottomEditor: false },
    inspectorSections: {
      transform: [2, 3, 4, 5, 6, 7, 12].includes(index), geometry: false, appearance: index === 8, hierarchy: [9, 10, 11].includes(index),
    },
    transformFields: { position: [2, 5, 6, 7, 12].includes(index), rotation: false, scale: [3, 4, 6, 7].includes(index) },
    appearance: { baseColor: index === 8, roughness: index === 8, metalness: index === 8, emissive: index === 8, readOnly: false },
    actions: {
      duplicate: false, delete: false, visibility: false, rename: false,
      group: false, ungroup: false, reparent: [9, 10, 11].includes(index),
    },
    features: { studio: false, snap: [5, 7].includes(index), snapSettings: index === 5, view: false },
  };
}

const freePlayCapabilities = {
  tools: { select: true, move: true, rotate: true, scale: true, add: true },
  shapes: { cube: true, sphere: true, cylinder: true, cone: true, plane: true },
  shapeNames: { cube: null, sphere: null, cylinder: null, cone: null, plane: null },
  panels: { scene: true, inspector: true, bottomEditor: true },
  inspectorSections: { transform: true, geometry: true, appearance: true, hierarchy: true },
  transformFields: { position: true, rotation: true, scale: true },
  actions: { duplicate: true, delete: true, visibility: true, rename: true, group: true, ungroup: true, reparent: true },
  features: { studio: true, snap: true, snapSettings: true, view: true },
};

/** Compose the Model an Accessory lesson over an initialised Creation Studio. */
export async function createAccessoryLesson(creator, { guidance: suppliedGuidance, example: suppliedExample } = {}) {
  if (!creator?.project || !creator?.setCapabilities) throw new TypeError('A ready Creation Studio instance is required');
  await creator.viewport?.ready;

  const { project } = creator;
  const guidance = suppliedGuidance || createGuidance();
  const example = suppliedExample || (creator.viewport?.stage
    ? (await import('./accessoryExample.js')).createAccessoryExample(creator)
    : null);
  const helpButton = document.getElementById('help-toggle');
  const productTag = document.querySelector('.prototype-tag');
  const priorTitle = document.title;
  const priorTag = productTag?.textContent;
  const initialIds = new Set(project.entities.map(entity => entity.id));
  let index = 0;
  let complete = false;
  let finished = false;
  let bodyId = null;
  let detailId = null;
  let cylinderId = null;
  let sphereId = null;
  let stepBaseline = new Map();
  let exampleSeen = false;
  let transitioning = false;

  const primitives = () => project.entities.filter(entity => PRIMITIVES.has(entity.type));
  const authored = type => primitives().filter(entity => entity.type === type && !initialIds.has(entity.id));
  const dimensions = entity => {
    if (!entity) return null;
    const geometry = entity.components.geometry || {};
    const base = entity.type === 'cube' ? [geometry.width, geometry.height, geometry.depth]
      : entity.type === 'sphere' ? [geometry.radius * 2, geometry.radius * 2, geometry.radius * 2]
      : entity.type === 'cylinder' ? [geometry.radius * 2, geometry.height, geometry.radius * 2]
      : [1, 1, 1];
    return base.map((value, axis) => value * entity.components.transform.scale[axis]);
  };
  const bounds = entity => {
    const size = dimensions(entity), position = entity?.components.transform.position;
    if (!size || !position) return null;
    return { min: position.map((value, axis) => value - size[axis] / 2), max: position.map((value, axis) => value + size[axis] / 2) };
  };
  const snapshot = entity => entity ? {
    position: copy(entity.components.transform.position),
    size: [
      ...entity.components.transform.scale,
      ...Object.values(entity.components.geometry || {}),
    ],
    material: copy(entity.components.material || null),
  } : null;

  const context = {
    get exampleSeen() { return exampleSeen; },
    get bodyId() { return bodyId; },
    get detailId() { return detailId; },
    get cylinderId() { return cylinderId; },
    get sphereId() { return sphereId; },
    entityChanged(id, key, threshold) {
      const entity = project.get(id), before = stepBaseline.get(id);
      if (!entity || !before) return false;
      const now = snapshot(entity)?.[key];
      return key === 'position' ? distance(now, before[key]) >= threshold : maxDifference(now, before[key]) >= threshold;
    },
    bodyChanged(key, threshold) { return this.entityChanged(bodyId, key, threshold); },
    bodyAtTarget() {
      const body = project.get(bodyId);
      return Boolean(body && maxDifference(body.components.transform.position, BODY_TARGET) <= .05);
    },
    bodyScaled() {
      return this.bodyChanged('size', .2);
    },
    detailScaled() {
      const detail = project.get(detailId), body = project.get(bodyId);
      const detailSize = dimensions(detail), bodySize = dimensions(body);
      return Boolean(detailSize && bodySize && this.entityChanged(detailId, 'size', .15)
        && detailSize.every((value, axis) => value < bodySize[axis]));
    },
    surfaceSnapOn() {
      const settings = creator.tools?.getSnapSettings?.();
      return Boolean(settings?.enabled && settings.mode === 'surface');
    },
    detailTouchesBody() {
      const a = bounds(project.get(detailId)), b = bounds(project.get(bodyId));
      if (!a || !b) return false;
      return [0, 1, 2].some(axis => {
        const gap = Math.min(Math.abs(a.max[axis] - b.min[axis]), Math.abs(b.max[axis] - a.min[axis]));
        const others = [0, 1, 2].filter(index => index !== axis);
        return gap <= .055 && others.every(index => a.max[index] >= b.min[index] && a.min[index] <= b.max[index]);
      });
    },
    cylinderShaped() {
      const size = dimensions(project.get(cylinderId));
      return Boolean(size && size[1] >= Math.max(size[0], size[2]) * 1.5 && Math.max(size[0], size[2]) <= .8);
    },
    antennaTipPlaced() {
      const mast = project.get(cylinderId), tip = project.get(sphereId);
      const mastSize = dimensions(mast), tipSize = dimensions(tip);
      if (!mast || !tip || !mastSize || !tipSize || Math.max(...tipSize) >= 1) return false;
      const mp = mast.components.transform.position, tp = tip.components.transform.position;
      const mastTop = mp[1] + mastSize[1] / 2;
      return Math.hypot(tp[0] - mp[0], tp[2] - mp[2]) <= Math.max(mastSize[0], mastSize[2]) / 2 + .25
        && Math.abs(tp[1] - mastTop) <= tipSize[1] / 2 + .3;
    },
    materialChanged(id) {
      const entity = project.get(id), before = stepBaseline.get(id)?.material;
      return Boolean(entity?.components.material && before
        && JSON.stringify(entity.components.material) !== JSON.stringify(before));
    },
    materialsStyled() {
      return [bodyId, detailId, cylinderId, sphereId].every(id => id && this.materialChanged(id));
    },
    tipParented() { return project.get(sphereId)?.parentId === cylinderId; },
    mastParented() { return project.get(cylinderId)?.parentId === bodyId; },
    detailParented() { return project.get(detailId)?.parentId === bodyId; },
    hierarchyBuilt() {
      return project.get(detailId)?.parentId === bodyId && project.get(cylinderId)?.parentId === bodyId
        && project.get(sphereId)?.parentId === cylinderId;
    },
    bodyMovedAsParent() {
      return this.entityChanged(bodyId, 'position', .2);
    },
  };

  function refreshKnownEntities() {
    const cubes = authored('cube');
    if (!project.get(bodyId)) bodyId = cubes[0]?.id || null;
    if (!project.get(detailId)) detailId = cubes.find(entity => entity.id !== bodyId)?.id || null;
    if (!project.get(cylinderId)) cylinderId = authored('cylinder')[0]?.id || null;
    if (!project.get(sphereId)) sphereId = authored('sphere')[0]?.id || null;
    for (const id of [bodyId, detailId, cylinderId, sphereId]) {
      const entity = project.get(id);
      if (entity && !stepBaseline.has(id)) stepBaseline.set(id, snapshot(entity));
    }
  }

  function exposeState() {
    return Object.freeze({ step: index, total: STEPS.length, complete, finished });
  }

  function evaluate() {
    refreshKnownEntities();
    const next = Boolean(STEPS[index].ready(context));
    if (next !== complete) { complete = next; guidance.setComplete(complete); }
  }

  function enter(nextIndex, exampleAlreadyHidden = false) {
    if (index === 0 && nextIndex !== 0 && !exampleAlreadyHidden) example?.hide?.();
    index = nextIndex;
    const step = STEPS[index];
    if (index === 0) example?.show?.();
    complete = false;
    refreshKnownEntities();
    const selectedId = { body: bodyId, detail: detailId, cylinder: cylinderId, sphere: sphereId }[step.selectEntity];
    if (selectedId && project.get(selectedId)) project.selection.set(selectedId);
    creator.setCapabilities(lessonCapabilities(index));
    const narrow = globalThis.matchMedia?.('(max-width: 900px)').matches;
    const needsInspector = /scene-panel|inspector|parent-select/.test(step.target);
    creator.setDock?.(index >= 1 && (!narrow || needsInspector) ? 'pinned' : 'closed');
    stepBaseline = new Map(project.entities.map(entity => [entity.id, snapshot(entity)]));
    guidance.show({
      step: index + 1, total: STEPS.length, title: step.title, body: step.body, terms: step.terms, references: step.references,
      target: step.target, placement: step.placement, spotlight: step.spotlight,
      continueLabel: step.continueLabel || 'Continue', canContinue: false,
      actionLabel: index === 0 ? 'See the pieces' : null,
      onAction: async () => {
        if (index !== 0 || finished) return false;
        const seen = await example?.separate?.();
        if (!seen || index !== 0 || finished) return false;
        exampleSeen = true;
        evaluate();
        return true;
      },
      onContinue: async () => {
        if (!complete || transitioning) return;
        if (index === 0) {
          transitioning = true;
          complete = false;
          guidance.setComplete(false);
          if (example?.transitionOut) await example.transitionOut();
          else example?.hide?.();
          if (finished) return;
          transitioning = false;
          enter(1, true);
        } else if (index < STEPS.length - 1) enter(index + 1);
        else finish();
      },
    });
    evaluate();
  }

  function finish() {
    if (finished) return;
    finished = true;
    unsubscribe?.(); unsubscribeTools?.();
    creator.setCapabilities(freePlayCapabilities);
    guidance.destroy();
    example?.hide?.();
    example?.dispose?.();
    if (helpButton) helpButton.hidden = false;
    if (productTag && priorTag) productTag.textContent = priorTag;
    document.title = priorTitle;
  }

  const unsubscribe = project.subscribe(evaluate);
  const unsubscribeTools = creator.tools?.subscribe?.(evaluate);
  const api = Object.freeze({
    get state() { return exposeState(); },
    next() { if (complete && !finished) index < STEPS.length - 1 ? enter(index + 1) : finish(); },
    destroy() {
      unsubscribe?.(); unsubscribeTools?.(); guidance.destroy();
      example?.hide?.(); example?.dispose?.();
      if (!finished) creator.setCapabilities(freePlayCapabilities);
      if (helpButton) helpButton.hidden = false;
      if (productTag && priorTag) productTag.textContent = priorTag;
      document.title = priorTitle;
      finished = true;
    },
  });
  creator.lesson = api;
  creator.showGuide?.(false);
  if (helpButton) helpButton.hidden = true;
  if (productTag) productTag.textContent = 'Accessory lesson';
  document.title = 'Model an Accessory · CreateAccess Creation Studio';
  enter(0);
  return api;
}

export { STEPS };
