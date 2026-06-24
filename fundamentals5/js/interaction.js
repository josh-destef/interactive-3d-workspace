/* ═══════════════════════════════════════════════
   INTERACTION — RAYCASTING + DRAG
   Priority: gizmo arrow > scale handle > orbit.
   Also hosts the wheel/keyboard handlers, the draggable
   panel, and the Reset View / Reset Gizmo actions.
═══════════════════════════════════════════════ */
import * as THREE from 'three';
import { clamp, lerp } from './utils.js';
import { cv, camera, orbitCtrl } from './stage.js';
import { CAMS, isOrbitBeat } from './config.js';
import { state } from './state.js';
import { camCurP, camCurL, camTgtP, camTgtL } from './cameraRig.js';
import { animate01 } from './anim.js';
import {
    allArrows, scaleHandle, sBox, rotateHandle, restoreColor,
    updateArrowPositions, updateScaleHandlePos, updateRotateHandlePos,
} from './gizmos.js';
import { characterHomePosition } from './character.js';
import { checkBeatComplete, nextBeat } from './beats.js';

const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const dragPlane = new THREE.Plane();

let dragArrow = null;   // currently dragged arrow group
let dragScale = false;  // whether scale handle is being dragged
let dragRotate = null;  // currently dragged rotation axis ('x','y','z')
let dragRotateMesh = null;
let rotateDragStartX = 0;
let rotateDragStartY = 0;
let charQuatStart = new THREE.Quaternion();
let dragStart = new THREE.Vector3();      // world-space hit point at drag start
let charPosStart = new THREE.Vector3();   // character position at drag start
let charScaleStart = 1;
let scaleDragStartY = 0;
let hoverObj = null;

const _tmpQ = new THREE.Quaternion();
const _tmpV = new THREE.Vector3();

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

    // 1. check scale handle
    if (scaleHandle.visible) {
        const hits = raycaster.intersectObjects(scaleHandle.children);
        if (hits.length) {
            dragScale = true;
            sBox.material.color.setHex(0xffffff); // highlight
            scaleDragStartY = e.clientY;
            charScaleStart = state.character ? state.character.scale.x : 1;

            freezeCamera();
            cv.style.cursor = 'ns-resize';
            return;
        }
    }

    // 2. check rotate handle
    if (rotateHandle.visible) {
        const hits = raycaster.intersectObjects(rotateHandle.children, true);
        const validHit = hits.find(h => h.object._axis);
        if (validHit) {
            dragRotate = validHit.object._axis;
            dragRotateMesh = validHit.object._visMesh;
            dragRotateMesh.material.color.setHex(0xffffff); // highlight

            freezeCamera();
            cv.style.cursor = 'grabbing';
            rotateDragStartX = e.clientX;
            rotateDragStartY = e.clientY;
            charQuatStart.copy(state.character.quaternion);
            return;
        }
    }

    // 3. check gizmo arrows
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

    // 4. fall through to orbit (OrbitControls handles it natively)
});

cv.addEventListener('pointermove', e => {
    if (state.beatLocked) return;
    getNDC(e);

    // scale drag
    if (dragScale && state.character) {
        const dy = scaleDragStartY - e.clientY; // up = positive
        const newScale = clamp(charScaleStart + dy * 0.008, 0.4, 2.2);
        state.character.scale.setScalar(newScale);
        if (newScale > 1.2) state.scaledUp = true;
        if (newScale < 0.85) state.scaledDown = true;
        checkBeatComplete();
        return;
    }

    // rotate drag
    if (dragRotate && state.character) {
        const dx = e.clientX - rotateDragStartX;
        const dy = e.clientY - rotateDragStartY;
        const angle = (dragRotate === 'x' ? dy : (dragRotate === 'y' ? dx : -dx)) * 0.01;

        _tmpV.set(dragRotate === 'x' ? 1 : 0, dragRotate === 'y' ? 1 : 0, dragRotate === 'z' ? 1 : 0);
        _tmpQ.setFromAxisAngle(_tmpV, angle);
        state.character.quaternion.copy(_tmpQ.multiply(charQuatStart));

        if (Math.abs(dx) > 20 || Math.abs(dy) > 20) {
            state.rotatedAxis.add(dragRotate);
            checkBeatComplete();
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
    if (!dragArrow && !dragScale && !dragRotate) {
        raycaster.setFromCamera(pointerNDC, camera);
        let foundHover = null;

        // 1. scale
        if (scaleHandle.visible) {
            const hits = raycaster.intersectObjects(scaleHandle.children);
            if (hits.length) foundHover = { type: 'scale', obj: scaleHandle };
        }
        // 2. rotate
        if (!foundHover && rotateHandle.visible) {
            const hits = raycaster.intersectObjects(rotateHandle.children, true);
            const vh = hits.find(h => h.object._axis);
            if (vh) foundHover = { type: 'rotate', obj: vh.object._visMesh };
        }
        // 3. arrows
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
                else if (foundHover.type === 'scale') sBox.material.color.setHex(0xffff00);
                else if (foundHover.type === 'rotate') hoverObj.material.color.setHex(0xffff00);
                cv.style.cursor = 'pointer';
            }
        } else {
            if (hoverObj) {
                restoreColor(hoverObj);
                hoverObj = null;
                cv.style.cursor = '';
            }
        }
    }

    // orbit tracking for beat 1
    if (state.beatIdx === 1 && orbitCtrl.enabled) {
        state.orbitAccum += Math.abs(e.movementX || 0) * 0.5;
        checkBeatComplete();
    }

    // pan tracking for beat 3
    if (state.beatIdx === 3 && orbitCtrl.enabled) {
        state.panAccum += (Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0)) * 0.5;
        checkBeatComplete();
    }
}, { passive: true });

window.addEventListener('pointerup', () => {
    if (dragArrow || dragScale || dragRotate) {
        if (dragArrow) restoreColor(dragArrow);
        if (dragScale) restoreColor(scaleHandle);
        if (dragRotateMesh) restoreColor(dragRotateMesh);

        dragArrow = null;
        dragScale = false;
        dragRotate = null;
        dragRotateMesh = null;
        cv.style.cursor = '';
        // restore orbit based on beat
        orbitCtrl.enabled = isOrbitBeat(state.beatIdx);
    }
});

/* track zoom for beat 2 */
cv.addEventListener('wheel', () => {
    if (state.beatIdx !== 2) return;
    const dist = camera.position.distanceTo(orbitCtrl.target);
    if (dist < state.zoomMin) { state.zoomMin = dist; checkBeatComplete(); }
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
   UTILITY ACTIONS — Reset View / Reset Gizmo
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

export function resetGizmo() {
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
    }, () => {
        state.beatLocked = false;
    });
}

/* ═══════════════════════════════════════════════
   DRAGGABLE PANEL
═══════════════════════════════════════════════ */
const pnl = document.getElementById('panel');
let pnlDrag = false;
let pnlStartX = 0, pnlStartY = 0;
let pnlStartLeft = 0, pnlStartTop = 0;

pnl.addEventListener('pointerdown', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.tagName === 'A') return;
    pnlDrag = true;
    pnlStartX = e.clientX;
    pnlStartY = e.clientY;
    const rect = pnl.getBoundingClientRect();
    pnlStartLeft = rect.left;
    pnlStartTop = rect.top;
    pnl.style.transform = 'none';
    pnl.style.left = pnlStartLeft + 'px';
    pnl.style.top = pnlStartTop + 'px';
    pnl.style.bottom = 'auto';
    pnl.setPointerCapture(e.pointerId);
    pnl.style.cursor = 'grabbing';
});
pnl.addEventListener('pointermove', (e) => {
    if (!pnlDrag) return;
    const dx = e.clientX - pnlStartX;
    const dy = e.clientY - pnlStartY;
    pnl.style.left = pnlStartLeft + dx + 'px';
    pnl.style.top = pnlStartTop + dy + 'px';
});
pnl.addEventListener('pointerup', (e) => {
    if (!pnlDrag) return;
    pnlDrag = false;
    pnl.releasePointerCapture(e.pointerId);
    pnl.style.cursor = 'grab';
});
