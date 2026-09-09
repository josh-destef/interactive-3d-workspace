import { transformSection, geometrySection, appearanceSection, hierarchySection } from './inspectorSections/index.js';
import { el } from './inspectorSections/fieldUtils.js';

const defaultSections = [transformSection, geometrySection, appearanceSection, hierarchySection];

export function createInspector({ project, root, onFocus, sections = defaultSections }) {
  const registry = new Map(sections.map(section => [section.id, section]));
  const expanded = new Map(sections.map(section => [section.id, section.defaultExpanded !== false]));
  let capabilities = {};
  let activeId = null;
  let sectionViews = [];
  let disposed = false;
  root.classList.add('inspector');

  function enabled(id) { return capabilities[id] !== false; }
  function clearViews() { sectionViews.forEach(view => view.dispose?.()); sectionViews = []; }

  function build() {
    clearViews(); root.replaceChildren();
    const entity = project.get(project.selection.activeId);
    activeId = entity?.id || null;
    if (!entity) {
      const empty = el('div', 'inspector-empty');
      empty.append(el('p', 'inspector-empty-title', 'Nothing selected'), el('p', 'inspector-empty-copy', 'Choose an object in the viewport or Scene.'));
      root.append(empty); return;
    }
    root.append(buildHeader(entity));
    const sectionsRoot = el('div', 'inspector-sections');
    registry.forEach(section => {
      if (!enabled(section.id) || !section.supports(entity)) return;
      const panel = el('section', 'inspector-section'); panel.dataset.section = section.id;
      const heading = el('h3', 'inspector-section-heading');
      const toggle = el('button', 'inspector-section-toggle'); toggle.type = 'button';
      const isOpen = expanded.get(section.id) !== false;
      toggle.setAttribute('aria-expanded', String(isOpen)); toggle.textContent = section.title;
      const content = el('div', 'inspector-section-content'); content.hidden = !isOpen;
      toggle.addEventListener('click', () => { const next = content.hidden; content.hidden = !next; expanded.set(section.id, next); toggle.setAttribute('aria-expanded', String(next)); });
      heading.append(toggle); panel.append(heading, content); sectionsRoot.append(panel);
      const view = section.render({ project, entity }); content.append(view.element); sectionViews.push(view);
    });
    root.append(sectionsRoot);
  }

  function buildHeader(entity) {
    const header = el('header', 'inspector-object-header');
    const status = el('p', 'inspector-action-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const runAction = action => {
      try { action(); status.textContent = ''; }
      catch (error) { status.textContent = error?.message || 'That action could not be completed.'; }
    };
    const titleRow = el('div', 'inspector-object-title');
    const name = el('input', 'inspector-name-input'); name.type = 'text'; name.value = entity.name; name.setAttribute('aria-label', 'Object name');
    name.addEventListener('change', () => runAction(() => {
      const next = name.value.trim();
      if (next) project.rename(entity.id, next);
      else name.value = project.get(entity.id).name;
    }));
    const type = el('span', 'inspector-object-type', entity.type); titleRow.append(name, type);
    const actions = el('div', 'object-actions');
    const action = (label, handler, className = '') => { const button = el('button', `button button-secondary ${className}`.trim(), label); button.type = 'button'; button.addEventListener('click', () => runAction(handler)); actions.append(button); return button; };
    const visibility = action(entity.visible ? 'Hide' : 'Show', () => {
      const current = project.get(entity.id);
      if (current) project.setVisible(entity.id, !current.visible);
    }); visibility.setAttribute('aria-pressed', String(entity.visible));
    action('Focus', () => onFocus?.(entity.id));
    action('Duplicate', () => project.duplicate(entity.id));
    const remove = action('Delete', () => project.remove(entity.id), 'button-danger'); remove.disabled = entity.id === 'creation';
    header.append(titleRow, actions, status); return header;
  }

  function sync() {
    if (disposed) return;
    const entity = project.get(project.selection.activeId);
    if (!entity || entity.id !== activeId) { build(); return; }
    const name = root.querySelector('.inspector-name-input');
    if (name && document.activeElement !== name) name.value = entity.name;
    sectionViews.forEach(view => view.update?.(entity));
    const visibility = root.querySelector('.object-actions button');
    if (visibility) { visibility.textContent = entity.visible ? 'Hide' : 'Show'; visibility.setAttribute('aria-pressed', String(entity.visible)); }
  }

  const unsubscribe = project.subscribe(event => {
    if (event.kind === 'selection') build();
    else if (event.kind === 'change' || event.kind === 'history') sync();
  });
  build();
  return {
    register(section) { registry.set(section.id, section); if (!expanded.has(section.id)) expanded.set(section.id, section.defaultExpanded !== false); build(); },
    setCapabilities(next = {}) { capabilities = { ...next }; build(); },
    dispose() { disposed = true; unsubscribe?.(); clearViews(); root.replaceChildren(); }
  };
}
