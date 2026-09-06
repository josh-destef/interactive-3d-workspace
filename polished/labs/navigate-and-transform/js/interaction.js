/* ═══════════════════════════════════════════════
   INTERACTION - RAYCASTING + DRAG
   Priority: gizmo arrow > scale handle > orbit.
   Also hosts the wheel/keyboard handlers, the draggable
   panel, and the Reset View / Reset Gizmobot actions.
═══════════════════════════════════════════════ */
import * as THREE from 'three';
import { clamp, lerp } from './utils.js';
import { cv, camera, orbitCtrl } from './stage.js';
import { CAMS, isOrbitBeat } from './config.js';
import { state } from './state.js';
import { camCurP, camCurL, camTgtP, camTgtL } from './cameraRig.js';
import { animate01 } from './anim.js';
import {
    allArrows, scaleHandle, scaleUniformMesh, rotateHandle, restoreColor,
    allScaleAxisHandles, updateScaleAxisPos,
    updateArrowPositions, updateScaleHandlePos, updateRotateHandlePos,
} from './gizmos.js';
import { characterHomePosition, getCharacterCenterWorld } from './character.js';
import { checkBeatComplete, nextBeat } from './beats.js';

const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const dragPlane = new THREE.Plane();

const AXIS_VECS = {
    x: new THREE.Vector3(1, 0, 0),
    y: new THREE.Vector3(0, 1, 0),
    z: new THREE.Vector3(0, 0, 1),
};

/* Uniform-scale reference distance (px). A cursor this far past the pivot
   roughly doubles the size; larger = gentler. The offset also removes the
   singularity you'd otherwise hit grabbing a handle sitting on the pivot. */
const SCALE_REF = 120;

const _projV = new THREE.Vector3();

function getAxisScreenDir(axKey) {
    // use the model's *local* axis in world space (scale stretches locally, and
    // the handle is drawn rotated with the model), so the drag direction lines
    // up with the handle at any model orientation
    const axis = AXIS_VECS[axKey].clone();
    if (state.character) axis.applyQuaternion(state.character.quaternion);
    const center = getCharacterCenterWorld();
    const p0 = center.clone().project(camera);
    const p1 = center.clone().add(axis).project(camera);
    const sx = p1.x - p0.x;
    const sy = -(p1.y - p0.y); // NDC Y is flipped vs screen Y
    const len = Math.sqrt(sx * sx + sy * sy);
    return len > 0.0001 ? { x: sx / len, y: sy / len } : { x: 0, y: -1 };
}

/* Pivot (character center) projected to screen pixels - same client-space
   coordinates as pointer events, so cursor deltas can be measured against it. */
function getCenterScreen() {
    getCharacterCenterWorld(_projV).project(camera);
    const r = cv.getBoundingClientRect();
    return {
        x: r.left + (_projV.x * 0.5 + 0.5) * r.width,
        y: r.top + (-_projV.y * 0.5 + 0.5) * r.height,
    };
}

let dragArrow = null;      // currently dragged arrow group
let dragScale = false;     // whether the uniform scale handle is being dragged
let dragScaleAxis = null;  // { handle, axKey, centerX, centerY, screenDir, startProj, startScale }
let dragRotate = null;     // currently dragged rotation axis ('x','y','z')
let dragRotateMesh = null;
let charQuatStart = new THREE.Quaternion();
let dragStart = new THREE.Vector3();      // world-space hit point at drag start
let charPosStart = new THREE.Vector3();   // character position at drag start
let charScaleStartVec = new THREE.Vector3(1, 1, 1);

// uniform scale (radial): cursor position relative to the pivot at grab time
let scaleCenterX = 0, scaleCenterY = 0;   // pivot in screen px, captured on grab
let scaleStartDist = 0;                    // |cursor − pivot| at grab
let scaleGrabX = 0, scaleGrabY = -1;       // unit grab direction (radial) in screen space

// rotate (in-plane angular): drag lives on a plane through the pivot, normal = axis
const rotatePlane = new THREE.Plane();
const rotateCenter = new THREE.Vector3();  // pivot world position at grab
const rotateAxisVec = new THREE.Vector3(); // world rotation axis
const rotateLastVec = new THREE.Vector3(); // last in-plane radial vector (pivot → hit)
let rotateAccum = 0;                       // accumulated signed angle (radians)

let hoverObj = null;

const _tmpQ = new THREE.Quaternion();
const _tmpV = new THREE.Vector3();
const _tmpV2 = new THREE.Vector3();

function getNDC(e) {
    const r = cv.getBoundingClientRect();
    pointerNDC.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointerNDC.y = -((e.clientY - r.top) / r.height) * 2 + 1;
}

/* freeze the lerp camera at its current pose and hand control to drag */
function freezeCamera() {
    camCurP.copy(camera.position); camTgtP.copy(camera.position);
    camCurL.copy(orbitCtrl.target); camTgtL.copy(orbitCtrl.target);
    orbitCtrl.enabled = false;
}

/* {mesh, arrow} pairs for the raycast hit-cylinders of visible arrows */
function visibleArrowHits() {
    return allArrows
        .filter(a => a.visible)
        .flatMap(a => a.children.filter(c => c._isHit).map(c => ({ mesh: c, arrow: a })));
}

cv.addEventListener('pointerdown', e => {
    if (state.beatLocked) return;
    getNDC(e);
    raycaster.setFromCamera(pointerNDC, camera);

    // 1. check axis scale handles first (small precise cubes - ratio along the axis)
    for (const handle of allScaleAxisHandles) {
        if (!handle.visible) continue;
        const hitMeshes = handle.children.filter(c => c._isScaleAxisHit);
        const hits = raycaster.intersectObjects(hitMeshes);
        if (hits.length) {
            const c = getCenterScreen();
            const screenDir = getAxisScreenDir(handle._axKey);
            dragScaleAxis = {
                handle,
                axKey: handle._axKey,
                centerX: c.x,
                centerY: c.y,
                screenDir,
                // signed screen distance from pivot to the grab point along the axis
                startProj: (e.clientX - c.x) * screenDir.x + (e.clientY - c.y) * screenDir.y,
                startScale: state.character ? state.character.scale[handle._axKey] : 1,
            };
            handle._visMeshes.forEach(m => m.material.color.setHex(0xffffff));
            freezeCamera();
            cv.style.cursor = 'grabbing';
            return;
        }
    }

    // 2. check the uniform scale ring (large outer target - radial from the pivot)
    if (scaleHandle.visible) {
        const hits = raycaster.intersectObjects(scaleHandle.children);
        if (hits.length) {
            dragScale = true;
            scaleUniformMesh.material.color.setHex(0xffff00); // yellow highlight on grab
            const c = getCenterScreen();
            scaleCenterX = c.x; scaleCenterY = c.y;
            const gx = e.clientX - c.x, gy = e.clientY - c.y;
            scaleStartDist = Math.hypot(gx, gy);
            // radial grab direction; a dead-center grab falls back to "up = grow"
            if (scaleStartDist > 4) { scaleGrabX = gx / scaleStartDist; scaleGrabY = gy / scaleStartDist; }
            else { scaleGrabX = 0; scaleGrabY = -1; }
            if (state.character) charScaleStartVec.copy(state.character.scale);

            freezeCamera();
            cv.style.cursor = 'grabbing';
            return;
        }
    }

    // 4. check rotate handle (in-plane angular drag - the ring follows the cursor)
    if (rotateHandle.visible) {
        const hits = raycaster.intersectObjects(rotateHandle.children, true);
        const validHit = hits.find(h => h.object._axis);
        if (validHit) {
            dragRotate = validHit.object._axis;
            dragRotateMesh = validHit.object._visMesh;
            dragRotateMesh.material.color.setHex(0xffffff); // highlight

            freezeCamera();
            cv.style.cursor = 'grabbing';

            // Drag on the plane through the pivot whose normal is the world axis.
            getCharacterCenterWorld(rotateCenter);
            rotateAxisVec.copy(AXIS_VECS[dragRotate]);
            rotatePlane.setFromNormalAndCoplanarPoint(rotateAxisVec, rotateCenter);
            charQuatStart.copy(state.character.quaternion);
            rotateAccum = 0;
            if (raycaster.ray.intersectPlane(rotatePlane, _tmpV)) {
                rotateLastVec.copy(_tmpV).sub(rotateCenter);
            } else {
                rotateLastVec.set(0, 0, 0);
            }
            return;
        }
    }

    // 5. check gizmo arrows
    const hitMeshes = visibleArrowHits();
    const hits = raycaster.intersectObjects(hitMeshes.map(h => h.mesh));
    if (hits.length) {
        const found = hitMeshes.find(h => h.mesh === hits[0].object);
        if (found) {
            dragArrow = found.arrow;
            dragArrow._meshes.forEach(m => m.material.color.setHex(0xffffff)); // highlight

            freezeCamera();
            dragPlane.setFromNormalAndCoplanarPoint(
                camera.position.clone().sub(hits[0].point).normalize(),
                hits[0].point
            );
            dragStart.copy(hits[0].point);
            charPosStart.copy(state.character.position);
            cv.style.cursor = 'grabbing';
            return;
        }
    }

    // 6. fall through to orbit (OrbitControls handles it natively)
});

cv.addEventListener('pointermove', e => {
    if (state.beatLocked) return;
    getNDC(e);

    // uniform scale drag (center sphere) - radial: the cursor's distance from
    // the pivot sets the factor. Push it outward to grow, pull it toward/through
    // the pivot to shrink. All axes multiply together so any distortion is kept.
    if (dragScale && state.character) {
        const dx = e.clientX - scaleCenterX;
        const dy = e.clientY - scaleCenterY;
        const dist = Math.hypot(dx, dy);
        // sign it along the grab direction, so dragging past the pivot shrinks smoothly
        const signed = (dx * scaleGrabX + dy * scaleGrabY) >= 0 ? dist : -dist;
        const factor = clamp((signed + SCALE_REF) / (scaleStartDist + SCALE_REF), 0.02, 8);
        state.character.scale.set(
            clamp(charScaleStartVec.x * factor, 0.05, 5.0),
            clamp(charScaleStartVec.y * factor, 0.05, 5.0),
            clamp(charScaleStartVec.z * factor, 0.05, 5.0)
        );
        updateScaleHandlePos();
        if (allScaleAxisHandles.some(h => h.visible)) updateScaleAxisPos();
        if (state.character.scale.x > 1.2) state.scaledUp = true;
        if (state.character.scale.x < 0.85) state.scaledDown = true;
        checkBeatComplete();
        return;
    }

    // axis scale drag - ratio of the cursor's distance from the pivot along the
    // axis vs. at grab time. Drag the handle outward to grow that axis, inward to shrink.
    if (dragScaleAxis && state.character) {
        const dx = e.clientX - dragScaleAxis.centerX;
        const dy = e.clientY - dragScaleAxis.centerY;
        const currProj = dx * dragScaleAxis.screenDir.x + dy * dragScaleAxis.screenDir.y;
        // guard a near-zero reference (axis pointing almost at the camera)
        const denom = Math.abs(dragScaleAxis.startProj) > 1
            ? dragScaleAxis.startProj
            : (dragScaleAxis.startProj < 0 ? -1 : 1);
        const factor = clamp(currProj / denom, 0.02, 8);
        const newScale = clamp(dragScaleAxis.startScale * factor, 0.1, 4.0);
        state.character.scale[dragScaleAxis.axKey] = newScale;
        updateScaleAxisPos();
        if (scaleHandle.visible) updateScaleHandlePos();
        if (Math.abs(newScale - dragScaleAxis.startScale) > 0.02) {
            state.axisScaleUsed.add(dragScaleAxis.axKey);
            checkBeatComplete();
        }
        return;
    }

    // rotate drag - spin about the world axis by the angle the cursor sweeps
    // around the pivot on the rotation plane, so the grabbed ring tracks the mouse.
    // Computing it on the actual 3D plane makes the direction correct at any camera angle.
    if (dragRotate && state.character) {
        raycaster.setFromCamera(pointerNDC, camera);
        if (raycaster.ray.intersectPlane(rotatePlane, _tmpV)) {
            _tmpV2.copy(_tmpV).sub(rotateCenter); // current pivot → cursor vector, in-plane
            if (_tmpV2.lengthSq() > 1e-6 && rotateLastVec.lengthSq() > 1e-6) {
                // signed angle swept since the last frame (about the axis)
                _tmpV.copy(rotateLastVec).cross(_tmpV2);
                const dAngle = Math.atan2(_tmpV.dot(rotateAxisVec), rotateLastVec.dot(_tmpV2));
                rotateAccum += dAngle;
                rotateLastVec.copy(_tmpV2);

                _tmpQ.setFromAxisAngle(rotateAxisVec, rotateAccum);
                state.character.quaternion.copy(_tmpQ.multiply(charQuatStart));

                if (Math.abs(rotateAccum) > 0.12) {
                    state.rotatedAxis.add(dragRotate);
                    checkBeatComplete();
                }
            }
        }
        return;
    }

    // gizmo drag
    if (dragArrow && state.character) {
        raycaster.setFromCamera(pointerNDC, camera);
        const pt = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(dragPlane, pt)) {
            const delta = pt.clone().sub(dragStart);
            const ax = dragArrow._axis;
            const move = delta.dot(ax);
            state.character.position.copy(charPosStart.clone().add(ax.clone().multiplyScalar(move)));
            // clamp position
            state.character.position.x = clamp(state.character.position.x, -4, 4);
            state.character.position.y = clamp(
                state.character.position.y,
                characterHomePosition.y - 1,
                characterHomePosition.y + 5
            );
            state.character.position.z = clamp(state.character.position.z, -4, 4);

            // track which axis was dragged and how far
            const axKey = Math.abs(ax.x) > 0.5 ? 'x' : Math.abs(ax.y) > 0.5 ? 'y' : 'z';
            state.axisDrag[axKey] += Math.abs(move);
            state.axesUsed.add(axKey);

            checkBeatComplete();
        }
        return;
    }

    // hover detection (only if not dragging)
    if (!dragArrow && !dragScale && !dragScaleAxis && !dragRotate) {
        raycaster.setFromCamera(pointerNDC, camera);
        let foundHover = null;

        // 1. axis scale handles (precise cubes take priority over the ring)
        for (const handle of allScaleAxisHandles) {
            if (!handle.visible) continue;
            const hitMeshes = handle.children.filter(c => c._isScaleAxisHit);
            const hits = raycaster.intersectObjects(hitMeshes);
            if (hits.length) { foundHover = { type: 'scaleAxis', obj: handle }; break; }
        }
        // 2. uniform scale ring
        if (!foundHover && scaleHandle.visible) {
            const hits = raycaster.intersectObjects(scaleHandle.children);
            if (hits.length) foundHover = { type: 'scale', obj: scaleHandle };
        }
        // 3. rotate
        if (!foundHover && rotateHandle.visible) {
            const hits = raycaster.intersectObjects(rotateHandle.children, true);
            const vh = hits.find(h => h.object._axis);
            if (vh) foundHover = { type: 'rotate', obj: vh.object._visMesh };
        }
        // 4. arrows
        if (!foundHover) {
            const hitMeshes = visibleArrowHits();
            const hits = raycaster.intersectObjects(hitMeshes.map(h => h.mesh));
            if (hits.length) {
                const found = hitMeshes.find(h => h.mesh === hits[0].object);
                if (found) foundHover = { type: 'arrow', obj: found.arrow };
            }
        }

        if (foundHover) {
            if (hoverObj !== foundHover.obj) {
                if (hoverObj) restoreColor(hoverObj);
                hoverObj = foundHover.obj;
                if (foundHover.type === 'arrow') hoverObj._meshes.forEach(m => m.material.color.setHex(0xffff00));
                else if (foundHover.type === 'scale') scaleUniformMesh.material.color.setHex(0xffff00);
                else if (foundHover.type === 'scaleAxis') hoverObj._visMeshes.forEach(m => m.material.color.setHex(0xffff00));
                else if (foundHover.type === 'rotate') hoverObj.material.color.setHex(0xffff00);
                cv.style.cursor = 'grab';
            }
        } else {
            if (hoverObj) {
                restoreColor(hoverObj);
                hoverObj = null;
                cv.style.cursor = '';
            }
        }
    }

    // orbit tracking for beat 1 - only while actually dragging (left button),
    // so just waving the mouse over the canvas doesn't complete the step
    if (state.beatIdx === 1 && orbitCtrl.enabled && (e.buttons & 1)) {
        state.orbitAccum += Math.abs(e.movementX || 0) * 0.5;
        checkBeatComplete();
    }

    // pan tracking for beat 3 - require a pan gesture: right/middle drag, or
    // shift + left drag (matches OrbitControls' pan bindings)
    const isPanGesture = (e.buttons & 6) || ((e.buttons & 1) && e.shiftKey);
    if (state.beatIdx === 3 && orbitCtrl.enabled && isPanGesture) {
        state.panAccum += (Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0)) * 0.5;
        checkBeatComplete();
    }
}, { passive: true });

window.addEventListener('pointerup', () => {
    if (dragArrow || dragScale || dragScaleAxis || dragRotate) {
        if (dragArrow) restoreColor(dragArrow);
        if (dragScale) restoreColor(scaleHandle);
        if (dragScaleAxis) restoreColor(dragScaleAxis.handle);
        if (dragRotateMesh) restoreColor(dragRotateMesh);

        dragArrow = null;
        dragScale = false;
        dragScaleAxis = null;
        dragRotate = null;
        dragRotateMesh = null;
        cv.style.cursor = '';
        orbitCtrl.enabled = isOrbitBeat(state.beatIdx);
    }
});

/* track zoom for beat 2 */
cv.addEventListener('wheel', () => {
    if (state.beatIdx !== 2) return;
    const dist = camera.position.distanceTo(orbitCtrl.target);
    if (dist < state.zoomMin) state.zoomMin = dist;
    state.zoomed = true;
    checkBeatComplete();
}, { passive: true });

/* keyboard shortcut: Space / ArrowRight advances when Continue is shown */
window.addEventListener('keydown', e => {
    if ((e.code === 'Space' || e.code === 'ArrowRight') &&
        document.getElementById('btn-continue').classList.contains('on')) {
        e.preventDefault();
        nextBeat();
    }
});

/* ═══════════════════════════════════════════════
   UTILITY ACTIONS - Reset View / Reset Gizmobot
═══════════════════════════════════════════════ */
export function resetCamera() {
    if (state.beatLocked) return;
    const startP = camera.position.clone();
    const startT = orbitCtrl.target.clone();
    const endP = CAMS.iso.pos.clone();
    const endT = CAMS.iso.look.clone();

    orbitCtrl.enabled = false;
    state.camLocked = true;
    state.beatLocked = true; // prevent other interactions during reset

    animate01(0.8, t => {
        camera.position.lerpVectors(startP, endP, t);
        orbitCtrl.target.lerpVectors(startT, endT, t);
        camera.lookAt(orbitCtrl.target);
    }, () => {
        orbitCtrl.enabled = isOrbitBeat(state.beatIdx);
        state.camLocked = false;
        state.beatLocked = false;
        orbitCtrl.update();
    });
}

export function resetGizmobot() {
    if (state.beatLocked || !state.character) return;

    const startP = state.character.position.clone();
    const startS = state.character.scale.x;

    state.beatLocked = true;
    animate01(0.6, t => {
        state.character.position.lerpVectors(startP, characterHomePosition, t);
        state.character.scale.setScalar(lerp(startS, 1, t));
        state.character.quaternion.slerp(new THREE.Quaternion(), t);
        updateArrowPositions();
        if (scaleHandle.visible) updateScaleHandlePos();
        if (rotateHandle.visible) updateRotateHandlePos();
        if (allScaleAxisHandles.some(h => h.visible)) updateScaleAxisPos();
    }, () => {
        state.beatLocked = false;
    });
}

/* The info panel is permanently docked (see #panel in styles.css) and is no
   longer draggable - the old pointer-drag handlers were removed so it can't be
   knocked out of place. */
