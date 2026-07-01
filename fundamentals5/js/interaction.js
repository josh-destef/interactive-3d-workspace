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

function getAxisScreenDir(axKey) {
    const axis = AXIS_VECS[axKey];
    const center = getCharacterCenterWorld();
    const p0 = center.clone().project(camera);
    const p1 = center.clone().add(axis).project(camera);
    const sx = p1.x - p0.x;
    const sy = -(p1.y - p0.y); // NDC Y is flipped vs screen Y
    const len = Math.sqrt(sx * sx + sy * sy);
    return len > 0.0001 ? { x: sx / len, y: sy / len } : { x: 0, y: -1 };
}

let dragArrow = null;      // currently dragged arrow group
let dragScale = false;     // whether uniform scale handle is being dragged
let dragScaleAxis = null;  // { handle, axKey, startX, startY, startScale, screenDir } for axis scale
let dragRotate = null;     // currently dragged rotation axis ('x','y','z')
let dragRotateMesh = null;
let rotateDragStartX = 0;
let rotateDragStartY = 0;
let charQuatStart = new THREE.Quaternion();
let dragStart = new THREE.Vector3();      // world-space hit point at drag start
let charPosStart = new THREE.Vector3();   // character position at drag start
let charScaleStart = 1;
let charScaleStartVec = new THREE.Vector3(1, 1, 1);
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
            sBox.material.color.setHex(0xffff00); // yellow highlight on grab
            scaleDragStartY = e.clientY;
            charScaleStart = state.character ? Math.max(state.character.scale.x, 0.01) : 1;
            if (state.character) charScaleStartVec.copy(state.character.scale);

            freezeCamera();
            cv.style.cursor = 'ns-resize';
            return;
        }
    }

    // 2. check axis scale handles (R/G/B levers)
    for (const handle of allScaleAxisHandles) {
        if (!handle.visible) continue;
        const hitMeshes = handle.children.filter(c => c._isScaleAxisHit);
        const hits = raycaster.intersectObjects(hitMeshes);
        if (hits.length) {
            dragScaleAxis = {
                handle,
                axKey: handle._axKey,
                startX: e.clientX,
                startY: e.clientY,
                startScale: state.character ? state.character.scale[handle._axKey] : 1,
                screenDir: getAxisScreenDir(handle._axKey),
            };
            handle._visMeshes.forEach(m => m.material.color.setHex(0xffffff));
            freezeCamera();
            cv.style.cursor = 'grab';
            return;
        }
    }

    // 4. check rotate handle
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

    // scale drag (uniform — center sphere)
    // Multiplies all axes proportionally so non-uniform distortions are preserved
    if (dragScale && state.character) {
        const dy = scaleDragStartY - e.clientY; // up = grow
        const newRef = clamp(charScaleStart + dy * 0.008, 0.1, 4.0);
        const ratio = newRef / charScaleStart;
        state.character.scale.set(
            clamp(charScaleStartVec.x * ratio, 0.05, 5.0),
            clamp(charScaleStartVec.y * ratio, 0.05, 5.0),
            clamp(charScaleStartVec.z * ratio, 0.05, 5.0)
        );
        updateScaleHandlePos();
        if (allScaleAxisHandles.some(h => h.visible)) updateScaleAxisPos();
        if (newRef > 1.2) state.scaledUp = true;
        if (newRef < 0.85) state.scaledDown = true;
        checkBeatComplete();
        return;
    }

    // axis scale drag — project mouse delta onto screen-space axis direction
    if (dragScaleAxis && state.character) {
        const dx = e.clientX - dragScaleAxis.startX;
        const dy = e.clientY - dragScaleAxis.startY;
        const dot = dx * dragScaleAxis.screenDir.x + dy * dragScaleAxis.screenDir.y;
        const newScale = clamp(dragScaleAxis.startScale + dot * 0.008, 0.2, 3.5);
        state.character.scale[dragScaleAxis.axKey] = newScale;
        updateScaleAxisPos();
        if (scaleHandle.visible) updateScaleHandlePos();
        state.axisScaleUsed.add(dragScaleAxis.axKey);
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
    if (!dragArrow && !dragScale && !dragScaleAxis && !dragRotate) {
        raycaster.setFromCamera(pointerNDC, camera);
        let foundHover = null;

        // 1. uniform scale
        if (scaleHandle.visible) {
            const hits = raycaster.intersectObjects(scaleHandle.children);
            if (hits.length) foundHover = { type: 'scale', obj: scaleHandle };
        }
        // 2. axis scale handles
        if (!foundHover) {
            for (const handle of allScaleAxisHandles) {
                if (!handle.visible) continue;
                const hitMeshes = handle.children.filter(c => c._isScaleAxisHit);
                const hits = raycaster.intersectObjects(hitMeshes);
                if (hits.length) { foundHover = { type: 'scaleAxis', obj: handle }; break; }
            }
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
                else if (foundHover.type === 'scale') sBox.material.color.setHex(0xffff00);
                else if (foundHover.type === 'scaleAxis') hoverObj._visMeshes.forEach(m => m.material.color.setHex(0xffff00));
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
        if (allScaleAxisHandles.some(h => h.visible)) updateScaleAxisPos();
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
