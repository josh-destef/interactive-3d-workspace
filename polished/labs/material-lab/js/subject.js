/* ═══════════════════════════════════════════════
   SUBJECT
   One teaching GLB is loaded, then cloned so the challenge reuses its geometry.
   Only Shell_Paint is learner-controlled; Face_Glow has its own emissive control.
═══════════════════════════════════════════════ */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene, registerRoomMaterial } from './stage.js';
import { MODEL_SCALE, MATCH_SPREAD, START_MATERIAL } from './config.js';

function makeShellMaterial() {
    return new THREE.MeshPhysicalMaterial({
        name: 'Shell_Paint',
        color: 0xb8b8b4,
        roughness: 0.5,
        metalness: 0,
        envMapIntensity: 1,
    });
}

export const studentMaterial = makeShellMaterial();
export const targetMaterial = makeShellMaterial();
let studentGlowMaterial = null;
let targetGlowMaterial = null;

registerRoomMaterial(studentMaterial);
registerRoomMaterial(targetMaterial);

export const studentRoot = new THREE.Group();
studentRoot.name = 'Learner_Gizmobot';
scene.add(studentRoot);

export const targetRoot = new THREE.Group();
targetRoot.name = 'Reference_Gizmobot';
targetRoot.position.x = -MATCH_SPREAD;
targetRoot.visible = false;
scene.add(targetRoot);

const fixedMaterials = new Map();

function configureMaterial(material, role) {
    if (role === 'Face_Glow') {
        const glow = material.clone();
        glow.name = 'Face_Glow';
        glow.emissive.set(0xc8f2ff);
        glow.emissiveIntensity = 0;
        glow.depthWrite = false;
        glow.transparent = true;
        registerRoomMaterial(glow);
        return glow;
    }

    if (!fixedMaterials.has(role)) {
        material.name = role;
        fixedMaterials.set(role, material);
        registerRoomMaterial(material);
    }
    return fixedMaterials.get(role);
}

function makeInstance(template, shellMaterial) {
    const instance = template.clone(true);
    let glowMaterial = null;
    instance.scale.setScalar(MODEL_SCALE);

    instance.traverse(object => {
        if (!object.isMesh) return;
        const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
        const assigned = sourceMaterials.map(source => {
            const role = source.name;
            if (role === 'Shell_Paint') return shellMaterial;
            const material = configureMaterial(source, role);
            if (role === 'Face_Glow') glowMaterial = material;
            return material;
        });
        object.material = Array.isArray(object.material) ? assigned : assigned[0];

        const overlay = assigned.some(material => ['Face_Glow', 'Logo_Decal'].includes(material.name));
        object.castShadow = !overlay;
        object.receiveShadow = !overlay;
        if (overlay) object.renderOrder = 2;
    });

    return { instance, glowMaterial };
}

export const subjectReady = new GLTFLoader()
    .loadAsync('assets/gizmobot-material-lab.glb')
    .then(gltf => {
        const template = gltf.scene;
        const student = makeInstance(template, studentMaterial);
        const target = makeInstance(template, targetMaterial);
        studentGlowMaterial = student.glowMaterial;
        targetGlowMaterial = target.glowMaterial;
        studentRoot.add(student.instance);
        targetRoot.add(target.instance);
        applyValues();
        applyValues(targetMaterial, { ...START_MATERIAL, emissive: 0 }, targetGlowMaterial);
    });

/* Held as 0-100 numbers so controls, examples and matching all use the same
   scale and no concept is hidden behind technical conversion. */
export const values = { ...START_MATERIAL };

export function applyValues(target = studentMaterial, v = values, glow = studentGlowMaterial) {
    target.color.set(v.color);
    target.roughness = v.roughness / 100;
    target.metalness = v.metalness / 100;
    target.needsUpdate = true;

    // The mask confines emission to the eyes and mouth. No light object is
    // added, so Glow never illuminates the floor or surrounding room.
    if (glow) {
        glow.emissiveIntensity = ((v.emissive ?? 0) / 100) * 4;
        glow.needsUpdate = true;
    }
}

export function setValue(key, value) {
    values[key] = value;
    applyValues();
}

export function setValues(patch) {
    Object.assign(values, patch);
    applyValues();
}

export function resetValues() {
    Object.assign(values, START_MATERIAL);
    applyValues();
}

export function setTargetMaterial(material) {
    applyValues(targetMaterial, { ...material, emissive: 0 }, targetGlowMaterial);
}

/* Both clones keep the same pose, scale, geometry, fixed materials and lights. */
export function setMatchLayout(on) {
    targetRoot.visible = on;
    studentRoot.position.x = on ? MATCH_SPREAD : 0;
}
