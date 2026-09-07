/* ═══════════════════════════════════════════════
   GIZMOBOT
   The size reference, on screen from the first beat to the last.

   The GLB is one flattened mesh - no rig, no sub-hierarchy - which is exactly
   what this lab needs. Ghosting him while the student edits geometry is one
   material's opacity rather than a tree walk, and turning him at the end is
   one node's rotation.

   A student cannot judge "is this the right size for a module" against an empty
   grid, so he never leaves and he only moves once.
═══════════════════════════════════════════════ */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GIZMOBOT_URL, GIZMO } from './config.js';
import { createBackPort } from './port.js';
import { animate01 } from '../../../kit/js/anim.js';
import { easeInOut } from '../../../kit/js/utils.js';

let root = null;
let port = null;
const materials = [];

/* The asset is authored facing -Z. This lab works in a frame where his back is
   -Z, so the module spawns behind him and every camera preset sits behind him.
   Turning him once on load is cheaper than carrying a sign flip through the
   spawn point and camera presets.
   Everything that touches his rotation goes through this, so nothing can
   quietly reset him to the direction the file happened to ship in. */
const BASE_Y = Math.PI;

export function loadGizmobot(scene) {
    return new Promise((resolve, reject) => {
        new GLTFLoader().load(GIZMOBOT_URL, gltf => {
            root = gltf.scene;
            root.name = 'Gizmobot';
            root.rotation.y = BASE_Y;
            root.traverse(node => {
                if (!node.isMesh) return;
                node.castShadow = true;
                node.receiveShadow = true;
                /* the material is shared, and ghosting must not leak into any
                   other lab that loads the same asset */
                node.material = node.material.clone();
                materials.push(node.material);
            });
            /* The port is a child of him, not of the scene, so it turns when
               he turns and the snap keeps working at any angle. */
            port = createBackPort();
            port.position.copy(GIZMO.portLocal);
            root.add(port);

            scene.add(root);
            resolve(root);
        }, undefined, reject);
    });
}

export const gizmobot = () => root;
export const backPort = () => port;

/** World position of the port's mating face - what the plug snaps to. */
export function portWorldPoint(target = new THREE.Vector3()) {
    if (!port) return null;
    return port.getWorldPosition(target);
}

/** Light the port's ring while the module is close enough to snap. */
export function setPortActive(on) {
    port?.setActive?.(on);
}

/** Drop back while the student works on the Back Unit. */
export function setGhost(on) {
    materials.forEach(m => {
        m.transparent = on;
        m.opacity = on ? 0.35 : 1;
        m.depthWrite = !on;
        m.needsUpdate = true;
    });
}

/** The payoff: he turns, and whatever is attached turns with him. */
export function turn(onDone) {
    if (!root) { onDone?.(); return; }
    const from = BASE_Y;
    animate01(2.4, t => {
        /* two turns out and back, so the module is seen from both sides */
        root.rotation.y = from + Math.sin(easeInOut(t) * Math.PI * 2) * THREE.MathUtils.degToRad(22);
    }, () => { root.rotation.y = BASE_Y; onDone?.(); });
}

export function resetTurn() {
    if (root) root.rotation.y = BASE_Y;
}
