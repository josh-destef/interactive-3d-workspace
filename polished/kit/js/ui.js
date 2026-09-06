/* ═══════════════════════════════════════════════
   UI
   Everything that speaks to the student: the Read card, the Watch / Your turn
   badge, the caption, the progress bar, Continue, Replay, and the two extra
   layers (a choice, a modal).

   THE RULE THIS FILE EXISTS TO ENFORCE

   A step's words are written once and do not change while the student is on
   that step. The Read card introduces the idea; the caption gives the action
   and the thing to notice; the caption then stays put through Watch and
   through Do. Swapping the caption when the demo ends means a student who
   looked away and back is reading something different from what they
   started, and cannot tell whether they missed a step or the app changed its
   mind. Write one caption that is true before, during and after the demo.

   Element ids are the same ones the existing labs use, so this module drops
   into Material Lab and Navigate + Transform markup unchanged. Everything is
   optional: a lab with no Read card simply has no #read-layer, and the
   related functions become no-ops rather than throwing.
═══════════════════════════════════════════════ */

const $ = id => document.getElementById(id);

function tog(id, on) {
    const el = $(id);
    if (el) el.classList.toggle('on', !!on);
}

/* ── configuration ──
   The two things a lab has to tell the kit: how many numbered steps a
   student sees, and how far along each beat is. Everything else is inferred. */
let numberedSteps = 0;
let totalBeats = 0;
let progressMap = null;

export function configureUI({ steps = 0, beats = 0, progress = null } = {}) {
    numberedSteps = steps;
    totalBeats = beats;
    progressMap = progress;
}

/* The element carrying the Watch / Your turn state. The console layout puts it
   on #console (a rule along the top edge); the panel layout puts it on #panel
   (a ring around the card). Detected once, so neither layout needs config. */
function surface() {
    return $('console') || $('panel');
}

function stepLabel(step) {
    if (typeof step === 'number') {
        return numberedSteps ? `Step ${step} of ${numberedSteps}` : `Step ${step}`;
    }
    return step || '';
}

/* ══════════════════════════════════════════════
   CAPTION
   ══════════════════════════════════════════════ */

/* Fade out, swap, fade in. The 150ms gap is what stops a new step's words from
   cross-fading illegibly over the last one's. */
export function setCaption(step, title, body) {
    const stepEl = $('cap-step');
    const titleEl = $('cap-title');
    const bodyEl = $('cap-body');
    if (!titleEl || !bodyEl) return;

    titleEl.classList.remove('on');
    bodyEl.classList.remove('on');

    setTimeout(() => {
        if (stepEl) {
            stepEl.textContent = stepLabel(step);
            stepEl.classList.toggle('on', !!stepLabel(step));
        }
        titleEl.innerHTML = title || '';
        bodyEl.innerHTML = body || '';
        if (title) titleEl.classList.add('on');
        if (body) bodyEl.classList.add('on');
    }, 150);
}

/* ── the floating hint ──
   One line of mono text over the canvas, for a nudge that belongs to the
   viewport rather than to the step. Use sparingly: a hint that repeats the
   caption is one more thing to read. */
export function setHint(text) {
    const el = $('hint');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('on', !!text);
}

export function clearHint() { setHint(''); }

/* ══════════════════════════════════════════════
   THE READ CARD
   The step's words, centered and still, before anything moves.
   ══════════════════════════════════════════════ */
let readAction = null;

const GO_ARROW =
    '<svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true">' +
    '<path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" stroke-width="1.5" ' +
    'stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function showReadCard({ step, title, body, cta }, onGo) {
    const layer = $('read-layer');
    if (!layer) { if (onGo) onGo(); return; }

    const stepEl = $('read-step');
    if (stepEl) {
        stepEl.textContent = stepLabel(step);
        stepEl.style.display = stepLabel(step) ? '' : 'none';
    }
    $('read-title').innerHTML = title || '';
    $('read-body').innerHTML = body || '';
    $('btn-read-go').innerHTML = (cta || 'Watch the demo') + GO_ARROW;

    readAction = onGo;
    layer.classList.add('on');
    // Focus the button so Enter works as well as Space, and so the click
    // target is obvious to anyone driving by keyboard.
    setTimeout(() => $('btn-read-go')?.focus(), 380);
}

export function dismissReadCard() {
    const layer = $('read-layer');
    if (!layer || !layer.classList.contains('on')) return;
    layer.classList.remove('on');
    const go = readAction;
    readAction = null;
    if (go) setTimeout(go, 260);   // let the card clear before the demo starts
}

export function readCardOpen() {
    return !!$('read-layer')?.classList.contains('on');
}

$('btn-read-go')?.addEventListener('click', dismissReadCard);

/* ══════════════════════════════════════════════
   THE CHOICE LAYER
   A fork the lesson offers rather than takes.
   ══════════════════════════════════════════════ */
let choicePrimary = null;
let choiceSecondary = null;

export function showChoice({ title, body, primary, secondary }, onPrimary, onSecondary) {
    const layer = $('choice-layer');
    if (!layer) { if (onPrimary) onPrimary(); return; }

    $('choice-title').textContent = title || '';
    $('choice-body').textContent = body || '';
    $('btn-choice-primary').textContent = primary || 'Yes';
    $('btn-choice-secondary').textContent = secondary || 'No thanks';
    choicePrimary = onPrimary;
    choiceSecondary = onSecondary;
    layer.classList.add('on');
    setTimeout(() => $('btn-choice-primary')?.focus(), 80);
}

function dismissChoice(which) {
    $('choice-layer')?.classList.remove('on');
    const fn = which === 'primary' ? choicePrimary : choiceSecondary;
    choicePrimary = null;
    choiceSecondary = null;
    if (fn) setTimeout(fn, 180);
}

export function choiceOpen() {
    return !!$('choice-layer')?.classList.contains('on');
}

$('btn-choice-primary')?.addEventListener('click', () => dismissChoice('primary'));
$('btn-choice-secondary')?.addEventListener('click', () => dismissChoice('secondary'));

/* ══════════════════════════════════════════════
   WATCH / YOUR TURN
   ══════════════════════════════════════════════ */

/* Whether the current beat ran a demo, so Replay is only offered where there
   is something to replay. Set by showWatch, consumed by hideWatch, cleared by
   setMode(null) at the top of each beat. */
let currentBeatHadWatch = false;

export function setMode(mode) {
    const badge = $('status-badge');
    const surf = surface();
    const util = $('util-bar');

    if (!mode) {
        badge?.classList.remove('on', 'watching', 'interacting');
        surf?.classList.remove('panel-watching', 'panel-interacting');
        util?.classList.remove('on');
        currentBeatHadWatch = false;
        tog('btn-replay', false);
        return;
    }

    const isWatch = mode === 'watch';
    if (badge) {
        const text = badge.querySelector('.badge-text');
        if (text) text.textContent = isWatch ? 'Watch' : 'Your turn';
        badge.className = isWatch ? 'watching on' : 'interacting on';
    }
    surf?.classList.toggle('panel-watching', isWatch);
    surf?.classList.toggle('panel-interacting', !isWatch);
    util?.classList.toggle('on', !isWatch);
}

export function showWatch() {
    currentBeatHadWatch = true;
    tog('btn-replay', false);
    setMode('watch');
    // The real pointer is hidden for the length of a demo, so there is only
    // ever one cursor on screen to follow.
    $('app')?.classList.add('demo-running');
}

export function hideWatch() {
    $('app')?.classList.remove('demo-running');
    setMode('interact');
    if (currentBeatHadWatch) tog('btn-replay', true);
}

/* ══════════════════════════════════════════════
   FOOTER
   ══════════════════════════════════════════════ */
export function showContinue() {
    tog('btn-continue', true);
    tog('kbd-hint', true);
}

export function hideContinue() {
    tog('btn-continue', false);
    tog('kbd-hint', false);
    $('btn-finish')?.classList.remove('on');
    surface()?.classList.remove('panel-celebrate');
    document.querySelectorAll('.panel-offer.on').forEach(el => el.classList.remove('on'));
}

export function continueShowing() {
    return !!$('btn-continue')?.classList.contains('on');
}

/* The Continue button's label is the first text node, so the arrow SVG after
   it survives the change. */
export function setContinueLabel(label = 'Continue') {
    const button = $('btn-continue');
    const first = button?.childNodes[0];
    if (first && first.nodeType === Node.TEXT_NODE) first.nodeValue = label + ' ';
}

export function showFinishButton() {
    $('btn-finish')?.classList.add('on');
}

export function celebrate() {
    surface()?.classList.add('panel-celebrate');
    showFinishButton();
}

/* A take-away offer inside the panel (save a picture, download a file). */
export function showOffer(id = 'panel-offer') { tog(id, true); }

/* ══════════════════════════════════════════════
   PROGRESS
   ══════════════════════════════════════════════ */

/* Pass a `progress` map to configureUI when some beats are optional side
   trips: without it, four optional RGB beats make the bar leap a third of
   the way across for work most students skip. With it, the bar tracks the
   main course and the side trips barely move it. */
export function setProgress(idx) {
    const fill = $('prog-fill');
    if (!fill) return;
    const mapped = progressMap ? progressMap[idx] : undefined;
    const pct = mapped ?? (idx <= 0 || totalBeats < 2 ? 0 : (idx / (totalBeats - 1)) * 100);
    fill.style.width = pct + '%';
}

export function setProgressPercent(pct) {
    const fill = $('prog-fill');
    if (fill) fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
}

/* ══════════════════════════════════════════════
   ATTENTION
   ══════════════════════════════════════════════ */

/* Briefly animate the util bar when a step calls out Reset view. Auto-clears
   so it can be retriggered later in the lesson. */
export function pulseUtilBar() {
    const util = $('util-bar');
    if (!util) return;
    util.classList.remove('callout');
    void util.offsetWidth;               // restart the CSS animation
    util.classList.add('callout');
    setTimeout(() => util.classList.remove('callout'), 3600);
}

/* ══════════════════════════════════════════════
   LAYOUT
   ══════════════════════════════════════════════ */

/* Keep a CSS variable in sync with the step surface's real rendered height.

   Neither the CSS nor the camera can assume a number here: the console grows
   a row every time a control is revealed, and on small screens the panel
   becomes a full-width bar that other chrome has to stack above. `onChange`
   is where a 3D lab lifts its subject clear of the bar.

   Call once from main.js after the DOM is up. */
export function trackSurfaceHeight(onChange) {
    const el = surface();
    if (!el) return;
    const variable = el.id === 'console' ? '--console-h' : '--panel-h';
    const sync = () => {
        const h = el.offsetHeight;
        document.documentElement.style.setProperty(variable, h + 'px');
        if (onChange) onChange(h);
    };
    new ResizeObserver(sync).observe(el);
    sync();
}

/* ══════════════════════════════════════════════
   KEYBOARD
   Space carries the student through Read -> Watch -> Do without them having
   to find a different target at each stage: it dismisses the Read card while
   that is up, and advances the beat otherwise.

   preventDefault also stops Space from re-firing whichever dock button
   happens to still hold focus.
   ══════════════════════════════════════════════ */
export function bindKeyboard(onAdvance) {
    window.addEventListener('keydown', e => {
        if (e.code !== 'Space' && e.code !== 'Enter') return;
        if (readCardOpen()) {
            e.preventDefault();
            dismissReadCard();
            return;
        }
        if (e.code !== 'Space') return;
        if (choiceOpen() || !continueShowing()) return;
        e.preventDefault();
        onAdvance();
    });
}
