import { createGuidance } from './guidance.js';
import { makeMaterialTarget, assessMaterial, assessRgb, materialHint } from './materialChallenge.js';

const COPY = {
  intro: ['Meet your material', 'Select Gizmobot Shell in the Outliner. The outer suit is the surface you will change; its settings live in Inspector → Appearance. You will build a look, see how light reveals it, then match a reference.'],
  color: ['Start with the shell color', 'Choose a different Base Color swatch in Appearance. Watch the outer suit change while the face and details stay the same. Keep a color you like; Explore RGB is an optional color-mixing activity.'],
  rgb: ['Mix your own color', 'Open the Base Color picker and choose a color. Notice how the shell color changes while its finish stays the same.'],
  roughness: ['Compare shiny and dull', 'Keep your color. Sweep Roughness toward Shiny and toward Dull. Watch the bright reflection: low roughness makes it sharp; high roughness spreads it out.'],
  metalness: ['Compare plastic and metal', 'Sweep Metalness toward Plastic and toward Metal. Notice how metal colors the reflection. If it is hard to see, lower Roughness toward Shiny first.'],
  light: ['See why lighting matters', 'Choose Watch light move. The material will stay the same while a light circles Gizmobot, so only the highlights move. You will learn to control light sources in a future lesson; this lab keeps a neutral light fixed while you edit materials.'],
  emission: ['What happens without room light?', 'Choose Room lighting off in Emission preview. Compare the face with the shell: the face stays visible in the dark. This effect is called emission.'],
  glow: ['Now make the shell glow', 'The room is dark again. Sweep Emission from None toward Bright in Appearance → Effects. Watch your shell color become visible; the glow does not light the floor or other objects in this lab.'],
  photo: ['Create a look to keep', 'The room lights are back on. Adjust Appearance to make your own look. Use Emission preview if you want to check it in darkness, and drag empty space to orbit. Save picture keeps this view.'],
  challenge: ['Rebuild the reference look', 'Your material is on the right; Reference is on the left, under the same light. Compare Plastic or Metal first, then reflection sharpness, then Base Color. Choose Check match for feedback.'],
  rgbOffer: ['Try an optional RGB match', 'You explored RGB. Try a color-only match, or choose Skip RGB match to move to three quick questions before your design returns.'],
  rgbChallenge: ['Match a color', 'The two shells have the same finish. Use the Base Color picker to match the reference color.'],
  reviewRoughness: ['Which control softens a reflection?', 'A plastic shell has a sharp reflection. Which control would you change to make that reflection softer while keeping it plastic?'],
  reviewMetalness: ['Can metal have a dull finish?', 'Imagine a metal shell with a broad, soft reflection. Can Roughness make metal dull while Metalness stays at Metal?'],
  reviewEmission: ['Will a glowing shell light the floor?', 'You can see the shell with Room lighting off. Does increasing Emission also shine light onto the floor in this lab?'],
  done: ['Your design is back', 'Your material and Room lighting choice from before the match are restored. Try a new combination, such as a dull metal or shiny plastic. Save picture keeps your favorite view.'],
};
const TERMS = {
  intro: ['Outliner', 'Inspector', 'Appearance'],
  color: ['Base Color', 'Appearance', 'Explore RGB'],
  rgb: ['Base Color'],
  roughness: ['Roughness', 'Shiny', 'Dull'],
  metalness: ['Metalness', 'Plastic', 'Metal', 'Roughness', 'Shiny'],
  light: ['light sources'],
  emission: ['Room lighting off', 'Emission preview', 'Emission'],
  glow: ['Emission', 'Appearance', 'Effects'],
  photo: ['Appearance', 'Emission preview', 'Save picture'],
  challenge: ['Reference', 'Plastic', 'Metal', 'Base Color', 'Check match'],
  rgbOffer: ['RGB', 'Skip RGB match'],
  rgbChallenge: ['Base Color'],
  reviewRoughness: ['Roughness', 'Metalness'],
  reviewMetalness: ['Roughness', 'Metalness'],
  reviewEmission: ['Emission', 'Room lighting off'],
  done: ['Roughness', 'Metalness', 'Room lighting', 'Save picture'],
};
const ORDER = ['intro', 'color', 'roughness', 'metalness', 'light', 'emission', 'glow', 'photo', 'challenge', 'reviewRoughness', 'reviewMetalness', 'reviewEmission', 'done'];
const REVIEWS = {
  reviewRoughness: ['Roughness', 'Metalness', 'Yes. Higher Roughness spreads the reflection; the shell stays plastic.', 'Metalness changes plastic-like or metallic behavior. Raise Roughness to soften the reflection.'],
  reviewMetalness: ['Yes', 'No', 'Yes. Metalness chooses the surface response; Roughness can make either metal or plastic dull.', 'Metal can be dull too. Keep Metalness at Metal and raise Roughness to spread the reflection.'],
  reviewEmission: ['No', 'Yes', 'Right. Emission keeps the surface visible, but this lab needs a scene light to illuminate the floor.', 'The glowing surface stays visible, but it does not illuminate nearby objects in this lab. A scene light does that.'],
};
const TARGETS = {
  intro: '.scene-row[data-entity-id="gizmobot"]',
  color: '[data-appearance="baseColor"]', rgb: '[data-appearance="baseColor"]',
  roughness: '[data-appearance="roughness"]', metalness: '[data-appearance="metalness"]',
  emission: '.material-lesson-controls [data-room-on="false"]',
  glow: '.appearance-effects-content [data-appearance="emissive"]',
  challenge: '.inspector-section[data-section="appearance"]', rgbChallenge: '[data-appearance="baseColor"]',
};
const clone = value => structuredClone(value);
const STATIC_LIGHT_ANGLE = 38;

/** Lesson orchestration over the Creation Studio project, selection and Appearance. */
export async function createMaterialLesson(creator, options = {}) {
  const { project } = creator;
  await creator.viewport?.ready;
  const guidance = options.guidance || createGuidance();
  let studio;
  let step = 'intro', complete = false, busy = false, disposed = false, rgbLearned = false;
  let baseline, previous, target, authored, hintCount = 0, generation = 0;
  let best = {}, roomOn = true;
  const pause = options.pause || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const reduced = options.reducedMotion ?? globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const material = () => clone(project.get('gizmobot').components.material);
  const update = patch => project.updateMaterial('gizmobot', patch);
  const notify = text => guidance.status?.(text);
  const ready = value => { complete = value; guidance.setComplete(value); };
  const achieved = text => { if (!complete) { guidance.acknowledge?.(); ready(true); notify(text); } };
  const dock = options.controls === false ? null : document.getElementById('editor-dock');
  const cursor = dock ? (await import('./controlCursor.js')).createControlCursor() : null;
  creator.showGuide?.(false);
  const helpButton = typeof document === 'undefined' ? null : document.getElementById('help-toggle');
  const oldHelpHidden = helpButton?.hidden;
  if (helpButton) helpButton.hidden = true;
  if (typeof document !== 'undefined') {
    document.title = 'Material Lab · CreateAccess Creation Studio';
    const tag = document.querySelector('.prototype-tag');
    if (tag) tag.textContent = 'Material Lab';
    const mode = document.querySelector('.mode-label');
    if (mode) mode.textContent = 'Material Lab';
  }
  const sceneControls = dock ? document.createElement('section') : null;
  let matchFeedback = null;
  studio = options.studio || (await import('./materialStudio.js')).createMaterialStudio(creator);

  function capabilities() {
    const level = Math.max(0, ORDER.indexOf(step));
    const final = ['photo', 'done'].includes(step);
    const challenge = step === 'challenge';
    creator.setCapabilities({
      tools: { select: !busy, move: false, rotate: false, scale: false, add: false },
      panels: { scene: true, inspector: true, bottomEditor: false },
      scene: { excludeIds: ['creation'] },
      inspectorSections: { transform: false, geometry: false, appearance: true, hierarchy: false },
      actions: { duplicate: false, delete: false, visibility: false, rename: false, group: false, ungroup: false, reparent: false },
      appearance: {
        baseColor: !['intro'].includes(step), rgb: false,
        roughness: (level >= 2 || final || challenge) && !['rgb', 'rgbChallenge', 'rgbOffer'].includes(step),
        metalness: (level >= 3 || final || challenge) && !['rgb', 'rgbChallenge', 'rgbOffer'].includes(step),
        emissive: ['glow', 'photo', 'done'].includes(step), exploreRgb: step === 'color', readOnly: busy || Boolean(REVIEWS[step]),
      },
    });
    creator.dock?.inspector?.setExpanded('appearance', true);
  }

  function controls() {
    if (!sceneControls) return;
    sceneControls.replaceChildren();
    matchFeedback = null;
    sceneControls.className = 'material-lesson-controls';
    const emissionPreview = ['emission', 'photo', 'done'].includes(step);
    const challenge = step === 'challenge';
    sceneControls.hidden = !emissionPreview && !challenge;
    if (emissionPreview) {
      const heading = document.createElement('h2'); heading.textContent = 'Emission preview'; sceneControls.append(heading);
      for (const on of [true, false]) {
        const choice = button(sceneControls, `Room lighting ${on ? 'on' : 'off'}`, () => room(on));
        choice.dataset.roomOn = String(on); choice.setAttribute('aria-pressed', String(roomOn === on));
      }
    }
    if (challenge) {
      button(sceneControls, 'Need a hint?', () => notify(materialHint(target, ++hintCount)));
      button(sceneControls, 'New reference', newTarget);
      matchFeedback = document.createElement('section');
      matchFeedback.className = 'material-match-feedback';
      matchFeedback.hidden = true;
      matchFeedback.setAttribute('role', 'status');
      matchFeedback.setAttribute('aria-live', 'polite');
      matchFeedback.innerHTML = `
        <strong class="material-match-score"></strong>
        <p class="material-match-note"></p>
        <div class="material-match-metrics">
          ${[['color', 'Base Color'], ['roughness', 'Roughness'], ['metalness', 'Metalness']].map(([key, label]) => `
            <div class="material-match-metric" data-metric="${key}">
              <span>${label}</span><progress max="100" value="0" aria-label="${label} closeness"></progress><output>0%</output>
            </div>`).join('')}
        </div>`;
      sceneControls.append(matchFeedback);
    }
  }
  function button(parent, text, fn) {
    const el = document.createElement('button'); el.type = 'button'; el.textContent = text; el.className = 'dock-btn'; el.addEventListener('click', fn); parent.append(el); return el;
  }
  if (sceneControls) dock.append(sceneControls);
  function room(on) {
    if (roomOn === on) return;
    roomOn = on; studio.setRoomLights(on);
    sceneControls?.querySelectorAll('[data-room-on]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.roomOn === String(on))));
    if (step === 'emission' && !on) achieved('The face stays visible in darkness; the shell relies on reflected light.');
  }

  function show() {
    const [title, body] = COPY[step];
    const watch = ['rgb', 'roughness', 'metalness', 'light'].includes(step);
    const photo = ['photo', 'done'].includes(step);
    const review = REVIEWS[step];
    guidance.show({
      step: step === 'rgb' || step === 'rgbChallenge' || step === 'rgbOffer' ? 'OPTIONAL RGB' : ORDER.indexOf(step) + 1,
      total: ORDER.length, title, body, terms: TERMS[step], fixedHome: true, target: TARGETS[step], spotlight: Boolean(TARGETS[step]), callout: true, dim: false, placement: 'left',
      canContinue: complete && step !== 'done', continueLabel: step === 'rgb' ? 'Use this color' : step === 'rgbOffer' ? 'Skip RGB match' : step === 'photo' ? 'Start the match' : step === 'reviewEmission' ? 'Return to my design' : 'Continue',
      onContinue: next,
      secondaryLabel: review?.[1] || (TARGETS[step] ? 'Show me where' : ''),
      onSecondary: review ? () => answer(false) : () => { revealControl(); guidance.showTarget?.(); },
      actionLabel: review?.[0] || (step === 'light' ? 'Watch light move' : watch ? 'Watch comparison' : photo ? 'Save picture' : ['challenge', 'rgbChallenge'].includes(step) ? 'Check match' : step === 'rgbOffer' ? 'Try RGB match' : ''),
      actionBusyLabel: watch ? 'Watch…' : photo ? 'Saving…' : 'Checking…',
      onAction: review ? () => answer(true) : watch ? demo : photo ? async () => {
        try { await studio.capture(); notify('Picture saved. Keep experimenting.'); }
        catch { notify('The picture could not be saved. Try Save picture again.'); }
        return false;
      } : step === 'rgbOffer' ? () => { enter('rgbChallenge'); return false; } : check,
    });
  }
  function answer(correct) {
    if (!REVIEWS[step]) return false;
    notify(REVIEWS[step][correct ? 2 : 3]); ready(correct); return false;
  }
  function revealControl() {
    if (creator.dock?.getState?.() === 'closed') creator.setDock?.('open');
    if (step !== 'intro' && project.selection.activeId !== 'gizmobot') project.selection.set(['gizmobot']);
    const field = { color: 'baseColor', rgb: 'baseColor', roughness: 'roughness', metalness: 'metalness', glow: 'emissive', challenge: 'baseColor', rgbChallenge: 'baseColor' }[step];
    if (field) creator.dock?.inspector?.revealSection?.('appearance', field);
    else if (step === 'emission') sceneControls?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }

  function enter(nextStep) {
    generation++; step = nextStep; complete = false; best = {};
    studio.hideReference(); studio.setLightVisible(false);
    if (step !== 'intro') project.selection.set(['gizmobot']);
    roomOn = step !== 'glow'; studio.setRoomLights(roomOn);
    studio.setLightAngle(STATIC_LIGHT_ANGLE);
    if (step === 'challenge') {
      update({ emissiveIntensity: 0 }); newTarget(false);
    }
    if (step === 'rgbChallenge') {
      update({ roughness: .5, metalness: 0, emissiveIntensity: 0 }); studio.showReference({ color: '#8b5cf6', roughness: .5, metalness: 0, emissiveIntensity: 0 });
    }
    if (step === 'done' && authored) {
      update(authored.material); roomOn = authored.roomOn; studio.setRoomLights(roomOn);
    }
    // Assessment starts from a fixed finish. Undo remains available for the
    // learner's new edits, without restoring properties hidden by this challenge.
    if (step === 'challenge' || step === 'rgbChallenge' || step === 'done') project.history.clear();
    baseline = material(); previous = clone(baseline);
    complete = ['photo', 'rgbOffer', 'done'].includes(step);
    capabilities(); controls(); show();
    revealControl();
  }
  function next() {
    if (!complete || busy || disposed || step === 'done') return;
    if (step === 'rgb') { rgbLearned = true; enter('roughness'); return; }
    if (step === 'photo') authored = { material: material(), roomOn };
    if (step === 'challenge') { enter(rgbLearned ? 'rgbOffer' : 'reviewRoughness'); return; }
    if (step === 'rgbOffer' || step === 'rgbChallenge') { enter('reviewRoughness'); return; }
    enter(ORDER[ORDER.indexOf(step) + 1]);
  }
  function changed() {
    if (disposed || busy) return;
    if (step === 'intro') {
      if (project.selection.activeId === 'gizmobot') achieved('Shell selected. Continue to reveal Base Color in Appearance.');
      else ready(false);
      return;
    }
    const now = material();
    if (['color', 'rgb'].includes(step) && now.color !== baseline.color) achieved('Your color is on the shell. Next, keep that color and explore its reflection.');
    if (['challenge', 'rgbChallenge'].includes(step) && JSON.stringify(now) !== JSON.stringify(previous)) {
      ready(false);
      if (step === 'challenge') markMatchFeedbackStale();
    }
    const key = { roughness: 'roughness', metalness: 'metalness', glow: 'emissiveIntensity' }[step];
    if (key && now[key] !== previous[key]) {
      const range = best[key] || (best[key] = { min: baseline[key] ?? 0, max: baseline[key] ?? 0 });
      range.min = Math.min(range.min, now[key]); range.max = Math.max(range.max, now[key]);
      if (range.max - range.min >= (step === 'glow' ? .35 : .3)) achieved({
        roughness: 'Both shiny and dull surfaces reflect light. Roughness changes how sharp that reflection looks.',
        metalness: 'Metal can be shiny or dull too. Roughness still controls reflection sharpness.',
        glow: 'Your shell is visible in the dark, but the floor stays dark.',
      }[step]);
    }
    previous = now;
  }
  function newTarget(render = true) {
    target = makeMaterialTarget(options.random); hintCount = 0; ready(false); studio.showReference(target);
    if (matchFeedback) { matchFeedback.hidden = true; matchFeedback.classList.remove('is-stale', 'is-pass'); }
    if (render) notify('A new reference is ready. Compare and check again.');
  }
  function renderMatchFeedback(result) {
    if (!matchFeedback) return;
    matchFeedback.hidden = false;
    matchFeedback.classList.remove('is-stale');
    matchFeedback.classList.toggle('is-pass', result.passed);
    matchFeedback.dataset.percentage = result.percentage;
    matchFeedback.querySelector('.material-match-score').textContent = `${result.percentage}% match`;
    matchFeedback.querySelector('.material-match-note').textContent = result.hint;
    for (const [key, score] of Object.entries(result.scores)) {
      const row = matchFeedback.querySelector(`[data-metric="${key}"]`);
      row.querySelector('progress').value = score;
      row.querySelector('output').textContent = `${score}%`;
    }
  }
  function markMatchFeedbackStale() {
    if (!matchFeedback || matchFeedback.hidden || matchFeedback.classList.contains('is-stale')) return;
    matchFeedback.classList.add('is-stale');
    matchFeedback.querySelector('.material-match-score').textContent = `Last check · ${matchFeedback.dataset.percentage}% match`;
  }
  function check() {
    if (!['challenge', 'rgbChallenge'].includes(step)) return false;
    const result = step === 'challenge' ? assessMaterial(material(), target) : assessRgb(material().color);
    if (step === 'challenge') renderMatchFeedback(result);
    notify(result.hint); ready(result.passed); return false;
  }
  async function demo() {
    if (busy || disposed) return false;
    if (step === 'light') return demoLight();
    const token = generation, saved = material(); busy = true; ready(false); capabilities(); revealControl(); guidance.acknowledge?.(); notify(step === 'rgb' ? 'Watch the color picker change the shell.' : 'Watch the pointer drag the slider, then compare the shell.');
    project.beginTransaction('Material comparison');
    const snapshots = step === 'rgb' ? [{ color: '#ff0000' }, { color: '#ffff00' }, { color: '#ffffff' }]
      : step === 'roughness' ? [{ roughness: .06 }, { roughness: .94 }] : [{ metalness: 0 }, { metalness: 1 }];
    try {
      for (const [index, patch] of snapshots.entries()) {
        if (disposed || generation !== token) break;
        if (step === 'rgb') notify(['Watch · Red', 'Watch · Yellow', 'Watch · White'][index]);
        const key = step === 'rgb' ? 'color' : step;
        const selector = step === 'rgb' ? '.color-input' : `[data-material-field="${key}"]`;
        const from = step === 'rgb' ? material().color : material()[key];
        const to = step === 'rgb' ? patch.color : patch[key];
        cursor?.point(selector, from); await pause(350);
        if (disposed || generation !== token) break;
        // RGB uses still comparisons to avoid flashing through unrelated colors.
        // Reduced-motion mode also keeps material comparisons static.
        if (!reduced && step !== 'rgb') {
          for (let frame = 1; frame <= 24; frame++) {
            if (disposed || generation !== token) break;
            const value = from + (to - from) * frame / 24;
            // Give the pointer a slower, easier-to-follow sweep across the slider.
            cursor?.point(selector, value, true); update({ [key]: value }); await pause(55);
          }
        }
        if (disposed || generation !== token) break;
        update(patch); cursor?.point(selector, to, !reduced); await pause(reduced ? 1100 : 900);
      }
    } finally {
      // Cancel keeps demonstrations out of undo history and restores the learner's look.
      cursor?.hide(); project.cancelTransaction(); busy = false;
      if (!disposed && generation === token) {
        baseline = saved; previous = clone(saved); best = {}; capabilities(); ready(false);
        notify('Your turn · Try the same control');
      }
    }
    return false;
  }
  async function demoLight() {
    const token = generation;
    busy = true; ready(false); capabilities(); guidance.acknowledge?.();
    notify('Watch · The material stays fixed while the highlight travels around it.');
    studio.setLightVisible(true);
    const angles = reduced ? [STATIC_LIGHT_ANGLE, 158, 278, STATIC_LIGHT_ANGLE] : Array.from({ length: 49 }, (_, index) => STATIC_LIGHT_ANGLE + index * 360 / 48);
    try {
      for (const angle of angles) {
        if (disposed || generation !== token) break;
        studio.setLightAngle(angle);
        await pause(reduced ? 900 : 70);
      }
    } finally {
      busy = false;
      if (!disposed && generation === token) {
        studio.setLightAngle(STATIC_LIGHT_ANGLE);
        studio.setLightVisible(false);
        capabilities(); ready(true);
        notify('The light is fixed again. You will control light sources in a future lesson.');
      }
    }
    return false;
  }
  const unsubscribe = project.subscribe(changed);
  const exploreRgb = () => { if (step === 'color' && !busy) enter('rgb'); };
  dock?.addEventListener('appearanceexplorergb', exploreRgb);
  project.selection.clear();
  if (guidance.welcome) {
    capabilities();
    guidance.welcome({
      title: 'Give Gizmobot a material of your own',
      body: 'A material controls how a surface looks and reflects light. You will change Gizmobot’s shell color and compare shiny, dull, plastic, and metal finishes.\n\nYou will briefly watch light reveal the surface, then explore glow, create your own look, and match a reference. Light-source controls come in a future lesson.',
      terms: ['Gizmobot', 'Base Color', 'Roughness', 'Metalness', 'Emission'],
      onStart: () => { enter('intro'); document.querySelector('.lesson-guidance-got-it')?.focus(); },
    });
  } else enter('intro');
  return {
    next, demo, check, newTarget, setRoomLights: room,
    exploreRgb, tryRgbChallenge: () => { if (step === 'rgbOffer') enter('rgbChallenge'); },
    get state() { return { step, complete, busy, rgbLearned, target: target && clone(target) }; },
    dispose() { disposed = true; generation++; unsubscribe(); cursor?.dispose(); dock?.removeEventListener('appearanceexplorergb', exploreRgb); sceneControls?.remove(); if (helpButton) helpButton.hidden = oldHelpHidden; studio.dispose(); guidance.destroy(); },
  };
}
