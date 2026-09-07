/* ═══════════════════════════════════════════════
   UI HELPERS
   Captions, hints, mode badge, progress bar, and the
   free-play tool switcher.
═══════════════════════════════════════════════ */
import { TOTAL_BEATS } from './config.js';
import {
    hideAllArrows, showArrows,
    scaleHandle, rotateHandle,
    updateScaleHandlePos, updateRotateHandlePos,
    showScaleAxes, hideScaleAxes, updateScaleAxisPos,
} from './gizmos.js';

function tog(id, on) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('on', !!on);
}

/* Tracks whether the current beat ran a "watch" demo, so the Replay button is
   only offered on beats that actually have something to replay. Set when the
   demo starts (showWatch) and consumed when the student's turn begins
   (hideWatch); reset whenever a new beat clears the mode (setMode(null)). */
let currentBeatHadWatch = false;

export function showReplay() { tog('btn-replay', true); }
export function hideReplay() { tog('btn-replay', false); }

export function setCaption(step, title, body) {
    const stepEl = document.getElementById('cap-step');
    const titleEl = document.getElementById('cap-title');
    const bodyEl = document.getElementById('cap-body');

    // fade out
    titleEl.classList.remove('on'); bodyEl.classList.remove('on');

    setTimeout(() => {
        stepEl.textContent = step ? `Step ${step} of ${TOTAL_BEATS - 1}` : '';
        titleEl.innerHTML = title || '';
        bodyEl.innerHTML = body || '';
        stepEl.classList.toggle('on', !!step);
        if (title) titleEl.classList.add('on');
        if (body) bodyEl.classList.add('on');
    }, 150);
}

export function setHint(txt) {
    const el = document.getElementById('hint');
    el.textContent = txt;
    el.classList.toggle('on', !!txt);
}

export function clearHint() {
    document.getElementById('hint').classList.remove('on');
}

export function setMode(mode) {
    const badge = document.getElementById('status-badge');
    const badgeText = badge.querySelector('.badge-text');
    const panel = document.getElementById('panel');
    const util = document.getElementById('util-bar');
    if (!mode) {
        badge.classList.remove('on', 'watching', 'interacting');
        if (util) util.classList.remove('on');
        if (panel) panel.classList.remove('panel-watching', 'panel-interacting');
        // fresh beat: forget any prior demo and hide the replay button until a
        // new demo runs
        currentBeatHadWatch = false;
        hideReplay();
        return;
    }
    const isWatch = mode === 'watch';
    if (badgeText) badgeText.textContent = isWatch ? 'Watch' : 'Your Turn';
    badge.className = isWatch ? 'watching on' : 'interacting on';
    if (panel) {
        panel.classList.toggle('panel-watching', isWatch);
        panel.classList.toggle('panel-interacting', !isWatch);
    }
    if (util) util.classList.toggle('on', mode === 'interact');
}

export function showWatch() { currentBeatHadWatch = true; hideReplay(); setMode('watch'); }
export function hideWatch() {
    setMode('interact');
    // demo just finished → let the student replay it if they missed something
    if (currentBeatHadWatch) showReplay();
}

export function showContinue() {
    tog('btn-continue', true);
    tog('kbd-hint', true);
}
export function hideContinue() {
    tog('btn-continue', false);
    tog('kbd-hint', false);
    const fin = document.getElementById('btn-finish');
    if (fin) fin.classList.remove('on');
    const panel = document.getElementById('panel');
    if (panel) panel.classList.remove('panel-celebrate');
}

export function setProgress(idx) {
    const pct = idx <= 0 ? 0 : (idx / (TOTAL_BEATS - 1)) * 100;
    document.getElementById('prog-fill').style.width = pct + '%';
}

/* ── panel position helpers ──
   The panel is now permanently docked in the bottom-left corner via CSS and is
   not draggable, so these are no-ops kept only so existing call sites (and any
   future ones) stay valid. */

export function centerPanel() { /* panel is fixed-docked - nothing to do */ }

export function dockPanel() { /* panel is fixed-docked - nothing to do */ }

/* Briefly animate the Reset View / Reset Gizmo buttons to draw attention when a
   beat calls them out. Auto-clears so it can be retriggered later. */
export function pulseUtilBar() {
    const util = document.getElementById('util-bar');
    if (!util) return;
    util.classList.remove('callout');
    void util.offsetWidth; // restart the CSS animation
    util.classList.add('callout');
    setTimeout(() => util.classList.remove('callout'), 3600);
}

/* ── celebration helpers ── */

export function showFinishButton() {
    const fin = document.getElementById('btn-finish');
    if (fin) fin.classList.add('on');
}

export function hideFinishButton() {
    const fin = document.getElementById('btn-finish');
    if (fin) fin.classList.remove('on');
}


/* ── free-play tool switch (used by the bottom widget and beat 12) ── */
export function setFreePlayMode(mode) {
    hideAllArrows();
    scaleHandle.visible = false;
    rotateHandle.visible = false;
    hideScaleAxes();

    if (mode === 'move') showArrows(['x', 'y', 'z']);
    if (mode === 'scale') {
        scaleHandle.visible = true; updateScaleHandlePos();
        showScaleAxes(); updateScaleAxisPos();
    }
    if (mode === 'rotate') { rotateHandle.visible = true; updateRotateHandlePos(); }

    document.querySelectorAll('.fp-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.fp-btn[data-mode="${mode}"]`);
    if (activeBtn) activeBtn.classList.add('active');
}
