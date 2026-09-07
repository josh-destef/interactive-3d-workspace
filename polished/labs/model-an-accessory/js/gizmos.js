import { createTransformGizmos } from '../../../kit/js/transformGizmos.js';
import { AXIS_COLORS } from './config.js';

let rig = null;
let target = null;
export let layer = null;
export let arrows = {};
export let allArrows = [];
export let allScaleAxis = [];
export let rotRings = [];
export let scaleHandle = null;
export let rotateHandle = null;
export let scaleUniformMesh = null;

export function initGizmos(scene) {
    rig = createTransformGizmos({ scene, axisColors: AXIS_COLORS });
    ({
        layer, arrows, allArrows, allScaleAxis, rotRings,
        scaleHandle, rotateHandle, scaleUniformMesh,
    } = rig);
}

export function setGizmoTarget(object) { target = object || null; }
export function gizmoTarget() { return target; }
export function targetCentre() { return rig?.centre.clone(); }
export function updateGizmos(camera) { if (target) rig?.updateForObject(target, camera); }
export function showFor({ tool, hasTarget }) { rig?.showFor(tool, hasTarget); }
export function hideAll() { rig?.hideAll(); }
export function restoreColor(object) { rig?.restoreColor(object); }
export function highlight(object) { rig?.highlight(object); }
export function pickables() { return rig?.pickables() || []; }
