import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '../../..');
const deps = path.join(os.tmpdir(), 'fundamentals-3d-qa/node_modules');
const { JSDOM } = await import(pathToFileURL(path.join(deps, 'jsdom/lib/api.js')).href);
const dom = new JSDOM('<div id="creator-app"><div id="tool-rail"></div><div id="add-menu" hidden></div></div>', { pretendToBeVisual: true });
const previous = Object.fromEntries(['window', 'document', 'Element', 'MutationObserver', 'innerWidth', 'innerHeight', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'ResizeObserver', 'addEventListener', 'removeEventListener'].map(key => [key, globalThis[key]]));
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, Element: dom.window.Element,
  MutationObserver: dom.window.MutationObserver, innerWidth: 1000, innerHeight: 700,
  addEventListener: dom.window.addEventListener.bind(dom.window), removeEventListener: dom.window.removeEventListener.bind(dom.window),
  matchMedia: query => ({ matches: globalThis.innerWidth <= Number(query.match(/(\d+)px/)?.[1] || 0) }),
});
const frames = [];
globalThis.requestAnimationFrame = callback => (frames.push(callback), frames.length);
globalThis.cancelAnimationFrame = () => {};
class TestResizeObserver { observe() {} unobserve() {} disconnect() { this.disconnected = true; } }
globalThis.ResizeObserver = TestResizeObserver;
const flush = () => { while (frames.length) frames.shift()(); };
const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
const shown = (element, box) => {
  element.getBoundingClientRect = () => box;
  element.getClientRects = () => [box];
};
shown(document.getElementById('tool-rail'), rect(15, 65, 82, 320));

const guidanceURL = pathToFileURL(path.join(root, 'polished/creator/js/lessons/guidance.js')).href;
const { createGuidance } = await import(guidanceURL);

function buildTarget() {
  const target = document.createElement('button');
  target.id = 'lesson-target';
  document.body.append(target);
  shown(target, rect(500, 120, 90, 42));
  return target;
}

const guidance = createGuidance();
assert.equal(document.querySelector('.lesson-guidance').hidden, true, 'guidance stays out of the first paint until a lesson step is ready');
let continues = 0;
const target = buildTarget();
guidance.show({ step: 2, total: 6, title: 'Meet the Viewport', body: 'Choose the Head in the Outliner. Review Navigate & Transform.', terms: ['Viewport', 'Outliner'], references: ['Navigate & Transform'], target: '#lesson-target', placement: 'right', spotlight: true, canContinue: false, onContinue: () => continues++ });
flush();
const layer = document.querySelector('.lesson-guidance');
assert.equal(layer.hidden, false, 'show reveals guidance only after its step content is populated');
const card = layer.querySelector('.lesson-guidance-card');
Object.defineProperty(card, 'offsetHeight', { get: () => 220 });
Object.defineProperty(card, 'offsetWidth', { get: () => 355 });
const continueButton = layer.querySelector('.lesson-guidance-continue');
const okayButton = layer.querySelector('.lesson-guidance-got-it');
assert.deepEqual([...layer.querySelectorAll('.lesson-term')].map(term => term.textContent), ['Viewport', 'Outliner'], 'new terms receive the shared vocabulary treatment');
assert.deepEqual([...layer.querySelectorAll('.lesson-reference')].map(term => term.textContent), ['Navigate & Transform'], 'previous lessons receive the navy reference treatment');
assert.equal(layer.classList.contains('is-spotlighting'), true, 'visible selector target opens a spotlight');
assert.equal(card.dataset.pointer, 'left', 'a right placement points back to the target');
assert.equal(continueButton.hidden, true, 'continue is unavailable before the observable goal');
assert.equal(okayButton.textContent, 'Okay');
assert.equal(document.getElementById('creator-app').classList.contains('lesson-mode'), true, 'guidance enables the compact lesson layout hook');

guidance.setComplete(true);
assert.equal(continueButton.hidden, true, 'Continue stays hidden while Okay is visible');
okayButton.click();
flush();
assert.equal(layer.classList.contains('is-spotlighting'), false, 'Okay releases the dimmed interface');
assert.equal(okayButton.hidden, true, 'Okay does not remain as a duplicate action');
assert.equal(card.dataset.pointer, '', 'released instruction is a stable home card');
assert.equal(Number.parseInt(card.style.left, 10), 24, 'instruction is inset as a floating card');
assert.equal(Number.parseInt(card.style.top, 10) >= 400, true, 'dismissed desktop guidance returns to the inset bottom-left, not the top-left');
assert.equal(continueButton.hidden, false, 'completion reveals Continue');
continueButton.click();
assert.equal(continues, 1, 'Continue calls its lesson callback only after completion');

guidance.show({ step: 1, title: 'Look around', target: '#lesson-target', spotlight: true, callout: true, canContinue: true });
guidance.setComplete(true); flush();
assert.equal(okayButton.hidden, false, 'an orientation callout that starts complete still waits for Okay');
okayButton.click(); flush();

// A selector can disappear as an editor panel is closed or rebuilt; guidance
// must fall back to the home card rather than leaving an orphaned shade.
target.remove();
const rebuiltTarget = buildTarget();
guidance.show({ step: 3, total: 6, title: 'Choose an object', body: 'Use the Outliner.', target: '#lesson-target', spotlight: true });
flush();
assert.equal(layer.classList.contains('is-spotlighting'), true, 'a rebuilt selector target can be spotlighted');
rebuiltTarget.remove();
await new Promise(resolve => setTimeout(resolve, 0));
flush();
assert.equal(layer.classList.contains('is-spotlighting'), false, 'a removed selector target safely disables its spotlight');

// Opening Add does not pull a general instruction back to the upper screen.
const addMenu = document.getElementById('add-menu');
addMenu.hidden = false;
shown(addMenu, rect(109, 100, 262, 250));
guidance.show({ step: 1, total: 6, title: 'Add', body: 'Choose a shape.', spotlight: false });
flush();
assert.equal(Number.parseInt(card.style.top, 10) >= 368, true, 'home guidance is placed below an open Add menu');

// On a phone-width viewport, the card uses the lower reserved band instead of
// covering the tool rail and most of the viewport.
globalThis.innerWidth = 600;
globalThis.innerHeight = 700;
addMenu.hidden = true;
guidance.show({ step: 1, total: 6, title: 'Add', body: 'Choose a shape.', spotlight: false });
flush();
assert.equal(Number.parseInt(card.style.left, 10), 24, 'phone guidance stays inset from the reserved lower band');
assert.equal(Number.parseInt(card.style.top, 10) > 400, true, 'phone guidance stays in the lower part of the viewport');

// Material comparisons keep guidance and Continue at one home while highlighting
// a newly introduced Inspector field. Additional actions stay in the same card.
globalThis.innerWidth = 1000;
const fixedTarget = buildTarget();
let secondaryClicks = 0;
guidance.show({ step: 2, total: 10, title: 'Appearance', body: 'Choose a color.', target: '#lesson-target', spotlight: true, fixedHome: true, secondaryLabel: 'Replay', onSecondary: () => secondaryClicks++ });
flush();
assert.equal(layer.classList.contains('is-spotlighting'), true);
assert.equal(layer.classList.contains('is-anchored'), false, 'stationary spotlight does not attach the card to a moving control');
assert.equal(card.dataset.pointer, '');
assert.equal(Number.parseInt(card.style.left, 10), 24);
layer.querySelector('.lesson-guidance-secondary').click();
assert.equal(secondaryClicks, 1);

guidance.show({ step: 3, title: 'Roughness', target: '#lesson-target', spotlight: true, fixedHome: true, callout: true, dim: false });
flush();
assert.equal(layer.classList.contains('is-anchored'), true, 'opt-in callout points at its control');
assert.equal(layer.classList.contains('is-undimmed'), true, 'callout keeps the material preview lit');
guidance.setComplete(true); flush();
assert.equal(okayButton.hidden, true, 'completing a callout replaces Okay without another click');
assert.equal(continueButton.hidden, false, 'completing a callout immediately reveals Continue');
assert.equal(continueButton.disabled, false, 'the revealed Continue action is ready to use');
assert.equal(layer.classList.contains('is-spotlighting'), true, 'completed callout keeps highlighting its target');
assert.equal(layer.classList.contains('is-anchored'), true, 'completed callout stays beside its target');
assert.equal(card.dataset.pointer, 'left', 'completed callout keeps its pointer instead of jumping home');
guidance.showTarget(); flush();
assert.equal(layer.classList.contains('is-anchored'), true, 'Show me where can reopen the same target');
assert.equal(okayButton.hidden, true, 'repositioning a completed callout does not bring Okay back');
globalThis.innerWidth = 390;
guidance.showTarget(); flush();
assert.equal(layer.classList.contains('is-anchored'), false, 'phone callout stays in its reserved band');
globalThis.innerWidth = 1000;
guidance.status('Your turn: compare a shiny and a dull finish.');
assert.equal(layer.querySelector('.lesson-feedback').hidden, false);
const localControl = document.createElement('input');
localControl.type = 'range';
guidance.mountControl(localControl);
assert.equal(layer.querySelector('.lesson-guidance-controls').contains(localControl), true, 'lesson-only controls mount inside the instruction card');
guidance.show({ step: 3, title: 'Roughness', body: 'Try the slider.' });
assert.equal(layer.querySelector('.lesson-feedback').hidden, true, 'feedback from the previous step is cleared');
assert.equal(layer.querySelector('.lesson-guidance-controls').hidden, true, 'lesson-only controls clear between steps');
assert.equal(layer.querySelector('.lesson-guidance-secondary').hidden, true, 'an absent optional action cannot remain focusable');
fixedTarget.remove();

guidance.destroy();
assert.equal(document.querySelector('.lesson-guidance'), null, 'destroy removes the mounted layer');
assert.equal(document.getElementById('creator-app').classList.contains('lesson-mode'), false, 'destroy releases the lesson layout hook');
dom.window.close();
for (const [key, value] of Object.entries(previous)) globalThis[key] = value;
console.log('PASS guidance positions safely, gates progression, releases spotlights, and adapts to small screens');
