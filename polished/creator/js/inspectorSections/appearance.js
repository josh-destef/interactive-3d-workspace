import { el, numericField, transactionFor } from './fieldUtils.js';
import { MATERIAL_SWATCHES } from '../materialPalette.js';

const rangeCopy = {
  roughness: { label: 'Roughness', ends: ['Shiny', 'Dull'], max: 1 },
  metalness: { label: 'Metalness', ends: ['Plastic', 'Metal'], max: 1 },
  emissiveIntensity: { label: 'Emission', ends: ['None', 'Bright'], max: 1.25 },
};

export const appearanceSection = {
  id: 'appearance', title: 'Appearance', defaultExpanded: true,
  supports: entity => Boolean(entity.components?.material),
  render({ project, entity, capabilities = {} }) {
    const config = { baseColor: true, rgb: false, roughness: true, metalness: true, emissive: true, exploreRgb: false, ...capabilities.appearance };
    const readOnly = () => Boolean(config.readOnly || project.get(entity.id)?.locked);
    const edit = patch => { if (!readOnly()) project.updateMaterial(entity.id, patch); };
    const root = el('div', 'appearance-fields');
    const base = el('div', 'appearance-property appearance-base-color'); base.dataset.appearance = 'baseColor'; base.hidden = !config.baseColor; root.append(base);
    const colorLabel = el('label', 'field color-field'); colorLabel.append(el('span', 'field-label', 'Base Color'));
    const color = el('input', 'color-input'); color.type = 'color'; color.value = entity.components.material.color; color.setAttribute('aria-label', 'Base Color'); colorLabel.append(color); base.append(colorLabel);
    const colorTransaction = transactionFor(project, 'Change color');
    color.addEventListener('focus', colorTransaction.begin); color.addEventListener('input', () => edit({ color: color.value })); color.addEventListener('change', colorTransaction.commit); color.addEventListener('blur', colorTransaction.commit);
    const swatches = el('div', 'appearance-swatches'); swatches.setAttribute('role', 'group'); swatches.setAttribute('aria-label', 'Base Color swatches');
    for (const [name, value] of MATERIAL_SWATCHES) {
      const button = el('button', 'appearance-swatch'); button.type = 'button'; button.title = name; button.setAttribute('aria-label', `${name} Base Color`); button.dataset.color = value; button.style.setProperty('--swatch-color', value);
      button.addEventListener('click', () => { colorTransaction.commit(); edit({ color: value }); }); swatches.append(button);
    }
    base.append(swatches);
    if (config.exploreRgb) { const explore = el('button', 'button button-secondary appearance-explore-rgb', 'Explore RGB'); explore.type = 'button'; explore.addEventListener('click', () => root.dispatchEvent(new CustomEvent('appearanceexplorergb', { bubbles: true, detail: { entityId: entity.id } }))); base.append(explore); }

    const rangeTransaction = transactionFor(project, 'Edit appearance'); const controls = [];
    function addRange(key, parent = root) {
      const copy = rangeCopy[key]; const wrap = el('div', 'range-field'); wrap.dataset.appearance = key === 'emissiveIntensity' ? 'emissive' : key;
      const caption = el('span', 'range-field-label', copy.label);
      const control = numericField({ label: `${copy.label} value`, value: entity.components.material[key] ?? 0, step: 0.01, min: 0, max: copy.max, transaction: rangeTransaction, onInput: value => edit({ [key]: Math.max(0, Math.min(copy.max, value)) }) }); control.field.classList.add('range-value');
      const range = el('input', 'range-input'); range.type = 'range'; range.min = '0'; range.max = String(copy.max); range.step = '0.01'; range.value = String(entity.components.material[key] ?? 0); range.dataset.materialField = key; range.setAttribute('aria-label', `${copy.label} slider`);
      range.addEventListener('focus', rangeTransaction.begin); range.addEventListener('pointerdown', rangeTransaction.begin); range.addEventListener('input', () => edit({ [key]: Number(range.value) })); range.addEventListener('change', rangeTransaction.commit); range.addEventListener('blur', rangeTransaction.commit); range.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); rangeTransaction.cancel(); range.blur(); } });
      const ends = el('div', 'appearance-range-ends'); copy.ends.forEach(text => ends.append(el('span', '', text)));
      wrap.append(caption, range, control.field, ends); parent.append(wrap); controls.push({ key, control, range });
    }
    if (config.roughness) addRange('roughness'); if (config.metalness) addRange('metalness');
    let effectsContent;
    if (config.emissive) {
      const effects = el('section', 'appearance-effects'); effects.dataset.appearance = 'emissive';
      const heading = el('button', 'appearance-effects-toggle'); heading.type = 'button'; heading.setAttribute('aria-expanded', 'false');
      const title = el('span', 'appearance-effects-title'); title.append(el('strong', '', 'Effects'), el('small', '', 'Emission, glow, and advanced materials')); heading.append(title);
      effectsContent = el('div', 'appearance-effects-content'); effectsContent.hidden = true;
      heading.addEventListener('click', () => { const open = effectsContent.hidden; effectsContent.hidden = !open; heading.setAttribute('aria-expanded', String(open)); });
      effects.append(heading, effectsContent); root.append(effects); addRange('emissiveIntensity', effectsContent);
    }
    function update(next) {
      if (document.activeElement !== color) color.value = next.components.material.color;
      controls.forEach(({ key, control, range }) => { control.update(next.components.material[key] ?? 0); if (document.activeElement !== range) range.value = String(next.components.material[key] ?? 0); });
      swatches.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.color.toLowerCase() === next.components.material.color.toLowerCase())));
      root.querySelectorAll('input[type="range"]').forEach(range => range.style.setProperty('--range-progress', `${100 * (Number(range.value) - Number(range.min)) / (Number(range.max) - Number(range.min))}%`));
      root.querySelectorAll('input, button').forEach(input => { input.disabled = readOnly(); });
    }
    update(entity);
    return { element: root, update,
      reveal(field) {
        if (field === 'emissive' && effectsContent?.hidden) { effectsContent.hidden = false; effectsContent.previousElementSibling?.setAttribute('aria-expanded', 'true'); }
        const target = [...root.querySelectorAll('[data-appearance]')].find(element => element.dataset.appearance === field && !element.hidden); (target || root).scrollIntoView({ block: 'nearest', behavior: 'instant' });
      },
      dispose() { colorTransaction.commit(); rangeTransaction.commit(); },
    };
  }
};
