import { el } from './fieldUtils.js';

export const hierarchySection = {
  id: 'hierarchy', title: 'Hierarchy', defaultExpanded: false,
  supports: () => true,
  render({ project, entity }) {
    const root = el('div', 'hierarchy-fields');
    const parentLabel = el('label', 'field'); parentLabel.append(el('span', 'field-label', 'Parent'));
    const select = el('select', 'parent-select'); select.setAttribute('aria-label', 'Parent object');
    select.disabled = entity.id === 'creation';
    parentLabel.append(select); root.append(parentLabel);
    const count = el('p', 'child-count'); root.append(count);
    const actions = el('div', 'hierarchy-actions');
    const status = el('p', 'hierarchy-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const runAction = action => {
      try { action(); status.textContent = ''; }
      catch (error) { status.textContent = error?.message || 'That hierarchy change could not be completed.'; }
    };
    const group = el('button', 'button button-secondary', 'Group selection'); group.type = 'button';
    group.addEventListener('click', () => runAction(() => project.group()));
    const ungroup = el('button', 'button button-secondary', 'Ungroup'); ungroup.type = 'button'; ungroup.disabled = entity.type !== 'group' || entity.id === 'creation';
    ungroup.addEventListener('click', () => runAction(() => project.ungroup(entity.id))); actions.append(group, ungroup); root.append(actions, status);

    let latest = entity;
    function sync(next) {
      latest = next;
      const descendants = new Set();
      const collect = id => (project.children?.(id) || []).forEach(child => { descendants.add(child.id); collect(child.id); });
      collect(next.id);
      const selectedValue = next.parentId ?? '';
      if (document.activeElement !== select) {
        select.replaceChildren();
        const sceneOption = el('option', '', 'Scene (no parent)'); sceneOption.value = ''; select.append(sceneOption);
        project.entities.filter(candidate => candidate.id !== next.id && !descendants.has(candidate.id) && (candidate.type === 'group' || candidate.type === 'gizmobot')).forEach(candidate => {
          const option = el('option', '', candidate.name); option.value = candidate.id; select.append(option);
        });
        select.value = selectedValue;
      }
      count.textContent = `${project.children?.(next.id)?.length || 0} children`;
      group.disabled = project.selection.ids.length < 1 || project.selection.ids.includes('creation');
      ungroup.disabled = next.type !== 'group' || next.id === 'creation';
    }
    select.addEventListener('change', () => {
      try {
        project.reparent(entity.id, select.value || null);
        select.removeAttribute('aria-invalid'); select.removeAttribute('title');
      } catch (error) {
        select.setAttribute('aria-invalid', 'true'); select.title = error.message;
        sync(project.get(entity.id));
      }
    });
    select.addEventListener('blur', () => sync(latest));
    sync(entity);
    return { element: root, update: sync };
  }
};
