/* ═══════════════════════════════════════════════
   BEAT SYSTEM
   Each beat: sets up scene, runs optional demo, then waits for
   student interaction before showing Continue.
═══════════════════════════════════════════════ */
import { V3, lerp } from './utils.js';
import { camera, orbitCtrl } from './stage.js';
import { TOTAL_BEATS, CAMS, HINT_ORBIT, HINT_ZOOM, HINT_PAN } from './config.js';
import { state } from './state.js';
import { camCurP, camCurL, camTgtL, setCam, arcCamera } from './cameraRig.js';
import { runSequence, clearAnims } from './anim.js';
import {
    arrows, showArrows, hideAllArrows, pulseArrow,
    scaleHandle, rotateHandle, updateScaleHandlePos, updateRotateHandlePos,
} from './gizmos.js';
import { getCharacterCenterWorld, getCharacterControlScale } from './character.js';
import {
    toggleDemoCursor, updateDemoCursor, updateDemoCursor3D,
    setDemoCursorDown, getArrowHeadPos,
} from './demoCursor.js';
import {
    setCaption, setHint, clearHint, setMode,
    showWatch, hideWatch, showContinue, hideContinue,
    setProgress, setFreePlayMode,
} from './ui.js';
import { buildMouseDiagram } from './mouseDiagram.js';

export function runBeat(idx) {
    state.beatIdx = idx;
    state.beatLocked = false;
    hideContinue();
    setMode(null);
    clearAnims(); // clear any leftover animations

    // reset interaction tracking
    state.orbitAccum = 0; state.zoomMin = 999; state.panAccum = 0;
    state.axisDrag = { x: 0, y: 0, z: 0 };
    state.axesUsed = new Set();
    state.scaledUp = false; state.scaledDown = false;

    setProgress(idx);

    switch (idx) {

        /* ─────────────────────────────────────────
           BEAT 0: character appears, slow auto-orbit reveal
           No interaction needed — student just watches.
        ───────────────────────────────────────── */
        case 0:
            orbitCtrl.enabled = false;
            hideAllArrows();
            scaleHandle.visible = false;
            if (state.character) state.character.scale.setScalar(1);

            setCaption('', 'Meet Gizmo',
                'This is a 3D object. It exists in three-dimensional space. You are about to learn how to move around it.');

            setCam('front', true);
            state.camLocked = false;
            state.beatLocked = false;
            setTimeout(() => showContinue(), 800);
            break;

        /* ─────────────────────────────────────────
           BEAT 1: demo orbiting, then student orbits
        ───────────────────────────────────────── */
        case 1: {
            orbitCtrl.enabled = false;
            setCaption(1, 'Orbit', 'Drag to look around Gizmo from any angle.' + buildMouseDiagram('orbit'));
            showWatch();
            state.beatLocked = true;
            state.camLocked = true;
            const b1StartP = camera.position.clone();
            const b1StartL = orbitCtrl.target.clone();
            runSequence([
                {
                    duration: 1.2, fn: t => {
                        camCurP.lerpVectors(b1StartP, CAMS.front.pos, t);
                        camCurL.lerpVectors(b1StartL, CAMS.front.look, t);
                        camera.position.copy(camCurP); camera.lookAt(camCurL);
                    }
                },
                { duration: 0.5, fn: t => { if (t === 0) { toggleDemoCursor(true); updateDemoCursor(0.3, 0); } } }
            ], () => {
                arcCamera(0, Math.PI * 1.5, 6, 2.5, V3(0, 1, 0), 3.5, () => {
                    toggleDemoCursor(false);
                    state.camLocked = false;
                    orbitCtrl.target.copy(V3(0, 1, 0));
                    hideWatch();
                    state.beatLocked = false;
                    orbitCtrl.enabled = true;
                    setCaption(1, 'Orbit', 'Drag to look around Gizmo from any angle.' + buildMouseDiagram('orbit'), 'orbit at least once around');
                });
            });
            break;
        }

        case 2: {
            orbitCtrl.enabled = true;
            setCaption(2, 'Zoom', 'Scroll to zoom in and out. Get close enough to see Gizmo\'s face.' + buildMouseDiagram('zoom'), 'zoom in close');
            showWatch();
            state.beatLocked = true;
            state.camLocked = true;
            toggleDemoCursor(true, 'scroll');
            updateDemoCursor(0.5, 0.5, false);
            const zStart = camera.position.clone();
            const zLook = V3(0, 1, 0);
            const zoomDir = zStart.clone().sub(zLook).normalize();
            runSequence([
                {
                    duration: 1.5, fn: t => {
                        const d = lerp(7, 3.5, t);
                        camera.position.copy(zLook.clone().add(zoomDir.clone().multiplyScalar(d)));
                        camera.lookAt(zLook);
                        camCurP.copy(camera.position); camCurL.copy(zLook);
                    }
                },
                { duration: 0.8, fn: () => { } },
                {
                    duration: 1.5, fn: t => {
                        const d = lerp(3.5, 6, t);
                        camera.position.copy(zLook.clone().add(zoomDir.clone().multiplyScalar(d)));
                        camera.lookAt(zLook);
                        camCurP.copy(camera.position); camCurL.copy(zLook);
                    }
                },
            ], () => {
                toggleDemoCursor(false);
                state.camLocked = false;
                orbitCtrl.update();
                hideWatch();
                state.beatLocked = false;
            });
            break;
        }

        case 3: {
            orbitCtrl.enabled = true;
            setCaption(3, 'Pan', 'Slide the camera sideways or up/down to shift your view.' + buildMouseDiagram('pan'), 'pan the camera');
            showWatch();
            state.beatLocked = true;
            state.camLocked = true;
            const pStartP = camera.position.clone();
            const pStartT = orbitCtrl.target.clone();
            const sideDir = V3(1, 0, 0).applyQuaternion(camera.quaternion).setY(0).normalize();
            runSequence([
                { duration: 0.8, fn: t => { if (t === 0) toggleDemoCursor(true); updateDemoCursor(0.5, 0.5, false); } },
                {
                    duration: 1.5, fn: t => {
                        if (t === 0) setDemoCursorDown(true);
                        const dist = t * 2;
                        camera.position.copy(pStartP.clone().add(sideDir.clone().multiplyScalar(dist)));
                        orbitCtrl.target.copy(pStartT.clone().add(sideDir.clone().multiplyScalar(dist)));
                        updateDemoCursor(0.5 - t * 0.3, 0.5, false);
                    }
                },
                { duration: 0.5, fn: () => { } },
                {
                    duration: 1.5, fn: t => {
                        const dist = 2 - t * 2;
                        camera.position.copy(pStartP.clone().add(sideDir.clone().multiplyScalar(dist)));
                        orbitCtrl.target.copy(pStartT.clone().add(sideDir.clone().multiplyScalar(dist)));
                        updateDemoCursor(0.2 + t * 0.3, 0.5, false);
                    }
                }
            ], () => {
                toggleDemoCursor(false);
                state.camLocked = false;
                orbitCtrl.update();
                hideWatch();
                state.beatLocked = false;
            });
            break;
        }

        case 4:
            orbitCtrl.enabled = true;
            clearHint();
            setMode('interact');
            setCaption(4, 'Look around', 'Take a moment. Orbit, zoom, and pan around. This is your camera. You control exactly how you view the world.');
            showContinue();
            break;

        case 5: {
            orbitCtrl.enabled = true;
            showArrows(['x']);
            setCaption(5, 'Move - Red Arrow', 'The <span class="cx">red arrow</span> controls left and right — the <b>X axis</b>.' + buildMouseDiagram('move-x'), 'drag the red arrow');
            showWatch();
            state.beatLocked = true;
            state.camLocked = true;
            const xOrigin = state.character.position.clone();
            const b5StartP = camera.position.clone();
            const b5StartL = orbitCtrl.target.clone();
            runSequence([
                {
                    duration: 1.5, fn: t => {
                        camCurP.lerpVectors(b5StartP, CAMS.iso.pos, t);
                        camCurL.lerpVectors(b5StartL, CAMS.iso.look, t);
                        camera.position.copy(camCurP); camera.lookAt(camCurL);
                        orbitCtrl.target.copy(camCurL);
                    }
                },
                { duration: 0.5, fn: t => { if (t === 0) { toggleDemoCursor(true); setDemoCursorDown(false); } updateDemoCursor3D(getArrowHeadPos('x')); } },
                {
                    duration: 1.2, fn: t => {
                        if (t === 0) setDemoCursorDown(true);
                        state.character.position.x = xOrigin.x + t * 2;
                        updateDemoCursor3D(getArrowHeadPos('x'));
                    }
                },
                { duration: 0.6, fn: t => { if (t === 0) setDemoCursorDown(false); pulseArrow(arrows.xPos); } },
                {
                    duration: 1.2, fn: t => {
                        if (t === 0) setDemoCursorDown(true);
                        state.character.position.x = xOrigin.x + 2 - t * 2;
                        updateDemoCursor3D(getArrowHeadPos('x'));
                    }
                },
            ], () => {
                toggleDemoCursor(false);
                state.character.position.x = xOrigin.x;
                state.camLocked = false;
                orbitCtrl.enabled = true;
                hideWatch();
                state.beatLocked = false;
            });
            break;
        }

        case 6: {
            orbitCtrl.enabled = true;
            showArrows(['x', 'y']);
            setCaption(6, 'Move - Green Arrow', 'The <span class="cy">green arrow</span> controls up and down — the <b>Y axis</b>.' + buildMouseDiagram('move-y'), 'drag the green arrow');
            showWatch();
            state.beatLocked = true;
            state.camLocked = true;
            const yOrigin = state.character.position.clone();
            runSequence([
                { duration: 0.5, fn: t => { if (t === 0) { toggleDemoCursor(true); setDemoCursorDown(false); } updateDemoCursor3D(getArrowHeadPos('y')); } },
                {
                    duration: 1.2, fn: t => {
                        if (t === 0) setDemoCursorDown(true);
                        state.character.position.y = yOrigin.y + t * 1.5;
                        updateDemoCursor3D(getArrowHeadPos('y'));
                    }
                },
                { duration: 0.7, fn: t => { if (t === 0) setDemoCursorDown(false); } },
                {
                    duration: 1.2, fn: t => {
                        if (t === 0) setDemoCursorDown(true);
                        state.character.position.y = yOrigin.y + 1.5 - t * 1.5;
                        updateDemoCursor3D(getArrowHeadPos('y'));
                    }
                },
            ], () => {
                toggleDemoCursor(false);
                state.character.position.y = yOrigin.y;
                state.camLocked = false;
                hideWatch();
                state.beatLocked = false;
            });
            break;
        }

        case 7: {
            orbitCtrl.enabled = true;
            showArrows(['x', 'y', 'z']);
            setCaption(7, 'Move - Blue Arrow', 'The <span class="cz">blue arrow</span> controls forward and back — the <b>Z axis</b>.' + buildMouseDiagram('move-z'), 'drag the blue arrow');
            showWatch();
            state.beatLocked = true;
            state.camLocked = true;
            const zOrigin = state.character.position.clone();
            runSequence([
                { duration: 0.5, fn: t => { if (t === 0) { toggleDemoCursor(true); setDemoCursorDown(false); } updateDemoCursor3D(getArrowHeadPos('z')); } },
                {
                    duration: 1.2, fn: t => {
                        if (t === 0) setDemoCursorDown(true);
                        state.character.position.z = zOrigin.z + t * 2;
                        updateDemoCursor3D(getArrowHeadPos('z'));
                    }
                },
                { duration: 0.7, fn: t => { if (t === 0) setDemoCursorDown(false); } },
                {
                    duration: 1.2, fn: t => {
                        if (t === 0) setDemoCursorDown(true);
                        state.character.position.z = zOrigin.z + 2 - t * 2;
                        updateDemoCursor3D(getArrowHeadPos('z'));
                    }
                },
            ], () => {
                toggleDemoCursor(false);
                state.character.position.z = zOrigin.z;
                state.camLocked = false;
                hideWatch();
                state.beatLocked = false;
            });
            break;
        }

        case 8:
            orbitCtrl.enabled = true;
            showArrows(['x', 'y', 'z']);
            clearHint();
            setMode('interact');
            setCaption(8, 'Move Gizmo anywhere', 'Use any arrow to move it. Orbit to see where it ends up.' + buildMouseDiagram('move-any'), 'use at least 2 different axes');
            break;

        case 9: {
            orbitCtrl.enabled = true;
            hideAllArrows();
            if (state.character) state.character.scale.setScalar(1);
            scaleHandle.visible = true;
            updateScaleHandlePos();
            setCaption(9, 'Scale', 'The <span class="co">scale tool</span> controls size. Drag up to grow, down to shrink.' + buildMouseDiagram('scale'), 'drag scale up and down');
            showWatch();
            state.beatLocked = true;
            runSequence([
                { duration: 0.5, fn: t => { if (t === 0) { toggleDemoCursor(true); setDemoCursorDown(false); } updateScaleHandlePos(); updateDemoCursor3D(scaleHandle.position); } },
                {
                    duration: 1.5, fn: t => {
                        if (t === 0) setDemoCursorDown(true);
                        if (state.character) state.character.scale.setScalar(lerp(1.0, 1.8, t));
                        updateScaleHandlePos();
                        updateDemoCursor3D(scaleHandle.position);
                    }
                },
                { duration: 0.8, fn: t => { if (t === 0) setDemoCursorDown(false); updateScaleHandlePos(); updateDemoCursor3D(scaleHandle.position); } },
                {
                    duration: 1.5, fn: t => {
                        if (t === 0) setDemoCursorDown(true);
                        if (state.character) state.character.scale.setScalar(lerp(1.8, 0.6, t));
                        updateScaleHandlePos();
                        updateDemoCursor3D(scaleHandle.position);
                    }
                },
                { duration: 0.8, fn: t => { if (t === 0) setDemoCursorDown(false); updateScaleHandlePos(); updateDemoCursor3D(scaleHandle.position); } },
                {
                    duration: 1.0, fn: t => {
                        if (t === 0) setDemoCursorDown(true);
                        if (state.character) state.character.scale.setScalar(lerp(0.6, 1.0, t));
                        updateScaleHandlePos();
                        updateDemoCursor3D(scaleHandle.position);
                    }
                },
            ], () => {
                toggleDemoCursor(false);
                if (state.character) state.character.scale.setScalar(1);
                hideWatch();
                state.beatLocked = false;
            });
            break;
        }

        case 10: {
            orbitCtrl.enabled = true;
            hideAllArrows();
            scaleHandle.visible = false;
            rotateHandle.visible = true;
            if (state.character) state.character.rotation.set(0, 0, 0);
            updateRotateHandlePos();
            setCaption(10, 'Rotate', 'The <span class="co">rotate tool</span> controls orientation. Drag any ring to spin Gizmo.' + buildMouseDiagram('rotate'), 'drag any rotation ring');
            showWatch();
            state.beatLocked = true;
            const rotRadius = 0.75 * getCharacterControlScale();
            runSequence([
                { duration: 0.5, fn: t => { if (t === 0) { toggleDemoCursor(true); setDemoCursorDown(false); } updateRotateHandlePos(); const p = getCharacterCenterWorld(); p.z += rotRadius; updateDemoCursor3D(p); } },
                {
                    duration: 1.5, fn: t => {
                        if (t === 0) setDemoCursorDown(true);
                        if (state.character) state.character.rotation.y = lerp(0, Math.PI, t);
                        updateRotateHandlePos();
                        const p = getCharacterCenterWorld(); p.z += Math.cos(Math.PI * t) * rotRadius; p.x += Math.sin(Math.PI * t) * rotRadius; updateDemoCursor3D(p);
                    }
                },
                { duration: 0.8, fn: t => { if (t === 0) setDemoCursorDown(false); updateRotateHandlePos(); } },
                {
                    duration: 1.5, fn: t => {
                        if (t === 0) setDemoCursorDown(true);
                        if (state.character) state.character.rotation.y = lerp(Math.PI, 0, t);
                        updateRotateHandlePos();
                        const p = getCharacterCenterWorld(); p.z += Math.cos(Math.PI * (1 - t)) * rotRadius; p.x += Math.sin(Math.PI * (1 - t)) * rotRadius; updateDemoCursor3D(p);
                    }
                },
            ], () => {
                toggleDemoCursor(false);
                if (state.character) state.character.rotation.set(0, 0, 0);
                hideWatch();
                state.beatLocked = false;
            });
            break;
        }

        case 11:
            orbitCtrl.enabled = true;
            orbitCtrl.target.copy(camTgtL);
            orbitCtrl.update();
            clearHint();
            setMode('interact');
            setCaption('', 'You can navigate 3D space', 'Orbit to look around. Zoom to get close. Pan to shift your view. Move on X, Y, and Z. Scale to resize. And rotate to turn. These are the fundamental tools in every 3D software.');
            document.getElementById('free-play-widget').style.display = 'flex';
            setFreePlayMode('move');
            break;
    }
}

/* ═══════════════════════════════════════════════
   BEAT COMPLETION CHECKS
   Called whenever relevant interaction happens.
   Shows Continue when the beat's goal is met.
═══════════════════════════════════════════════ */
export function checkBeatComplete() {
    if (state.beatLocked) return;
    if (document.getElementById('btn-continue').classList.contains('on')) return; // already unlocked

    switch (state.beatIdx) {
        case 1: if (state.orbitAccum > 120) { clearHint(); showContinue(); } break;
        case 2: if (state.zoomMin < 4) { clearHint(); showContinue(); } break;
        case 3: if (state.panAccum > 50) { clearHint(); showContinue(); } break;
        case 5: if (state.axisDrag.x > 1.0) { showContinue(); } break;
        case 6: if (state.axisDrag.y > 1.0) { showContinue(); } break;
        case 7: if (state.axisDrag.z > 1.0) { showContinue(); } break;
        case 8: if (state.axesUsed.size >= 2) { showContinue(); } break;
        case 9: if (state.scaledUp && state.scaledDown) { showContinue(); } break;
        case 10: if (state.rotatedAxis.size > 0) { showContinue(); } break;
    }
}

/* ═══════════════════════════════════════════════
   NEXT BEAT
   Called by Continue button and keyboard shortcut.
═══════════════════════════════════════════════ */
export function nextBeat() {
    if (state.beatLocked) return;
    if (state.beatIdx < TOTAL_BEATS - 1) runBeat(state.beatIdx + 1);
}
