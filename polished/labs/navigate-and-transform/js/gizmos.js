/* ═══════════════════════════════════════════════
   GIZMOS
   Move arrows, the scale handle, and the rotate rings -
   plus the helpers that keep them pinned to the character.
═══════════════════════════════════════════════ */
import * as THREE from 'three';
import { clamp, V3 } from './utils.js';
import { AXIS_COLORS } from './config.js';
import { scene, camera } from './stage.js';
import { state } from './state.js';
import { getCharacterCenterWorld, getCharacterControlScale } from './character.js';

/* ── move arrows ──
   Three axis pairs (pos + neg), built from cylinders + cones.
   Introduced one pair at a time: X → Y → Z. */

/* Local Y of the arrow head (before the control-scale factor). Shared with the
   demo cursor so it can ride the arrowhead - keep the two in lockstep. */
export const ARROW_HEAD_Y = 1.325;

function makeArrow(color, dir, opacity = 1) {
    const g = new THREE.Group();

    // visible shaft
    const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 1.2, 10),
        new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false })
    );
    shaft.position.y = 0.6;

    // visible head
    const head = new THREE.Mesh(
        new THREE.ConeGeometry(0.10, 0.25, 10),
        new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false })
    );
    head.position.y = ARROW_HEAD_Y;

    // invisible hit mesh for raycasting (much thicker)
    const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 1.6, 8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    hit.position.y = 0.8;
    hit._isHit = true;

    g.add(shaft, head, hit);

    // orient along dir
    g.quaternion.setFromUnitVectors(V3(0, 1, 0), dir.clone().normalize());
    g._axis = dir.clone().normalize();
    g._color = color;
    g._meshes = [shaft, head];
    g.visible = false;
    scene.add(g);
    return g;
}

export const arrows = {
    xPos: makeArrow(AXIS_COLORS.x, V3(1, 0, 0)),
    xNeg: makeArrow(AXIS_COLORS.x, V3(-1, 0, 0), 0.35),
    yPos: makeArrow(AXIS_COLORS.y, V3(0, 1, 0)),
    yNeg: makeArrow(AXIS_COLORS.y, V3(0, -1, 0), 0.35),
    zPos: makeArrow(AXIS_COLORS.z, V3(0, 0, 1)),
    zNeg: makeArrow(AXIS_COLORS.z, V3(0, 0, -1), 0.35),
};

// all arrows as array for easy iteration
export const allArrows = Object.values(arrows);

// keep gizmo arrows attached to character position each frame
export function updateArrowPositions() {
    if (!state.character) return;
    const center = getCharacterCenterWorld();
    const factor = getCharacterControlScale();
    allArrows.forEach(a => {
        a.position.copy(center);
        a.scale.set(factor, factor, factor);
    });
}

export function showArrows(axes) {
    // axes: array like ['x'] or ['x','y'] or ['x','y','z']
    const show = new Set(axes);
    arrows.xPos.visible = show.has('x');
    arrows.xNeg.visible = show.has('x');
    arrows.yPos.visible = show.has('y');
    arrows.yNeg.visible = show.has('y');
    arrows.zPos.visible = show.has('z');
    arrows.zNeg.visible = show.has('z');
}

export function hideAllArrows() {
    allArrows.forEach(a => { a.visible = false; });
}

/* pulse an arrow (scale 1→1.25→1) to draw attention */
export function pulseArrow(arrow, duration = 600) {
    const start = performance.now();
    const factor = getCharacterControlScale();
    function tick() {
        const t = clamp((performance.now() - start) / duration, 0, 1);
        const s = (1 + 0.25 * Math.sin(t * Math.PI)) * factor;
        arrow.scale.setScalar(s);
        if (t < 1) requestAnimationFrame(tick);
        else arrow.scale.setScalar(factor);
    }
    tick();
}

/* ── uniform scale: an outer ring that encircles the model (Blender-style) ──
   A camera-facing circle around the object. Grab it and drag outward to grow,
   inward to shrink. Reads as "resize the whole thing" far better than a dot at
   the center, and matches the convention in Blender / Maya / Unity. */
export const scaleHandle = new THREE.Group();
const UNIFORM_RING_R = 1.35;              // local radius (× control factor)
const SCALE_UNIFORM_COLOR = 0x5f6672;     // resting neutral ring color (slate grey)

export const scaleUniformMesh = new THREE.Mesh(
    new THREE.TorusGeometry(UNIFORM_RING_R, 0.025, 12, 100),
    new THREE.MeshBasicMaterial({
        color: SCALE_UNIFORM_COLOR, depthTest: false, depthWrite: false,
        transparent: true, opacity: 0.95,
    })
);
scaleUniformMesh.renderOrder = 998;
const uHit = new THREE.Mesh(
    // generous invisible grab zone - a near-miss on the thin ring should still
    // scale, not fall through to orbit and spin the camera on a beginner
    new THREE.TorusGeometry(UNIFORM_RING_R, 0.32, 8, 50),
    new THREE.MeshBasicMaterial({ visible: false })
);
scaleHandle.add(scaleUniformMesh, uHit);
scaleHandle.visible = false;
scene.add(scaleHandle);

export function updateScaleHandlePos() {
    if (!state.character) return;
    const sc = state.character.scale;
    // floor the ring size so it stays grabbable even when the model has been
    // shrunk to a speck - otherwise the student's only way back is Reset
    const factor = Math.max(
        state.characterControlRadius * Math.cbrt(sc.x * sc.y * sc.z),
        0.3
    );
    scaleHandle.position.copy(getCharacterCenterWorld());
    scaleHandle.scale.setScalar(factor);
    scaleHandle.quaternion.copy(camera.quaternion); // billboard: always face the camera
}

/* world position of the ring's screen-right edge - used to aim the demo cursor */
const _edgeOff = new THREE.Vector3();
export function getScaleRingEdgeWorld(target = new THREE.Vector3()) {
    getCharacterCenterWorld(target);
    if (!state.character) return target;
    const sc = state.character.scale;
    // same floored factor as updateScaleHandlePos so the cursor rides the ring
    const r = Math.max(
        state.characterControlRadius * Math.cbrt(sc.x * sc.y * sc.z),
        0.3
    ) * UNIFORM_RING_R;
    _edgeOff.set(1, 0, 0).applyQuaternion(camera.quaternion).multiplyScalar(r);
    return target.add(_edgeOff);
}

/* ── axis scale handles: one per axis, shaft + box head ── */
function makeScaleAxisHandle(color, dir) {
    const g = new THREE.Group();
    const norm = new THREE.Vector3().copy(dir).normalize();

    const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.9, 10),
        new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false })
    );
    shaft.position.y = 0.45;
    shaft.renderOrder = 998;

    const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.16, 0.16),
        new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false })
    );
    box.position.y = 1.0;
    box.renderOrder = 999;

    const hit = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.4, 0.4),
        new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 1.0;
    hit._isScaleAxisHit = true;

    g.add(shaft, box, hit);
    g.quaternion.setFromUnitVectors(V3(0, 1, 0), norm);
    // base orientation (local +Y → this axis); the model's rotation is applied
    // on top each frame so the handle points along the model's *local* axis -
    // which is the direction the scale actually stretches.
    g._baseQuat = g.quaternion.clone();
    g._axKey = Math.abs(norm.x) > 0.5 ? 'x' : Math.abs(norm.y) > 0.5 ? 'y' : 'z';
    g._color = color;
    g._visMeshes = [shaft, box];
    g.visible = false;
    scene.add(g);
    return g;
}

const scaleAxisX = makeScaleAxisHandle(AXIS_COLORS.x, V3(1, 0, 0));
const scaleAxisY = makeScaleAxisHandle(AXIS_COLORS.y, V3(0, 1, 0));
const scaleAxisZ = makeScaleAxisHandle(AXIS_COLORS.z, V3(0, 0, 1));
export const allScaleAxisHandles = [scaleAxisX, scaleAxisY, scaleAxisZ];

export function showScaleAxes() {
    allScaleAxisHandles.forEach(h => { h.visible = true; });
}
export function hideScaleAxes() {
    allScaleAxisHandles.forEach(h => { h.visible = false; });
}
export function updateScaleAxisPos() {
    if (!state.character) return;
    const sc = state.character.scale;
    const base = state.characterControlRadius;
    const center = getCharacterCenterWorld();
    const modelQuat = state.character.quaternion;
    allScaleAxisHandles.forEach(h => {
        h.position.copy(center);
        // rotate the handle with the model so it lines up with the local axis
        // the scale distorts along
        h.quaternion.multiplyQuaternions(modelQuat, h._baseQuat);
        // each handle scales along its own axis so it tracks the actual distortion
        h.scale.setScalar(Math.max(base * sc[h._axKey] * 1.15, 0.25));
    });
}

/* ── rotate handle: three rings for X, Y, Z rotation ──
   Thin crisp tubes drawn on top (so they're always visible and grabbable),
   over a faint sphere so the three rings read as one cohesive ball. */
export const rotateHandle = new THREE.Group();
const ROT_R = 0.85; // ring radius (local; × control factor)

function rotRingMat(color) {
    // depthTest ON so the solid robot mesh occludes the arcs that pass behind
    // it - a real depth cue instead of flat rings floating on top. Only the
    // robot writes depth here (the orb, hit rings, floor and grid don't), so
    // nothing else can hide the rings. depthWrite stays off so the three rings
    // blend over each other rather than z-fighting.
    return new THREE.MeshBasicMaterial({
        color, depthTest: true, depthWrite: false, transparent: true, opacity: 0.82,
    });
}
const rMatX = rotRingMat(AXIS_COLORS.x);
const rMatY = rotRingMat(AXIS_COLORS.y);
const rMatZ = rotRingMat(AXIS_COLORS.z);

// faint inner sphere backing - groups the rings into one "orb"
const rotOrb = new THREE.Mesh(
    new THREE.SphereGeometry(ROT_R * 0.97, 32, 24),
    new THREE.MeshBasicMaterial({ color: 0x8a8a8a, transparent: true, opacity: 0.05, depthWrite: false })
);
rotOrb.renderOrder = 996;

function makeHitRing(axis, visMesh, color) {
    const h = new THREE.Mesh(
        new THREE.TorusGeometry(ROT_R, 0.18, 8, 40),
        new THREE.MeshBasicMaterial({ visible: false })
    );
    h._axis = axis; h._visMesh = visMesh; h._color = color;
    return h;
}

const rX = new THREE.Mesh(new THREE.TorusGeometry(ROT_R, 0.02, 16, 128), rMatX);
rX.rotation.y = Math.PI / 2;
rX.renderOrder = 997;
rX.add(makeHitRing('x', rX, AXIS_COLORS.x));

const rY = new THREE.Mesh(new THREE.TorusGeometry(ROT_R, 0.02, 16, 128), rMatY);
rY.rotation.x = Math.PI / 2;
rY.renderOrder = 997;
rY.add(makeHitRing('y', rY, AXIS_COLORS.y));

const rZ = new THREE.Mesh(new THREE.TorusGeometry(ROT_R, 0.02, 16, 128), rMatZ);
rZ.renderOrder = 997;
rZ.add(makeHitRing('z', rZ, AXIS_COLORS.z));

rotateHandle.add(rotOrb, rX, rY, rZ);
rotateHandle.visible = false;
scene.add(rotateHandle);

export function updateRotateHandlePos() {
    if (!state.character) return;
    const factor = getCharacterControlScale();
    rotateHandle.position.copy(getCharacterCenterWorld());
    rotateHandle.scale.set(factor, factor, factor);
}

/* restore a hovered/dragged gizmo to its resting color */
export function restoreColor(obj) {
    if (!obj) return;
    if (obj._meshes) { // move arrow
        obj._meshes.forEach(m => m.material.color.setHex(obj._color));
    } else if (obj === scaleHandle) {
        scaleUniformMesh.material.color.setHex(SCALE_UNIFORM_COLOR);
    } else if (allScaleAxisHandles.includes(obj)) { // axis scale handle
        obj._visMeshes.forEach(m => m.material.color.setHex(obj._color));
    } else if (obj.parent === rotateHandle) { // rotation ring
        obj.material.color.setHex(obj.children[0]._color);
    }
}
