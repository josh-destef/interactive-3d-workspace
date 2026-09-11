import { createAnimation } from './animation.js';
import { createTimeline } from './timeline.js';
import { createMeshEditor } from './meshEditor.js';
import { createProjectFiles } from './projectFiles.js';

const node = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
};

/** Compose modelling, animation and project utilities around one teaching workbench. */
export function createStudio({ project, tools, viewport, dock, bottomEditor, editingProject, lessonId, onStatus }) {
  const app = document.getElementById('creator-app');
  const rail = document.getElementById('tool-rail');
  const header = document.querySelector('.viewport-heading');
  let workspace = 'object';
  let allowed = !lessonId;
  let lessonFeatures = {};
  let interactionEnabled = true;
  const animation = createAnimation({ project, viewport, onStatus });
  editingProject.connect(animation);
  viewport.setTransformEditor((id, partial) => animation.isEditingPose ? animation.updateTransform(id, partial) : project.updateTransform(id, partial));

  const meshRoot = node('div', 'mesh-editor-host'); meshRoot.hidden = true;
  document.querySelector('.scene-panel').after(meshRoot);
  const meshEditor = createMeshEditor({ project, tools, viewport, root: meshRoot, onStatus });
  const timelineRoot = node('div');
  const timeline = createTimeline({ project, animation, root: timelineRoot, onStatus });
  bottomEditor.mount(timelineRoot);

  const modeGroup = node('div', 'workspace-modes'); modeGroup.setAttribute('role', 'group'); modeGroup.setAttribute('aria-label', 'Workspace');
  const modeButtons = new Map();
  [['object', 'Object'], ['edit', 'Edit mesh'], ['animate', 'Animate']].forEach(([id, label]) => {
    const button = node('button', 'workspace-mode', label); button.type = 'button';
    button.setAttribute('aria-pressed', String(id === workspace)); button.addEventListener('click', () => setWorkspace(id));
    modeButtons.set(id, button); modeGroup.append(button);
  });
  const utilities = node('div', 'viewport-utilities');
  const viewMenu = node('details', 'view-menu'); const viewSummary = node('summary', '', 'View');
  const viewContent = node('div', 'view-menu-content');
  const cameraLabel = node('label', 'view-control', 'Camera'); const camera = node('select'); camera.setAttribute('aria-label', 'Camera view');
  [['perspective','Perspective'],['front','Front'],['right','Right'],['top','Top']].forEach(([value,text]) => { const option = node('option','',text); option.value=value; camera.append(option); });
  cameraLabel.append(camera); viewContent.append(cameraLabel);
  camera.addEventListener('change', () => { viewport.setView(camera.value); meshEditor.refresh(); });
  const wireframe = node('button', '', 'Wireframe'); wireframe.type = 'button'; wireframe.setAttribute('aria-pressed', 'false');
  wireframe.addEventListener('click', () => { const value = wireframe.getAttribute('aria-pressed') !== 'true'; wireframe.setAttribute('aria-pressed', String(value)); viewport.setDisplayMode(value ? 'wireframe' : 'solid'); });
  const grid = node('button', '', 'Grid'); grid.type = 'button'; grid.setAttribute('aria-pressed','true');
  grid.addEventListener('click', () => { const value = grid.getAttribute('aria-pressed') !== 'true'; grid.setAttribute('aria-pressed',String(value)); viewport.setGridVisible(value); });
  const focus = node('button', '', 'Focus selection'); focus.type = 'button'; focus.addEventListener('click', () => viewport.focusSelected());
  viewContent.append(wireframe, grid, focus); viewMenu.append(viewSummary, viewContent);
  const snapControl = node('div', 'snap-control'); snapControl.setAttribute('role', 'group'); snapControl.setAttribute('aria-label', 'Snapping');
  const snap = node('button', 'snap-toggle', 'Snap'); snap.type = 'button'; snap.setAttribute('aria-pressed','false'); snap.title = 'Turn snapping on or off';
  snap.addEventListener('click', () => tools.setSnapping(!tools.getSnapping()));
  const snapSettings = node('details', 'snap-settings');
  const snapSummary = node('summary', 'snap-menu-toggle'); snapSummary.setAttribute('aria-label', 'Snap settings'); snapSummary.title = 'Open Snap settings';
  const snapContent = node('div', 'snap-settings-content');
  const snapModeLabel = node('label', 'view-control', 'Mode');
  const snapMode = node('select'); snapMode.setAttribute('aria-label', 'Snap mode');
  [['increment', 'Regular increments'], ['surface', 'Nearest surface']].forEach(([value, text]) => {
    const option = node('option', '', text); option.value = value; snapMode.append(option);
  });
  snapModeLabel.append(snapMode);
  const snapHelp = node('p', 'snap-settings-help');
  const settingFields = new Map();
  [['moveStep', 'Move step', .01], ['rotateStep', 'Rotate step (degrees)', 1], ['scaleStep', 'Scale step', .01], ['surfaceDistance', 'Surface reach', .05]].forEach(([key, label, step]) => {
    const field = node('label', 'snap-number', label); const input = node('input'); input.type = 'number'; input.min = String(step); input.step = String(step); input.setAttribute('aria-label', label);
    input.addEventListener('change', () => { try { tools.setSnapSettings({ [key]: Number(input.value) }); } catch { syncSnapControls(); } });
    field.append(input); settingFields.set(key, field); snapContent.append(field);
  });
  snapMode.addEventListener('change', () => { tools.setSnapSettings({ mode: snapMode.value }); tools.setSnapping(true); });
  snapContent.prepend(snapModeLabel, snapHelp); snapSettings.append(snapSummary, snapContent); snapControl.append(snap, snapSettings);
  const primary = header.querySelector('.viewport-primary') || node('div', 'viewport-primary');
  primary.querySelector('.mode-label')?.remove();
  primary.prepend(modeGroup);
  utilities.append(snapControl, viewMenu); header.replaceChildren(primary, utilities);

  function syncSnapControls() {
    const settings = tools.getSnapSettings?.() || { mode: 'increment', moveStep: .25, rotateStep: 15, scaleStep: .1, surfaceDistance: .5 };
    snapMode.value = settings.mode;
    for (const [key, field] of settingFields) field.querySelector('input').value = String(settings[key]);
    for (const key of ['moveStep', 'rotateStep', 'scaleStep']) settingFields.get(key).hidden = settings.mode !== 'increment';
    settingFields.get('surfaceDistance').hidden = settings.mode !== 'surface';
    snapHelp.textContent = settings.mode === 'surface'
      ? 'Nearest surface pulls a nearby face flush with another object. Surface reach sets how close it must be before Snap takes effect.'
      : 'Regular increments move, rotate, and scale in fixed steps. Smaller steps give finer control.';
  }

  // Primary tools retain visible names for learners discovering the shortcuts.
  for (const button of rail.querySelectorAll('[data-tool]:not([data-tool="add"])')) {
    const caption = node('span', 'tool-caption', button.dataset.tool[0].toUpperCase() + button.dataset.tool.slice(1)); button.append(caption);
  }
  const modeNote = node('div', 'workspace-note'); modeNote.setAttribute('role','status');
  document.getElementById('canvas-wrap').append(modeNote);
  const statistics = node('span', 'scene-statistics'); document.querySelector('.statusbar').append(statistics);
  const files = createProjectFiles({ project, root: document.querySelector('.global-actions'), onStatus, autosave: !lessonId, beforeOpen: () => setWorkspace('object') });
  if (lessonId) document.querySelector('.project-menu').hidden = true;
  const help = createHelp();

  function sync() {
    const editing = tools.getEditingMode() === 'edit';
    if (workspace === 'edit' && !editing) workspace = 'object';
    app.dataset.workspace = workspace;
    meshRoot.hidden = !editing;
    modeButtons.forEach((button, id) => button.setAttribute('aria-pressed', String(workspace === id)));
    const entity = project.get(project.selection.activeId);
    const meshButton = modeButtons.get('edit'); meshButton.disabled = !meshEditor.canEdit(entity) || Boolean(entity?.locked);
    meshButton.title = meshButton.disabled ? 'Select an unlocked primitive shape to edit its mesh' : 'Edit vertices and faces';
    const snapAvailable = allowed || lessonFeatures.snap;
    const snapSettingsAvailable = allowed || lessonFeatures.snapSettings;
    snap.setAttribute('aria-pressed', String(tools.getSnapping())); snapControl.hidden = editing || !snapAvailable;
    snapSettings.hidden = editing || !snapSettingsAvailable;
    if (snapControl.hidden || snapSettings.hidden) snapSettings.open = false;
    syncSnapControls();
    for (const button of rail.querySelectorAll('[data-tool]')) button.classList.toggle('mode-unavailable', editing && button.dataset.tool !== 'select');
    modeNote.textContent = '';
    statistics.textContent = `${project.entities.length} objects${entity?.components.mesh ? ` · ${entity.components.mesh.vertices.length} vertices · ${entity.components.mesh.faces.length} faces` : ''}`;
    statistics.hidden = Boolean(lessonId);
    // During playback the fields show evaluated poses, but cannot edit authored data.
    document.querySelectorAll('[data-section="transform"] input').forEach(input => { input.disabled = animation.isPlaying || Boolean(entity?.locked); });
    if (interactionEnabled === animation.isPlaying) {
      interactionEnabled = !animation.isPlaying;
      viewport.setInteractionEnabled(interactionEnabled);
    }
  }

  function setWorkspace(next) {
    if (!allowed && next !== 'object') return false;
    if (!['object','edit','animate'].includes(next)) return false;
    try {
      if (next === 'edit' && !meshEditor.canEdit(project.get(project.selection.activeId))) {
        onStatus('Select a shape to edit its vertices and faces.'); return false;
      }
      animation.pause();
      if (tools.getEditingMode() === 'edit' && next !== 'edit') meshEditor.exit();
      animation.setEditingEnabled(next === 'animate');
      if (next === 'edit' && !meshEditor.enter()) return false;
      workspace = next;
      if (next === 'animate') bottomEditor.open(); else bottomEditor.close();
      onStatus(next === 'animate' ? 'Animate mode: transform edits record keys.' : next === 'edit' ? 'Edit mesh: select a face or vertex.' : 'Object mode: edit the base scene.');
      sync(); return true;
    } catch (error) { onStatus(error.message); return false; }
  }

  // The existing timeline toggle has one meaning: enter/leave the animation workspace.
  document.getElementById('bottom-toggle').addEventListener('click', () => setWorkspace(workspace === 'animate' ? 'object' : 'animate'));
  const offTools = tools.subscribe(sync);
  const offProject = project.subscribe(sync);
  const offAnimation = animation.subscribe(sync);
  document.getElementById('reset-view').addEventListener('click', () => { camera.value = 'perspective'; });
  function keydown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && !lessonId) { event.preventDefault(); document.activeElement?.blur(); files.save(); return; }
    if (event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    if (event.ctrlKey || event.metaKey || event.altKey || !allowed) return;
    if (event.key.toLowerCase() === 'i' && workspace === 'animate') { event.preventDefault(); try { animation.addKey(); } catch (error) { onStatus(error.message); } }
    if (event.code === 'Space' && workspace === 'animate' && !event.target.closest('button,summary')) { event.preventDefault(); animation.isPlaying ? animation.pause() : animation.play(); }
  }
  document.addEventListener('keydown', keydown);
  function setAllowed(value, features = {}) {
    allowed = Boolean(value);
    lessonFeatures = { ...features };
    if (!allowed && workspace !== 'object') setWorkspace('object');
    modeGroup.hidden = !allowed; utilities.hidden = !allowed;
    const lessonUtilities = !allowed && (features.snap || features.view);
    utilities.hidden = !allowed && !lessonUtilities;
    snapControl.hidden = !allowed && !features.snap;
    snapSettings.hidden = !allowed && !features.snapSettings;
    viewMenu.hidden = !allowed && !features.view;
    meshEditor.setAllowed(allowed); timeline.setAllowed(allowed); modeNote.hidden = !allowed;
  }
  setAllowed(allowed); sync();
  return { animation, meshEditor, timeline, files, setWorkspace, setAllowed, get workspace() { return workspace; },
    dispose() { offTools(); offProject(); offAnimation(); editingProject.dispose(); meshEditor.dispose(); timeline.dispose(); files.dispose(); help.dispose(); document.removeEventListener('keydown',keydown); }
  };
}

function createHelp() {
  const dialog = node('dialog','creator-help');
  dialog.setAttribute('aria-labelledby','creator-help-title');
  dialog.innerHTML = `<header><div><small>CREATION STUDIO FIELD GUIDE</small><h2 id="creator-help-title">Build. Shape. Animate.</h2></div><button type="button" aria-label="Close field guide">Close</button></header>
    <p class="help-intro">One scene, three ways to work. Start with a cube and explore one change at a time.</p>
    <section><h3>Object · Arrange your scene</h3><p>Add a shape, then select <b>Move</b>, <b>Rotate</b> or <b>Scale</b>. Drag a coloured handle or enter precise values in Transform. Shift-click selects several objects; Hierarchy can group them.</p><p class="help-prompt">Try: rotate a cube, then scale one axis. Which directions follow the object?</p></section>
    <section><h3>Edit mesh · Shape the surface</h3><p>Select a shape and choose <b>Edit mesh</b>. Pick a vertex or face, change its position, or use <b>Extrude face</b> to add depth. <b>Inset face</b> adds a smaller face; <b>Subdivide mesh</b> adds more corners to work with. Undo returns you to the earlier shape.</p><p class="help-prompt">Try: extrude the top of a cube. Compare the vertex and face counts before and after.</p></section>
    <section><h3>Animate · Record poses over time</h3><p>Choose <b>Animate</b> and <b>Add key</b> at frame 0. Move to frame 24, then move the object. Transform edits record keys automatically in this workspace. Press Play to see the in-between motion. Click a diamond to move, delete or change its interpolation.</p><p><b>Linear</b> keeps a steady change. <b>Smooth</b> eases in and out. <b>Step</b> holds each pose until the next key. Rotation values interpolate in degrees, so 0° to 360° makes a full turn.</p><p class="help-prompt">Try: place a sphere on the ground at frame 0, lift it at 12, and return it at 24. How does Smooth change the motion?</p></section>
    <section><h3>Navigate and keep your work</h3><p>Drag empty space to orbit, right-drag or Shift-drag to pan, and scroll to zoom. <b>View</b> offers front, right and top views, grid and wireframe. <b>Snap settings</b> lets you tune regular move, rotate and scale steps or choose Nearest surface. Numeric object transforms are local to their parent; move and rotate handles use world axes.</p><p><b>Project → Save project</b> keeps meshes and keys in a file. Open that file on another computer, or use Restore autosave in this browser.</p></section>
    <footer><span><kbd>V</kbd> Select <kbd>W</kbd> Move <kbd>E</kbd> Rotate <kbd>R</kbd> Scale <kbd>F</kbd> Focus</span><span><kbd>I</kbd> Add key <kbd>Space</kbd> Play/pause in Animate <kbd>Ctrl/⌘ Z</kbd> Undo <kbd>Ctrl/⌘ S</kbd> Save</span></footer>`;
  document.body.append(dialog);
  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  const toggle = document.getElementById('help-toggle');
  toggle.setAttribute('aria-controls','creator-help-title'); toggle.setAttribute('aria-haspopup','dialog'); toggle.setAttribute('aria-expanded','false');
  toggle.addEventListener('click', () => { dialog.showModal(); toggle.setAttribute('aria-expanded','true'); });
  dialog.addEventListener('close', () => { toggle.setAttribute('aria-expanded','false'); toggle.focus(); });
  return { dispose() { dialog.remove(); } };
}
