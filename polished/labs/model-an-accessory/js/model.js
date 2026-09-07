/* ═══════════════════════════════════════════════
   MODEL
   The thing the student is building, and the only place it changes.

   A modelled object here is a box plus a per-face extrusion depth, rebuilt
   into one merged geometry whenever either changes. That is a real
   simplification of a mesh editor, and it is the one that buys the most:
   extrude and bevel stay direct, undo stays a snapshot of plain data, and
   there is never a broken mesh to get stuck in.

   A face carries two numbers: how far it has been INSET, and how far it has
   been pushed OUT. Inset alone changes no silhouette - it makes a smaller
   face inside the face, which is topology, not shape. Push alone, with no
   inset, moves the whole face and is arithmetically identical to scaling on
   that axis.

   Keeping them apart is the point. Together they make a panel; separately
   they are the two halves of why extruding a whole face looks like nothing
   new happened, which is the thing beginners get stuck on.
═══════════════════════════════════════════════ */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { LIMITS, SPAWN, COLORS } from './config.js';
import { createMountPlug } from './port.js';
import { clamp } from '../../../kit/js/utils.js';

/* ── the six faces ──
   Named for where they sit on a back module rather than by axis letter:
   INNER is the side facing Gizmobot, which is where the mount goes. */
export const FACES = [
    { id: 0, axis: 'x', sign: 1, n: new THREE.Vector3(1, 0, 0), label: 'RIGHT' },
    { id: 1, axis: 'x', sign: -1, n: new THREE.Vector3(-1, 0, 0), label: 'LEFT' },
    { id: 2, axis: 'y', sign: 1, n: new THREE.Vector3(0, 1, 0), label: 'TOP' },
    { id: 3, axis: 'y', sign: -1, n: new THREE.Vector3(0, -1, 0), label: 'BOTTOM' },
    { id: 4, axis: 'z', sign: 1, n: new THREE.Vector3(0, 0, 1), label: 'INNER' },
    { id: 5, axis: 'z', sign: -1, n: new THREE.Vector3(0, 0, -1), label: 'OUTER' },
];
export const INNER_FACE = 4;

export const state = {
    root: null,          // everything the student made hangs off this
    entries: [],         // flat registry; parentId gives the tree
    mount: null,         // { objectId, u, v, colour, object3D } - the plug half
    attached: false,     // has the module been parented to Gizmobot yet
    nextId: 1,
};

let scene = null;

export function initModel(targetScene) {
    scene = targetScene;
    state.root = new THREE.Group();
    state.root.name = 'Gizmo_BackModule';
    scene.add(state.root);
    return state.root;
}

const nid = prefix => prefix + '-' + (state.nextId++);

/* Slightly glossy and very slightly metallic. Flat matte fill reads as an
   untextured placeholder; a little specular is what makes a bevel visible at
   all, which is the whole reason step 6 exists. */
const makeMaterial = colour => new THREE.MeshStandardMaterial({
    color: new THREE.Color(colour), roughness: 0.42, metalness: 0.12,
});

/* ── geometry ──
   Rebuilt whole rather than patched. At this scale the rebuild is free, and
   a build that always runs the same way cannot drift out of step with the
   data that describes it. */

function boxPart(w, h, d, bevel, seg) {
    const r = Math.min(bevel, w * 0.49, h * 0.49, d * 0.49);
    const g = r > 0.001
        ? new RoundedBoxGeometry(w, h, d, seg, r)
        : new THREE.BoxGeometry(w, h, d);
    /* merging needs every part to agree; RoundedBoxGeometry already is */
    return g.index ? g.toNonIndexed() : g;
}

function buildBoxGeometry(entry) {
    const { bevel, seg, extrusions } = entry;
    const parts = [boxPart(1, 1, 1, bevel, seg)];

    for (const face of FACES) {
        const depth = extrusions[face.id] || 0;
        if (depth <= 0.001) continue;
        /* the pushed region is whatever the inset left: no inset means the
           whole face travels, which is exactly why that reads as a stretch */
        const span = faceSpan(entry, face.id);
        /* overlap the parent box slightly so the union reads as one solid
           rather than two boxes touching at a hairline */
        const run = depth + 0.04;
        const dims = { x: span, y: span, z: span };
        dims[face.axis] = run;
        const g = boxPart(dims.x, dims.y, dims.z, bevel, seg);
        const offset = 0.5 + depth / 2 - 0.02;
        g.translate(
            face.axis === 'x' ? face.sign * offset : 0,
            face.axis === 'y' ? face.sign * offset : 0,
            face.axis === 'z' ? face.sign * offset : 0,
        );
        parts.push(g);
    }

    if (parts.length === 1) return parts[0];
    const merged = BufferGeometryUtils.mergeGeometries(parts, false);
    parts.forEach(p => p.dispose());
    return merged;
}

function buildGeometry(entry) {
    if (entry.kind === 'box') return buildBoxGeometry(entry);
    if (entry.kind === 'cylinder') return new THREE.CylinderGeometry(0.5, 0.5, 1, 28);
    return new THREE.SphereGeometry(0.5, 28, 18);
}

export function rebuildGeometry(entry) {
    if (!entry.mesh || entry.kind === 'group') return;
    const old = entry.mesh.geometry;
    entry.mesh.geometry = buildGeometry(entry);
    old?.dispose();
}

/* ── objects ── */

export function canAdd() {
    return state.entries.filter(e => e.kind !== 'group').length < LIMITS.maxObjects;
}

function labelFor(kind) {
    const base = kind === 'box' ? 'Cube' : kind === 'cylinder' ? 'Cylinder' : 'Sphere';
    const n = state.entries.filter(e => e.kind === kind).length + 1;
    return n > 1 ? base + ' ' + n : base;
}

export function addObject(kind = 'box', { position = null, color = null } = {}) {
    if (!canAdd()) return null;
    const entry = {
        id: nid('obj'), kind, name: labelFor(kind), parentId: null,
        bevel: 0, seg: 3, insets: {}, extrusions: {}, color: color || COLORS[0],
    };
    const mesh = new THREE.Mesh(buildGeometry(entry), makeMaterial(entry.color));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = entry.name.replace(/\s+/g, '_');
    mesh.userData.entryId = entry.id;

    /* land in front of whatever is already there, not inside it */
    const spawn = position ? position.clone() : SPAWN.clone();
    if (!position && state.entries.length) spawn.z -= 0.75;
    mesh.position.copy(spawn);

    entry.mesh = mesh;
    state.root.add(mesh);
    state.entries.push(entry);
    return entry;
}

export function duplicateObject(id) {
    const src = getEntry(id);
    if (!src || src.kind === 'group' || !canAdd()) return null;
    const copy = addObject(src.kind, { position: src.mesh.position, color: src.color });
    if (!copy) return null;
    copy.bevel = src.bevel;
    copy.seg = src.seg;
    copy.insets = { ...src.insets };
    copy.extrusions = { ...src.extrusions };
    copy.mesh.quaternion.copy(src.mesh.quaternion);
    copy.mesh.scale.copy(src.mesh.scale);
    copy.mesh.position.copy(src.mesh.position);
    copy.mesh.position.x += 0.25;
    rebuildGeometry(copy);
    return copy;
}

export function removeObject(id) {
    const entry = getEntry(id);
    if (!entry) return;
    if (state.mount?.objectId === id) removeMount();
    entry.mesh.parent?.remove(entry.mesh);
    entry.mesh.geometry?.dispose();
    entry.mesh.material?.dispose();
    state.entries = state.entries.filter(e => e.id !== id);
    state.entries.filter(e => e.parentId === id).forEach(e => { e.parentId = null; });
}

export const getEntry = id => state.entries.find(e => e.id === id) || null;
export const entryForObject3D = obj => {
    let node = obj;
    while (node) {
        if (node.userData?.entryId) return getEntry(node.userData.entryId);
        node = node.parent;
    }
    return null;
};

/* Top-level rows for the object list: anything with no parent. */
export const rootEntries = () => state.entries.filter(e => !e.parentId);
export const childrenOf = id => state.entries.filter(e => e.parentId === id);

/* ── grouping ──
   attach() rather than add(), so the pieces keep the world transform the
   student put them in. That is the whole promise of the step: grouping
   changes what moves together, and moves nothing on its own. */
export function groupObjects(ids, name = 'Group') {
    const members = ids.map(getEntry).filter(Boolean);
    if (members.length < 2) return null;

    const centre = new THREE.Vector3();
    members.forEach(m => centre.add(m.mesh.getWorldPosition(new THREE.Vector3())));
    centre.divideScalar(members.length);

    const group = new THREE.Group();
    group.name = name.replace(/\s+/g, '_');
    group.position.copy(state.root.worldToLocal(centre.clone()));
    state.root.add(group);

    const entry = {
        id: nid('grp'), kind: 'group', name, parentId: null,
        bevel: 0, seg: 2, extrusions: {}, color: null, mesh: group,
    };
    group.userData.entryId = entry.id;
    state.entries.push(entry);

    members.forEach(m => { group.attach(m.mesh); m.parentId = entry.id; });
    return entry;
}

export function ungroup(id) {
    const entry = getEntry(id);
    if (!entry || entry.kind !== 'group') return;
    childrenOf(id).forEach(child => { state.root.attach(child.mesh); child.parentId = null; });
    entry.mesh.parent?.remove(entry.mesh);
    state.entries = state.entries.filter(e => e.id !== id);
}

/* ── per-object edits ── */

/** How much of a face is left after its inset: 1.0 is the whole face. */
export function faceSpan(entry, faceId) {
    return clamp(1 - 2 * getInset(entry, faceId), LIMITS.insetMinSpan, 1);
}

export function setInset(entry, faceId, value) {
    if (!entry || entry.kind !== 'box') return 0;
    const i = clamp(value, 0, LIMITS.insetMax);
    if (i <= 0.001) delete entry.insets[faceId];
    else entry.insets[faceId] = i;
    rebuildGeometry(entry);
    return i;
}
export const getInset = (entry, faceId) => (entry && entry.insets?.[faceId]) || 0;

export function setExtrude(entry, faceId, depth) {
    if (!entry || entry.kind !== 'box') return 0;
    const d = clamp(depth, LIMITS.extrudeMin, LIMITS.extrudeMax);
    if (d <= 0.001) delete entry.extrusions[faceId];
    else entry.extrusions[faceId] = d;
    rebuildGeometry(entry);
    return d;
}
export const getExtrude = (entry, faceId) =>
    (entry && entry.extrusions[faceId]) || 0;

export function setBevel(entry, r) {
    if (!entry || entry.kind !== 'box') return 0;
    entry.bevel = clamp(r, 0, LIMITS.bevelMax);
    rebuildGeometry(entry);
    return entry.bevel;
}

export function setSegments(entry, n) {
    if (!entry || entry.kind !== 'box') return 2;
    entry.seg = Math.round(clamp(n, LIMITS.segMin, LIMITS.segMax));
    rebuildGeometry(entry);
    return entry.seg;
}

export function setColor(entry, hex) {
    if (!entry || entry.kind === 'group') return;
    entry.color = hex;
    entry.mesh.material.color.set(hex);
}

/* ── faces ──
   Classified from the hit point in the object's own space: whichever axis
   sits furthest out is the face that was clicked. An extrusion pushes its
   points past 0.5 on that axis, so a boss classifies as its own face for
   free rather than needing its own hit geometry. */
export function faceFromPoint(entry, worldPoint) {
    if (!entry || entry.kind !== 'box') return null;
    const local = entry.mesh.worldToLocal(worldPoint.clone());
    let best = null, bestScore = -Infinity;
    for (const face of FACES) {
        const score = local[face.axis] * face.sign;
        if (score > bestScore) { bestScore = score; best = face; }
    }
    return best;
}

/** Centre of a face in object space, pushed out by any extrusion on it. */
export function faceCentreLocal(entry, face) {
    const d = getExtrude(entry, face.id);
    return face.n.clone().multiplyScalar(0.5 + d);
}

export function faceCentreWorld(entry, face) {
    return entry.mesh.localToWorld(faceCentreLocal(entry, face));
}

/** World-space normal of a face, honouring the object's rotation. */
export function faceNormalWorld(entry, face) {
    return face.n.clone()
        .applyQuaternion(entry.mesh.getWorldQuaternion(new THREE.Quaternion()))
        .normalize();
}

/* ── the mount ──
   The module's half of the magnetic joint. Stored as a position on the inner
   face rather than an offset, so it stays put on that face when the module is
   later scaled, extruded or bevelled, and the snap still lines up afterwards.

   Its axis points along the module's +Z, straight at Gizmobot's back. */
export function addMount(objectId, u = 0, v = 0, colour = '#ff9022') {
    const entry = getEntry(objectId);
    if (!entry || entry.kind !== 'box') return null;
    if (state.mount) removeMount();

    const plug = createMountPlug(new THREE.Color(colour).getHex());
    plug.name = 'Mount';
    state.mount = { objectId, u, v, colour, object3D: plug };
    entry.mesh.add(plug);
    placeMount();
    return state.mount;
}

export function removeMount() {
    if (!state.mount) return;
    state.mount.object3D.parent?.remove(state.mount.object3D);
    state.mount = null;
}

/** u and v run across the inner face; the plug never leaves it. */
export function moveMount(u, v) {
    if (!state.mount) return;
    state.mount.u = clamp(u, -LIMITS.mountHalfWidth, LIMITS.mountHalfWidth);
    state.mount.v = clamp(v, -LIMITS.mountHalfHeight, LIMITS.mountHalfHeight);
    placeMount();
}

export function placeMount() {
    const m = state.mount;
    if (!m) return;
    const entry = getEntry(m.objectId);
    if (!entry) { removeMount(); return; }
    const d = getExtrude(entry, INNER_FACE);
    m.object3D.position.set(m.u, m.v, 0.5 + d);
    /* the plug is built along +Z with its mating face at z = 0, which is
       already the direction the inner face looks, so no rotation is needed */
    m.object3D.rotation.set(0, 0, 0);
    /* the module gets scaled non-uniformly, and a squashed connector would
       never read as the same part as his port - so undo the parent's scale */
    const s = entry.mesh.scale;
    m.object3D.scale.set(1 / (s.x || 1), 1 / (s.y || 1), 1 / (s.z || 1));
}

export function setMountColour(hex) {
    if (!state.mount) return;
    state.mount.colour = hex;
    const c = new THREE.Color(hex).getHex();
    state.mount.object3D.traverse(n => {
        if (n.isMesh && n.name === 'Plug_Ring') n.material.color.setHex(c);
    });
}

export function mountWorldPoint() {
    return state.mount ? state.mount.object3D.getWorldPosition(new THREE.Vector3()) : null;
}

export function setMountActive(on) {
    state.mount?.object3D.setActive?.(on);
}

/* ── the snap ──
   Always moves the module ROOT rather than whatever happens to be selected,
   so the result is the same whether the student dragged the body, a detail or
   the finished group. */
export function distanceToPort(portWorld) {
    const mount = mountWorldPoint();
    return mount && portWorld ? mount.distanceTo(portWorld) : Infinity;
}

export function snapToPort(portWorld) {
    const mount = mountWorldPoint();
    if (!mount || !portWorld) return false;
    if (mount.distanceTo(portWorld) > LIMITS.snapDistance) return false;
    state.root.position.add(portWorld.clone().sub(mount));
    state.root.updateMatrixWorld(true);
    return true;
}

/* ── measurements for the readout ── */
export function worldSizeOf(entry) {
    if (!entry) return new THREE.Vector3();
    const box = new THREE.Box3().setFromObject(entry.mesh);
    return box.getSize(new THREE.Vector3());
}

/* ── snapshots ──
   Undo, replay and the demo's restore all run through these two functions,
   so none of them can disagree about what the scene was. */
export function serialize() {
    return {
        nextId: state.nextId,
        attached: state.attached,
        entries: state.entries.map(e => ({
            id: e.id, kind: e.kind, name: e.name, parentId: e.parentId,
            bevel: e.bevel, seg: e.seg, color: e.color,
            insets: { ...e.insets },
            extrusions: { ...e.extrusions },
            pos: e.mesh.position.toArray(),
            quat: e.mesh.quaternion.toArray(),
            scale: e.mesh.scale.toArray(),
        })),
        mount: state.mount
            ? { objectId: state.mount.objectId, u: state.mount.u, v: state.mount.v, colour: state.mount.colour }
            : null,
        rootPos: state.root.position.toArray(),
        rootQuat: state.root.quaternion.toArray(),
        rootScale: state.root.scale.toArray(),
    };
}

export function restore(snap, { gizmobot = null } = {}) {
    [...state.entries].forEach(e => {
        e.mesh.parent?.remove(e.mesh);
        if (e.kind !== 'group') { e.mesh.geometry?.dispose(); e.mesh.material?.dispose(); }
    });
    removeMount();
    state.entries = [];
    state.nextId = snap.nextId;
    state.attached = snap.attached;

    /* groups first, so a child always has a parent to land in */
    const byId = new Map();
    const ordered = [...snap.entries].sort((a, b) => (a.kind === 'group' ? -1 : 1) - (b.kind === 'group' ? -1 : 1));

    for (const s of ordered) {
        let entry;
        if (s.kind === 'group') {
            const group = new THREE.Group();
            group.name = s.name.replace(/\s+/g, '_');
            entry = { ...s, mesh: group, insets: { ...s.insets }, extrusions: { ...s.extrusions } };
            group.userData.entryId = s.id;
        } else {
            entry = { ...s, mesh: null, insets: { ...s.insets }, extrusions: { ...s.extrusions } };
            const mesh = new THREE.Mesh(buildGeometry(entry), makeMaterial(s.color));
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.name = s.name.replace(/\s+/g, '_');
            mesh.userData.entryId = s.id;
            entry.mesh = mesh;
        }
        entry.mesh.position.fromArray(s.pos);
        entry.mesh.quaternion.fromArray(s.quat);
        entry.mesh.scale.fromArray(s.scale);
        byId.set(s.id, entry);
        state.entries.push(entry);
    }

    for (const entry of state.entries) {
        const parent = entry.parentId ? byId.get(entry.parentId)?.mesh : null;
        (parent || state.root).add(entry.mesh);
    }

    /* Root transforms are local to whichever parent the snapshot names.
       Reparent without preserving the current world transform, then restore
       the complete saved local transform. This makes scene <-> Gizmobot
       attachment transitions faithfully undoable. */
    const rootParent = state.attached && gizmobot ? gizmobot : scene;
    rootParent?.add(state.root);
    state.root.position.fromArray(snap.rootPos || [0, 0, 0]);
    state.root.quaternion.fromArray(snap.rootQuat || [0, 0, 0, 1]);
    state.root.scale.fromArray(snap.rootScale || [1, 1, 1]);
    if (snap.mount && byId.has(snap.mount.objectId)) {
        addMount(snap.mount.objectId, snap.mount.u, snap.mount.v, snap.mount.colour);
    }
}

export function clearAll() {
    restore({ nextId: 1, attached: false, entries: [], mount: null, rootPos: [0, 0, 0] });
}
