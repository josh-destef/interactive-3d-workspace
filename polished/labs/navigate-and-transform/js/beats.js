/* ═══════════════════════════════════════════════
   BEAT SYSTEM
   Each beat: sets up scene, runs optional demo, then waits for
   student interaction before showing Continue.
═══════════════════════════════════════════════ */
import * as THREE from 'three';
import { V3, lerp } from './utils.js';
import { camera, orbitCtrl } from './stage.js';
import { TOTAL_BEATS, CAMS } from './config.js';
import { state } from './state.js';
import { camCurP, camCurL, camTgtL, setCam, arcCamera } from './cameraRig.js';
import { runSequence, clearAnims } from './anim.js';
import {
    arrows, showArrows, hideAllArrows, pulseArrow,
    scaleHandle, rotateHandle, updateScaleHandlePos, updateRotateHandlePos,
    showScaleAxes, hideScaleAxes, updateScaleAxisPos, getScaleRingEdgeWorld,
} from './gizmos.js';
import { getCharacterCenterWorld, getCharacterControlScale, characterHomePosition } from './character.js';
import {
    toggleDemoCursor, updateDemoCursor, updateDemoCursor3D,
    setDemoCursorDown, getArrowHeadPos,
} from './demoCursor.js';
import {
    setCaption, clearHint, setMode,
    showWatch, hideWatch, showContinue, hideContinue,
    setProgress, setFreePlayMode,
    dockPanel, showFinishButton, pulseUtilBar,
} from './ui.js';
import { buildMouseDiagram } from './mouseDiagram.js';

/* A runSequence step that eases the camera from wherever it is to a preset, so
   every "Watch" demo opens from a framing that shows the tool clearly. Requires
   orbit already disabled and state.camLocked = true (set at the top of the beat)
   so nothing fights the scripted move.

   If the camera is already close to the preset (common - e.g. Move Y/Z right
   after Move X already framed to iso), it snaps instantly instead of adding a
   pointless slow sweep that reads as lag. Real sweeps are capped short. */
function camMoveStep(presetKey, duration = 0.6) {
    const cam = CAMS[presetKey];
    const alreadyFramed = camera.position.distanceTo(cam.pos) < 0.75;
    const dur = alreadyFramed ? 0.001 : Math.min(duration, 0.6);
    let startP = null, startL = null;
    return {
        duration: dur, fn: t => {
            if (t === 0 || !startP) {
                startP = camera.position.clone();
                startL = orbitCtrl.target.clone();
            }
            camCurP.lerpVectors(startP, cam.pos, t);
            camCurL.lerpVectors(startL, cam.look, t);
            camera.position.copy(camCurP);
            camera.lookAt(camCurL);
            orbitCtrl.target.copy(camCurL);
        },
    };
}

/* Hand camera control back to the student once a Watch demo finishes: re-enable
   free orbit around the tool's look point. */
function releaseCameraToOrbit(lookKey = 'iso') {
    orbitCtrl.target.copy(CAMS[lookKey].look);
    state.camLocked = false;
    orbitCtrl.enabled = true;
    orbitCtrl.update();
}

export function runBeat(idx) {
    state.beatIdx = idx;
    state.beatLocked = false;
    hideContinue();
    setMode(null);
    clearAnims(); // clear any leftover animations

    // reset interaction tracking
    state.orbitAccum = 0; state.zoomMin = 999; state.zoomed = false; state.panAccum = 0;
    state.axisDrag = { x: 0, y: 0, z: 0 };
    state.axesUsed = new Set();
    state.axisScaleUsed = new Set();
    state.rotatedAxis = new Set();
    state.scaledUp = false; state.scaledDown = false;
    hideScaleAxes();

    setProgress(idx);

    switch (idx) {

        /* ─────────────────────────────────────────
           BEAT 0: character appears, slow auto-orbit reveal
           No interaction needed - student just watches.
        ───────────────────────────────────────── */
        case 0:
            orbitCtrl.enabled = false;
            hideAllArrows();
            scaleHandle.visible = false;
            if (state.character) state.character.scale.setScalar(1);

            setCaption('', 'Meet Gizmobot!',
                'This is Gizmobot, a 3D object. Unlike a flat picture, Gizmobot has depth: you can look at it from the front, the side, behind, anywhere. Let\'s learn how.');

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
            dockPanel();
            setCaption(1, 'Orbit', 'Orbiting circles your camera around Gizmobot, like walking around a statue. <b>Drag to orbit around Gizmobot.</b>' + buildMouseDiagram('orbit'));
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
                arcCamera(0, Math.PI * 1.5, 6, 2.5, V3(0, 1, 0), 2.2, () => {
                    toggleDemoCursor(false);
                    state.camLocked = false;
                    orbitCtrl.target.copy(V3(0, 1, 0));
                    hideWatch();
                    state.beatLocked = false;
                    orbitCtrl.enabled = true;
                });
            });
            break;
        }

        case 2: {
            orbitCtrl.enabled = false; // no orbit/zoom/pan while watching
            setCaption(2, 'Zoom', '<b>Scroll to zoom in and out.</b> Move closer to Gizmobot, then back away.' + buildMouseDiagram('zoom'));
            showWatch();
            state.beatLocked = true;
            state.camLocked = true;
            // no demo cursor here - the zoom gesture is a scroll, shown by the
            // mouse diagram in the instructions; the camera motion tells the rest
            const zStart = CAMS.front.pos.clone();
            const zLook = CAMS.front.look.clone();
            const zoomDir = zStart.clone().sub(zLook).normalize();
            runSequence([
                camMoveStep('front', 0.8), // settle to a clean front view first
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
                releaseCameraToOrbit('front');
                hideWatch();
                state.beatLocked = false;
            });
            break;
        }

        case 3: {
            orbitCtrl.enabled = false; // no orbit/zoom/pan while watching
            setCaption(3, 'Pan', 'Panning slides your view sideways or up and down, like stepping to the side instead of turning your head. <b>Hold right-click and drag to pan the camera.</b>' + buildMouseDiagram('pan'));
            showWatch();
            state.beatLocked = true;
            state.camLocked = true;
            const pStartP = CAMS.front.pos.clone();
            const pStartT = CAMS.front.look.clone();
            // Pan the camera screen-LEFT so Gizmobot appears to slide right, into
            // the open half of the screen (panning right would hide him behind
            // the docked info panel).
            const sideDir = V3(-1, 0, 0);
            runSequence([
                camMoveStep('front', 0.8), // settle to a clean front view first
                { duration: 0.8, fn: t => { if (t === 0) toggleDemoCursor(true); updateDemoCursor(0.5, 0.5, false); } },
                {
                    duration: 1.5, fn: t => {
                        if (t === 0) setDemoCursorDown(true, 'right'); // pan = right-drag → green glow
                        const dist = t * 2;
                        camera.position.copy(pStartP.clone().add(sideDir.clone().multiplyScalar(dist)));
                        orbitCtrl.target.copy(pStartT.clone().add(sideDir.clone().multiplyScalar(dist)));
                        // cursor drags right - the gesture that slides the view this way
                        updateDemoCursor(0.5 + t * 0.3, 0.5, false);
                    }
                },
                { duration: 0.5, fn: () => { } },
                {
                    duration: 1.5, fn: t => {
                        const dist = 2 - t * 2;
                        camera.position.copy(pStartP.clone().add(sideDir.clone().multiplyScalar(dist)));
                        orbitCtrl.target.copy(pStartT.clone().add(sideDir.clone().multiplyScalar(dist)));
                        updateDemoCursor(0.8 - t * 0.3, 0.5, false);
                    }
                }
            ], () => {
                toggleDemoCursor(false);
                releaseCameraToOrbit('front');
                hideWatch();
                state.beatLocked = false;
            });
            break;
        }

        case 4:
            orbitCtrl.enabled = true;
            clearHint();
            setMode('interact');
            setCaption(4, 'Look around', 'Take a moment. Orbit, zoom, and pan around. Notice that Gizmobot never moves; only your camera does. You control exactly how you view the world.');
            showContinue();
            break;

        case 5: {
            orbitCtrl.enabled = false; // no orbit/zoom/pan while watching
            showArrows(['x']);
            setCaption(5, 'Move - Red Arrow', '<b>Drag the <span class="cx">red arrow</span> to slide Gizmobot left and right.</b> In 3D, this direction is called the X axis.' + buildMouseDiagram('move-x'));
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
            orbitCtrl.enabled = false; // no orbit/zoom/pan while watching
            showArrows(['x', 'y']);
            setCaption(6, 'Move - Green Arrow', '<b>Drag the <span class="cy">green arrow</span> to lift Gizmobot up and down.</b> This direction is the Y axis.' + buildMouseDiagram('move-y'));
            showWatch();
            state.beatLocked = true;
            state.camLocked = true;
            const yOrigin = state.character.position.clone();
            runSequence([
                camMoveStep('iso', 0.7), // frame the tool before the demo
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
                releaseCameraToOrbit('iso');
                hideWatch();
                state.beatLocked = false;
            });
            break;
        }

        case 7: {
            orbitCtrl.enabled = false; // no orbit/zoom/pan while watching
            showArrows(['x', 'y', 'z']);
            setCaption(7, 'Move - Blue Arrow', '<b>Drag the <span class="cz">blue arrow</span> to slide Gizmobot closer and farther away.</b> This direction is the Z axis.' + buildMouseDiagram('move-z'));
            showWatch();
            state.beatLocked = true;
            state.camLocked = true;
            const zOrigin = state.character.position.clone();
            runSequence([
                camMoveStep('iso', 0.7), // frame the tool before the demo
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
                releaseCameraToOrbit('iso');
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
            setCaption(8, 'Move Gizmobot anywhere',
                '<b>Move Gizmobot using at least two different arrows.</b> Orbit to see where it ends up.<br><span class="cap-tip">Lost Gizmobot or left it at an awkward angle? Use <b>Reset View</b> or <b>Reset Gizmobot</b> in the bottom-right corner anytime.</span>' + buildMouseDiagram('move-any'));
            pulseUtilBar(); // flash the reset buttons so students notice them
            break;

        case 9: {
            orbitCtrl.enabled = false; // no orbit/zoom/pan while watching
            hideAllArrows();
            if (state.character) { state.character.scale.setScalar(1); state.character.position.copy(characterHomePosition); }
            scaleHandle.visible = true;
            updateScaleHandlePos();
            setCaption(9, 'Scale', 'The <span class="co">scale tool</span> controls size. <b>Grab the <span class="co">outer ring</span> and drag outward to grow Gizmobot, then inward to shrink it.</b>' + buildMouseDiagram('scale'));
            showWatch();
            state.beatLocked = true;
            state.camLocked = true;
            runSequence([
                camMoveStep('front', 0.8), // frame the tool before the demo
                { duration: 0.5, fn: t => { if (t === 0) { toggleDemoCursor(true); setDemoCursorDown(false); } updateScaleHandlePos(); updateDemoCursor3D(getScaleRingEdgeWorld()); } },
                {
                    duration: 1.5, fn: t => {
                        if (t === 0) setDemoCursorDown(true);
                        if (state.character) state.character.scale.setScalar(lerp(1.0, 1.8, t));
                        updateScaleHandlePos();
                        updateDemoCursor3D(getScaleRingEdgeWorld());
                    }
                },
                { duration: 0.8, fn: t => { if (t === 0) setDemoCursorDown(false); updateScaleHandlePos(); updateDemoCursor3D(getScaleRingEdgeWorld()); } },
                {
                    duration: 1.5, fn: t => {
                        if (t === 0) setDemoCursorDown(true);
                        if (state.character) state.character.scale.setScalar(lerp(1.8, 0.6, t));
                        updateScaleHandlePos();
                        updateDemoCursor3D(getScaleRingEdgeWorld());
                    }
                },
                { duration: 0.8, fn: t => { if (t === 0) setDemoCursorDown(false); updateScaleHandlePos(); updateDemoCursor3D(getScaleRingEdgeWorld()); } },
                {
                    duration: 1.0, fn: t => {
                        if (t === 0) setDemoCursorDown(true);
                        if (state.character) state.character.scale.setScalar(lerp(0.6, 1.0, t));
                        updateScaleHandlePos();
                        updateDemoCursor3D(getScaleRingEdgeWorld());
                    }
                },
            ], () => {
                toggleDemoCursor(false);
                if (state.character) state.character.scale.setScalar(1);
                releaseCameraToOrbit('front');
                hideWatch();
                state.beatLocked = false;
            });
            break;
        }

        case 10: {
            orbitCtrl.enabled = false; // no orbit/zoom/pan while watching
            hideAllArrows();
            if (state.character) { state.character.scale.setScalar(1); state.character.position.copy(characterHomePosition); }
            scaleHandle.visible = true;
            rotateHandle.visible = false;
            updateScaleHandlePos();
            // Show the per-axis cube handles alongside the uniform ring so the
            // student can see which handle drives the single-axis stretch as it
            // happens (they track the distortion frame by frame below).
            showScaleAxes();
            updateScaleAxisPos();
            setCaption(10, 'Two Ways to Scale',
                'Scaling on one axis (the <span class="cx">red</span>, <span class="cy">green</span>, or <span class="cz">blue</span> cube handles) stretches or squishes Gizmobot in a single direction, so it looks taller, wider, or flatter. Uniform scale (the outer ring) grows or shrinks the whole body evenly. <b>Drag a cube handle to stretch Gizmobot in one direction.</b>');
            showWatch();
            state.beatLocked = true;
            state.camLocked = true;
            runSequence([
                camMoveStep('iso', 0.8), // frame the tool before the demo
                { duration: 0.7, fn: () => { updateScaleHandlePos(); updateScaleAxisPos(); } },
                // Y-axis only: tall and lanky (wrong)
                {
                    duration: 1.8, fn: t => {
                        if (state.character) state.character.scale.set(1, lerp(1, 2.4, t), 1);
                        updateScaleHandlePos();
                        updateScaleAxisPos();
                    }
                },
                { duration: 1.1, fn: () => { updateScaleHandlePos(); updateScaleAxisPos(); } },
                {
                    duration: 1.0, fn: t => {
                        if (state.character) state.character.scale.set(1, lerp(2.4, 1, t), 1);
                        updateScaleHandlePos();
                        updateScaleAxisPos();
                    }
                },
                { duration: 0.7, fn: () => { updateScaleHandlePos(); updateScaleAxisPos(); } },
                // Uniform: grows evenly (right)
                {
                    duration: 1.5, fn: t => {
                        if (state.character) state.character.scale.setScalar(lerp(1, 1.8, t));
                        updateScaleHandlePos();
                        updateScaleAxisPos();
                    }
                },
                { duration: 0.9, fn: () => { updateScaleHandlePos(); updateScaleAxisPos(); } },
                {
                    duration: 1.0, fn: t => {
                        if (state.character) state.character.scale.setScalar(lerp(1.8, 1, t));
                        updateScaleHandlePos();
                        updateScaleAxisPos();
                    }
                },
            ], () => {
                if (state.character) state.character.scale.setScalar(1);
                updateScaleHandlePos();
                showScaleAxes();
                updateScaleAxisPos();
                releaseCameraToOrbit('iso');
                hideWatch();
                state.beatLocked = false;
            });
            break;
        }

        case 11: {
            orbitCtrl.enabled = false; // no orbit/zoom/pan while watching
            hideAllArrows();
            scaleHandle.visible = false;
            rotateHandle.visible = true;
            if (state.character) { state.character.rotation.set(0, 0, 0); state.character.position.copy(characterHomePosition); }
            updateRotateHandlePos();
            setCaption(11, 'Rotate', 'The <span class="co">rotate tool</span> turns Gizmobot to face a different way. Each ring spins it in a different direction. <b>Drag any ring to rotate Gizmobot.</b>' + buildMouseDiagram('rotate'));
            showWatch();
            state.beatLocked = true;
            state.camLocked = true;
            const rotRadius = 0.75 * getCharacterControlScale();
            runSequence([
                camMoveStep('iso', 0.8), // frame the tool before the demo
                { duration: 0.5, fn: t => { if (t === 0) { toggleDemoCursor(true); setDemoCursorDown(false); } updateRotateHandlePos(); const p = getCharacterCenterWorld(); p.z += rotRadius; updateDemoCursor3D(p); } },
                // one single stroke around the ring - grab, sweep half a turn, release
                {
                    duration: 1.8, fn: t => {
                        if (t === 0) setDemoCursorDown(true);
                        if (state.character) state.character.rotation.y = lerp(0, Math.PI, t);
                        updateRotateHandlePos();
                        const p = getCharacterCenterWorld(); p.z += Math.cos(Math.PI * t) * rotRadius; p.x += Math.sin(Math.PI * t) * rotRadius; updateDemoCursor3D(p);
                    }
                },
                { duration: 0.5, fn: t => { if (t === 0) { setDemoCursorDown(false); toggleDemoCursor(false); } updateRotateHandlePos(); } },
                // cursor gone - quietly ease back to the start pose
                {
                    duration: 0.6, fn: t => {
                        if (state.character) state.character.rotation.y = lerp(Math.PI, 0, t);
                        updateRotateHandlePos();
                    }
                },
            ], () => {
                toggleDemoCursor(false);
                if (state.character) state.character.rotation.set(0, 0, 0);
                releaseCameraToOrbit('iso');
                hideWatch();
                state.beatLocked = false;
            });
            break;
        }

        case 12: {
            orbitCtrl.enabled = true;
            orbitCtrl.target.copy(camTgtL);
            orbitCtrl.update();
            clearHint();
            setMode('interact');
            setCaption('',
                'You can navigate 3D space!',
                'Orbit · Zoom · Pan · Move · Scale · Rotate: these are the core tools you will need to begin exploring 3D technology. You have the foundation. Now use your skills to move Gizmobot any way you wish, and continue your 3D creation journey on the Microcourses Hub!',
            );
            document.getElementById('panel').classList.add('panel-celebrate');
            document.getElementById('free-play-widget').style.display = 'flex';
            setFreePlayMode('move');
            setTimeout(() => showFinishButton(), 300);

            // Ease Gizmobot back to a clean standing pose for the finale - the
            // student may arrive with him face-down, stretched, or off-screen
            // from the rotate/scale beats. Free play then starts fresh.
            if (state.character) {
                const startPos = state.character.position.clone();
                const startQuat = state.character.quaternion.clone();
                const startScale = state.character.scale.clone();
                const idQuat = new THREE.Quaternion();
                runSequence([{
                    duration: 0.8, fn: t => {
                        state.character.position.lerpVectors(startPos, characterHomePosition, t);
                        state.character.quaternion.slerpQuaternions(startQuat, idQuat, t);
                        state.character.scale.lerpVectors(startScale, V3(1, 1, 1), t);
                    }
                }]);
            }
            break;
        }
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
        case 2: if (state.zoomed) { clearHint(); showContinue(); } break;
        case 3: if (state.panAccum > 50) { clearHint(); showContinue(); } break;
        case 5: if (state.axisDrag.x > 1.0) { showContinue(); } break;
        case 6: if (state.axisDrag.y > 1.0) { showContinue(); } break;
        case 7: if (state.axisDrag.z > 1.0) { showContinue(); } break;
        case 8: if (state.axesUsed.size >= 2) { showContinue(); } break;
        case 9: if (state.scaledUp && state.scaledDown) { showContinue(); } break;
        case 10: if (state.axisScaleUsed.size > 0) { showContinue(); } break;
        case 11: if (state.rotatedAxis.size > 0) { showContinue(); } break;
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

/* ═══════════════════════════════════════════════
   REPLAY BEAT
   Re-runs the current beat from the top, replaying its "watch" demo, for a
   student who missed or forgot what to do. runBeat is self-contained (it resets
   scene + interaction state), so this just re-invokes it. Ignored while a demo
   is mid-playback so a double-tap can't stack sequences.
═══════════════════════════════════════════════ */
export function replayBeat() {
    if (state.beatLocked) return;
    runBeat(state.beatIdx);
}
