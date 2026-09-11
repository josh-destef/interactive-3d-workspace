function sceneIcon(type) {
  const paths = {
    sphere: '<circle cx="12" cy="12" r="9"/>',
    group: '<path d="M9 15l6-6M10 6l2-2a5 5 0 017 7l-2 2M7 11l-2 2a5 5 0 007 7l2-2"/>',
    cone: '<path d="M12 3L3 19q9 4 18 0Z"/>',
    cylinder: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5"/>',
    plane: '<path d="M3 15l8-9 10 3-8 9Z"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = paths[type] || '<path d="M12 2l9 5v10l-9 5-9-5V7Z M3 7l9 5 9-5M12 12v10"/>';
  return svg;
}

export function createSceneTree({ project, root }) {
  const expanded = new Set(['creation']);
  let disposed = false;
  let capabilities = {};

  root.classList.add('scene-tree');
  root.setAttribute('role', 'tree');
  root.setAttribute('aria-label', 'Outliner objects');
  root.setAttribute('aria-multiselectable', 'true');
  root.tabIndex = -1;

  function childEntities(id) {
    return (typeof project.children === 'function'
      ? project.children(id)
      : project.entities.filter(entity => entity.parentId === id)).filter(entity => !capabilities.scene?.excludeIds?.includes(entity.id));
  }

  function visibleEntries() {
    const entries = [];
    const visit = (entity, depth) => {
      entries.push({ entity, depth });
      if (expanded.has(entity.id)) childEntities(entity.id).forEach(child => visit(child, depth + 1));
    };
    project.entities.filter(entity => entity.parentId == null && !capabilities.scene?.excludeIds?.includes(entity.id)).forEach(entity => visit(entity, 0));
    return entries;
  }

  function select(id, additive = false) {
    if (additive && typeof project.selection.add === 'function') project.selection.add(id);
    else project.selection.set(id);
  }

  function beginRename(row, entity) {
    if (capabilities.actions?.rename === false) return;
    if (row.querySelector('.scene-name-input')) return;
    const label = row.querySelector('.scene-name');
    const input = document.createElement('input');
    input.className = 'scene-name-input';
    input.type = 'text';
    input.value = entity.name;
    input.setAttribute('aria-label', `Rename ${entity.name}`);
    label.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const finish = commit => {
      if (done) return;
      done = true;
      const name = input.value.trim();
      if (commit && name && name !== entity.name) project.rename(entity.id, name);
      else render(entity.id);
    };
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); finish(true); }
      if (event.key === 'Escape') { event.preventDefault(); finish(false); }
    });
  }

  function render(focusId = null) {
    if (disposed) return;
    const active = document.activeElement;
    const priorFocusId = focusId || active?.closest?.('.scene-row')?.dataset.entityId;
    let selectedAncestor = project.get(project.selection.activeId)?.parentId;
    while (selectedAncestor) {
      expanded.add(selectedAncestor);
      selectedAncestor = project.get(selectedAncestor)?.parentId;
    }
    root.replaceChildren();
    const entries = visibleEntries();
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'scene-empty';
      empty.textContent = 'Your outliner is empty.';
      root.append(empty);
      return;
    }

    entries.forEach(({ entity, depth }) => {
      const children = childEntities(entity.id);
      const row = document.createElement('div');
      row.className = 'scene-row';
      if (entity.parentId == null) row.classList.add('is-root');
      if (project.selection.ids.includes(entity.id)) row.classList.add('is-selected');
      row.dataset.entityId = entity.id;
      row.style.setProperty('--tree-depth', depth);
      row.setAttribute('role', 'treeitem');
      row.setAttribute('aria-level', String(depth + 1));
      row.setAttribute('aria-selected', String(project.selection.ids.includes(entity.id)));
      if (children.length) row.setAttribute('aria-expanded', String(expanded.has(entity.id)));
      row.tabIndex = entity.id === (priorFocusId || project.selection.activeId || entries[0].entity.id) ? 0 : -1;

      const expander = document.createElement('button');
      expander.type = 'button';
      expander.className = 'scene-expander';
      expander.textContent = children.length ? (expanded.has(entity.id) ? '▾' : '▸') : '';
      expander.disabled = !children.length;
      expander.tabIndex = -1;
      expander.setAttribute('aria-label', `${expanded.has(entity.id) ? 'Collapse' : 'Expand'} ${entity.name}`);
      expander.addEventListener('click', event => {
        event.stopPropagation();
        expanded.has(entity.id) ? expanded.delete(entity.id) : expanded.add(entity.id);
        render(entity.id);
      });

      const icon = document.createElement('span');
      icon.className = 'scene-type-icon';
      icon.append(sceneIcon(entity.type));
      icon.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span');
      name.className = 'scene-name';
      name.textContent = entity.name;

      const visibility = document.createElement('button');
      visibility.type = 'button';
      visibility.className = 'scene-visibility';
      visibility.hidden = capabilities.actions?.visibility === false;
      visibility.append(sceneIcon('eye'));
      visibility.title = `${entity.visible ? 'Hide' : 'Show'} ${entity.name}`;
      visibility.setAttribute('aria-label', `${entity.visible ? 'Hide' : 'Show'} ${entity.name}`);
      visibility.setAttribute('aria-pressed', String(entity.visible));
      visibility.addEventListener('click', event => {
        event.stopPropagation();
        project.setVisible(entity.id, !entity.visible);
      });

      row.append(expander, icon, name, visibility);
      row.addEventListener('click', event => select(entity.id, event.ctrlKey || event.metaKey || event.shiftKey));
      row.addEventListener('dblclick', event => {
        if (!event.target.closest('button')) beginRename(row, entity);
      });
      row.addEventListener('keydown', event => handleKey(event, row, entity, entries));
      root.append(row);
    });
    if (priorFocusId) root.querySelector(`[data-entity-id="${CSS.escape(priorFocusId)}"]`)?.focus();
  }

  function handleKey(event, row, entity) {
    if (event.target !== row) return;
    const rows = [...root.querySelectorAll('.scene-row')];
    const index = rows.indexOf(row);
    let target;
    if (event.key === 'ArrowDown') target = rows[index + 1];
    if (event.key === 'ArrowUp') target = rows[index - 1];
    if (event.key === 'Home') target = rows[0];
    if (event.key === 'End') target = rows.at(-1);
    if (target) { event.preventDefault(); row.tabIndex = -1; target.tabIndex = 0; target.focus(); return; }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(entity.id, event.ctrlKey || event.metaKey || event.shiftKey); }
    if (event.key === 'F2') { event.preventDefault(); beginRename(row, entity); }
    if (event.key === 'ArrowRight' && childEntities(entity.id).length) {
      event.preventDefault(); expanded.add(entity.id); render(entity.id);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (expanded.has(entity.id)) { expanded.delete(entity.id); render(entity.id); }
      else if (entity.parentId) root.querySelector(`[data-entity-id="${CSS.escape(entity.parentId)}"]`)?.focus();
    }
  }

  const unsubscribe = project.subscribe(event => {
    if (event.kind === 'change' || event.kind === 'selection' || event.kind === 'history') render();
  });
  render();
  return { render, expanded, setCapabilities(next) { capabilities = next; render(); }, dispose() { disposed = true; unsubscribe?.(); root.replaceChildren(); } };
}
