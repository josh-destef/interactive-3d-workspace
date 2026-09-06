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
import { scene } from './stage.js';
import {
    START_POSE, PICKUP_POS, GRIP_CATCH, GRIP_RELEASE, CATCH_RADIUS,
} from './config.js';

function material(color, roughness = 0.45, metalness = 0.08) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

const MAT = {
    shell: material(0xf0f1ec, 0.32, 0.12),
    shellSide: material(0xc9ced5, 0.42, 0.1),
    slate: material(0x26334c, 0.28, 0.28),
    dark: material(0x121a2c, 0.3, 0.34),
    orange: material(0xff9022, 0.3, 0.18),
    blue: material(0x3a6fa8, 0.28, 0.22),
    green: material(0x00aa00, 0.34, 0.12),
};

function finish(mesh, { shadow = true, receive = true } = {}) {
    mesh.castShadow = shadow;
    mesh.receiveShadow = receive;
    return mesh;
}

/* Each hinge is a real axle, not two intersecting spheres. Its coloured ring is
   repeated in the scene-tree buttons, so the student can match the abstract
   hierarchy to the machine before the axes helper ever appears. */
function jointHousing(radius, accentMaterial) {
    const group = new THREE.Group();

    const axle = finish(new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, 0.5, 32),
        MAT.slate
    ));
    axle.rotation.x = Math.PI / 2;

    const ringGeo = new THREE.TorusGeometry(radius * 0.78, radius * 0.13, 10, 40);
    const ringFront = finish(new THREE.Mesh(ringGeo, accentMaterial));
    ringFront.position.z = 0.27;
    const ringBack = ringFront.clone();
    ringBack.position.z = -0.27;

    const capGeo = new THREE.CylinderGeometry(radius * 0.43, radius * 0.43, 0.035, 24);
    const capFront = finish(new THREE.Mesh(capGeo, MAT.shell));
    capFront.rotation.x = Math.PI / 2;
    capFront.position.z = 0.305;
    const capBack = capFront.clone();
    capBack.position.z = -0.305;

    group.add(axle, ringFront, ringBack, capFront, capBack);
    return group;
}

/* A tapered, faceted link has enough silhouette to read from every orbit angle,
   while the inset stripe makes its parent-facing direction obvious. Geometry is
   offset from the hinge; the node itself stays exactly on the pivot. */
function armLink(length, width, stripeMaterial) {
    const group = new THREE.Group();
    const body = finish(new THREE.Mesh(
        new THREE.CylinderGeometry(width * 0.37, width * 0.48, length, 8),
        MAT.shell
    ));
    body.position.y = length / 2;

    const spine = finish(new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.2, length * 0.62, width * 0.12),
        stripeMaterial
    ));
    spine.position.set(0, length * 0.48, width * 0.39);

    const sideA = finish(new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.12, length * 0.7, width * 0.42),
        MAT.shellSide
    ));
    sideA.position.set(width * 0.34, length * 0.46, 0);
    const sideB = sideA.clone();
    sideB.position.x *= -1;

    group.add(body, spine, sideA, sideB);
    return group;
}

/* ── the chain ── */
const base = new THREE.Group();
const baseTurn = new THREE.Group();
const shoulder = new THREE.Group();
const elbow = new THREE.Group();
const wrist = new THREE.Group();
scene.add(base);
base.add(baseTurn);
baseTurn.add(shoulder);
shoulder.add(elbow);
elbow.add(wrist);

const foot = finish(new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.24, 0.34, 40),
    MAT.dark
));
foot.position.y = 0.17;
base.add(foot);

const turntable = finish(new THREE.Mesh(
    new THREE.CylinderGeometry(0.84, 0.96, 0.34, 40),
    MAT.slate
));
turntable.position.y = 0.46;
baseTurn.add(turntable);

const baseBand = finish(new THREE.Mesh(
    new THREE.TorusGeometry(0.78, 0.06, 10, 48),
    MAT.orange
));
baseBand.rotation.x = Math.PI / 2;
baseBand.position.y = 0.64;
baseTurn.add(baseBand);

shoulder.position.y = 0.68;
shoulder.add(jointHousing(0.44, MAT.orange));
shoulder.add(armLink(2.25, 0.68, MAT.orange));

elbow.position.y = 2.25;
elbow.add(jointHousing(0.39, MAT.blue));
elbow.add(armLink(1.85, 0.58, MAT.blue));

wrist.position.y = 1.85;
wrist.add(jointHousing(0.31, MAT.green));

const wristStem = finish(new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.23, 0.45, 20),
    MAT.shellSide
));
wristStem.position.y = 0.4;
wrist.add(wristStem);

const palm = finish(new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.42, 0.5, 8),
    MAT.slate
));
palm.position.y = 0.78;
wrist.add(palm);

const palmBand = finish(new THREE.Mesh(
    new THREE.TorusGeometry(0.31, 0.045, 8, 32),
    MAT.green
));
palmBand.rotation.x = Math.PI / 2;
palmBand.position.y = 0.98;
wrist.add(palmBand);

const fingerRootA = new THREE.Group();
const fingerRootB = new THREE.Group();
fingerRootA.position.set(-0.42, 0.96, 0);
fingerRootB.position.set(0.42, 0.96, 0);

function buildFinger(side) {
    const group = new THREE.Group();
    const finger = finish(new THREE.Mesh(
        new THREE.CapsuleGeometry(0.09, 0.48, 6, 14),
        MAT.orange
    ));
    finger.position.y = 0.34;
    const pad = finish(new THREE.Mesh(
        new THREE.CapsuleGeometry(0.085, 0.22, 6, 12),
        MAT.dark
    ));
    pad.rotation.z = side * Math.PI / 2;
    pad.position.set(-side * 0.09, 0.67, 0);
    group.add(finger, pad);
    return group;
}

fingerRootA.add(buildFinger(-1));
fingerRootB.add(buildFinger(1));
wrist.add(fingerRootA, fingerRootB);

/* An empty at the point the claw actually closes on. Everything the pickup check
   measures is measured from here, not from the wrist, so "the claw is around it"
   means what it looks like it means. */
const tip = new THREE.Object3D();
tip.position.y = 1.58;
wrist.add(tip);

/* ── the block, and the halo that says where it is ── */
/* The target rests on a real station. The former floating cube made the final
   task look like a collision bug instead of a deliberate reparenting exercise. */
const targetStation = new THREE.Group();
targetStation.position.set(PICKUP_POS.x, 0, PICKUP_POS.z);
const targetColumn = finish(new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.28, PICKUP_POS.y - 0.34, 20),
    MAT.shellSide
));
targetColumn.position.y = (PICKUP_POS.y - 0.34) / 2;
const targetDeck = finish(new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.48, 0.18, 32),
    MAT.slate
));
targetDeck.position.y = PICKUP_POS.y - 0.24;
const targetRing = finish(new THREE.Mesh(
    new THREE.TorusGeometry(0.47, 0.045, 8, 32),
    MAT.orange
));
targetRing.rotation.x = Math.PI / 2;
targetRing.position.y = PICKUP_POS.y - 0.14;
targetStation.add(targetColumn, targetDeck, targetRing);
scene.add(targetStation);

const pickupObject = finish(new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.46, 0.46),
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
    new THREE.TorusGeometry(0.61, 0.025, 8, 48),
    new THREE.MeshBasicMaterial({
        color: 0xffb02e,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
    })
);
halo.position.copy(PICKUP_POS);
scene.add(halo);

const haloLight = new THREE.PointLight(0xff9022, 1.2, 3.5);
haloLight.position.copy(PICKUP_POS);
scene.add(haloLight);

let objectHeld = false;

/* ── selection and the axes helper ──
   The helper is parented to the selected node rather than positioned at it, so
   it picks up the node's inherited rotation for free. A helper that had to be
   placed by hand would be showing world axes wearing a costume. */
const nodes = { base: baseTurn, shoulder, elbow, wrist };
let selectedNode = 'wrist';

/* A selection halo answers "which node am I editing?" directly on the model.
   It is intentionally quieter than the XYZ axes, which arrive later as a new
   concept rather than being present from the opening frame. */
const selectionRings = {
    base: new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.035, 8, 48), new THREE.MeshBasicMaterial({ color: 0xff9022, transparent: true, opacity: 0.78, depthTest: false })),
    shoulder: new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: 0xff9022, transparent: true, opacity: 0.78, depthTest: false })),
    elbow: new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: 0x3a6fa8, transparent: true, opacity: 0.78, depthTest: false })),
    wrist: new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: 0x00aa00, transparent: true, opacity: 0.78, depthTest: false })),
};
selectionRings.base.rotation.x = Math.PI / 2;
selectionRings.base.position.y = 0.66;
Object.entries(selectionRings).forEach(([name, ring]) => {
    ring.renderOrder = 4;
    ring.visible = name === selectedNode;
    nodes[name].add(ring);
});

const axes = new THREE.AxesHelper(1.25);
let axesOn = false;

export function getSelectedNode() { return selectedNode; }

export function selectNode(name) {
    if (!nodes[name]) return;
    selectedNode = name;
    Object.entries(selectionRings).forEach(([key, ring]) => { ring.visible = key === name; });
    if (axesOn) nodes[selectedNode].add(axes);
}

export function setAxesVisible(on) {
    axesOn = !!on;
    if (axesOn) nodes[selectedNode].add(axes);
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
    baseTurn.rotation.y = THREE.MathUtils.degToRad(joints.base);
    shoulder.rotation.z = THREE.MathUtils.degToRad(joints.shoulder);
    elbow.rotation.z = THREE.MathUtils.degToRad(joints.elbow);
    wrist.rotation.z = THREE.MathUtils.degToRad(joints.wrist);
    updateClaw();
    // The pickup test compares two world positions, and world positions are
    // stale until the whole chain has been re-multiplied. Without this the claw
    // catches the block one frame late, which reads as the check being flaky.
    scene.updateMatrixWorld(true);
    updatePickup();
}

export function setJoint(key, value) {
    joints[key] = value;
    applyJoints();
}

export function setJoints(patch) {
    Object.assign(joints, patch);
    applyJoints();
}

/* Only the finger roots slide inward. Rotating them would look more mechanical
   and would also drive the fingertips through the palm at full grip. */
function updateClaw() {
    const grip = joints.grip / 100;
    const offset = THREE.MathUtils.lerp(0.42, 0.23, grip);
    fingerRootA.position.x = -offset;
    fingerRootB.position.x = offset;
}

/* ── the reparenting moment ──
   attach() is the whole lesson of the last step: it moves the block to a new
   parent while keeping it exactly where it was on screen, by rewriting its local
   transform to whatever produces the same world transform under the wrist. */
function updatePickup() {
    const grip = joints.grip / 100;
    tip.getWorldPosition(_tip);
    pickupObject.getWorldPosition(_block);
    if (!objectHeld && grip > GRIP_CATCH && _tip.distanceTo(_block) < CATCH_RADIUS) {
        wrist.attach(pickupObject);
        pickupObject.position.set(0, 1.38, 0);
        objectHeld = true;
    } else if (objectHeld && grip < GRIP_RELEASE) {
        scene.attach(pickupObject);
        objectHeld = false;
    }
}

export function isHeld() { return objectHeld; }

/* Put the block back on its stand. Called at the top of every beat but the last,
   so a student who caught it while exploring still gets the challenge whole. */
export function resetPickup() {
    if (objectHeld) scene.attach(pickupObject);
    objectHeld = false;
    pickupObject.position.copy(PICKUP_POS);
    pickupObject.rotation.set(0, 0, 0);
}

/* ── readout source ──
   Local is read straight off the node. World is asked of the matrix, because
   there is nowhere else it exists. */
export function localPosition() {
    return _local.copy(nodes[selectedNode].position);
}

export function worldPosition() {
    return nodes[selectedNode].getWorldPosition(_world);
}

/* ── per-frame ── */
let elapsed = 0;

export function tickArm(dt) {
    elapsed += dt;
    // The halo rides the block instead of sitting at a fixed target, so after a
    // drop it marks where the block actually is rather than where it began.
    halo.visible = !objectHeld;
    haloLight.visible = !objectHeld;
    if (!objectHeld) {
        pickupObject.getWorldPosition(_block);
        halo.position.copy(_block);
        haloLight.position.copy(_block);
        halo.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.08);
    }
}

applyJoints();
