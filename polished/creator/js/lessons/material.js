import { createGuidance } from './guidance.js';
import { makeMaterialTarget, assessMaterial } from './materialChallenge.js';

// Each step's copy is set once and stays put: the takeaway lives in the
// instruction itself, and feedback appears beside the control that produced it.
const COPY = {
  intro: ['Select Gizmobot', 'Click Gizmobot in the object list on the right. Selecting it opens its Appearance settings, where you will change how its body looks.'],
  color: ['Choose a color', 'Choose a Base Color swatch on the right. Notice that Gizmobot’s body changes color while its face and colored details keep theirs.'],
  roughness: ['Compare shiny and dull', 'Move Roughness between Shiny and Dull. Roughness sets the surface finish: notice the bright reflection change from sharp to soft. The change is easiest to see on a darker color.'],
  metalness: ['Compare plastic and metal', 'Move Metalness between Plastic and Metal. Notice that metal turns darker and more mirror-like. Metalness and Roughness work together to set the finish: metal looks most like a mirror when Roughness is near Shiny.'],
  emission: ['Turn off the room lights', 'Choose “Turn off the lights”. Notice which parts of Gizmobot you can still see.'],
  glow: ['Make Gizmobot glow', 'The face stayed visible because it uses Emission: the face glows with its own color, even without room light. Move Emission from None toward Bright to make Gizmobot glow too. Dark colors barely glow, so try a brighter Base Color if Gizmobot stays dark.'],
  photo: ['Create your own look', 'Use Base Color, Roughness, Metalness, and Emission to design a look you like. Next you will match a reference look, and then your design will come back so you can save a picture.'],
  challenge: ['Match the reference', 'Make your Gizmobot look like the Reference using the Base Color swatches and the finish sliders, Roughness and Metalness. Choose the “Check match” button to see your score, which then updates as you adjust.'],
  done: ['You can design materials!', 'Base Color, Roughness, Metalness, and Emission work together to make a material, and your design is back. Change anything you like, then choose “Save picture” to keep a picture of your Gizmobot to share.'],
};
// Green marks vocabulary the first time it matters, not every control name.
const TERMS = {
  intro: ['Appearance'],
  color: ['Base Color'],
  roughness: ['Roughness', 'finish'],
  metalness: ['Metalness'],
  glow: ['Emission'],
};
const ORDER = ['intro', 'color', 'roughness', 'metalness', 'emission', 'glow', 'photo', 'challenge', 'done'];
// Like Navigate + Transform, the closing celebration is not a numbered step.
const NUMBERED_STEPS = ORDER.length - 1;
const HOME_URL = '../';
const TARGETS = {
  intro: '.scene-row[data-entity-id="gizmobot"]',
  color: '[data-appearance="baseColor"]',
  roughness: '[data-appearance="roughness"]', metalness: '[data-appearance="metalness"]',
  glow: '.appearance-effects-content [data-appearance="emissive"]',
};
// Free design keeps a room-lights switch beside Emission.
const FREE_STEPS = ['photo', 'done'];
const clone = value => structuredClone(value);
const STATIC_LIGHT_ANGLE = 38;

/** Lesson orchestration over the Creation Studio project, selection and Appearance. */
export async function createMaterialLesson(creator, options = {}) {
  const { project } = creator;
  await creator.viewport?.ready;
  const guidance = options.guidance || createGuidance();
  let studio;
  let step = 'intro', complete = false, busy = false, disposed = false;
  let baseline, previous, target, authored, generation = 0;
  let best = {}, roomOn = true, matchChecked = false;
  const pause = options.pause || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const reduced = options.reducedMotion ?? globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const material = () => clone(project.get('gizmobot').components.material);
  const update = patch => project.updateMaterial('gizmobot', patch);
  const ready = value => { complete = value; guidance.setComplete(value); };
  const achieved = () => { if (!complete) { guidance.acknowledge?.(); ready(true); } };
  // Match feedback sits under the matching buttons so the instruction never changes.
  let matchSummary = null;
  const feedback = text => { if (matchSummary) { matchSummary.textContent = text; matchSummary.hidden = !text; } };
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
  studio =options.studio || (await import('./materialStudio.js')).createMaterialStudio(creator);

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
        baseColor: !['intro'].includes(step), rgb: false, colorPicker: !challenge,
        roughness: level >= 2 || final || challenge,
        metalness: level >= 3 || final || challenge,
        emissive: ['glow', 'photo', 'done'].includes(step), exploreRgb: step === 'color', readOnly: busy,
        effectsOpen: ['glow', 'photo', 'done'].includes(step),
        lightsToggle: FREE_STEPS.includes(step) ? (roomOn ? 'on' : 'off') : false,
      },
    });
    creator.dock?.inspector?.setExpanded('appearance', true);
  }

  function summaryLine(parent) {
    matchSummary = document.createElement('p');
    matchSummary.className = 'material-match-summary';
    matchSummary.hidden = true;
    matchSummary.setAttribute('role', 'status');
    matchSummary.setAttribute('aria-live', 'polite');
    parent.append(matchSummary);
  }
  function controls() {
    if (!sceneControls) return;
    sceneControls.replaceChildren();
    matchFeedback = null; matchSummary = null;
    sceneControls.className = 'material-lesson-controls';
    const challenge = step === 'challenge';
    sceneControls.hidden = !challenge;
    if (challenge) {
      dock.prepend(sceneControls);
      const panel = document.createElement('div'); panel.className = 'material-match-panel'; guidance.mountControl?.(panel);
      if (!panel.isConnected) sceneControls.append(panel);
      summaryLine(panel);
      matchFeedback = document.createElement('section');
      matchFeedback.className = 'material-match-feedback';
      matchFeedback.hidden = true;
      matchFeedback.setAttribute('aria-label', 'Match details');
      matchFeedback.innerHTML = `
        <strong class="material-match-score"></strong>
        <div class="material-match-metrics">
          ${[['color', 'Base Color'], ['roughness', 'Roughness'], ['metalness', 'Metalness']].map(([key, label]) => `
            <div class="material-match-metric" data-metric="${key}">
              <span>${label}</span>
              <div class="material-match-bar" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="${label} closeness"><span></span></div>
              <output>0%</output>
            </div>`).join('')}
        </div>`;
      sceneControls.append(matchFeedback);
    }
  }
  if (sceneControls) dock.append(sceneControls);
  function room(on) {
    if (step !== 'emission') return;
    if (roomOn === on) return;
    roomOn = on; studio.setRoomLights(on);
    if (step === 'emission' && !on) achieved();
  }
  function freeLights(event) {
    if (!FREE_STEPS.includes(step) || busy || disposed) return;
    roomOn = Boolean(event.detail?.on); studio.setRoomLights(roomOn);
  }
  function rematch() {
    if (busy || disposed || step !== 'done') return;
    authored = material();
    enter('challenge');
  }

  function show() {
    const [title, body] = COPY[step];
    const watch = ['color', 'roughness', 'metalness'].includes(step);
    // Saving a picture is the finale's reward, not a mid-lesson task.
    const photo = step === 'done';
    const finished = step === 'done';
    // The lights switch is the step's one action; it becomes Continue once pressed.
    const lights = step === 'emission';
    const matching = step === 'challenge';
    guidance.show({
      step: finished ? '' : ORDER.indexOf(step) + 1,
      total: NUMBERED_STEPS, title, body, terms: TERMS[step], fixedHome: true, target: TARGETS[step], spotlight: Boolean(TARGETS[step]), callout: true, dim: true, placement: 'left',
      // The highlighted control works straight away; Okay is only needed to read first.
      targetInteractive: true,
      celebrate: finished,
      canContinue: complete,
      continueLabel: finished ? 'Back to Home' : step === 'glow' ? 'Turn on the lights' : step === 'photo' ? 'Start the match' : step === 'challenge' ? 'Return to my design' : 'Continue',
      onContinue: finished ? () => options.onFinish ? options.onFinish() : location.assign(new URL(HOME_URL, location.href)) : next,
      secondaryLabel: TARGETS[step] ? 'Show me where' : finished || matching ? 'Try another match' : '',
      // After a match, another reference sits beside returning to the design.
      secondaryWhenComplete: matching,
      onSecondary: finished ? rematch : matching ? () => { if (!busy && !disposed) newTarget(); } : () => { revealControl(); guidance.showTarget?.(); },
      actionLabel: watch ? 'Watch comparison' : lights ? 'Turn off the lights' : matching ? 'Check match' : photo ? 'Save picture' : '',
      // Only the step's required action is primary; demos and saves are optional.
      actionTone: lights || matching ? 'primary' : 'secondary',
      // A watched example gives way to Continue once the learner has done it themselves.
      hideActionWhenComplete: watch || lights || matching,
      actionBusyLabel: watch ? 'Watch…' : matching ? 'Check match' : 'Saving…',
      onAction: watch ? demo : lights ? () => { room(false); return true; } : matching ? check : photo ? async () => {
        try { await studio.capture(); guidance.flashAction?.('Picture saved ✓'); }
        catch { guidance.flashAction?.('Not saved, try again'); }
        return false;
      } : undefined,
    });
  }
  function revealControl() {
    if (creator.dock?.getState?.() === 'closed') creator.setDock?.('open');
    if (step !== 'intro' && project.selection.activeId !== 'gizmobot') project.selection.set(['gizmobot']);
    const field = { color: 'baseColor', roughness: 'roughness', metalness: 'metalness', glow: 'emissive', challenge: 'baseColor' }[step];
    if (field) creator.dock?.inspector?.revealSection?.('appearance', field);
  }

  function enter(nextStep) {
    generation++; step = nextStep; complete = false; best = {}; matchChecked = false;
    closeRgbTip();
    studio.hideReference(); studio.setLightVisible(false);
    if (step !== 'intro') project.selection.set(['gizmobot']);
    roomOn = step !== 'glow'; studio.setRoomLights(roomOn);
    studio.setLightAngle(STATIC_LIGHT_ANGLE);
    if (step === 'challenge') {
      update({ emissiveIntensity: 0 }); newTarget();
    }
    // The emission demo happens in a dark room; starting the design with that
    // glow would silently wash Gizmobot out once the lights return.
    if (step === 'photo') update({ emissiveIntensity: 0 });
    if (step === 'done' && authored) update(authored);
    // Assessment starts from a fixed finish. Undo remains available for the
    // learner's new edits, without restoring properties hidden by this challenge.
    if (step === 'challenge' || step === 'done') project.history.clear();
    baseline = material(); previous = clone(baseline);
    complete = ['photo', 'done'].includes(step);
    capabilities(); show(); controls();
    revealControl();
  }
  function next() {
    if (!complete || busy || disposed || step === 'done') return;
    if (step === 'photo') authored = material();
    enter(ORDER[ORDER.indexOf(step) + 1]);
  }
  function changed() {
    if (disposed || busy) return;
    if (step === 'intro') {
      if (project.selection.activeId === 'gizmobot') achieved();
      else ready(false);
      return;
    }
    const now = material();
    if (step === 'color' && now.color !== baseline.color) achieved();
    if (step === 'challenge' && JSON.stringify(now) !== JSON.stringify(previous)) {
      ready(false);
      if (matchChecked) check();
    }
    const key = { roughness: 'roughness', metalness: 'metalness', glow: 'emissiveIntensity' }[step];
    if (key && now[key] !== previous[key]) {
      const range = best[key] || (best[key] = { min: baseline[key] ?? 0, max: baseline[key] ?? 0 });
      range.min = Math.min(range.min, now[key]); range.max = Math.max(range.max, now[key]);
      if (range.max - range.min >= (step === 'glow' ? .28 : .3)) achieved();
    }
    previous = now;
  }
  function newTarget() {
    target = makeMaterialTarget(options.random); matchChecked = false; ready(false); studio.showReference(target);
    if (matchFeedback) { matchFeedback.hidden = true; matchFeedback.classList.remove('is-pass'); }
    feedback('');
  }
  function renderMatchFeedback(result) {
    feedback(`${result.percentage}% match · ${result.hint}`);
    matchSummary?.classList.toggle('is-pass', result.passed);
    if (!matchFeedback) return;
    matchFeedback.hidden = false;
    matchFeedback.classList.toggle('is-pass', result.passed);
    matchFeedback.querySelector('.material-match-score').textContent = `${result.percentage}% match`;
    for (const [key, score] of Object.entries(result.scores)) {
      const row = matchFeedback.querySelector(`[data-metric="${key}"]`);
      const bar = row.querySelector('.material-match-bar');
      bar.setAttribute('aria-valuenow', String(score));
      bar.style.setProperty('--score', `${score}%`);
      row.querySelector('output').textContent = `${score}%`;
    }
  }
  function check() {
    if (step !== 'challenge') return false;
    matchChecked = true;
    const result = assessMaterial(material(), target);
    renderMatchFeedback(result);
    ready(result.passed); return false;
  }
  async function demo() {
    if (busy || disposed) return false;
    if (!['color', 'roughness', 'metalness'].includes(step)) return false;
    const colorDemo = step === 'color';
    const token = generation, saved = material(); busy = true; ready(false); capabilities(); revealControl(); guidance.acknowledge?.();
    project.beginTransaction('Material comparison');
    const snapshots = step === 'color' ? [{ color: '#3a6fa8' }, { color: '#c0453a' }]
      : step === 'roughness' ? [{ roughness: .06 }, { roughness: .94 }] : [{ metalness: 0 }, { metalness: 1 }];
    try {
      for (const patch of snapshots) {
        if (disposed || generation !== token) break;
        const key = colorDemo ? 'color' : step;
        const selector = colorDemo ? `.appearance-swatch[data-color="${patch.color}"]` : `[data-material-field="${key}"]`;
        const from = colorDemo ? material().color : material()[key];
        const to = colorDemo ? patch.color : patch[key];
        cursor?.point(selector, from); await pause(350);
        if (disposed || generation !== token) break;
        // Color swaps are still comparisons; reduced-motion mode also keeps
        // finish comparisons static.
        if (!reduced && !colorDemo) {
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
      }
    }
    return false;
  }
  const unsubscribe = project.subscribe(changed);
  // Explore RGB is a side note, not a lesson step: a small popup beside the
  // button explains mixing a color while the instruction card stays put.
  let rgbTip = null;
  function outsideRgbTip(event) {
    if (rgbTip && !rgbTip.contains(event.target) && !event.target.closest?.('.appearance-explore-rgb')) closeRgbTip();
  }
  function closeRgbTip() {
    if (!rgbTip) return;
    rgbTip.remove(); rgbTip = null;
    document.removeEventListener('pointerdown', outsideRgbTip, true);
  }
  function exploreRgb() {
    if (step !== 'color' || busy || typeof document === 'undefined') return;
    if (rgbTip) { closeRgbTip(); return; }
    const anchor = document.querySelector('.appearance-explore-rgb');
    rgbTip = document.createElement('div');
    rgbTip.className = 'material-rgb-tip';
    rgbTip.setAttribute('role', 'dialog');
    rgbTip.setAttribute('aria-label', 'Mix your own color');
    rgbTip.innerHTML = `
      <h3>Mix your own color</h3>
      <p>All of the colors on your screen are made by mixing some combination of red, green, and blue light (RGB). Choose “Open color picker” and mix any color you like for Gizmobot.</p>
      <div class="material-rgb-tip-actions"><button type="button" class="is-primary" data-rgb-open>Open color picker</button></div>`;
    rgbTip.querySelector('[data-rgb-open]').addEventListener('click', () => {
      const input = document.querySelector('.color-input');
      closeRgbTip();
      input?.focus();
      try { input?.showPicker(); } catch { input?.click(); }
    });
    rgbTip.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); closeRgbTip(); anchor?.focus(); } });
    document.body.append(rgbTip);
    const rect = anchor?.getBoundingClientRect();
    if (rect) {
      rgbTip.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - rgbTip.offsetWidth - 12))}px`;
      rgbTip.style.top = `${rect.bottom + 10}px`;
    }
    document.addEventListener('pointerdown', outsideRgbTip, true);
    rgbTip.querySelector('[data-rgb-open]').focus();
  }
  dock?.addEventListener('appearanceexplorergb', exploreRgb);
  dock?.addEventListener('appearancelights', freeLights);
  project.selection.clear();
  if (guidance.welcome) {
    capabilities();
    guidance.welcome({
      title: 'Create your own Gizmobot look',
      body: 'A material describes how the surface of a 3D object looks. In this lab you will change Gizmobot’s material one setting at a time: its color, how shiny it is, whether it looks like plastic or metal, and whether it glows in the dark. Then you will design your own look and try matching a reference.\n\nOn some steps, the “Watch comparison” button shows you an example first.',
      terms: ['Gizmobot', 'material'],
      onStart: () => { enter('intro'); document.querySelector('.lesson-guidance-got-it')?.focus(); },
    });
  } else enter('intro');
  return {
    next, demo, check, newTarget, rematch, setRoomLights: room,
    exploreRgb,
    get state() { return { step, complete, busy, roomOn, target: target && clone(target) }; },
    dispose() { disposed = true; generation++; closeRgbTip(); unsubscribe(); cursor?.dispose(); dock?.removeEventListener('appearanceexplorergb', exploreRgb); dock?.removeEventListener('appearancelights', freeLights); sceneControls?.remove(); if (helpButton) helpButton.hidden = oldHelpHidden; studio.dispose(); guidance.destroy(); },
  };
}
