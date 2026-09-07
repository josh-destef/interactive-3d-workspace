/* ═══════════════════════════════════════════════
   SESSION
   What is selected, which mode we are in, which tool is armed.

   This is interface state, not the model, so it lives apart from it - and it
   lives in its own file rather than inside the interaction code because the
   gizmos, the object list, the modal operators and the lesson all need to
   read it. One shared box with a change event keeps them from each holding a
   slightly different idea of what is selected.
═══════════════════════════════════════════════ */

export const session = {
    mode: 'object',        // 'object' | 'edit'
    tool: 'select',        // select | move | rotate | scale | extrude | bevel
    selected: [],          // entry ids, in click order
    face: null,            // FACES entry, only meaningful in edit mode
    dragging: false,
    placingMount: false,    // step 9 only: clicks on the inner face place the plug
    modal: null,           // the running modal operator, if any
};

const listeners = new Set();

export function onSession(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function emitSession() { listeners.forEach(fn => fn(session)); }

export function setMode(mode) {
    if (session.mode === mode) return;
    session.mode = mode;
    if (mode === 'object') session.face = null;
    /* leaving edit mode with the extrude tool armed would leave a tool on the
       rail lit that cannot do anything */
    if (mode === 'object' && ['inset', 'extrude', 'bevel'].includes(session.tool)) session.tool = 'move';
    emitSession();
}

export function setTool(tool) {
    if (session.tool === tool) return;
    session.tool = tool;
    emitSession();
}

export function select(ids, { additive = false } = {}) {
    const previousActive = session.selected[0] || null;
    const list = Array.isArray(ids) ? ids : ids ? [ids] : [];
    if (additive) {
        for (const id of list) {
            session.selected = session.selected.includes(id)
                ? session.selected.filter(x => x !== id)
                : [...session.selected, id];
        }
    } else {
        session.selected = list;
    }
    const nextActive = session.selected[0] || null;
    if (!nextActive || nextActive !== previousActive) session.face = null;
    emitSession();
}

export function setFace(face) {
    if (session.face?.id === face?.id) return;
    session.face = face;
    emitSession();
}

export const activeId = () => session.selected[0] || null;
export const isSelected = id => session.selected.includes(id);
