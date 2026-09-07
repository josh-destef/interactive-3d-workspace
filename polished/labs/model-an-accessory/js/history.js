/* ═══════════════════════════════════════════════
   HISTORY
   Undo/redo as a stack of full-model snapshots with an index pointing at
   the current one, rather than separate undo/redo lists — that keeps
   undo-then-redo trivially symmetric and avoids an off-by-one on either end.
   suspend() lets the worked-example demo drive the model without burying
   the student's own history under demo steps.
═══════════════════════════════════════════════ */

let serialize = null;
let restore = null;
let stack = [];
let index = -1;
let suspended = false;

const MAX_ENTRIES = 40;

export function initHistory({ serialize: s, restore: r }) {
    serialize = s;
    restore = r;
}

export function resetHistory() {
    if (!serialize) return;
    stack = [structuredClone(serialize())];
    index = 0;
}

export function push() {
    if (suspended || !serialize) return;
    stack = stack.slice(0, index + 1);
    stack.push(structuredClone(serialize()));
    index = stack.length - 1;
    if (stack.length > MAX_ENTRIES) {
        stack.shift();
        index -= 1;
    }
}

export function undo() {
    if (!restore || index <= 0) return false;
    index -= 1;
    restore(structuredClone(stack[index]));
    return true;
}

export function redo() {
    if (!restore || index >= stack.length - 1) return false;
    index += 1;
    restore(structuredClone(stack[index]));
    return true;
}

export function suspend(fn) {
    const was = suspended;
    suspended = true;
    try {
        fn();
    } finally {
        suspended = was;
    }
}

export function canUndo() {
    return index > 0;
}

export function canRedo() {
    return index < stack.length - 1;
}
