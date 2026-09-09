const NAMES = ['select', 'move', 'rotate', 'scale', 'add'];
export function createTools() {
  let active = 'select';
  let allowed = Object.fromEntries(NAMES.map(name => [name, true]));
  const listeners = new Set();
  const emit = () => listeners.forEach(listener => listener(active));
  return {
    editingMode: 'object',
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
