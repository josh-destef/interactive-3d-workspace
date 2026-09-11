import { transformSection, geometrySection, appearanceSection, hierarchySection } from './inspectorSections/index.js';
import { el } from './inspectorSections/fieldUtils.js';

const defaultSections = [transformSection, geometrySection, appearanceSection, hierarchySection];
const sectionSubtitles = {
  transform: 'Position, rotation, and scale',
  geometry: 'Shape-specific properties',
  appearance: 'Color and surface finish',
  hierarchy: 'Parent and children'
};

export function createInspector({ project, root, onFocus, sections = defaultSections }) {
  const registry = new Map(sections.map(section => [section.id, section]));
  const expanded = new Map(sections.map(section => [section.id, section.defaultExpanded !== false]));
  let capabilities = {};
  let featureConfig = {};
  let activeId = null;
  let activeStructure = '';
  let sectionViews = [];
  const sectionTargets = new Map();
  let disposed = false;
  root.classList.add('inspector');

  function enabled(id) { return capabilities[id] !== false; }
  function clearViews() { sectionViews.forEach(view => view.dispose?.()); sectionViews = []; sectionTargets.clear(); }

  function build() {
    clearViews(); root.replaceChildren();
    const entity = project.get(project.selection.activeId);
    activeId = entity?.id || null;
    activeStructure = entity ? JSON.stringify([...registry.values()].map(section => section.supports(entity))) : '';
    if (!entity) {
      const empty = el('div', 'inspector-empty');
      empty.append(el('p', 'inspector-empty-title', 'Nothing selected'), el('p', 'inspector-empty-copy', 'Choose an object in the viewport or Outliner.'));
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
      toggle.setAttribute('aria-expanded', String(isOpen));
      const toggleCopy = el('span', 'inspector-section-toggle-copy');
      toggleCopy.append(
        el('span', 'inspector-section-title', section.title),
        el('span', 'inspector-section-subtitle', section.subtitle || sectionSubtitles[section.id] || '')
      );
      toggle.append(toggleCopy);
      const content = el('div', 'inspector-section-content'); content.hidden = !isOpen;
      toggle.addEventListener('click', () => { const next = content.hidden; content.hidden = !next; expanded.set(section.id, next); toggle.setAttribute('aria-expanded', String(next)); });
      heading.append(toggle); panel.append(heading, content); sectionsRoot.append(panel);
      const view = section.render({ project, entity, capabilities: featureConfig }); content.append(view.element); sectionViews.push(view);
      sectionTargets.set(section.id, { panel, view });
    });
    root.append(sectionsRoot);
  }

  function buildHeader(entity) {
    const header = el('header', 'inspector-object-header');
    const headingRow = el('div', 'inspector-heading-row');
    headingRow.append(el('h2', 'inspector-heading', 'Inspector'));
    const status = el('p', 'inspector-action-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const runAction = action => {
      try { action(); status.textContent = ''; }
      catch (error) { status.textContent = error?.message || 'That action could not be completed.'; }
    };
    const menu = el('details', 'inspector-object-menu');
    const menuToggle = el('summary', 'inspector-object-menu-toggle');
    const editingMark = el('span', 'inspector-editing-mark');
    editingMark.setAttribute('aria-hidden', 'true');
    const editingLabel = el('span', 'inspector-editing-label', 'Editing:');
    const editingName = el('span', 'inspector-editing-name', entity.name);
    menuToggle.append(editingMark, editingLabel, editingName);
    const menuContent = el('div', 'inspector-object-menu-content');
    const titleRow = el('div', 'inspector-object-title');
    const name = el('input', 'inspector-name-input'); name.type = 'text'; name.value = entity.name; name.setAttribute('aria-label', 'Object name');
    name.readOnly = featureConfig.actions?.rename === false;
    name.addEventListener('change', () => runAction(() => {
      const next = name.value.trim();
      if (next) project.rename(entity.id, next);
      else name.value = project.get(entity.id).name;
    }));
    const type = el('span', 'inspector-object-type', entity.type); titleRow.append(name, type);
    const actions = el('div', 'object-actions');
    const action = (label, handler, className = '') => { const button = el('button', `button button-secondary ${className}`.trim(), label); button.type = 'button'; button.dataset.action = label.toLowerCase(); button.addEventListener('click', () => runAction(handler)); actions.append(button); return button; };
    const visibility = action(entity.visible ? 'Hide' : 'Show', () => {
      const current = project.get(entity.id);
      if (current) project.setVisible(entity.id, !current.visible);
    }); visibility.setAttribute('aria-pressed', String(entity.visible));
    action('Focus', () => onFocus?.(entity.id));
    action('Duplicate', () => project.duplicate(entity.id));
    const remove = action('Delete', () => project.remove(entity.id), 'button-danger'); remove.disabled = entity.id === 'creation';
    for (const button of actions.children) {
      const key = ({ Hide: 'visibility', Show: 'visibility', Duplicate: 'duplicate', Delete: 'delete' })[button.textContent];
      if (key) button.hidden = featureConfig.actions?.[key] === false;
    }
    menuContent.append(titleRow, actions);
    menu.append(menuToggle, menuContent);
    headingRow.append(menu);
    header.append(headingRow, status); return header;
  }

  function sync() {
    if (disposed) return;
    const entity = project.get(project.selection.activeId);
    if (!entity || entity.id !== activeId || activeStructure !== JSON.stringify([...registry.values()].map(section => section.supports(entity)))) { build(); return; }
    const name = root.querySelector('.inspector-name-input');
    if (name && document.activeElement !== name) name.value = entity.name;
    const editingName = root.querySelector('.inspector-editing-name');
    if (editingName) editingName.textContent = entity.name;
    sectionViews.forEach(view => view.update?.(entity));
    const visibility = root.querySelector('.object-actions [data-action="hide"], .object-actions [data-action="show"]');
    if (visibility) { visibility.textContent = entity.visible ? 'Hide' : 'Show'; visibility.dataset.action = entity.visible ? 'hide' : 'show'; visibility.setAttribute('aria-pressed', String(entity.visible)); }
  }

  const unsubscribe = project.subscribe(event => {
    if (event.kind === 'selection') build();
    else if (event.kind === 'change' || event.kind === 'history') sync();
  });
  build();
  function setExpanded(id, value) {
    if (!registry.has(id)) throw new Error(`Unknown Inspector section: ${id}`);
    expanded.set(id, Boolean(value));
    const panel = sectionTargets.get(id)?.panel;
    if (panel) {
      panel.querySelector('.inspector-section-content').hidden = !value;
      panel.querySelector('.inspector-section-toggle').setAttribute('aria-expanded', String(Boolean(value)));
    }
  }
  return {
    setExpanded,
    revealSection(id, field) {
      setExpanded(id, true);
      const target = sectionTargets.get(id);
      if (!target) return false;
      if (field && target.view.reveal) target.view.reveal(field);
      else target.panel.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      return true;
    },
    register(section) { registry.set(section.id, section); if (!expanded.has(section.id)) expanded.set(section.id, section.defaultExpanded !== false); build(); },
    setCapabilities(next = {}, config = {}) { capabilities = { ...next }; featureConfig = config; build(); },
    dispose() { disposed = true; unsubscribe?.(); clearViews(); root.replaceChildren(); }
  };
}
