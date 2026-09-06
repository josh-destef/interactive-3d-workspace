/* ═══════════════════════════════════════════════
   UI HELPERS
   The Read card, the Watch/Your Turn badge, the caption panel, the progress
   bar, Continue and Replay.

   The lesson's pacing is Read -> Watch -> Do, and this file owns the first two
   thirds of it. A demo that starts the instant a step arrives is a demo nobody
   reads the setup for, so every step with a demo puts its words in the middle
   of the screen first and waits to be dismissed. The same words then stay in
   the console for the whole step - they are never swapped out between watching
   and doing, so a student who looks away and back is never reading something
   different in meaning from what they started.
═══════════════════════════════════════════════ */
import { NUMBERED_STEPS, TOTAL_BEATS } from './config.js';

function tog(id, on) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('on', !!on);
}

/* Whether the current beat ran a demo, so Replay is only offered where there is
   something to replay. Set by showWatch, consumed by hideWatch, cleared on
   setMode(null) at the top of each beat. */
let currentBeatHadWatch = false;

/* ── caption ── */

export function setCaption(step, title, body) {
    const stepEl = document.getElementById('cap-step');
    const titleEl = document.getElementById('cap-title');
    const bodyEl = document.getElementById('cap-body');

    titleEl.classList.remove('on');
    bodyEl.classList.remove('on');

    setTimeout(() => {
        stepEl.textContent = typeof step === 'number'
            ? 'Step ' + step + ' of ' + NUMBERED_STEPS
            : (step || '');
        titleEl.innerHTML = title || '';
        bodyEl.innerHTML = body || '';
        stepEl.classList.toggle('on', !!step);
        if (title) titleEl.classList.add('on');
        if (body) bodyEl.classList.add('on');
    }, 150);
}

/* ── the Read card ──
   The card introduces the idea while the shorter console caption gives the
   action. Nothing moves until the student says they are ready. */

const readLayer = document.getElementById('read-layer');
let readAction = null;

export function showReadCard({ step, title, body, cta }, onGo) {
    document.getElementById('read-step').textContent = typeof step === 'number'
        ? 'Step ' + step + ' of ' + NUMBERED_STEPS
        : (step || '');
    document.getElementById('read-step').style.display = step ? '' : 'none';
    document.getElementById('read-title').innerHTML = title || '';
    document.getElementById('read-body').innerHTML = body || '';
    document.getElementById('btn-read-go').innerHTML =
        (cta || 'Watch the demo') +
        '<svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true">' +
        '<path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" stroke-width="1.5" ' +
        'stroke-linecap="round" stroke-linejoin="round"/></svg>';
    readAction = onGo;
    readLayer.classList.add('on');
    // Focus the button so Enter works as well as Space and the click target is
    // obvious to anyone driving by keyboard.
    setTimeout(() => document.getElementById('btn-read-go').focus(), 380);
}

export function dismissReadCard() {
    if (!readLayer.classList.contains('on')) return;
    readLayer.classList.remove('on');
    const go = readAction;
    readAction = null;
    if (go) setTimeout(go, 260);   // let the card clear before the demo starts
}

export function readCardOpen() {
    return readLayer.classList.contains('on');
}

document.getElementById('btn-read-go').addEventListener('click', dismissReadCard);

/* ── Watch / Your Turn ── */

export function setMode(mode) {
    const badge = document.getElementById('status-badge');
    const badgeText = badge.querySelector('.badge-text');
    const panel = document.getElementById('console');
    if (!mode) {
        badge.classList.remove('on', 'watching', 'interacting');
        panel.classList.remove('panel-watching', 'panel-interacting');
        currentBeatHadWatch = false;
        tog('btn-replay', false);
        return;
    }
    const isWatch = mode === 'watch';
    if (badgeText) badgeText.textContent = isWatch ? 'Watch' : 'Your turn';
    badge.className = isWatch ? 'watching on' : 'interacting on';
    panel.classList.toggle('panel-watching', isWatch);
    panel.classList.toggle('panel-interacting', !isWatch);
}

export function showWatch() {
    currentBeatHadWatch = true;
    tog('btn-replay', false);
    setMode('watch');
    // The real pointer is hidden for the length of a demo so there is only ever
    // one cursor on screen to follow.
    document.getElementById('app').classList.add('demo-running');
}

export function hideWatch() {
    document.getElementById('app').classList.remove('demo-running');
    setMode('interact');
    if (currentBeatHadWatch) tog('btn-replay', true);
}

/* ── footer ── */

export function showContinue() {
    tog('btn-continue', true);
    tog('kbd-hint', true);
}

export function hideContinue() {
    tog('btn-continue', false);
    tog('kbd-hint', false);
    const fin = document.getElementById('btn-finish');
    if (fin) fin.classList.remove('on');
    document.getElementById('console').classList.remove('panel-celebrate');
}

export function setProgress(idx) {
    const pct = idx <= 0 ? 0 : (idx / (TOTAL_BEATS - 1)) * 100;
    document.getElementById('prog-fill').style.width = pct + '%';
}

export function showFinishButton() {
    const fin = document.getElementById('btn-finish');
    if (fin) fin.classList.add('on');
}
