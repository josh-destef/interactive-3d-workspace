import * as THREE from 'three';
import { LIMITS, SPAWN, COLORS } from './config.js';
import { createMountPlug } from './port.js';

export const state = { root: null, entries: [], mount: null, attached: false, nextId: 1 };
let scene = null;
const nid = prefix => prefix + '-' + (state.nextId++);
const material = colour => new THREE.MeshStandardMaterial({ color: new THREE.Color(colour), roughness: 0.42, metalness: 0.12 });

export function initModel(targetScene) {
    scene = targetScene;
    state.root = new THREE.Group(); state.root.name = 'Gizmo_BackModule'; scene.add(state.root);
    return state.root;
}
const geometryFor = kind => kind === 'box' ? new THREE.BoxGeometry(1, 1, 1)
    : kind === 'cylinder' ? new THREE.CylinderGeometry(0.5, 0.5, 1, 28) : new THREE.SphereGeometry(0.5, 28, 18);
export const canAdd = () => state.entries.filter(e => e.kind !== 'group').length < LIMITS.maxObjects;
const labelFor = kind => { const base = kind === 'box' ? 'Cube' : kind === 'cylinder' ? 'Cylinder' : 'Sphere'; const n = state.entries.filter(e => e.kind === kind).length + 1; return n > 1 ? base + ' ' + n : base; };

export function addObject(kind = 'box', { position = null, color = null } = {}) {
    if (!canAdd()) return null;
    const entry = { id: nid('obj'), kind, name: labelFor(kind), parentId: null, color: color || COLORS[0] };
    const mesh = new THREE.Mesh(geometryFor(kind), material(entry.color));
    mesh.castShadow = mesh.receiveShadow = true; mesh.name = entry.name.replace(/\s+/g, '_'); mesh.userData.entryId = entry.id;
    const spawn = position ? position.clone() : SPAWN.clone(); if (!position && state.entries.length) spawn.z -= 0.75;
    mesh.position.copy(spawn); entry.mesh = mesh; state.root.add(mesh); state.entries.push(entry); return entry;
}
export function duplicateObject(id) {
    const src = getEntry(id); if (!src || src.kind === 'group' || !canAdd()) return null;
    const copy = addObject(src.kind, { color: src.color }); if (!copy) return null;
    // A grouped piece uses its group's coordinates. Copy its full transform in
    // the module frame so duplication stays beside the visible source.
    state.root.updateWorldMatrix(true, true);
    const local = new THREE.Matrix4().copy(state.root.matrixWorld).invert().multiply(src.mesh.matrixWorld);
    local.decompose(copy.mesh.position, copy.mesh.quaternion, copy.mesh.scale);
    copy.mesh.position.x += 0.25; return copy;
}
export const getEntry = id => state.entries.find(e => e.id === id) || null;
export const entryForObject3D = obj => { for (let node = obj; node; node = node.parent) if (node.userData?.entryId) return getEntry(node.userData.entryId); return null; };
export const rootEntries = () => state.entries.filter(e => !e.parentId);
export const childrenOf = id => state.entries.filter(e => e.parentId === id);

export function groupObjects(ids, name = 'Back Unit') {
    const leaves = entry => !entry ? [] : entry.kind === 'group' ? childrenOf(entry.id).flatMap(leaves) : [entry];
    const members = [...new Set(ids.map(getEntry).flatMap(leaves))]; if (members.length < 2) return null;
    const oldParents = new Set(members.map(e => e.parentId).filter(Boolean));
    const centre = members.reduce((sum, e) => sum.add(e.mesh.getWorldPosition(new THREE.Vector3())), new THREE.Vector3()).divideScalar(members.length);
    const mesh = new THREE.Group(); mesh.name = name.replace(/\s+/g, '_'); mesh.position.copy(state.root.worldToLocal(centre.clone())); state.root.add(mesh);
    const entry = { id: nid('grp'), kind: 'group', name, parentId: null, color: null, mesh }; mesh.userData.entryId = entry.id; state.entries.push(entry);
    members.forEach(member => { mesh.attach(member.mesh); member.parentId = entry.id; });
    oldParents.forEach(id => { const old = getEntry(id); if (old && !childrenOf(id).length) { old.mesh.parent?.remove(old.mesh); state.entries = state.entries.filter(e => e.id !== id); } });
    return entry;
}
export function ungroup(id) { const group = getEntry(id); if (!group || group.kind !== 'group') return; childrenOf(id).forEach(child => { state.root.attach(child.mesh); child.parentId = null; }); group.mesh.parent?.remove(group.mesh); state.entries = state.entries.filter(e => e.id !== id); }
export function setColor(entry, hex) { if (!entry || entry.kind === 'group') return; entry.color = hex; entry.mesh.material.color.set(hex); }

export function addMount(objectId, colour = '#ff9022') {
    const entry = getEntry(objectId); if (!entry || entry.kind !== 'box') return null; removeMount();
    const object3D = createMountPlug(new THREE.Color(colour).getHex()); object3D.name = 'Mount'; state.mount = { objectId, colour, object3D }; entry.mesh.add(object3D); placeMount(); return state.mount;
}
export function removeMount() { if (state.mount) state.mount.object3D.parent?.remove(state.mount.object3D); state.mount = null; }
export function placeMount() { const entry = getEntry(state.mount?.objectId); if (!entry) return; state.mount.object3D.position.set(0, 0, 0.5); const s = entry.mesh.scale; state.mount.object3D.scale.set(1 / (s.x || 1), 1 / (s.y || 1), 1 / (s.z || 1)); }
export function setMountColour(hex) { if (!state.mount) return; state.mount.colour = hex; const colour = new THREE.Color(hex).getHex(); state.mount.object3D.traverse(node => { if (node.isMesh && node.name === 'Plug_Ring') node.material.color.setHex(colour); }); }
export const mountWorldPoint = () => state.mount?.object3D.getWorldPosition(new THREE.Vector3()) || null;
export const setMountActive = on => state.mount?.object3D.setActive?.(on);
export const distanceToPort = point => { const mount = mountWorldPoint(); return mount && point ? mount.distanceTo(point) : Infinity; };
export function snapToPort(point) {
    const mount = mountWorldPoint(); if (!mount || !point || mount.distanceTo(point) > LIMITS.snapDistance) return false;
    const destination = state.root.getWorldPosition(new THREE.Vector3()).add(point.clone().sub(mount));
    state.root.position.copy(state.root.parent ? state.root.parent.worldToLocal(destination) : destination);
    state.root.updateMatrixWorld(true); return true;
}
export const worldSizeOf = entry => new THREE.Box3().setFromObject(entry?.mesh || new THREE.Object3D()).getSize(new THREE.Vector3());

export function serialize() { return { nextId: state.nextId, attached: state.attached, rootPos: state.root.position.toArray(), rootQuat: state.root.quaternion.toArray(), rootScale: state.root.scale.toArray(), mount: state.mount ? { objectId: state.mount.objectId, colour: state.mount.colour } : null, entries: state.entries.map(e => ({ id: e.id, kind: e.kind, name: e.name, parentId: e.parentId, color: e.color, pos: e.mesh.position.toArray(), quat: e.mesh.quaternion.toArray(), scale: e.mesh.scale.toArray() })) }; }
export function restore(snap, { gizmobot = null } = {}) {
    state.entries.forEach(e => { e.mesh.parent?.remove(e.mesh); e.mesh.geometry?.dispose(); e.mesh.material?.dispose(); }); removeMount(); state.entries = []; state.nextId = snap.nextId; state.attached = snap.attached;
    const byId = new Map(); [...snap.entries].sort((a, b) => (a.kind === 'group' ? -1 : 1) - (b.kind === 'group' ? -1 : 1)).forEach(s => { const mesh = s.kind === 'group' ? new THREE.Group() : new THREE.Mesh(geometryFor(s.kind), material(s.color)); mesh.name = s.name.replace(/\s+/g, '_'); mesh.userData.entryId = s.id; mesh.position.fromArray(s.pos); mesh.quaternion.fromArray(s.quat); mesh.scale.fromArray(s.scale); const entry = { ...s, mesh }; byId.set(s.id, entry); state.entries.push(entry); });
    state.entries.forEach(e => (e.parentId ? byId.get(e.parentId)?.mesh : state.root).add(e.mesh)); (state.attached && gizmobot ? gizmobot : scene)?.add(state.root);
    state.root.position.fromArray(snap.rootPos || [0, 0, 0]); state.root.quaternion.fromArray(snap.rootQuat || [0, 0, 0, 1]); state.root.scale.fromArray(snap.rootScale || [1, 1, 1]); if (snap.mount && byId.has(snap.mount.objectId)) addMount(snap.mount.objectId, snap.mount.colour);
}
export const clearAll = () => restore({ nextId: 1, attached: false, entries: [], mount: null, rootPos: [0, 0, 0] });
