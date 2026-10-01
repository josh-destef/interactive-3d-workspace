import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const { JSDOM } = await import(pathToFileURL(path.join(os.tmpdir(), 'fundamentals-3d-qa/node_modules/jsdom/lib/api.js')));
const dom = new JSDOM('<main></main>', { pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document });
const { createProject } = await import('../js/project.js');
const { appearanceSection } = await import('../js/inspectorSections/appearance.js');
const { numericField } = await import('../js/inspectorSections/fieldUtils.js');

test('numeric display preserves precise model values and Appearance uses tenth steps beside fluid hundredth sliders', () => {
  const project = createProject();
  const entity = project.addPrimitive('cube');
  project.updateMaterial(entity.id, { roughness: 0.123456 });
  const section = appearanceSection.render({ project, entity, capabilities: { appearance: { emissive: false, metalness: false } } });
  document.querySelector('main').append(section.element);

  const number = section.element.querySelector('.range-value input');
  const slider = section.element.querySelector('.range-input');
  assert.equal(number.value, '0.12', 'ordinary values use a readable two-decimal display');
  assert.equal(number.step, '0.1', 'number inputs encourage useful tenths');
  assert.equal(slider.step, '0.01', 'sliders keep fine-grained control');
  assert.equal(project.get(entity.id).components.material.roughness, 0.123456, 'formatting does not round stored material data');

  number.focus();
  number.value = '0.3';
  number.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.equal(project.get(entity.id).components.material.roughness, 0.3, 'typed values still update the model');
  section.dispose();
});

test('numeric fields keep a nonzero minimum visible and Escape cancels invalid edits', () => {
  const small = numericField({ label: 'Scale', value: 0.001 });
  document.querySelector('main').append(small.field);
  assert.equal(small.input.value, '0.001', 'a positive minimum does not appear as zero');

  let active = false;
  const events = [];
  const transaction = {
    begin() { if (!active) { events.push('begin'); active = true; } },
    commit() { if (active) { events.push('commit'); active = false; } },
    cancel() { if (active) { events.push('cancel'); active = false; } },
  };
  const field = numericField({ label: 'Width', value: 1.23, min: 0.001, transaction, onInput() {} });
  document.querySelector('main').append(field.field);
  field.input.focus();
  field.input.value = '';
  field.input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.equal(field.input.getAttribute('aria-invalid'), 'true', 'empty numeric input is marked invalid');
  const escape = new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  field.input.dispatchEvent(escape);
  assert.equal(escape.defaultPrevented, true);
  assert.deepEqual(events, ['begin', 'cancel'], 'Escape cancels the active transaction without committing it on blur');
  assert.equal(field.input.value, '1.23', 'the field returns to its last authoritative value');
  assert.equal(field.input.hasAttribute('aria-invalid'), false);
});

test('Position, Rotation and Scale all use the same drag-left-and-right field', async () => {
  const { transformSection } = await import('../js/inspectorSections/transform.js');
  const project = createProject();
  const entity = project.addPrimitive('cube');
  const section = transformSection.render({ project, entity: project.get(entity.id) });
  const fields = [...section.element.querySelectorAll('[data-transform-axis]')];
  assert.equal(fields.length, 9);
  for (const field of fields) assert.equal(field.classList.contains('is-scrubbable'), true, `${field.dataset.transformAxis} drags like the others`);
  const optedOut = transformSection.render({ project, entity: project.get(entity.id), capabilities: { transformFields: { scrub: { scale: false } } } });
  assert.equal(optedOut.element.querySelector('[data-transform-axis="scale-x"]').classList.contains('is-scrubbable'), false, 'a lesson can still opt a group out');
  section.dispose(); optedOut.dispose();
});

test('Transform can open one Position axis at a time and drag values like a Blender field', async () => {
  const { transformSection } = await import('../js/inspectorSections/transform.js');
  const project = createProject();
  const entity = project.addPrimitive('cube');
  project.updateTransform(entity.id, { position: [0.5, 1, -0.4] });
  const section = transformSection.render({ project, entity: project.get(entity.id), capabilities: { transformFields: {
    rotation: false, scale: false,
    axes: { position: ['z', 'y'] }, currentAxis: { position: 'y' }, scrub: { position: true },
  } } });
  document.querySelector('main').append(section.element);
  const field = axis => section.element.querySelector(`[data-transform-axis="position-${axis}"]`);
  const input = axis => field(axis).querySelector('input');
  const pointer = (type, clientX, extra = {}) => Object.assign(new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, clientX, ...extra }), { pointerId: 1 });

  assert.equal(section.element.querySelectorAll('fieldset').length, 1, 'only Position is shown');
  assert.equal(section.element.querySelectorAll('input[type="range"]').length, 0, 'the number itself is the slider');
  assert.equal(input('x').disabled, true, 'an axis not yet reached is locked');
  assert.equal(field('y').classList.contains('is-current'), true);
  assert.equal(field('y').classList.contains('is-scrubbable'), true);
  assert.equal(input('z').disabled, false, 'a placed axis stays editable');

  input('y').dispatchEvent(pointer('pointerdown', 100));
  input('y').dispatchEvent(pointer('pointermove', 110));
  input('y').dispatchEvent(pointer('pointermove', 310));
  assert.deepEqual(project.get(entity.id).components.transform.position, [0.5, 2, -0.4], 'dragging 200px right adds 1 to only its axis');
  input('y').dispatchEvent(pointer('pointermove', -1690));
  assert.deepEqual(project.get(entity.id).components.transform.position, [0.5, -8, -0.4], 'the drag has no range limit');
  input('y').dispatchEvent(pointer('pointermove', -1790, { ctrlKey: true }));
  assert.equal(project.get(entity.id).components.transform.position[1], -8.5, 'Ctrl moves in tenths');
  input('y').dispatchEvent(pointer('pointerup', -1790));
  assert.notEqual(document.activeElement, input('y'), 'a drag does not open typing');

  input('z').dispatchEvent(pointer('pointerdown', 50));
  input('z').dispatchEvent(pointer('pointerup', 50));
  assert.equal(document.activeElement, input('z'), 'a click without dragging opens the value for typing');
  input('z').value = '0.25';
  input('z').dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  input('z').blur();
  assert.equal(project.get(entity.id).components.transform.position[2], 0.25);

  project.updateTransform(entity.id, { position: [0.5, 1.5, 0.75] });
  section.update(project.get(entity.id));
  assert.equal(input('z').value, '0.75', 'the field follows external changes');
  section.dispose();
});
