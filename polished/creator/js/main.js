import { createProject } from './project.js';
import { createTools } from './tools.js';
import { createViewport } from './viewport.js';
import { createDock } from './dock.js';
import { createBottomEditor } from './bottomEditor.js';
import { createEditingProject } from './editingProject.js';
import { createStudio } from './studio.js';

const $ = id => document.getElementById(id);
const lessonId = new URLSearchParams(location.search).get('lesson');
const project = createProject();
if (lessonId === 'build-gizmobot') {
  const { createAssemblyProjectData } = await import('./assemblyData.js');
  project.restore(createAssemblyProjectData());
  document.body.classList.add('assembly-lesson');
  $('guide').hidden = true;
  $('help-toggle').hidden = true;
  const style = document.createElement('link');
  style.rel = 'stylesheet'; style.href = new URL('../css/assembly-lesson.css', import.meta.url).href;
  document.head.append(style);
}
if (lessonId === 'material-lab') {
  const seed = project.serialize();
  const shell = seed.entities.find(entity => entity.id === 'gizmobot');
  shell.name = 'Gizmobot Shell';
  shell.components.transform.position = [0, 0, 0];
  shell.components.transform.rotation = [0, 0, 0];
  shell.components.material = { color: '#f2f0eb', roughness: .5, metalness: 0, emissiveIntensity: 0 };
  const creation = seed.entities.find(entity => entity.id === 'creation');
  creation.visible = false;
  creation.locked = true;
  project.restore(seed);
  document.body.classList.add('material-lesson');
  $('guide').hidden = true;
  $('help-toggle').hidden = true;
  const style = document.createElement('link');
  style.rel = 'stylesheet'; style.href = new URL('../css/material-lesson.css', import.meta.url).href;
  document.head.append(style);
}
const tools = createTools();
const onStatus = text => { $('status').textContent = text; };
const run = fn => { try { return fn(); } catch (error) { onStatus(error.message); console.warn('Creation Studio action:', error); } };
const viewport = createViewport({
  project, tools, canvasId: 'cv', wrapId: 'canvas-wrap', onStatus,
  modelProfile: lessonId === 'material-lab' ? 'materials' : lessonId === 'build-gizmobot' ? 'assembly' : undefined,
});
const editingProject = createEditingProject(project);
const dock = createDock({ project: editingProject.project, root: $('editor-dock'), onFocus: () => viewport.focusSelected() });
const bottomEditor = createBottomEditor($('bottom-editor'), $('bottom-toggle'));
const studio = createStudio({ project, tools, viewport, dock, bottomEditor, editingProject, lessonId, onStatus });
let capabilities = {
  tools: { select: true, move: true, rotate: true, scale: true, add: true },
  panels: { scene: true, inspector: true, bottomEditor: true },
  inspectorSections: { transform: true, geometry: true, appearance: true, hierarchy: true },
  shapes: { cube: true, sphere: true, cylinder: true, cone: true, plane: true },
  shapeNames: { cube: null, sphere: null, cylinder: null, cone: null, plane: null },
  actions: { duplicate: true, delete: true, visibility: true, rename: true, group: true, ungroup: true, reparent: true },
  transformFields: { position: true, rotation: true, scale: true },
  appearance: { baseColor: true, rgb: false, roughness: true, metalness: true, emissive: true, exploreRgb: false, readOnly: false },
  scene: { excludeIds: [] },
  features: { studio: !lessonId, snap: false, view: false },
};
const narrow = matchMedia('(max-width: 900px)');
let previousTool = 'select';
let wasDockOpen = true;

function updateDockChrome() {
  const open = dock.getState() !== 'closed';
  const returnFocus = !open && wasDockOpen && $('editor-dock').contains(document.activeElement);
  wasDockOpen = open;
  $('creator-app').dataset.dock = dock.getState();
  document.body.classList.toggle('material-dock-open', lessonId === 'material-lab' && open);
  $('dock-toggle').setAttribute('aria-expanded', String(open));
  const overlayDock = narrow.matches && open && lessonId !== 'material-lab';
  $('dock-backdrop').hidden = !overlayDock;
  $('editor-dock').setAttribute('role', overlayDock ? 'dialog' : 'complementary');
  if (overlayDock && !document.querySelector('.lesson-guidance')) $('editor-dock').setAttribute('aria-modal', 'true');
  else $('editor-dock').removeAttribute('aria-modal');
  for (const element of [$('guide'), $('canvas-wrap'), document.querySelector('.topbar'), document.querySelector('.statusbar'), $('bottom-editor')]) element.inert = overlayDock;
  if (returnFocus) $('dock-toggle').focus();
}
function setDock(state) {
  dock.setState(state);
  updateDockChrome();
  if (narrow.matches && state !== 'closed') $('editor-dock').querySelector('button')?.focus();
  if (state === 'closed') $('dock-toggle').focus();
}
$('editor-dock').addEventListener('dockstatechange', updateDockChrome);
new MutationObserver(updateDockChrome).observe($('editor-dock'), { attributes: true, attributeFilter: ['data-state', 'hidden'] });
narrow.addEventListener('change', () => { if (narrow.matches) setDock('closed'); else updateDockChrome(); });
$('dock-toggle').addEventListener('click', () => setDock(dock.getState() === 'closed' ? 'open' : 'closed'));
$('dock-backdrop').addEventListener('click', () => setDock('closed'));

function showGuide(show) { $('guide').hidden = !show; $('help-toggle').setAttribute('aria-expanded', String(show)); }
$('guide-close').addEventListener('click', () => { showGuide(false); $('help-toggle').focus(); });
if (innerWidth <= 1100) showGuide(false);
matchMedia('(max-width: 1100px)').addEventListener('change', event => { if (event.matches) showGuide(false); });

function closeAdd(restoreFocus = false) {
  $('add-menu').hidden = true;
  $('add-toggle').setAttribute('aria-expanded', 'false');
  if (tools.getActive() === 'add') tools.setActive(tools.isAllowed(previousTool) ? previousTool : 'select');
  if (restoreFocus) $('add-toggle').focus();
}
function openAdd() {
  if (!tools.isAllowed('add')) return;
  previousTool = tools.getActive() === 'add' ? previousTool : tools.getActive();
  tools.setActive('add');
  $('add-menu').hidden = false;
  $('add-toggle').setAttribute('aria-expanded', 'true');
  $('add-menu').querySelector('[data-shape]:not([hidden])')?.focus();
}
document.querySelectorAll('[data-tool]').forEach(button => button.addEventListener('click', () => {
  if (button.dataset.tool === 'add') { $('add-menu').hidden ? openAdd() : closeAdd(true); return; }
  closeAdd(); tools.setActive(button.dataset.tool);
}));
document.querySelectorAll('[data-shape]').forEach(button => button.addEventListener('click', () => run(() => {
  if (!capabilities.tools.add || capabilities.shapes[button.dataset.shape] === false) return;
  project.addPrimitive(button.dataset.shape, { name: capabilities.shapeNames[button.dataset.shape] || undefined });
  closeAdd(true);
  const shapeLabel = button.querySelector('strong')?.textContent || button.dataset.shape;
  onStatus(`${shapeLabel} added. Try Move or open the Inspector.`);
})));
$('add-menu').addEventListener('keydown', event => {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const items = [...$('add-menu').querySelectorAll('[data-shape]:not([hidden])')];
  if (!items.length) return;
  const current = Math.max(0, items.indexOf(document.activeElement));
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
    : event.key === 'ArrowDown' ? (current + 1) % items.length : (current - 1 + items.length) % items.length;
  items[next].focus();
  event.preventDefault();
});
document.addEventListener('pointerdown', event => {
  if (!$('add-menu').hidden && !$('add-menu').contains(event.target) && !$('add-toggle').contains(event.target)) closeAdd();
});
tools.subscribe(() => {
  document.querySelectorAll('[data-tool]').forEach(button => {
    if (button.dataset.tool === 'add') button.removeAttribute('aria-pressed');
    else button.setAttribute('aria-pressed', String(button.dataset.tool === tools.getActive()));
  });
});
$('undo').addEventListener('click', () => run(() => project.history.undo()));
$('redo').addEventListener('click', () => run(() => project.history.redo()));
$('reset-view').addEventListener('click', () => viewport.resetView());
function syncProject(event) {
  $('undo').disabled = !project.history.canUndo;
  $('redo').disabled = !project.history.canRedo;
  const active = project.get(project.selection.activeId);
  const selectionHint = $('selection-hint');
  if (selectionHint) selectionHint.textContent = project.selection.ids.length > 1 ? `${project.selection.ids.length} objects selected` : active ? `${active.name} selected` : 'Drag to look around · Add to create';
  if (event?.label) onStatus(event.label);
}
project.subscribe(syncProject);
syncProject();

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (!$('add-menu').hidden) { closeAdd(true); event.preventDefault(); return; }
    if (narrow.matches && dock.getState() !== 'closed') { setDock('closed'); event.preventDefault(); return; }
  }
  // A narrow dock is a modal: retain focus inside it, including Shift+Tab.
  if (event.key === 'Tab' && narrow.matches && dock.getState() !== 'closed' && lessonId !== 'material-lab') {
    const controls = [...$('editor-dock').querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]'), ...document.querySelectorAll('.lesson-guidance button:not(:disabled)')].filter(el => el.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (first && (!controls.includes(document.activeElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last))) {
      (event.shiftKey ? last : first).focus(); event.preventDefault();
    }
  }
  if (event.target.closest('input, textarea, select, [contenteditable="true"]') || event.altKey) return;
  const key = event.key.toLowerCase();
  const modifier = event.ctrlKey || event.metaKey;
  if (modifier && key === 'z') { event.preventDefault(); run(() => event.shiftKey ? project.history.redo() : project.history.undo()); return; }
  if (modifier && key === 'y') { event.preventDefault(); run(() => project.history.redo()); return; }
  if (modifier && key === 'd') { event.preventDefault(); if (tools.getEditingMode() !== 'edit' && capabilities.actions.duplicate && project.selection.activeId) run(() => project.duplicate(project.selection.activeId)); return; }
  if (modifier) return;
  // Mesh operations have their own selection. Delete must not remove the whole object.
  if (tools.getEditingMode() === 'edit') return;
  // Space/Enter on a focused button keep their native activation; letter shortcuts
  // are available from the viewport and general page, not from dock form controls.
  if (key === 'delete' || key === 'backspace') {
    if (!capabilities.actions.delete) return;
    if (!project.selection.ids.length) return;
    event.preventDefault();
    run(() => { project.beginTransaction('Delete selection'); try { [...project.selection.ids].forEach(id => project.remove(id)); project.commitTransaction(); } catch (error) { project.cancelTransaction(); throw error; } });
  } else if (key === 'f') viewport.focusSelected();
  else if ({ v: 'select', w: 'move', e: 'rotate', r: 'scale' }[key]) {
    closeAdd(); tools.setActive({ v: 'select', w: 'move', e: 'rotate', r: 'scale' }[key]);
  }
});

function setCapabilities(next = {}) {
  for (const key of ['tools', 'panels', 'inspectorSections', 'shapes', 'shapeNames', 'actions', 'transformFields', 'appearance', 'scene', 'features']) capabilities[key] = { ...capabilities[key], ...next[key] };
  tools.setAllowed(capabilities.tools);
  for (const button of document.querySelectorAll('[data-tool]')) button.hidden = capabilities.tools[button.dataset.tool] === false;
  if (!capabilities.tools.add) closeAdd();
  for (const button of document.querySelectorAll('[data-shape]')) button.hidden = capabilities.shapes[button.dataset.shape] === false;
  dock.setCapabilities(capabilities);
  bottomEditor.setAllowed(capabilities.panels.bottomEditor !== false && capabilities.features.studio !== false);
  studio.setAllowed(capabilities.features.studio !== false, capabilities.features);
  const hasDock = capabilities.panels.scene || capabilities.panels.inspector;
  $('dock-toggle').hidden = !hasDock;
  if (!hasDock) setDock('closed');
  return structuredClone(capabilities);
}

window.creator = { project, tools, viewport, dock, bottomEditor, studio, animation: studio.animation, setDock, showGuide, setCapabilities, getCapabilities: () => structuredClone(capabilities) };
setCapabilities(lessonId === 'material-lab' ? {
  tools: { move: false, rotate: false, scale: false, add: false },
  panels: { bottomEditor: false },
  inspectorSections: { transform: false, geometry: false, hierarchy: false },
  appearance: { baseColor: false, roughness: false, metalness: false, emissive: false },
  scene: { excludeIds: ['creation'] },
  actions: { duplicate: false, delete: false, visibility: false, rename: false, group: false, ungroup: false, reparent: false },
} : {});
if (narrow.matches) setDock('closed'); else { dock.setState('pinned'); updateDockChrome(); }
Promise.resolve(viewport.ready).then(() => {
  $('loading').hidden = true;
  onStatus(lessonId === 'material-lab' ? 'Select Gizmobot Shell to explore its Appearance.'
    : lessonId === 'build-gizmobot' ? 'Creation Studio - Build Gizmobot'
    : 'Ready to create · Add a shape to get started');
}).catch(error => {
  $('loading').hidden = true;
  onStatus(`Gizmobot could not load. Shapes are still available. ${error.message}`);
});

if (lessonId === 'model-an-accessory') {
  const { createAccessoryLesson } = await import('./lessons/accessory.js');
  window.creator.lesson = await createAccessoryLesson(window.creator);
}
if (lessonId === 'material-lab') {
  const { createMaterialLesson } = await import('./lessons/material.js');
  window.creator.lesson = await createMaterialLesson(window.creator);
}
if (lessonId === 'build-gizmobot') {
  const { createAssemblyLesson } = await import('./lessons/assembly.js');
  window.creator.lesson = await createAssemblyLesson(window.creator);
}
