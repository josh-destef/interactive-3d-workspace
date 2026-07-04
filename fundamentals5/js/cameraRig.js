/* ═══════════════════════════════════════════════
   CAMERA RIG
   Smooth camera lerping toward presets (used when orbit is
   disabled) plus the scripted arc used in demos.
═══════════════════════════════════════════════ */
import { V3, clamp, lerp } from './utils.js';
import { camera, orbitCtrl } from './stage.js';
import { CAMS } from './config.js';
import { state } from './state.js';
import { animate01 } from './anim.js';
import { updateDemoCursor, setDemoCursorDown } from './demoCursor.js';

/* ── camera lerp state (used when orbit is disabled) ── */
export const camCurP = V3(0, 2.5, 7);
export const camCurL = V3(0, 1, 0);
export const camTgtP = V3(0, 2.5, 7);
export const camTgtL = V3(0, 1, 0);

export function setCam(key, instant = false) {
    const c = CAMS[key];
    camTgtP.copy(c.pos);
    camTgtL.copy(c.look);
    if (instant) {
        camCurP.copy(c.pos); camCurL.copy(c.look);
        camera.position.copy(camCurP);
        camera.lookAt(camCurL);
        orbitCtrl.target.copy(camCurL);
    }
}

export function tickCam(dt) {
    if (orbitCtrl.enabled) { orbitCtrl.update(); return; }
    if (state.camLocked) return; // scripted animation drives camera directly
    const s = clamp(0.03 + dt * 0.9, 0.03, 0.15);
    camCurP.lerp(camTgtP, s);
    camCurL.lerp(camTgtL, s);
    camera.position.copy(camCurP);
    camera.lookAt(camCurL);
    orbitCtrl.target.copy(camCurL);
}

/* scripted camera arc around a point
   Smoothly sweeps camera azimuth from fromAngle to toAngle
   while keeping the same radius and target height. */
export function arcCamera(fromAngle, toAngle, radius, height, lookAt, duration, onDone) {
    const look = lookAt.clone();
    animate01(duration, t => {
        const angle = lerp(fromAngle, toAngle, t);
        camCurP.set(
            look.x + Math.sin(angle) * radius,
            height,
            look.z + Math.cos(angle) * radius
        );
        camCurL.copy(look);
        camera.position.copy(camCurP);
        camera.lookAt(camCurL);

        if (state.beatIdx === 1) {
            // one swift press-drag-release matching the real orbit gesture:
            // a single leftward drag sweeps the camera around
            if (t === 0) setDemoCursorDown(true);
            updateDemoCursor(0.3 - t * 0.65, 0);
            if (t >= 1) setDemoCursorDown(false);
        }
    }, () => {
        camTgtP.copy(camCurP);
        camTgtL.copy(camCurL);
        if (onDone) onDone();
    });
}
