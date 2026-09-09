export function createHistory({ restore, emit = () => {}, isBlocked = () => false, limit = 100 }) {
  const undoStack = [];
  const redoStack = [];

  return {
    get canUndo() { return undoStack.length > 0; },
    get canRedo() { return redoStack.length > 0; },
    undo() {
      if (isBlocked()) return false;
      const entry = undoStack.pop();
      if (!entry) return false;
      restore(entry.before);
      redoStack.push(entry);
      emit({ kind: 'history', label: entry.label });
      return true;
    },
    redo() {
      if (isBlocked()) return false;
      const entry = redoStack.pop();
      if (!entry) return false;
      restore(entry.after);
      undoStack.push(entry);
      emit({ kind: 'history', label: entry.label });
      return true;
    },
    _push(entry) {
      undoStack.push(entry);
      if (undoStack.length > limit) undoStack.splice(0, undoStack.length - limit);
      redoStack.length = 0;
      emit({ kind: 'history', label: entry.label });
    },
    _clear() {
      undoStack.length = 0;
      redoStack.length = 0;
      emit({ kind: 'history' });
    }
  };
}
