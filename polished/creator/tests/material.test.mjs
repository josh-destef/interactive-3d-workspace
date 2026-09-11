import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { JSDOM } = await import(pathToFileURL(path.join(os.tmpdir(), 'fundamentals-3d-qa/node_modules/jsdom/lib/api.js')));
const dom = new JSDOM('<aside id="dock"></aside>', { pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, CustomEvent: dom.window.CustomEvent });
const { createProject } = await import('../js/project.js');
const { createDock } = await import('../js/dock.js');
const { MATERIAL_SWATCHES } = await import('../js/materialPalette.js');

test('emission survives history and serialization and rejects invalid values', () => {
 const project = createProject(); const entity = project.addPrimitive('cube');
 project.updateMaterial(entity.id, { emissiveIntensity: 1.25 });
 assert.equal(project.get(entity.id).components.material.emissiveIntensity, 1.25);
 project.history.undo(); assert.equal(project.get(entity.id).components.material.emissiveIntensity, undefined);
 project.history.redo(); assert.equal(project.get(entity.id).components.material.emissiveIntensity, 1.25);
 const data = project.serialize(); project.restore(data); assert.equal(project.get(entity.id).components.material.emissiveIntensity, 1.25);
 for (const value of [-1, 1.26, NaN, Infinity, '1']) assert.throws(() => project.updateMaterial(entity.id, { emissiveIntensity: value }));
 data.entities.find(e => e.id === entity.id).components.material.emissiveIntensity = -1;
 assert.throws(() => project.restore(data));
});

test('Appearance progressively exposes fields and Base Color changes the normal material with undo', () => {
 const project = createProject(); const entity = project.addPrimitive('cube'); const root = document.querySelector('#dock');
 const dock = createDock({ project, root });
 dock.setCapabilities({ appearance: { baseColor: true, rgb: false, roughness: false, metalness: false, emissive: false, exploreRgb: true }, scene: { excludeIds: ['creation'] } });
 dock.inspector.setExpanded('appearance', true);
 assert.equal(root.querySelector('[data-section="appearance"] .inspector-section-content').hidden, false);
 assert.equal(root.querySelector('[data-appearance="roughness"]'), null);
 assert.deepEqual([...root.querySelectorAll('.appearance-swatch')].map(button => button.dataset.color), MATERIAL_SWATCHES.map(([, color]) => color));
 assert.equal(root.querySelector('.scene-row[data-entity-id="creation"]'), null);
 let requested = null; root.addEventListener('appearanceexplorergb', event => requested = event.detail.entityId);
 root.querySelector('.appearance-explore-rgb').click(); assert.equal(requested, entity.id);
 dock.setCapabilities({ appearance: { rgb: true } }); dock.inspector.setExpanded('appearance', true);
 assert.equal(root.querySelectorAll('[data-appearance="rgb"] .appearance-range-ends').length, 0, 'RGB uses the normal Base Color picker rather than duplicate channel sliders');
 const before = project.get(entity.id).components.material.color;
 const picker = root.querySelector('.color-input');
 picker.focus(); picker.value = '#112233'; picker.dispatchEvent(new dom.window.Event('input')); picker.dispatchEvent(new dom.window.Event('change')); picker.blur();
 assert.equal(project.get(entity.id).components.material.color, '#112233');
 project.history.undo(); assert.equal(project.get(entity.id).components.material.color, before);
 assert.equal(root.querySelector('.color-input').value, before);
 dock.setCapabilities({ appearance: { readOnly: true } });
 assert.ok([...root.querySelectorAll('.appearance-fields input, .appearance-fields button')].every(input => input.disabled));
 const color = project.get(entity.id).components.material.color;
 root.querySelector('.color-input').value = '#000000'; root.querySelector('.color-input').dispatchEvent(new dom.window.Event('input'));
 assert.equal(project.get(entity.id).components.material.color, color);
 dock.dispose();
});

test('Inspector reveals a section or Appearance field without rebuilding or moving input focus', () => {
 const project = createProject(); project.addPrimitive('cube');
 const root = document.querySelector('#dock'); const dock = createDock({ project, root });
 const scrolls = []; const original = dom.window.Element.prototype.scrollIntoView;
 dom.window.Element.prototype.scrollIntoView = function(options) { scrolls.push({ element: this, options }); };
 try {
  dock.inspector.setExpanded('appearance', false);
  assert.equal(dock.inspector.revealSection('appearance'), true);
  const panel = root.querySelector('[data-section="appearance"]');
  assert.equal(panel.querySelector('.inspector-section-content').hidden, false);
  assert.equal(scrolls.at(-1).element, panel);
  const input = root.querySelector('[data-material-field="roughness"]'); input.focus();
  dock.inspector.revealSection('appearance', 'roughness');
  assert.equal(scrolls.at(-1).element.dataset.appearance, 'roughness');
  assert.deepEqual(scrolls.at(-1).options, { block: 'nearest', behavior: 'instant' });
  assert.equal(document.activeElement, input);
  assert.equal(root.querySelector('[data-material-field="roughness"]'), input);
  input.blur();
  dock.setCapabilities({ inspectorSections: { appearance: false } });
  const count = scrolls.length;
  assert.equal(dock.inspector.revealSection('appearance', 'roughness'), false);
  assert.equal(scrolls.length, count);
 } finally { dom.window.Element.prototype.scrollIntoView = original; dock.dispose(); }
});
