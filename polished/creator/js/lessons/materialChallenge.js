/** Lesson assessment data, independent of rendering and the Inspector. */
import { MATERIAL_SWATCHES } from '../materialPalette.js';
export const MATERIAL_PALETTE = MATERIAL_SWATCHES.map(([, hex]) => hex);
const NAMES = MATERIAL_SWATCHES.map(([name]) => name.toLowerCase());
export const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const linear = value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
const SCORE_TOLERANCE = { color: .5, roughness: .45, metalness: .6 };
const SCORE_WEIGHT = { color: .4, roughness: .3, metalness: .3 };
const PASS_PERCENTAGE = 70;
const PASS_METRIC = 45;
const closeness = (distance, tolerance) => Math.round(Math.max(0, 1 - distance / tolerance) * 100);
export function makeMaterialTarget(random = Math.random) {
  const index = Math.min(MATERIAL_PALETTE.length - 1, Math.floor(random() * MATERIAL_PALETTE.length));
  return { color: MATERIAL_PALETTE[index], roughness: .1 + random() * .8, metalness: random() < .5 ? 0 : 1, emissiveIntensity: 0, hue: NAMES[index] };
}
export function assessMaterial(actual, target) {
  const a = rgb(actual.color).map(v => linear(v / 255)), b = rgb(target.color).map(v => linear(v / 255));
  const scores = {
    color: closeness(Math.hypot(...a.map((v, i) => v - b[i])), SCORE_TOLERANCE.color),
    roughness: closeness(Math.abs(actual.roughness - target.roughness), SCORE_TOLERANCE.roughness),
    metalness: closeness(Math.abs(actual.metalness - target.metalness), SCORE_TOLERANCE.metalness),
  };
  const percentage = Math.round(Object.keys(scores).reduce((total, key) => total + scores[key] * SCORE_WEIGHT[key], 0));
  // A good overall reading passes as long as no one property is visibly far off.
  // These broad bands are intentionally more forgiving than the earlier matcher.
  const passed = percentage >= PASS_PERCENTAGE && Object.values(scores).every(score => score >= PASS_METRIC);
  const worst = Object.keys(scores).sort((a, b) => scores[a] - scores[b])[0];
  const hint = passed ? 'You matched the look. The color and surface finish work together.'
    : worst === 'roughness' ? (actual.roughness > target.roughness ? 'Make the reflection a little sharper: lower Roughness.' : 'Soften the reflection: raise Roughness toward Dull.')
      : worst === 'metalness' ? (actual.metalness < target.metalness ? 'The reference is more metallic. Move Metalness toward Metal.' : 'The reference looks more like plastic. Lower Metalness.')
        : 'Compare the color on the shaded side, away from the bright highlight.';
  return { passed, worst, hint, percentage, scores };
}
export function materialHint(target, count) {
  if (count === 1) return 'Compare in this order: plastic or metal, sharp or broad reflection, then the color in the shade.';
  return `Look for ${target.hue || 'the reference color'}, ${target.metalness > .5 ? 'a metallic surface' : 'a plastic-like surface'}, and ${target.roughness < .35 ? 'a tight, shiny reflection' : target.roughness > .65 ? 'a broad, dull reflection' : 'a moderately soft reflection'}.`;
}
export function assessRgb(color, target = '#8b5cf6') {
  const delta = rgb(target).map((v, i) => v - rgb(color)[i]);
  if (Math.hypot(...delta) < 74) return { passed: true, hint: 'You built a close color match with RGB.' };
  const brightness = delta.reduce((a, b) => a + b, 0);
  if (Math.abs(brightness) > 135) return { passed: false, hint: `Your color is ${brightness > 0 ? 'darker' : 'brighter'}. ${brightness > 0 ? 'Raise' : 'Lower'} all three channels a little.` };
  const i = delta.map(Math.abs).indexOf(Math.max(...delta.map(Math.abs)));
  return { passed: false, hint: `${delta[i] > 0 ? 'Add more' : 'Use less'} ${['Red', 'Green', 'Blue'][i]}. Compare again.` };
}
