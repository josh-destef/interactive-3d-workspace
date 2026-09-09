import { createSceneTree } from './sceneTree.js';
import { createInspector } from './inspector.js';

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

export function createDock({ project, root, onFocus }) {
  if (!root) throw new Error('createDock requires a root element');
  let state = root.dataset.state || 'pinned';
  let capabilities = { panels: { scene: true, inspector: true }, inspectorSections: {} };

  root.replaceChildren();
  const header = node('header', 'dock-header');
  const title = node('h2', 'dock-title', 'Editor');
  const headerActions = node('div', 'dock-header-actions');
  const pin = node('button', 'dock-pin', 'Pin'); pin.type = 'button'; pin.setAttribute('aria-label', 'Pin editor dock');
  const close = node('button', 'dock-close', 'Close'); close.type = 'button'; close.setAttribute('aria-label', 'Close editor dock');
  headerActions.append(pin, close); header.append(title, headerActions);

  const scenePanel = node('section', 'scene-panel');
  const sceneHeading = node('h2', 'panel-heading', 'Scene');
  const sceneRoot = node('div', 'scene-tree-host'); scenePanel.append(sceneHeading, sceneRoot);
  const inspectorPanel = node('section', 'inspector-panel');
  const inspectorHeading = node('h2', 'panel-heading', 'Inspector');
  const inspectorRoot = node('div', 'inspector-host'); inspectorPanel.append(inspectorHeading, inspectorRoot);
  root.append(header, scenePanel, inspectorPanel);

  const sceneTree = createSceneTree({ project, root: sceneRoot });
  const inspector = createInspector({ project, root: inspectorRoot, onFocus });

  function emit() {
    root.dispatchEvent(new CustomEvent('dockstatechange', { bubbles: true, detail: { state } }));
  }
  function applyState(next, notify = true) {
    if (!['closed', 'open', 'pinned'].includes(next)) throw new Error(`Unknown dock state: ${next}`);
    state = next; root.dataset.state = state; root.hidden = state === 'closed';
    pin.setAttribute('aria-pressed', String(state === 'pinned'));
    pin.textContent = state === 'pinned' ? 'Unpin' : 'Pin';
    if (notify) emit();
  }
  pin.addEventListener('click', () => applyState(state === 'pinned' ? 'open' : 'pinned'));
  close.addEventListener('click', () => applyState('closed'));
  root.addEventListener('keydown', event => { if (event.key === 'Escape' && state === 'open') applyState('closed'); });

  function setCapabilities(config = {}) {
    capabilities = {
      panels: { ...capabilities.panels, ...(config.panels || {}) },
      inspectorSections: { ...capabilities.inspectorSections, ...(config.inspectorSections || {}) }
    };
    scenePanel.hidden = capabilities.panels.scene === false;
    inspectorPanel.hidden = capabilities.panels.inspector === false;
    inspector.setCapabilities(capabilities.inspectorSections);
  }

  applyState(state, false);
  return {
    setState: applyState,
    getState: () => state,
    setCapabilities,
    dispose() { sceneTree.dispose(); inspector.dispose(); root.replaceChildren(); }
  };
}
