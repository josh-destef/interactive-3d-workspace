import { createProject } from './project.js';
import { createTools } from './tools.js';
import { createViewport } from './viewport.js';
import { createDock } from './dock.js';
import { createBottomEditor } from './bottomEditor.js';

const $ = id => document.getElementById(id);
const project = createProject();
const tools = createTools();
const onStatus = text => { $('status').textContent = text; };
const run = fn => { try { return fn(); } catch (error) { onStatus(error.message); console.warn('Creator action:', error); } };
const viewport = createViewport({ project, tools, canvasId: 'cv', wrapId: 'canvas-wrap', onStatus });
const dock = createDock({ project, root: $('editor-dock'), onFocus: () => viewport.focusSelected() });
const bottomEditor = createBottomEditor($('bottom-editor'), $('bottom-toggle'));
let capabilities = {
  tools: { select: true, move: true, rotate: true, scale: true, add: true },
  panels: { scene: true, inspector: true, bottomEditor: true },
  inspectorSections: { transform: true, geometry: true, appearance: true, hierarchy: true },
};
const narrow = matchMedia('(max-width: 900px)');
let previousTool = 'select';
let wasDockOpen = true;

function updateDockChrome() {
  const open = dock.getState() !== 'closed';
  const returnFocus = !open && wasDockOpen && $('editor-dock').contains(document.activeElement);
  wasDockOpen = open;
  $('creator-app').dataset.dock = dock.getState();
  $('dock-toggle').setAttribute('aria-expanded', String(open));
  $('dock-backdrop').hidden = !open || !narrow.matches;
  $('editor-dock').setAttribute('role', narrow.matches && open ? 'dialog' : 'complementary');
  if (narrow.matches && open) $('editor-dock').setAttribute('aria-modal', 'true');
  else $('editor-dock').removeAttribute('aria-modal');
  for (const element of [$('guide'), $('canvas-wrap'), document.querySelector('.topbar'), document.querySelector('.statusbar'), $('bottom-editor')]) element.inert = narrow.matches && open;
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
$('help-toggle').addEventListener('click', () => showGuide($('guide').hidden));
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
  $('add-menu').querySelector('[data-shape]').focus();
}
document.querySelectorAll('[data-tool]').forEach(button => button.addEventListener('click', () => {
  if (button.dataset.tool === 'add') { $('add-menu').hidden ? openAdd() : closeAdd(true); return; }
  closeAdd(); tools.setActive(button.dataset.tool);
}));
$('add-close').addEventListener('click', () => closeAdd(true));
document.querySelectorAll('[data-shape]').forEach(button => button.addEventListener('click', () => run(() => {
  project.addPrimitive(button.dataset.shape);
  closeAdd(true);
  onStatus(`${button.textContent.trim()} added. Try Move or open the Inspector.`);
})));
document.addEventListener('pointerdown', event => {
  if (!$('add-menu').hidden && !$('add-menu').contains(event.target) && !$('add-toggle').contains(event.target)) closeAdd();
});
tools.subscribe(() => {
  document.querySelectorAll('[data-tool]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.tool === tools.getActive()));
  });
});
$('undo').addEventListener('click', () => run(() => project.history.undo()));
$('redo').addEventListener('click', () => run(() => project.history.redo()));
$('reset-view').addEventListener('click', () => viewport.resetView());
$('focus-selected').addEventListener('click', () => viewport.focusSelected());

function syncProject(event) {
  $('undo').disabled = !project.history.canUndo;
  $('redo').disabled = !project.history.canRedo;
  const active = project.get(project.selection.activeId);
  $('focus-selected').disabled = !active;
  $('selection-hint').textContent = project.selection.ids.length > 1 ? `${project.selection.ids.length} objects selected` : active ? `${active.name} selected` : 'Drag to look around · + Add to create';
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
  if (event.key === 'Tab' && narrow.matches && dock.getState() !== 'closed') {
    const controls = [...$('editor-dock').querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter(el => el.getClientRects().length);
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
  if (modifier && key === 'd') { event.preventDefault(); if (project.selection.activeId) run(() => project.duplicate(project.selection.activeId)); return; }
  if (modifier) return;
  // Space/Enter on a focused button keep their native activation; letter shortcuts
  // are available from the viewport and general page, not from dock form controls.
  if (key === 'delete' || key === 'backspace') {
    if (!project.selection.ids.length) return;
    event.preventDefault();
    run(() => { project.beginTransaction('Delete selection'); try { [...project.selection.ids].forEach(id => project.remove(id)); project.commitTransaction(); } catch (error) { project.cancelTransaction(); throw error; } });
  } else if (key === 'f') viewport.focusSelected();
  else if ({ v: 'select', w: 'move', e: 'rotate', r: 'scale' }[key]) {
    closeAdd(); tools.setActive({ v: 'select', w: 'move', e: 'rotate', r: 'scale' }[key]);
  }
});

function setCapabilities(next = {}) {
  for (const key of ['tools', 'panels', 'inspectorSections']) capabilities[key] = { ...capabilities[key], ...next[key] };
  tools.setAllowed(capabilities.tools);
  for (const button of document.querySelectorAll('[data-tool]')) button.hidden = capabilities.tools[button.dataset.tool] === false;
  if (!capabilities.tools.add) closeAdd();
  dock.setCapabilities(capabilities);
  bottomEditor.setAllowed(capabilities.panels.bottomEditor !== false);
  const hasDock = capabilities.panels.scene || capabilities.panels.inspector;
  $('dock-toggle').hidden = !hasDock;
  if (!hasDock) setDock('closed');
  return structuredClone(capabilities);
}

window.creator = { project, tools, viewport, dock, bottomEditor, setCapabilities, getCapabilities: () => structuredClone(capabilities) };
setCapabilities();
if (narrow.matches) setDock('closed'); else { dock.setState('pinned'); updateDockChrome(); }
Promise.resolve(viewport.ready).then(() => {
  $('loading').hidden = true;
  onStatus('Ready to create · Add a shape to get started');
}).catch(error => {
  $('loading').hidden = true;
  onStatus(`Gizmobot could not load. Shapes are still available. ${error.message}`);
});
