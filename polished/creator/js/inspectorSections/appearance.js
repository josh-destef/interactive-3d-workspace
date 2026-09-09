import { el, numericField, transactionFor } from './fieldUtils.js';

export const appearanceSection = {
  id: 'appearance', title: 'Appearance', defaultExpanded: false,
  supports: entity => Boolean(entity.components?.material),
  render({ project, entity }) {
    const root = el('div', 'appearance-fields');
    const colorLabel = el('label', 'field color-field');
    colorLabel.append(el('span', 'field-label', 'Base color'));
    const color = el('input', 'color-input'); color.type = 'color'; color.value = entity.components.material.color;
    color.setAttribute('aria-label', 'Base color'); colorLabel.append(color); root.append(colorLabel);
    const colorTransaction = transactionFor(project, 'Change color');
    color.addEventListener('focus', colorTransaction.begin);
    color.addEventListener('input', () => project.updateMaterial(entity.id, { color: color.value }));
    color.addEventListener('blur', colorTransaction.commit);
    const rangeTransaction = transactionFor(project, 'Edit appearance');
    const controls = ['roughness', 'metalness'].map(key => {
      const wrap = el('div', 'range-field');
      const control = numericField({ label: key[0].toUpperCase() + key.slice(1), value: entity.components.material[key], step: 0.05, min: 0, max: 1, transaction: rangeTransaction,
        onInput: value => project.updateMaterial(entity.id, { [key]: Math.max(0, Math.min(1, value)) }) });
      const range = el('input', 'range-input'); range.type = 'range'; range.min = '0'; range.max = '1'; range.step = '0.05'; range.value = String(entity.components.material[key]);
      range.setAttribute('aria-label', `${key} slider`);
      range.addEventListener('focus', rangeTransaction.begin);
      range.addEventListener('pointerdown', rangeTransaction.begin);
      range.addEventListener('input', () => project.updateMaterial(entity.id, { [key]: Number(range.value) }));
      range.addEventListener('change', rangeTransaction.commit);
      range.addEventListener('blur', rangeTransaction.commit);
      wrap.append(control.field, range); root.append(wrap);
      return { key, control, range };
    });
    return { element: root, update(next) {
      if (document.activeElement !== color) color.value = next.components.material.color;
      controls.forEach(({ key, control, range }) => { control.update(next.components.material[key]); if (document.activeElement !== range) range.value = String(next.components.material[key]); });
    }, dispose() { colorTransaction.commit(); rangeTransaction.commit(); } };
  }
};
