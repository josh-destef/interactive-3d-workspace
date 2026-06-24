/* ═══════════════════════════════════════════════
   CHARACTER (GLB)
   Loaded from gizmo.glb. Centered on origin, sitting on floor.
═══════════════════════════════════════════════ */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { V3 } from './utils.js';
import { GIZMO_URL } from './config.js';
import { scene } from './stage.js';
import { state } from './state.js';

/* mutated in place during load; safe to export as live const vectors */
export const characterLocalCenter = V3(0, 1, 0);
export const characterHomePosition = V3(0, 1, 0);

export function getCharacterCenterWorld(target = new THREE.Vector3()) {
    if (!state.character) return target.set(0, 0, 0);
    state.character.updateMatrixWorld(true);
    return target.copy(characterLocalCenter).applyMatrix4(state.character.matrixWorld);
}

export function getCharacterControlScale() {
    return state.characterControlRadius * (state.character ? state.character.scale.x : 1);
}

/* Load the model and call onReady() once it is in the scene. */
export function loadCharacter(onReady) {
    const loader = new GLTFLoader();
    loader.load(GIZMO_URL, (gltf) => {
        const model = gltf.scene;

        // correct material styling and enable shadows
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.material) {
                    child.material.metalness = 0.1;
                    child.material.roughness = 0.8;
                }
            }
        });

        // Apply the asset-facing transform before measuring it. This keeps
        // the control placement correct when a replacement GLB has a
        // different authored size, origin, or orientation.
        model.rotation.y = Math.PI;
        model.scale.setScalar(0.5);
        model.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.x -= center.x;
        model.position.y -= box.min.y;
        model.position.z -= center.z;

        const wrapper = new THREE.Group();
        wrapper.add(model);
        wrapper.updateMatrixWorld(true);

        // Move the wrapper pivot to the visual center without changing the
        // robot's world-space position. Rotate and scale now operate around
        // the same point used by the controls.
        const groundedBounds = new THREE.Box3().setFromObject(wrapper);
        groundedBounds.getCenter(characterHomePosition);
        model.position.sub(characterHomePosition);
        wrapper.position.copy(characterHomePosition);
        wrapper.updateMatrixWorld(true);

        const localBounds = new THREE.Box3().setFromObject(wrapper);
        localBounds.translate(wrapper.position.clone().negate());
        const localSize = localBounds.getSize(new THREE.Vector3());
        localBounds.getCenter(characterLocalCenter);
        state.characterHeight = localSize.y;
        state.characterControlRadius = Math.max(state.characterHeight * 0.5, 0.25);

        scene.add(wrapper);
        state.character = wrapper;

        if (onReady) onReady();

    }, undefined, (err) => {
        document.getElementById('loading').textContent = 'Error: ' + (err.message || err.toString());
        console.error(err);
    });
}
