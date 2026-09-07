/* ═══════════════════════════════════════════════
   ARM
   The robot arm, the block it can pick up, and the transforms that connect them.

   The nesting below is the entire subject of the lab, so it is built literally:
   base holds baseTurn holds shoulder holds elbow holds wrist. Every joint stores
   one rotation and one fixed offset from its parent, and nothing anywhere in
   this file ever writes a world position. That is the point - world position is
   what falls out of the chain, not something anyone sets.
═══════════════════════════════════════════════ */
import * as THREE from 'three';
import { scene } from './stage.js?v=selector5';
import {
    START_POSE, PICKUP_POS, GRIP_CATCH, GRIP_RELEASE, CATCH_RADIUS, PARTS, ROTATION_KEYS, GRASP_POS, FINGER_LIMITS,
} from './config.js?v=selector5';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function material(color) { return new THREE.MeshStandardMaterial({ color }); }
const MAT = { blue: material(0x3a6fa8) };
function finish(mesh) { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; }

// Preserve the source geometry, textures and anatomical pivots. Only the arm
// is loaded. A uniform scale avoids shearing when its rigid joints rotate.
const base = new THREE.Group();
const baseTurn = new THREE.Group();
base.add(baseTurn);
scene.add(base);
let shoulder, elbow, wrist;
const fingers = {};
const highlightedSurfaces = [];
const tip = new THREE.Object3D();
tip.position.copy(GRASP_POS);
export const armReady = new GLTFLoader().loadAsync('assets/gizmobot-arm.glb').then(gltf => {
    shoulder = gltf.scene.getObjectByName('LeftUpperArm');
    elbow = gltf.scene.getObjectByName('LeftForearm');
    wrist = gltf.scene.getObjectByName('LeftHand');
    baseTurn.add(shoulder);
    shoulder.position.set(0, 0.68, 0);
    // Bake a uniform display scale into mesh vertices and joint offsets so
    // local/world readouts and attach() all use the same scene units.
    shoulder.traverse(node => {
        if (node !== shoulder) node.position.multiplyScalar(4);
        if (node.isMesh) { node.geometry.scale(4,4,4); finish(node); }
    });
    Object.assign(nodes, { shoulder, elbow, wrist });
    for (const [key, name] of Object.entries({ mitt: 'Mitt', pointer: 'Pointer', thumb: 'Thumb' })) {
        fingers[key] = gltf.scene.getObjectByName(name) || shoulder.getObjectByName(name);
        nodes[key] = fingers[key];
    }
    for (const part of PARTS) nodes[part].userData.restPosition = nodes[part].position.clone();
    shoulder.traverse(mesh => {
        if (!mesh.isMesh) return;
        let owner = mesh.parent;
        while (owner && !Object.values(nodes).includes(owner)) owner = owner.parent;
        mesh.material = mesh.material.clone();
        highlightedSurfaces.push({mesh, owner, emissive:mesh.material.emissive.clone(), intensity:mesh.material.emissiveIntensity, color:mesh.material.color.clone(), emissiveMap:mesh.material.emissiveMap});
    });
    wrist.add(tip);
    for (const [name, node] of Object.entries(nodes)) {
        const radius = name === 'base' ? .5 : ['mitt','pointer','thumb'].includes(name) ? .18 : .30;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radius,.025,8,40), new THREE.MeshBasicMaterial({ color: 0xff9022, transparent:true, opacity:.8, depthTest:false }));
        ring.renderOrder = 4;
        selectionRings[name] = ring;
        node.add(ring);
    }
    selectNode(selectedNode);
    applyJoints();
});

/* ── the block, and the halo that says where it is ── */
// A floating target keeps the reach exercise focused on the arm and block.
// Big enough to read as a thing the claw is holding rather than a bead it has
// swallowed - at half this size the block vanished behind the fingers the moment
// it was caught, which is the one frame the whole lab is building towards.
const pickupObject = finish(new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.92, 0.92),
    MAT.blue
));
pickupObject.position.copy(PICKUP_POS);
scene.add(pickupObject);

const blockEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(pickupObject.geometry),
    new THREE.LineBasicMaterial({ color: 0x9bc8f2, transparent: true, opacity: 0.85 })
);
pickupObject.add(blockEdges);

const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.03, 8, 48),
    new THREE.MeshBasicMaterial({
        color: 0xffb02e,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
    })
);
halo.position.copy(PICKUP_POS);
scene.add(halo);

const haloLight = new THREE.PointLight(0xff9022, 1.2, 4.2);
haloLight.position.copy(PICKUP_POS);
scene.add(haloLight);

let objectHeld = false;
let settling = false;
let targetOn = true;
export function setTargetVisible(on) {
    targetOn = on;
    pickupObject.visible = on;
    halo.visible = on && !objectHeld;
    haloLight.visible = on && !objectHeld;
}

/* ── selection and the axes helper ──
   The helper is parented to the selected node rather than positioned at it, so
   it picks up the node's inherited rotation for free. A helper that had to be
   placed by hand would be showing world axes wearing a costume. */
const nodes = { base: baseTurn };
let selectedNode = 'wrist';
const selectionRings = {};

const axes = new THREE.AxesHelper(1.25);
let axesOn = false;

export function getSelectedNode() { return selectedNode; }

export function selectNode(name) {
    if (!nodes[name]) return;
    selectedNode = name;
    Object.entries(selectionRings).forEach(([key, ring]) => { ring.visible = key === name; });
    if (axesOn && nodes[selectedNode]) nodes[selectedNode].add(axes);
    updateHighlights();
}

export function getInfluencedParts(name = selectedNode) {
    return PARTS.filter(part => {
        let node = nodes[part];
        while (node) { if (node === nodes[name]) return true; node = node.parent; }
        return false;
    });
}
function updateHighlights() {
    const affected = getInfluencedParts().map(part => nodes[part]);
    for (const {mesh,owner,emissive,intensity,color,emissiveMap} of highlightedSurfaces) {
        const wasMapped = !!mesh.material.emissiveMap;
        mesh.material.color.copy(color);
        mesh.material.emissiveMap = emissiveMap;
        mesh.material.emissive.copy(emissive);
        mesh.material.emissiveIntensity = intensity;
        if (affected.includes(owner)) {
            mesh.material.emissiveMap = null;
            mesh.material.color.lerp(new THREE.Color(0xf6c27b), owner === nodes[selectedNode] ? .22 : .14);
            mesh.material.emissive.setHex(owner === nodes[selectedNode] ? 0xed841e : 0xe5b65b);
            mesh.material.emissiveIntensity = owner === nodes[selectedNode] ? .22 : .12;
        }
        if(wasMapped !== !!mesh.material.emissiveMap) mesh.material.needsUpdate = true;
    }
}
export function getCatchState() {
    if (!targetOn || !wrist) return 'hidden';
    if (objectHeld) return 'held';
    tip.getWorldPosition(_tip);
    pickupObject.getWorldPosition(_block);
    return _tip.distanceTo(_block) < CATCH_RADIUS ? 'ready' : 'far';
}

export function setAxesVisible(on) {
    axesOn = !!on;
    if (axesOn && nodes[selectedNode]) nodes[selectedNode].add(axes);
    else if (axes.parent) axes.parent.remove(axes);
}

/* ── joint values ──
   Held here in degrees (and grip in percent) so the sliders, the pose presets
   and the demos all speak the same units and nothing converts twice. */
export const joints = { ...START_POSE };

const _local = new THREE.Vector3();
const _world = new THREE.Vector3();
const _tip = new THREE.Vector3();
const _block = new THREE.Vector3();

function applyJoints() {
    if (!wrist) return;
    for (const part of PARTS) {
        const node = nodes[part], keys = ROTATION_KEYS[part];
        const angles = ['x','y','z'].map(axis => THREE.MathUtils.degToRad(joints[keys[axis]] || 0));
        if (part === 'mitt' || part === 'pointer') angles[2] *= -1;
        if (part === 'thumb') angles[0] *= -1;
        node.quaternion.setFromEuler(new THREE.Euler(...angles));
        if (part === 'shoulder') node.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2));
        node.position.copy(node.userData.restPosition);
    }
    // The pickup test compares two world positions, and world positions are
    // stale until the whole chain has been re-multiplied. Without this the claw
    // catches the block one frame late, which reads as the check being flaky.
    scene.updateMatrixWorld(true);
    updatePickup();
}

export function setJoint(key, value) { setJoints({ [key]:value }); }
export function setJoints(patch) {
    for (const [key,value] of Object.entries(patch)) {
        if (key in joints && Number.isFinite(value)) joints[key] = key === 'grip' ? THREE.MathUtils.clamp(value, 0, 100) : key in FINGER_LIMITS ? THREE.MathUtils.clamp(value, 0, FINGER_LIMITS[key]) : value;
    }
    if ('grip' in patch) {
        joints.mitt = joints.grip * .85;
        joints.pointer = joints.grip * .85;
        joints.thumb = joints.grip * .70;
    } else if (['mitt','pointer','thumb'].some(key => key in patch)) {
        joints.grip = Math.min(joints.mitt/.85, joints.pointer/.85, joints.thumb/.70);
    }
    applyJoints();
}
/* ── the reparenting moment ──
   attach() is the whole lesson of the last step: it moves the block to a new
   parent while keeping it exactly where it was on screen, by rewriting its local
   transform to whatever produces the same world transform under the wrist. */
function updatePickup() {
    if (!targetOn) return;
    const grip = joints.grip / 100;
    tip.getWorldPosition(_tip);
    pickupObject.getWorldPosition(_block);
    if (!objectHeld && grip > GRIP_CATCH && _tip.distanceTo(_block) < CATCH_RADIUS) {
        wrist.attach(pickupObject);
        // Ease the cube into the palm pocket, rather than leaving it perched on the fingers.
        settling = true;
        objectHeld = true;
    } else if (objectHeld && grip < GRIP_RELEASE) {
        scene.attach(pickupObject);
        objectHeld = false;
        settling = false;
    }
}

export function isHeld() { return objectHeld; }

/* Put the block back at its starting position. Called at the top of every beat but the last,
   so a student who caught it while exploring still gets the challenge whole. */
export function resetPickup() {
    if (objectHeld) scene.attach(pickupObject);
    objectHeld = false;
    settling = false;
    pickupObject.position.copy(PICKUP_POS);
    pickupObject.rotation.set(0, 0, 0);
}

/* ── readout source ──
   Local is read straight off the node. World is asked of the matrix, because
   there is nowhere else it exists. */
export function localPosition() {
    return nodes[selectedNode] ? _local.copy(nodes[selectedNode].position) : _local.set(0,0,0);
}

export function worldPosition() {
    return nodes[selectedNode] ? nodes[selectedNode].getWorldPosition(_world) : _world.set(0,0,0);
}

/* ── per-frame ── */
let elapsed = 0;

export function tickArm(dt) {
    elapsed += dt;
    if (objectHeld && settling) {
        const t = 1 - Math.exp(-14 * dt);
        pickupObject.position.lerp(GRASP_POS, t);
        pickupObject.quaternion.slerp(new THREE.Quaternion(), t);
        if (pickupObject.position.distanceTo(GRASP_POS) < .001 && pickupObject.quaternion.angleTo(new THREE.Quaternion()) < .001) {
            pickupObject.position.copy(GRASP_POS);
            pickupObject.quaternion.identity();
            settling = false;
        }
    }
    // The halo rides the block instead of sitting at a fixed target, so after a
    // drop it marks where the block actually is rather than where it began.
    const ready = getCatchState() === 'ready';
    halo.material.color.setHex(ready ? 0x26964d : 0xffb02e);
    haloLight.color.copy(halo.material.color);
    halo.visible = targetOn && !objectHeld;
    haloLight.visible = targetOn && !objectHeld;
    if (!objectHeld) {
        pickupObject.getWorldPosition(_block);
        halo.position.copy(_block);
        haloLight.position.copy(_block);
        halo.scale.setScalar(ready ? .88 : 1 + Math.sin(elapsed * 4) * 0.04);
    }
}

applyJoints();

// A stable rest-pose copy makes the side selector readable while the main arm moves.
export function createArmReplica() {
    const copy = baseTurn.clone(true);
    const copiedParts = {};
    for (const part of PARTS) {
        const node = part === 'base' ? copy : copy.getObjectByName(nodes[part].name);
        copiedParts[part] = node;
        node.position.copy(nodes[part].userData.restPosition);
        node.quaternion.identity();
        if(part === 'shoulder') node.rotation.z = Math.PI/2;
    }
    const surfaces = [];
    copy.traverse(node => {
        if (!node.isMesh) { if(node.isLine) node.visible=false; return; }
        const source = highlightedSurfaces.find(entry => entry.mesh.name === node.name);
        if(!source) { node.visible=false; return; }
        node.material = node.material.clone();
        node.material.color.copy(source.color);
        node.material.emissive.copy(source.emissive);
        node.material.emissiveIntensity=source.intensity;
        node.material.emissiveMap=source.emissiveMap;
        let parent=node.parent;
        while(parent && !Object.values(copiedParts).includes(parent)) parent=parent.parent;
        node.userData.part=PARTS.find(part=>copiedParts[part]===parent);
        surfaces.push(node);
    });
    return {object:copy, parts:copiedParts, surfaces};
}
