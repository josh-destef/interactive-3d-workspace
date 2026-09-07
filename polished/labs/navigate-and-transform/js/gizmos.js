/* Navigate + Transform adapter for the shared kit manipulators. */
import * as THREE from 'three';
import { clamp } from './utils.js';
import { AXIS_COLORS } from './config.js';
import { scene, camera } from './stage.js';
import { state } from './state.js';
import { getCharacterCenterWorld, getCharacterControlScale } from './character.js';
import {
    ARROW_HEAD_Y, SCALE_RING_RADIUS, createTransformGizmos,
} from '../../../kit/js/transformGizmos.js';

export { ARROW_HEAD_Y };

const rig = createTransformGizmos({ scene, axisColors: AXIS_COLORS, negativeAxes: true });
export const arrows = rig.arrows;
export const allArrows = rig.allArrows;
export const scaleHandle = rig.scaleHandle;
export const scaleUniformMesh = rig.scaleUniformMesh;
export const allScaleAxisHandles = rig.allScaleAxis;
export const rotateHandle = rig.rotateHandle;

export function updateArrowPositions() {
    if (state.character) rig.updateMove(getCharacterCenterWorld(), getCharacterControlScale());
}

export function showArrows(axes) {
    const visible = new Set(axes);
    for (const [name, arrow] of Object.entries(arrows)) arrow.visible = visible.has(name[0]);
}

export function hideAllArrows() { allArrows.forEach(arrow => { arrow.visible = false; }); }

export function pulseArrow(arrow, duration = 600) {
    const start = performance.now();
    const factor = getCharacterControlScale();
    function tick() {
        const t = clamp((performance.now() - start) / duration, 0, 1);
        arrow.scale.setScalar((1 + .25 * Math.sin(t * Math.PI)) * factor);
        if (t < 1) requestAnimationFrame(tick);
        else arrow.scale.setScalar(factor);
    }
    tick();
}

function uniformScaleFactor() {
    const scale = state.character.scale;
    return Math.max(state.characterControlRadius * Math.cbrt(scale.x * scale.y * scale.z), .3);
}

export function updateScaleHandlePos() {
    if (state.character) rig.updateUniformScale(getCharacterCenterWorld(), camera, uniformScaleFactor());
}

const edgeOffset = new THREE.Vector3();
export function getScaleRingEdgeWorld(target = new THREE.Vector3()) {
    getCharacterCenterWorld(target);
    if (!state.character) return target;
    edgeOffset.set(1, 0, 0).applyQuaternion(camera.quaternion)
        .multiplyScalar(uniformScaleFactor() * SCALE_RING_RADIUS);
    return target.add(edgeOffset);
}

export function showScaleAxes() { allScaleAxisHandles.forEach(handle => { handle.visible = true; }); }
export function hideScaleAxes() { allScaleAxisHandles.forEach(handle => { handle.visible = false; }); }

export function updateScaleAxisPos() {
    if (!state.character) return;
    rig.updateScaleAxes(
        getCharacterCenterWorld(),
        state.character.quaternion,
        state.characterControlRadius,
        state.character.scale,
    );
}

export function updateRotateHandlePos() {
    if (state.character) rig.updateRotate(getCharacterCenterWorld(), getCharacterControlScale());
}

export function restoreColor(object) { rig.restoreColor(object); }
