import { createProject } from './project.js';

export const STORAGE_KEY = 'createaccess.creator.project.v1';
export const MAX_BYTES = 8 * 1024 * 1024;

export function parseProjectText(text) {
  if (typeof text !== 'string') throw new TypeError('Project file must contain text');
  if (new Blob([text]).size > MAX_BYTES) throw new Error('Choose a project smaller than 8 MB');
  const data = JSON.parse(text);
  const check = createProject();
  check.restore(data);
  return data;
}

/** Local files and optional recovery never replace a scene until validation succeeds. */
export function createProjectFiles({ project, root, onStatus, beforeOpen = () => {}, autosave = true }) {
  const menu = document.createElement('details'); menu.className = 'project-menu';
  const summary = document.createElement('summary'); summary.textContent = 'Project';
  const content = document.createElement('div'); content.className = 'project-menu-content';
  menu.append(summary, content); root.prepend(menu);
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json'; input.hidden = true; root.append(input);
  const button = (text, handler) => {
    const node = document.createElement('button'); node.type = 'button'; node.textContent = text;
    node.addEventListener('click', handler); content.append(node); return node;
  };
  let timer;
  let restoring = false;
  let recovery = null;
  try { recovery = autosave ? localStorage.getItem(STORAGE_KEY) : null; } catch { /* Files still work when storage is unavailable. */ }
  function writeAutosave() {
    if (!autosave) return;
    const data = JSON.stringify(project.serialize());
    localStorage.setItem(STORAGE_KEY, data); recovery = data; restore.disabled = false;
  }
  function save() {
    const blob = new Blob([JSON.stringify(project.serialize(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'my-creation.creator.json';
    anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    menu.open = false; onStatus('Project saved with meshes and animation.');
  }
  function openText(text) {
    const data = parseProjectText(text);
    // Validate separately before changing the editor mode or current scene.
    beforeOpen(); restoring = true;
    try { project.restore(data); } finally { restoring = false; }
    try { writeAutosave(); } catch { onStatus('Project opened, but browser storage is full or unavailable. Save a file to keep your work.'); return; }
    menu.open = false; onStatus('Project opened. Meshes and animation are ready.');
  }
  button('Save project…', save);
  button('Open project…', () => { input.value = ''; input.click(); });
  const restore = button('Restore autosave', () => {
    try { if (recovery) openText(recovery); } catch (error) { onStatus(`Could not restore autosave: ${error.message}`); }
  }); restore.disabled = !recovery;
  const note = document.createElement('p'); note.textContent = autosave ? 'Autosaved in this browser. Save a file to keep or share your work.' : 'Save a file to keep or share your work.'; content.append(note);
  input.addEventListener('change', async () => {
    const file = input.files?.[0]; if (!file) return;
    try {
      if (file.size > MAX_BYTES) throw new Error('Choose a project smaller than 8 MB');
      openText(await file.text());
    } catch (error) { onStatus(`Could not open project: ${error.message}`); }
  });
  const off = project.subscribe(event => {
    if (!autosave || restoring || event.kind === 'selection') return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        writeAutosave();
      } catch { onStatus('Browser storage is full or unavailable. Use Project → Save project to keep your work.'); }
    }, 800);
  });
  const outside = event => { if (!menu.contains(event.target)) menu.open = false; };
  document.addEventListener('pointerdown', outside);
  return { save, openText, dispose() { clearTimeout(timer); off(); document.removeEventListener('pointerdown', outside); menu.remove(); input.remove(); } };
}
