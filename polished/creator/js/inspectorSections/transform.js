import { el, numericField, transactionFor } from './fieldUtils.js';

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

export const transformSection = {
  id: 'transform', title: 'Transform', defaultExpanded: true,
  supports: entity => Boolean(entity.components?.transform),
  render({ project, entity, capabilities = {} }) {
    const root = el('div', 'transform-fields');
    const transaction = transactionFor(project, 'Edit transform');
    const controls = [];
    const groups = [
      ['Position', 'position', 1, null],
      ['Rotation (°)', 'rotation', RAD_TO_DEG, '°'],
      ['Scale', 'scale', 1, null]
    ];
    groups.forEach(([title, key, displayFactor, suffix]) => {
      if (capabilities.transformFields?.[key] === false) return;
      const group = el('fieldset', 'transform-group transform-row');
      group.append(el('legend', 'field-group-label', title));
      const axes = el('div', 'axis-fields transform-axis-fields');
      ['X', 'Y', 'Z'].forEach((axis, index) => {
        const control = numericField({
          label: suffix ? `${axis} (${suffix})` : axis,
          value: entity.components.transform[key][index] * displayFactor,
          step: key === 'rotation' ? 1 : 0.1,
          min: key === 'scale' ? 0.001 : undefined,
          transaction,
          onInput(value) {
            const current = [...project.get(entity.id).components.transform[key]];
            current[index] = value / displayFactor;
            project.updateTransform(entity.id, { [key]: current });
          }
        });
        control.field.classList.add(`axis-${axis.toLowerCase()}`);
        control.field.querySelector('.field-label').textContent = axis;
        control.input.setAttribute('aria-label', `${title.replace(' (°)', '')} ${axis}${suffix ? ` (${suffix})` : ''}`);
        controls.push({ key, index, factor: displayFactor, control });
        axes.append(control.field);
      });
      group.append(axes); root.append(group);
    });
    return {
      element: root,
      update(next) { controls.forEach(item => item.control.update(next.components.transform[item.key][item.index] * item.factor)); },
      dispose() { transaction.commit(); }
    };
  }
};
