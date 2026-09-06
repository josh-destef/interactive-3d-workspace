/* ═══════════════════════════════════════════════
   ACTOR
   The thing being animated, plus the two ghosts that stand in the key poses on
   either side of the playhead.

   The ghosts are the argument of this whole lab made visible: they are the poses
   that were stored, the solid object is the pose that was calculated, and having
   all three on screen at once is the only way to show a student the difference.
═══════════════════════════════════════════════ */
import * as THREE from 'three';
import { scene } from './stage.js';

function standardMaterial(color, roughness = 0.45) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.08 });
}

const MATERIALS = {
    shell: standardMaterial(0xf0f1ec, 0.28),
    shadow: standardMaterial(0xc8cdd4, 0.38),
    slate: new THREE.MeshStandardMaterial({ color: 0x26334c, roughness: 0.26, metalness: 0.3 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xff9022, roughness: 0.3, metalness: 0.14 }),
    red: new THREE.MeshStandardMaterial({ color: 0xc0453a, roughness: 0.38, metalness: 0.08 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x3a6fa8, roughness: 0.2, metalness: 0.28 }),
};

function finish(mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

/* The launch pad stays fixed while the actor moves. Besides grounding the model,
   it gives every pose a shared origin, so a change in height reads as animation
   rather than a camera move. */
const launchPad = new THREE.Group();
const padFoot = finish(new THREE.Mesh(
    new THREE.CylinderGeometry(1.02, 1.18, 0.22, 40),
    MATERIALS.slate
));
padFoot.position.y = 0.11;
const padDeck = finish(new THREE.Mesh(
    new THREE.CylinderGeometry(0.84, 0.94, 0.18, 40),
    MATERIALS.shadow
));
padDeck.position.y = 0.28;
const padRing = finish(new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.055, 10, 48),
    MATERIALS.orange
));
padRing.rotation.x = Math.PI / 2;
padRing.position.y = 0.39;
launchPad.add(padFoot, padDeck, padRing);
scene.add(launchPad);

/* ── shapes ──
   A rocket, a cube and a ball. The rocket has a nose and fins, so a turn of 90
   degrees is unmistakable on it; the cube and the ball are there to prove that
   the keyframes belong to the timeline and not to the shape. */
function buildObject(type, ghostRole = '') {
    const group = new THREE.Group();

    if (type === 'cube') {
        const cube = finish(new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.55, 1.55), MATERIALS.orange));
        cube.position.y = 1.16;
        const inset = finish(new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.86, 0.055), MATERIALS.slate));
        inset.position.set(0, 1.16, 0.79);
        group.add(cube, inset);
    } else if (type === 'ball') {
        const ball = finish(new THREE.Mesh(new THREE.SphereGeometry(0.98, 40, 24), MATERIALS.blue));
        ball.position.y = 1.38;
        const band = finish(new THREE.Mesh(new THREE.TorusGeometry(0.99, 0.055, 10, 48), MATERIALS.orange));
        band.position.y = 1.38;
        group.add(ball, band);
    } else {
        /* A compact, directional silhouette: nose, window, belt, nozzle and four
           fins all make a turn legible even when height stays unchanged. */
        const body = finish(new THREE.Mesh(
            new THREE.CapsuleGeometry(0.58, 1.14, 10, 24),
            MATERIALS.shell
        ));
        body.position.y = 1.47;

        const lowerShell = finish(new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 0.58, 0.56, 32),
            MATERIALS.shadow
        ));
        lowerShell.position.y = 0.58;

        const nose = finish(new THREE.Mesh(
            new THREE.ConeGeometry(0.59, 0.84, 40),
            MATERIALS.orange
        ));
        nose.position.y = 2.82;

        const belt = finish(new THREE.Mesh(
            new THREE.TorusGeometry(0.55, 0.055, 10, 48),
            MATERIALS.slate
        ));
        belt.rotation.x = Math.PI / 2;
        belt.position.y = 1.04;

        const nozzle = finish(new THREE.Mesh(
            new THREE.CylinderGeometry(0.28, 0.4, 0.38, 28),
            MATERIALS.slate
        ));
        nozzle.position.y = 0.19;

        const portRim = finish(new THREE.Mesh(
            new THREE.CylinderGeometry(0.27, 0.27, 0.10, 28),
            MATERIALS.slate
        ));
        portRim.rotation.x = Math.PI / 2;
        portRim.position.set(0, 1.72, 0.56);
        const portGlass = finish(new THREE.Mesh(
            new THREE.CylinderGeometry(0.2, 0.2, 0.112, 28),
            MATERIALS.blue
        ));
        portGlass.rotation.x = Math.PI / 2;
        portGlass.position.set(0, 1.72, 0.57);

        const finGeo = new THREE.ConeGeometry(0.42, 0.92, 4);
        const fins = [
            [0.53, 0.48, 0, -0.2, 0],
            [-0.53, 0.48, 0, 0.2, 0],
            [0, 0.48, 0.53, 0, Math.PI / 2],
            [0, 0.48, -0.53, 0, Math.PI / 2],
        ].map(([x, y, z, rz, ry]) => {
            const fin = finish(new THREE.Mesh(finGeo, MATERIALS.red));
            fin.position.set(x, y, z);
            fin.rotation.set(0, ry, rz);
            return fin;
        });

        group.add(body, lowerShell, nose, belt, nozzle, portRim, portGlass, ...fins);
    }

    group.traverse(child => {
        if (!child.isMesh) return;
        const isGhost = Boolean(ghostRole);
        child.castShadow = !isGhost;
        child.receiveShadow = !isGhost;
        if (!isGhost) return;
        // Wireframe, unlit and depth-write off, so a ghost never hides the solid
        // object standing inside it.
        child.material = new THREE.MeshBasicMaterial({
            color: ghostRole === 'previous' ? 0x00aa00 : 0xff9022,
            transparent: true,
            opacity: 0.2,
            depthWrite: false,
            wireframe: true,
        });
    });

    return group;
}

/* ── the live objects ── */
let type = 'rocket';
let actor = null;
let prevGhost = null;
let nextGhost = null;

function rebuild() {
    [actor, prevGhost, nextGhost].forEach(obj => { if (obj) scene.remove(obj); });
    actor = buildObject(type);
    prevGhost = buildObject(type, 'previous');
    nextGhost = buildObject(type, 'next');
    prevGhost.visible = false;
    nextGhost.visible = false;
    scene.add(prevGhost, nextGhost, actor);
}

export function getActorType() { return type; }

export function setActorType(next) {
    if (next === type) return;
    type = next;
    rebuild();
}

/* ── posing ──
   A pose is { y, turn, size } and nothing else. Position on the floor plane,
   pitch and roll are all left out on purpose: fewer channels means the motion
   graph can be honest about plotting one of them. */
function applyPose(object, pose) {
    object.position.y = pose.y;
    object.rotation.y = pose.turn * Math.PI / 180;
    object.scale.setScalar(pose.size);
}

export function setActorPose(pose) {
    applyPose(actor, pose);
}

export function setGhostPoses(prev, next) {
    prevGhost.visible = Boolean(prev);
    nextGhost.visible = Boolean(next);
    if (prev) applyPose(prevGhost, prev);
    if (next) applyPose(nextGhost, next);
}

rebuild();
