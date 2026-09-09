export function createSelection({ exists = () => true, onChange = () => {} } = {}) {
  let ids = [];
  let activeId = null;

  const normalize = value => {
    const input = Array.isArray(value) ? value : value == null ? [] : [value];
    return [...new Set(input.filter(id => typeof id === 'string' && exists(id)))];
  };

  const apply = (nextIds, nextActive = nextIds.at(-1) ?? null, notify = true) => {
    nextIds = normalize(nextIds);
    nextActive = nextIds.includes(nextActive) ? nextActive : (nextIds.at(-1) ?? null);
    if (ids.length === nextIds.length && ids.every((id, i) => id === nextIds[i]) && activeId === nextActive) return false;
    ids = nextIds;
    activeId = nextActive;
    if (notify) onChange();
    return true;
  };

  return {
    get ids() { return [...ids]; },
    get activeId() { return activeId; },
    set(value) { apply(normalize(value)); },
    add(id) {
      if (typeof id !== 'string' || !exists(id)) return;
      apply([...ids.filter(current => current !== id), id], id);
    },
    clear() { apply([]); },
    _restore(state, notify = true) {
      const restoredIds = normalize(state?.ids);
      apply(restoredIds, state?.activeId, notify);
    }
  };
}
