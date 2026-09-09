import test from 'node:test';
import assert from 'node:assert/strict';
import { connect } from './browser-session.mjs';

test('Scene, Inspector, capabilities, and dock state share the project model', async () => {
  const browser = await connect();
  try {
    await browser.send('Log.clear'); browser.errors.length = 0;
    await browser.evaluate('delete window.creator');
    await browser.send('Page.reload', { ignoreCache: true });
    await browser.wait('Boolean(window.creator?.project && document.querySelector(".scene-tree") && document.getElementById("loading").hidden)');
    const result = await browser.evaluate(`(async () => {
      const project = window.creator.project;
      const initial = project.serialize();
      const fire = (element, type, init = {}) => element.dispatchEvent(new Event(type, { bubbles: true, ...init }));
      const click = element => element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const report = {};
      try {
        const cube = project.addPrimitive('cube');
        const sphere = project.addPrimitive('sphere');
        report.rowsCreated = Boolean(document.querySelector('[data-entity-id="' + cube.id + '"]') && document.querySelector('[data-entity-id="' + sphere.id + '"]'));

        click(document.querySelector('[data-entity-id="' + cube.id + '"]'));
        report.sharedSelection = project.selection.activeId === cube.id && document.querySelector('.inspector-name-input').value === cube.name;
        document.querySelector('[data-entity-id="' + sphere.id + '"]').dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
        report.multiSelection = project.selection.ids.includes(cube.id) && project.selection.ids.includes(sphere.id);

        const creationRow = document.querySelector('[data-entity-id="creation"]');
        click(creationRow.querySelector('.scene-expander'));
        project.selection.clear();
        project.selection.set(cube.id);
        report.ancestorAutoExpanded = document.querySelector('[data-entity-id="creation"]').getAttribute('aria-expanded') === 'true' && Boolean(document.querySelector('[data-entity-id="' + cube.id + '"]'));

        const positionX = document.querySelector('[data-section="transform"] .transform-group:nth-child(1) .axis-x input');
        positionX.focus(); positionX.value = '2.5'; fire(positionX, 'input'); positionX.blur();
        report.liveNumeric = project.get(cube.id).components.transform.position[0] === 2.5;
        const rotationY = document.querySelector('[data-section="transform"] .transform-group:nth-child(2) .axis-y input');
        rotationY.focus(); rotationY.value = '180'; fire(rotationY, 'input'); rotationY.blur();
        report.degreesToRadians = Math.abs(project.get(cube.id).components.transform.rotation[1] - Math.PI) < 1e-9;

        const scaleX = document.querySelector('[data-section="transform"] .transform-group:nth-child(3) .axis-x input');
        scaleX.focus(); scaleX.value = '-4'; fire(scaleX, 'input'); scaleX.blur();
        report.numericBounds = project.get(cube.id).components.transform.scale[0] > 0;
        scaleX.focus(); scaleX.value = '7'; fire(scaleX, 'input');
        scaleX.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        report.escapeRestores = Number(scaleX.value) === project.get(cube.id).components.transform.scale[0];

        const visibility = document.querySelector('.object-actions button');
        click(visibility); const hidden = !project.get(cube.id).visible;
        click(visibility); report.repeatedVisibility = hidden && project.get(cube.id).visible;

        const activeField = document.querySelector('[data-section="transform"] input');
        activeField.focus(); activeField.value = '4'; fire(activeField, 'input');
        window.creator.setCapabilities({ inspectorSections: { transform: false } });
        report.capabilityHides = !document.querySelector('[data-section="transform"]');
        window.creator.setCapabilities({ inspectorSections: { transform: true } });
        report.capabilityRestores = Boolean(document.querySelector('[data-section="transform"]'));

        let dockEvents = 0;
        const dockRoot = document.getElementById('editor-dock');
        dockRoot.addEventListener('dockstatechange', () => dockEvents++);
        window.creator.dock.setState('open');
        window.creator.dock.setState('pinned');
        report.dockState = window.creator.dock.getState() === 'pinned' && dockRoot.dataset.state === 'pinned' && dockEvents === 2;
      } finally {
        project.restore(initial);
        window.creator.setCapabilities({ inspectorSections: { transform: true, geometry: true, appearance: true, hierarchy: true } });
      }
      return report;
    })()`);
    for (const [name, passed] of Object.entries(result)) assert.equal(passed, true, name);
    const relevantErrors = browser.errors.filter(error => !(error.url?.endsWith('/favicon.ico') && error.text?.includes('404')));
    assert.equal(relevantErrors.length, 0, JSON.stringify(relevantErrors));
  } finally {
    browser.close();
  }
});
