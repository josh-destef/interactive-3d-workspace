export const session = { tool: 'select', selected: [], dragging: false, modal: null };
const listeners = new Set();
export const onSession = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export const emitSession = () => listeners.forEach(fn => fn(session));
export function setTool(tool) { if (session.tool !== tool) { session.tool = tool; emitSession(); } }
export function select(ids, { additive = false } = {}) {
    const list = Array.isArray(ids) ? ids : ids ? [ids] : [];
    session.selected = additive ? [...new Set([...session.selected, ...list])] : list;
    emitSession();
}
export const activeId = () => session.selected[0] || null;
export const isSelected = id => session.selected.includes(id);
