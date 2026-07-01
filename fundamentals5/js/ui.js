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

        // keep badge-task in sync; auto-show if already in interact mode
        const taskEl = document.getElementById('badge-task');
        if (taskEl) {
            taskEl.textContent = prompt || '';
            const badge = document.getElementById('status-badge');
            if (badge && badge.classList.contains('interacting')) {
                taskEl.classList.toggle('on', !!prompt);
            }
        }
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
    if (badgeText) badgeText.textContent = isWatch ? 'Watch' : 'Your Turn';
    badge.className = isWatch ? 'watching on' : 'interacting on';
    if (panel) {
        panel.classList.toggle('panel-watching', isWatch);
        panel.classList.toggle('panel-interacting', !isWatch);
    }
    if (util) util.classList.toggle('on', mode === 'interact');

    // show task text under "Your Turn" when interacting
    const taskEl = document.getElementById('badge-task');
    if (taskEl) taskEl.classList.toggle('on', !isWatch && !!taskEl.textContent);
}

export function showWatch() { setMode('watch'); }
export function hideWatch() { setMode('interact'); }

export function showContinue() {
    tog('btn-continue', true);
    tog('kbd-hint', true);
    // task is done — hide the badge task prompt
    const taskEl = document.getElementById('badge-task');
    if (taskEl) taskEl.classList.remove('on');
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

/* ── panel position helpers ── */

export function centerPanel() {
    const panel = document.getElementById('panel');
    panel.style.transition = 'box-shadow .4s ease';
    panel.style.bottom = 'auto';
    panel.style.top = '50%';
    panel.style.left = '50%';
    panel.style.transform = 'translate(-50%, -50%)';
    panel.classList.remove('panel-docked', 'panel-celebrate');
}

export function dockPanel() {
    const panel = document.getElementById('panel');
    const rect = panel.getBoundingClientRect();

    // Freeze at exact current rendered position (no transition)
    panel.style.transition = 'none';
    panel.style.top = 'auto';
    panel.style.bottom = (window.innerHeight - rect.bottom) + 'px';
    panel.style.left = rect.left + 'px';
    panel.style.transform = 'none';

    // Force reflow so the browser registers the starting position
    panel.offsetHeight; // eslint-disable-line no-unused-expressions

    // Spring-animate to docked corner
    panel.style.transition = [
        'left .7s cubic-bezier(.34,1.2,.64,1)',
        'bottom .7s cubic-bezier(.34,1.2,.64,1)',
        'box-shadow .4s ease',
    ].join(',');
    panel.style.left = '24px';
    panel.style.bottom = '24px';
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
