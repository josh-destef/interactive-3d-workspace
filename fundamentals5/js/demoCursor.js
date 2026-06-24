/* ═══════════════════════════════════════════════
   DEMO CURSOR
   The simulated pointer shown during "watch" demos.
═══════════════════════════════════════════════ */
import { V3 } from './utils.js';
import { camera, W, H } from './stage.js';
import { state } from './state.js';
import { getCharacterControlScale, getCharacterCenterWorld } from './character.js';

const curEl = document.getElementById('demo-cursor');

export function updateDemoCursor(x, y, isNDC = true) {
    if (!curEl) return;
    let px = x, py = y;
    if (isNDC) {
        px = (x * 0.5 + 0.5) * W();
        py = (y * -0.5 + 0.5) * H();
    }
    curEl.style.transform = `translate(${px}px, ${py}px)`;
}

export function updateDemoCursor3D(worldPos) {
    if (!camera) return;
    const p = worldPos.clone();
    p.project(camera);
    updateDemoCursor(p.x, p.y);
}

export function toggleDemoCursor(show, mode = 'arrow') {
    if (!curEl) return;
    if (show) {
        curEl.classList.add('on');
        curEl.className = mode === 'scroll' ? 'on scrolling' : 'on';
    } else {
        curEl.classList.remove('on');
        curEl.classList.remove('down');
    }
}

export function setDemoCursorDown(down) {
    if (!curEl) return;
    if (down) curEl.classList.add('down');
    else curEl.classList.remove('down');
}

export function getArrowHeadPos(axisKey) {
    if (!state.character) return V3();
    const factor = getCharacterControlScale();
    const dir = axisKey === 'x' ? V3(1, 0, 0) : axisKey === 'y' ? V3(0, 1, 0) : V3(0, 0, 1);
    return getCharacterCenterWorld().add(dir.multiplyScalar(1.325 * factor));
}
