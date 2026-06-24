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
} from './gizmos.js';

function tog(id, on) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('on', !!on);
}

export function setCaption(step, title, body, prompt = '') {
    const stepEl = document.getElementById('cap-step');
    const titleEl = document.getElementById('cap-title');
    const bodyEl = document.getElementById('cap-body');
    const promptEl = document.getElementById('cap-prompt');

    // fade out
    titleEl.classList.remove('on'); bodyEl.classList.remove('on'); promptEl.classList.remove('on');

    setTimeout(() => {
        stepEl.textContent = step ? `Step ${step} of ${TOTAL_BEATS - 1}` : '';
        titleEl.innerHTML = title || '';
        bodyEl.innerHTML = body || '';
        promptEl.innerHTML = prompt || '';
        stepEl.classList.toggle('on', !!step);
        if (title) titleEl.classList.add('on');
        if (body) bodyEl.classList.add('on');
        if (prompt) promptEl.classList.add('on');
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
        return;
    }
    const isWatch = mode === 'watch';
    if (badgeText) badgeText.textContent = isWatch ? 'Watching' : 'Your Turn';
    badge.className = isWatch ? 'watching on' : 'interacting on';
    if (panel) {
        panel.classList.toggle('panel-watching', isWatch);
        panel.classList.toggle('panel-interacting', !isWatch);
    }
    if (util) util.classList.toggle('on', mode === 'interact');
}

export function showWatch() { setMode('watch'); }
export function hideWatch() { setMode('interact'); }

export function showContinue() { tog('btn-continue', true); tog('kbd-hint', true); }
export function hideContinue() { tog('btn-continue', false); tog('kbd-hint', false); }

export function setProgress(idx) {
    const pct = idx <= 0 ? 0 : (idx / (TOTAL_BEATS - 1)) * 100;
    document.getElementById('prog-fill').style.width = pct + '%';
}

/* free-play tool switch (used by the bottom widget and beat 11) */
export function setFreePlayMode(mode) {
    hideAllArrows();
    scaleHandle.visible = false;
    rotateHandle.visible = false;

    if (mode === 'move') showArrows(['x', 'y', 'z']);
    if (mode === 'scale') { scaleHandle.visible = true; updateScaleHandlePos(); }
    if (mode === 'rotate') { rotateHandle.visible = true; updateRotateHandlePos(); }

    document.querySelectorAll('.fp-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.fp-btn[data-mode="${mode}"]`);
    if (activeBtn) activeBtn.classList.add('active');
}
