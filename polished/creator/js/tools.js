const NAMES = ['select', 'move', 'rotate', 'scale', 'add'];
const SNAP_MODES = new Set(['increment', 'surface']);
const DEFAULT_SNAP = Object.freeze({
  enabled: false,
  mode: 'increment',
  moveStep: .25,
  rotateStep: 15,
  scaleStep: .1,
  surfaceDistance: .5,
});

function validateSnapSettings(value) {
  if (!value || typeof value !== 'object') throw new TypeError('Snap settings are required');
  if (!SNAP_MODES.has(value.mode)) throw new TypeError('Choose Increment or Nearest surface snapping');
  for (const key of ['moveStep', 'rotateStep', 'scaleStep', 'surfaceDistance']) {
    if (!Number.isFinite(value[key]) || value[key] <= 0) throw new TypeError(`${key} must be greater than zero`);
  }
}

export function createTools() {
  let active = 'select';
  let editingMode = 'object';
  let snapSettings = { ...DEFAULT_SNAP };
  let allowed = Object.fromEntries(NAMES.map(name => [name, true]));
  const listeners = new Set();
  const emit = () => listeners.forEach(listener => listener(active));
  return {
    get editingMode() { return editingMode; },
    getEditingMode: () => editingMode,
    setEditingMode(mode) {
      if (!['object', 'edit'].includes(mode)) throw new TypeError('Choose Object or Edit mesh mode');
      if (editingMode === mode) return;
      editingMode = mode; emit();
    },
    getSnapping: () => snapSettings.enabled,
    getSnapSettings: () => Object.freeze({ ...snapSettings }),
    setSnapping(value) { snapSettings = { ...snapSettings, enabled: Boolean(value) }; emit(); },
    setSnapSettings(partial) {
      const next = { ...snapSettings, ...partial };
      validateSnapSettings(next);
      snapSettings = next; emit();
      return Object.freeze({ ...snapSettings });
    },
    getActive: () => active,
    isAllowed: name => allowed[name] === true,
    setActive(name) {
      if (!NAMES.includes(name) || !allowed[name] || active === name) return;
      active = name;
      emit();
    },
    setAllowed(next) {
      allowed = { ...allowed, ...next };
      if (!allowed[active]) active = NAMES.find(name => allowed[name]) ?? 'select';
      emit();
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
