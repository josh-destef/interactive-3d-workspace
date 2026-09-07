/* ═══════════════════════════════════════════════
   GIZMOS
   Move arrows, the scale ring, the axis scale boxes and the rotate rings -
   lifted from Navigate + Transform, with one change: they pin to whatever is
   selected rather than to the one character that lab had.

   Two handles are new. The extrude arrow is a move arrow pointed along a face
   normal, which is the whole of what extrude is. The bevel handle is a wedge
   at the nearest corner, because a corner is where a bevel is visible.
═══════════════════════════════════════════════ */
import * as THREE from 'three';
import { AXIS_COLORS } from './config.js';
import { FACES, faceCentreWorld, faceNormalWorld, getExtrude, faceSpan } from './model.js';
import { clamp } from '../../../kit/js/utils.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const ARROW_HEAD_Y = 1.325;
const UNIFORM_RING_R = 1.35;
const RING_COLOR = 0x5f6672;
const ROT_R = 0.85;

let scene = null;
export const layer = new THREE.Group();   // everything here ignores raycast depth

/* The target the whole rig is currently pinned to. */
const target = { object: null, centre: V3(), radius: 0.6 };

export function initGizmos(targetScene) {
    scene = targetScene;
    scene.add(layer);
    buildAll();
    hideAll();
}

/* ── move arrows ── */
function makeArrow(color, dir, opacity = 1) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
        color, transparent: opacity < 1, opacity, depthTest: false, depthWrite: false,
    });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 10), mat);
    shaft.position.y = 0.6;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.25, 10), mat);
    head.position.y = ARROW_HEAD_Y;
    /* a near-miss on a thin arrow should still move the object rather than
       fall through to orbit and spin the camera on a beginner */
    const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.34, 1.6, 8),
        new THREE.MeshBasicMaterial({ visible: false }),
    );
    hit.position.y = 0.8;
    hit._isHit = true;
    shaft.renderOrder = head.renderOrder = 998;
    g.add(shaft, head, hit);
    g.quaternion.setFromUnitVectors(V3(0, 1, 0), dir.clone().normalize());
    g._axis = dir.clone().normalize();
    g._axKey = Math.abs(dir.x) > 0.5 ? 'x' : Math.abs(dir.y) > 0.5 ? 'y' : 'z';
    g._color = color;
    g._meshes = [shaft, head];
    g._kind = 'move';
    g.visible = false;
    layer.add(g);
    return g;
}

export let arrows = {};
export let allArrows = [];

/* ── uniform scale ring ── */
export const scaleHandle = new THREE.Group();
export let scaleUniformMesh = null;

/* ── axis scale boxes ── */
function makeScaleAxis(color, dir) {
    const g = new THREE.Group();
    const norm = dir.clone().normalize();
    const mat = new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.9, 10), mat);
    shaft.position.y = 0.45;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), mat);
    box.position.y = 1.0;
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 1.0;
    hit._isHit = true;
    shaft.renderOrder = 998; box.renderOrder = 999;
    g.add(shaft, box, hit);
    g.quaternion.setFromUnitVectors(V3(0, 1, 0), norm);
    g._baseQuat = g.quaternion.clone();
    g._axKey = Math.abs(norm.x) > 0.5 ? 'x' : Math.abs(norm.y) > 0.5 ? 'y' : 'z';
    g._color = color;
    g._meshes = [shaft, box];
    g._kind = 'scaleAxis';
    g.visible = false;
    layer.add(g);
    return g;
}
export let allScaleAxis = [];

/* ── rotate rings ── */
export const rotateHandle = new THREE.Group();
export let rotRings = [];

/* ── extrude arrow + bevel handle + face highlight ── */
export const extrudeArrow = new THREE.Group();
export const bevelHandle = new THREE.Group();
export const insetHandle = new THREE.Group();
export const faceHighlight = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
        color: 0xff9022, transparent: true, opacity: 0.30,
        depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    }),
);
const faceOutline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)),
    new THREE.LineBasicMaterial({ color: 0xff9022, depthTest: false, transparent: true }),
);

function buildAll() {
    arrows = {
        xPos: makeArrow(AXIS_COLORS.x, V3(1, 0, 0)),
        xNeg: makeArrow(AXIS_COLORS.x, V3(-1, 0, 0), 0.35),
        yPos: makeArrow(AXIS_COLORS.y, V3(0, 1, 0)),
        yNeg: makeArrow(AXIS_COLORS.y, V3(0, -1, 0), 0.35),
        zPos: makeArrow(AXIS_COLORS.z, V3(0, 0, 1)),
        zNeg: makeArrow(AXIS_COLORS.z, V3(0, 0, -1), 0.35),
    };
    allArrows = Object.values(arrows);

    scaleUniformMesh = new THREE.Mesh(
        new THREE.TorusGeometry(UNIFORM_RING_R, 0.025, 12, 90),
        new THREE.MeshBasicMaterial({
            color: RING_COLOR, depthTest: false, depthWrite: false,
            transparent: true, opacity: 0.95,
        }),
    );
    scaleUniformMesh.renderOrder = 998;
    const ringHit = new THREE.Mesh(
        new THREE.TorusGeometry(UNIFORM_RING_R, 0.30, 8, 40),
        new THREE.MeshBasicMaterial({ visible: false }),
    );
    ringHit._isHit = true;
    scaleHandle.add(scaleUniformMesh, ringHit);
    scaleHandle._kind = 'scaleUniform';
    scaleHandle.visible = false;
    layer.add(scaleHandle);

    allScaleAxis = [
        makeScaleAxis(AXIS_COLORS.x, V3(1, 0, 0)),
        makeScaleAxis(AXIS_COLORS.y, V3(0, 1, 0)),
        makeScaleAxis(AXIS_COLORS.z, V3(0, 0, 1)),
    ];

    const ringMat = color => new THREE.MeshBasicMaterial({
        color, depthTest: false, depthWrite: false, transparent: true, opacity: 0.85,
    });
    const mk = (color, axis, rot) => {
        const m = new THREE.Mesh(new THREE.TorusGeometry(ROT_R, 0.02, 12, 96), ringMat(color));
        if (rot) m.rotation[rot] = Math.PI / 2;
        m.renderOrder = 997;
        const hit = new THREE.Mesh(
            new THREE.TorusGeometry(ROT_R, 0.16, 8, 32),
            new THREE.MeshBasicMaterial({ visible: false }),
        );
        hit._isHit = true;
        m.add(hit);
        m._axKey = axis;
        m._color = color;
        m._meshes = [m];
        m._kind = 'rotate';
        rotateHandle.add(m);
        return m;
    };
    rotRings = [
        mk(AXIS_COLORS.x, 'x', 'y'),
        mk(AXIS_COLORS.y, 'y', 'x'),
        mk(AXIS_COLORS.z, 'z', null),
    ];
    rotateHandle.visible = false;
    layer.add(rotateHandle);

    /* extrude: one arrow, coloured by whichever axis the normal lies along */
    const eMat = new THREE.MeshBasicMaterial({ color: AXIS_COLORS.z, depthTest: false, depthWrite: false });
    const eShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 10), eMat);
    eShaft.position.y = 0.45;
    const eHead = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.26, 10), eMat);
    eHead.position.y = 1.02;
    const eHit = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 1.3, 8), new THREE.MeshBasicMaterial({ visible: false }));
    eHit.position.y = 0.6;
    eHit._isHit = true;
    eShaft.renderOrder = eHead.renderOrder = 999;
    extrudeArrow.add(eShaft, eHead, eHit);
    extrudeArrow._kind = 'extrude';
    extrudeArrow._meshes = [eShaft, eHead];
    extrudeArrow._mat = eMat;
    extrudeArrow.visible = false;
    layer.add(extrudeArrow);

    /* bevel: a small wedge, read as "the corner you are rounding" */
    const bMat = new THREE.MeshBasicMaterial({ color: 0xff9022, depthTest: false, depthWrite: false });
    const bBox = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), bMat);
    const bHit = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    bHit._isHit = true;
    bBox.renderOrder = 999;
    bevelHandle.add(bBox, bHit);
    bevelHandle._kind = 'bevel';
    bevelHandle._meshes = [bBox];
    bevelHandle.visible = false;
    layer.add(bevelHandle);

    /* inset: a small square that sits on the corner of the highlighted face
       and is dragged toward its middle. A ring handle would read as "rotate";
       a square on the corner reads as "pull this edge inward". */
    const iMat = new THREE.MeshBasicMaterial({ color: 0xff9022, depthTest: false, depthWrite: false });
    const iBox = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.03), iMat);
    const iHit = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), new THREE.MeshBasicMaterial({ visible: false }));
    iHit._isHit = true;
    iBox.renderOrder = 999;
    insetHandle.add(iBox, iHit);
    insetHandle._kind = 'inset';
    insetHandle._meshes = [iBox];
    insetHandle.visible = false;
    layer.add(insetHandle);

    faceHighlight.renderOrder = 996;
    faceOutline.renderOrder = 997;
    faceHighlight.visible = false;
    faceOutline.visible = false;
    layer.add(faceHighlight, faceOutline);
}

/* ── target ── */
const _box = new THREE.Box3();
const _size = new THREE.Vector3();

export function setGizmoTarget(object3D) {
    target.object = object3D || null;
}

export function gizmoTarget() { return target.object; }
export function targetCentre() { return target.centre.clone(); }
export function targetRadius() { return target.radius; }
/* A stable point on the visible uniform-scale ring, used by the lesson demo
   so the animated mouse lands on the same handle a student should drag. */
export function scaleRingPoint() {
    if (!scaleUniformMesh) return target.centre.clone();
    scaleUniformMesh.updateMatrixWorld();
    return scaleUniformMesh.localToWorld(new THREE.Vector3(UNIFORM_RING_R, 0, 0));
}
export function scaleAxisPoint(axis = 'x') {
    const handle = allScaleAxis.find(h => h._axKey === axis);
    if (!handle) return target.centre.clone();
    handle.updateMatrixWorld();
    return handle.localToWorld(new THREE.Vector3(0, 1, 0));
}
export function extrudeArrowPoint() {
    extrudeArrow.updateMatrixWorld();
    return extrudeArrow.localToWorld(new THREE.Vector3(0, 1.02, 0));
}
/* The point a Watch demo should press when it teaches an axis move. */
export function moveHandlePoint(axis = 'x') {
    const arrow = arrows[axis + 'Pos'];
    if (!arrow) return target.centre.clone();
    arrow.updateMatrixWorld();
    return arrow.localToWorld(new THREE.Vector3(0, ARROW_HEAD_Y, 0));
}

/** Kept in sync every frame: the rig has to follow a drag, not lag it. */
export function updateGizmos(camera) {
    if (!target.object) return;
    _box.setFromObject(target.object);
    if (_box.isEmpty()) return;
    _box.getCenter(target.centre);
    _box.getSize(_size);
    target.radius = Math.max(Math.max(_size.x, _size.y, _size.z) * 0.62, 0.28);

    const r = target.radius;
    allArrows.forEach(a => { a.position.copy(target.centre); a.scale.setScalar(r); });

    scaleHandle.position.copy(target.centre);
    scaleHandle.scale.setScalar(r);
    scaleHandle.quaternion.copy(camera.quaternion);   // billboard

    const q = target.object.getWorldQuaternion(new THREE.Quaternion());
    const s = target.object.scale;
    allScaleAxis.forEach(h => {
        h.position.copy(target.centre);
        h.quaternion.multiplyQuaternions(q, h._baseQuat);
        h.scale.setScalar(Math.max(r * s[h._axKey] * 0.95, 0.22));
    });

    rotateHandle.position.copy(target.centre);
    rotateHandle.scale.setScalar(r);
}

/** The extrude arrow and face highlight ride the selected face. */
export function updateFaceGizmos(entry, face) {
    const on = !!(entry && face && entry.kind === 'box');
    faceHighlight.visible = on;
    faceOutline.visible = on;
    if (!on) { extrudeArrow.visible = false; bevelHandle.visible = false; return; }

    const centre = faceCentreWorld(entry, face);
    const normal = faceNormalWorld(entry, face);
    const q = entry.mesh.getWorldQuaternion(new THREE.Quaternion());

    /* the highlight is the region a push would actually move, so insetting
       visibly shrinks it. That shrinking IS the feedback for inset: on its own
       it changes the topology and not the silhouette, so there is nothing else
       on screen to see. */
    const span = faceSpan(entry, face.id);
    const scale = entry.mesh.getWorldScale(new THREE.Vector3());
    const across = face.axis === 'x' ? [scale.z, scale.y] : face.axis === 'y' ? [scale.x, scale.z] : [scale.x, scale.y];
    faceHighlight.position.copy(centre).addScaledVector(normal, 0.004);
    faceHighlight.quaternion.copy(q).multiply(faceQuat(face));
    faceHighlight.scale.set(across[0] * span, across[1] * span, 1);
    faceOutline.position.copy(faceHighlight.position);
    faceOutline.quaternion.copy(faceHighlight.quaternion);
    faceOutline.scale.copy(faceHighlight.scale);

    const r = Math.max(target.radius, 0.3);
    extrudeArrow.position.copy(centre);
    extrudeArrow.quaternion.setFromUnitVectors(V3(0, 1, 0), normal);
    extrudeArrow.scale.setScalar(r * 0.8);
    extrudeArrow._mat.color.setHex(AXIS_COLORS[face.axis]);

    /* nearest corner of the face, so the wedge sits where a bevel shows */
    const corner = faceCentreLocalCorner(entry, face);
    bevelHandle.position.copy(entry.mesh.localToWorld(corner));
    bevelHandle.scale.setScalar(Math.max(r * 0.7, 0.22));

    /* the inset handle rides the corner of the highlight, so it is always on
       the edge the student is about to pull inward */
    insetHandle.position.copy(faceHighlight.position)
        .addScaledVector(cornerAcross(faceHighlight, 0), faceHighlight.scale.x / 2)
        .addScaledVector(cornerAcross(faceHighlight, 1), faceHighlight.scale.y / 2);
    insetHandle.quaternion.copy(faceHighlight.quaternion);
    insetHandle.scale.setScalar(Math.max(r * 0.75, 0.2));
}

/** World direction of the highlight quad's own X (0) or Y (1) axis. */
const _col = new THREE.Vector3();
export function cornerAcross(quad, index) {
    quad.updateMatrixWorld();
    return _col.setFromMatrixColumn(quad.matrixWorld, index).normalize().clone();
}

const _pq = new THREE.Quaternion();
function faceQuat(face) {
    return _pq.setFromUnitVectors(V3(0, 0, 1), face.n).clone();
}

function faceCentreLocalCorner(entry, face) {
    const d = getExtrude(entry, face.id);
    const c = face.n.clone().multiplyScalar(0.5 + d);
    const inset = 0.5;
    if (face.axis !== 'x') c.x += inset;
    if (face.axis !== 'y') c.y += inset;
    if (face.axis !== 'z') c.z += inset;
    return c;
}

/* ── visibility ──
   Which handles are up is a question about the armed tool and the mode, so
   it is answered in one place rather than at every call site. */
export function showFor({ tool, mode, hasTarget, hasFace }) {
    hideAll();
    if (!hasTarget) return;
    if (mode === 'edit') {
        if (tool === 'extrude') extrudeArrow.visible = !!hasFace;
        else if (tool === 'bevel') bevelHandle.visible = !!hasFace;
        else if (tool === 'inset') insetHandle.visible = !!hasFace;
        return;
    }
    if (tool === 'move') allArrows.forEach(a => { a.visible = true; });
    else if (tool === 'scale') { scaleHandle.visible = true; allScaleAxis.forEach(h => { h.visible = true; }); }
    else if (tool === 'rotate') rotateHandle.visible = true;
}

export function hideAll() {
    allArrows.forEach(a => { a.visible = false; });
    allScaleAxis.forEach(h => { h.visible = false; });
    scaleHandle.visible = false;
    rotateHandle.visible = false;
    extrudeArrow.visible = false;
    bevelHandle.visible = false;
    insetHandle.visible = false;
}

export function hideFaceHighlight() {
    faceHighlight.visible = false;
    faceOutline.visible = false;
}

/* ── hover feedback ── */
export function restoreColor(obj) {
    if (!obj) return;
    if (obj._kind === 'extrude') { obj._mat.color.setHex(AXIS_COLORS.z); return; }
    if (obj === scaleHandle) { scaleUniformMesh.material.color.setHex(RING_COLOR); return; }
    if (obj._meshes && obj._color !== undefined) obj._meshes.forEach(m => m.material.color.setHex(obj._color));
}

export function highlight(obj) {
    if (!obj) return;
    if (obj === scaleHandle) { scaleUniformMesh.material.color.setHex(0xff9022); return; }
    if (obj._meshes) obj._meshes.forEach(m => m.material.color.setHex(0xffb15e));
}

/** Every hit mesh currently visible, for the raycaster, in priority order. */
export function pickables() {
    const out = [];
    const add = group => {
        if (!group.visible) return;
        group.traverse(c => { if (c._isHit) out.push({ mesh: c, handle: group }); });
    };
    allScaleAxis.forEach(add);
    add(extrudeArrow);
    add(bevelHandle);
    add(insetHandle);
    allArrows.forEach(add);
    add(scaleHandle);
    rotRings.forEach(r => { if (rotateHandle.visible) add(r); });
    return out;
}

export const clampScale = (v, lo, hi) => clamp(v, lo, hi);
