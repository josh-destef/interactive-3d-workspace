/* ═══════════════════════════════════════════════
   DEMO CURSOR
   The simulated pointer shown during "watch" demos.
═══════════════════════════════════════════════ */
import { V3 } from './utils.js';
import { camera, W, H } from './stage.js';
import { state } from './state.js';
import { getCharacterControlScale, getCharacterCenterWorld } from './character.js';
import { ARROW_HEAD_Y } from './gizmos.js';

const curEl = document.getElementById('demo-cursor');

export function updateDemoCursor(x, y, isNDC = true) {
    if (!curEl) return;
    let px, py;
    if (isNDC) {
        px = (x * 0.5 + 0.5) * W();
        py = (y * -0.5 + 0.5) * H();
    } else {
        // non-NDC coords are fractions of the canvas (0..1, y down) - every
        // caller passes those. Treating them as raw pixels (the old behavior)
        // pinned the cursor to the top-left corner during the zoom/pan demos.
        px = x * W();
        py = y * H();
    }
    curEl.style.transform = `translate(${px}px, ${py}px)`;
}

export function updateDemoCursor3D(worldPos) {
    if (!camera) return;
    const p = worldPos.clone();
    p.project(camera);
    updateDemoCursor(p.x, p.y);
}

export function toggleDemoCursor(show) {
    if (!curEl) return;
    // full reset either way so no press/button classes leak between demos
    curEl.className = show ? 'on' : '';
}

/* press feedback: orange glow for left-button drags, green for right (pan) */
export function setDemoCursorDown(down, button = 'left') {
    if (!curEl) return;
    curEl.classList.toggle('down', !!down);
    curEl.classList.toggle('right', !!down && button === 'right');
}

export function getArrowHeadPos(axisKey) {
    if (!state.character) return V3();
    const factor = getCharacterControlScale();
    const dir = axisKey === 'x' ? V3(1, 0, 0) : axisKey === 'y' ? V3(0, 1, 0) : V3(0, 0, 1);
    return getCharacterCenterWorld().add(dir.multiplyScalar(ARROW_HEAD_Y * factor));
}
