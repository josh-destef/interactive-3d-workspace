/* ═══════════════════════════════════════════════
   CONFIG
   Static constants and lesson-wide settings.
═══════════════════════════════════════════════ */
import { V3 } from './utils.js';

/* path to the character model, relative to index.html */
export const GIZMO_URL = '../gizmo.glb';

/* total beats in the lesson (beats 0-11) */
export const TOTAL_BEATS = 12;

/* axis colors — X red, Y green, Z blue (industry convention) */
export const AXIS_COLORS = { x: 0xc0453a, y: 0x2e8b2e, z: 0x3a6fa8 };

/* camera presets */
export const CAMS = {
    front: { pos: V3(0, 2.5, 7), look: V3(0, 1, 0) },
    right: { pos: V3(5, 2.5, 3), look: V3(0, 1, 0) },
    behind: { pos: V3(0, 2.5, -7), look: V3(0, 1, 0) },
    above: { pos: V3(0, 6, 4), look: V3(0, 1, 0) },
    iso: { pos: V3(4, 3.5, 5), look: V3(0, 1, 0) },
};

/* every beat except the intro (beat 0) allows free orbit */
export const isOrbitBeat = (idx) => idx >= 1;

/* touch/trackpad detection for hint text */
export const isTouch = navigator.maxTouchPoints > 0;
export const HINT_ORBIT = isTouch ? 'two fingers to orbit' : 'click and drag to orbit';
export const HINT_ZOOM = isTouch ? 'pinch to zoom' : 'scroll to zoom';
export const HINT_PAN = isTouch ? 'two fingers to pan' : 'right-click or Shift+drag to pan';
