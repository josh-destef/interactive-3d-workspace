import { el, numericField, transactionFor } from './fieldUtils.js';

const fieldsByType = {
  cube: [['Width', 'width'], ['Height', 'height'], ['Depth', 'depth']],
  sphere: [['Radius', 'radius']],
  cylinder: [['Radius', 'radius'], ['Height', 'height']],
  cone: [['Radius', 'radius'], ['Height', 'height']],
  plane: [['Width', 'width'], ['Height', 'height']]
};

export const geometrySection = {
  id: 'geometry', title: 'Geometry', defaultExpanded: true,
  supports: entity => Boolean(entity.components?.geometry && fieldsByType[entity.type]),
  render({ project, entity }) {
    const root = el('div', 'geometry-fields');
    const transaction = transactionFor(project, 'Edit geometry');
    const controls = fieldsByType[entity.type].map(([label, key]) => {
      const control = numericField({ label, value: entity.components.geometry[key], min: 0.001, transaction,
        onInput: value => project.updateGeometry(entity.id, { [key]: value }) });
      root.append(control.field); return { key, control };
    });
    return { element: root, update(next) { controls.forEach(({ key, control }) => control.update(next.components.geometry[key])); }, dispose() { transaction.commit(); } };
  }
};
