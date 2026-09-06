/* ═══════════════════════════════════════════════
   SUBJECT
   The thing the lesson is about, and the only place its state lives.

   A real lab loads a GLB here and exposes the same shape of API:
   `values` (what the student has set), `setValue`, `applyValues`, `reset`.
   Keeping every mutation behind those means the demo, the student's controls
   and a reset all go through one path and cannot disagree.
═══════════════════════════════════════════════ */
import * as THREE from 'three';

export const values = { size: 100, color: '#ff9022' };

const START = { ...values };

let mesh = null;

export function buildSubject(scene) {
    const geo = new THREE.TorusKnotGeometry(0.62, 0.2, 160, 24);
    const mat = new THREE.MeshStandardMaterial({
        color: values.color,
        roughness: 0.42,
        metalness: 0.05,
    });
    mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 1.15;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    applyValues();
    return mesh;
}

export function setValue(key, value) {
    values[key] = value;
    applyValues();
}

export function applyValues() {
    if (!mesh) return;
    const s = values.size / 100;
    mesh.scale.setScalar(s);
    mesh.material.color.set(values.color);
}

export function reset() {
    Object.assign(values, START);
    applyValues();
}

export function getSubject() { return mesh; }
