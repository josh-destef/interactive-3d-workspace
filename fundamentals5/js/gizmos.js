/* ═══════════════════════════════════════════════
   GIZMOS
   Move arrows, the scale handle, and the rotate rings —
   plus the helpers that keep them pinned to the character.
═══════════════════════════════════════════════ */
import * as THREE from 'three';
import { clamp, V3 } from './utils.js';
import { AXIS_COLORS } from './config.js';
import { scene } from './stage.js';
import { state } from './state.js';
import { getCharacterCenterWorld, getCharacterControlScale } from './character.js';

/* ── move arrows ──
   Three axis pairs (pos + neg), built from cylinders + cones.
   Introduced one pair at a time: X → Y → Z. */
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
    head.position.y = 1.325;

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

/* ── scale handle: a simple box above the character ── */
export const scaleHandle = new THREE.Group();

export const sBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.3, 0.3),
    new THREE.MeshBasicMaterial({ color: 0x00cccc, depthWrite: false })
);
const sHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.8, 0.8),
    new THREE.MeshBasicMaterial({ visible: false })
);
scaleHandle.add(sBox, sHit);
scaleHandle.visible = false;
scene.add(scaleHandle);

export function updateScaleHandlePos() {
    if (!state.character) return;
    const factor = getCharacterControlScale();
    const p = getCharacterCenterWorld();
    p.y += state.characterHeight * state.character.scale.y * 0.5 + factor * 0.2;
    scaleHandle.position.copy(p);
    scaleHandle.scale.set(factor, factor, factor);
}

/* ── rotate handle: three rings for X, Y, Z rotation ── */
export const rotateHandle = new THREE.Group();
const rMatX = new THREE.MeshBasicMaterial({ color: AXIS_COLORS.x, depthWrite: false, transparent: true, opacity: 0.85 });
const rMatY = new THREE.MeshBasicMaterial({ color: AXIS_COLORS.y, depthWrite: false, transparent: true, opacity: 0.85 });
const rMatZ = new THREE.MeshBasicMaterial({ color: AXIS_COLORS.z, depthWrite: false, transparent: true, opacity: 0.85 });

const rX = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 16, 64), rMatX);
rX.rotation.y = Math.PI / 2;
const hRX = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.25, 8, 32), new THREE.MeshBasicMaterial({ visible: false }));
hRX._axis = 'x'; hRX._visMesh = rX; hRX._color = AXIS_COLORS.x;
rX.add(hRX);

const rY = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 16, 64), rMatY);
rY.rotation.x = Math.PI / 2;
const hRY = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.25, 8, 32), new THREE.MeshBasicMaterial({ visible: false }));
hRY._axis = 'y'; hRY._visMesh = rY; hRY._color = AXIS_COLORS.y;
rY.add(hRY);

const rZ = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 16, 64), rMatZ);
const hRZ = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.25, 8, 32), new THREE.MeshBasicMaterial({ visible: false }));
hRZ._axis = 'z'; hRZ._visMesh = rZ; hRZ._color = AXIS_COLORS.z;
rZ.add(hRZ);

rotateHandle.add(rX, rY, rZ);
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
    if (obj._meshes) { // arrow
        obj._meshes.forEach(m => m.material.color.setHex(obj._color));
    } else if (obj === scaleHandle) {
        sBox.material.color.setHex(0x00cccc);
    } else if (obj.parent === rotateHandle) { // rotation ring
        obj.material.color.setHex(obj.children[0]._color);
    }
}
