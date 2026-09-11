/** Inspector view of evaluated poses. Authored records remain in the real project. */
export function createEditingProject(project) {
  let animation = null;
  let unsubscribe = null;
  const listeners = new Set();
  const view = Object.create(project);
  Object.defineProperties(view, {
    get: { value(id) {
      const entity = project.get(id);
      if (!entity || !animation?.isEditingEnabled) return entity;
      return { ...entity, components: { ...entity.components, transform: animation.getTransform(id) } };
    } },
    updateTransform: { value(id, partial) {
      return animation?.isEditingPose ? animation.updateTransform(id, partial) : project.updateTransform(id, partial);
    } },
    subscribe: { value(listener) {
      listeners.add(listener);
      const off = project.subscribe(listener);
      return () => { listeners.delete(listener); off(); };
    } },
  });
  return {
    project: view,
    connect(controller) {
      unsubscribe?.(); animation = controller;
      unsubscribe = animation.subscribe(() => listeners.forEach(listener => listener({ kind: 'change' })));
    },
    dispose() { unsubscribe?.(); listeners.clear(); },
  };
}
