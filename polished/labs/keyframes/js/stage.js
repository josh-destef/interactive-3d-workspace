/* ═══════════════════════════════════════════════
   STAGE
   Renderer, scene, camera, orbit controls, floor and lights.

   The rig is fixed and there is a grid on the floor. Both are here for the same
   reason: this lab asks the student to judge how far something moved between two
   moments, and that judgement needs landmarks that do not themselves move.
═══════════════════════════════════════════════ */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMS, CAM_FOR_BEAT } from './config.js';
import { state } from './state.js';

export const W = () => window.innerWidth;
export const H = () => window.innerHeight;

export const clock = new THREE.Clock();

export const scene = new THREE.Scene();

export const camera = new THREE.PerspectiveCamera(42, W() / H(), 0.05, 100);
camera.position.copy(CAMS.hero.pos);

const canvas = document.getElementById('cv');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(W(), H());
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0xf8f8f6, 1);

export const orbitCtrl = new OrbitControls(camera, canvas);
orbitCtrl.enableDamping = true;
orbitCtrl.dampingFactor = 0.08;
orbitCtrl.enablePan = false;          // nothing to pan to; keeps the actor centered
orbitCtrl.target.copy(CAMS.hero.look);
orbitCtrl.minDistance = 5;
orbitCtrl.maxDistance = 16;
orbitCtrl.minPolarAngle = 0.2;
orbitCtrl.maxPolarAngle = Math.PI / 2 - 0.06;   // stay above the floor
orbitCtrl.update();

/* ── lights ──
   Ambient + hemisphere + warm key + cool rim, matching the navigate lab. With
   ACES gone the intensities are read straight, so the key sits under 2 rather
   than at the 2.6 the tone curve used to swallow. */
scene.add(new THREE.AmbientLight(0xffffff, 0.34));
scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d4cc, 0.95));

const key = new THREE.DirectionalLight(0xfff5e0, 1.85);
key.position.set(5, 9, 6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0006;
key.shadow.normalBias = 0.02;
/* The actor climbs to height 6 and the shadow has to follow it the whole way, so
   the shadow camera is sized to the whole stage rather than to the object. */
key.shadow.camera.top = 12;
key.shadow.camera.bottom = -6;
key.shadow.camera.left = -10;
key.shadow.camera.right = 10;
key.shadow.camera.far = 34;
// A directional light shadow camera is orthographic and nothing rebuilds its
// projection for us; without this the frustum stays at its 10x10 default and the
// bounds set just above are ignored.
key.shadow.camera.updateProjectionMatrix();
scene.add(key, key.target);

/* Soft cool white rather than a saturated blue: the student orbits all the way
   around the rocket, and a blue rim tinted its whole back side violet. */
const rim = new THREE.DirectionalLight(0xdde4ff, 0.6);
rim.position.set(-5, 5, -6);
scene.add(rim);

/* ── floor ──
   A shadow-catcher rather than a surface. An opaque plane has an edge, and that
   edge draws a horizon across the screen that says "you are standing on a disc",
   which is the wrong read for a scene the student orbits freely. Catching the
   shadow onto the clear colour leaves the grid as the only ground cue, and the
   grid runs off the frame in every direction. */
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.ShadowMaterial({ opacity: 0.3 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

/* The grid is a ruler here: this lab asks the student to judge how far something
   moved between two moments, and that judgement needs landmarks that do not
   themselves move. Neutral black so it reads as a ruler, not as a colour. */
const grid = new THREE.GridHelper(20, 20, 0x000000, 0x000000);
grid.material.opacity = 0.1;
grid.material.transparent = true;
scene.add(grid);

/* ── height ruler ──
   A floor grid measures sideways travel but says almost nothing about height.
   This quiet vertical ruler turns a key at y=3 or y=6 into a distance the eye
   can check, which is especially useful while scrubbing between two poses. */
const ruler = new THREE.Group();
ruler.position.set(2.65, 0, -0.45);

const rulerMat = new THREE.LineBasicMaterial({
    color: 0x26334c,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
});
const rulerLineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 6.2, 0),
]);
ruler.add(new THREE.Line(rulerLineGeo, rulerMat));

for (let y = 0; y <= 6; y++) {
    const major = y % 3 === 0;
    const tickGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(major ? -0.34 : -0.18, y, 0),
        new THREE.Vector3(major ? 0.34 : 0.18, y, 0),
    ]);
    ruler.add(new THREE.Line(tickGeo, rulerMat));

    if (major) {
        const marker = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.085, 0),
            new THREE.MeshBasicMaterial({
                color: y === 3 ? 0xff9022 : 0x26334c,
                transparent: true,
                opacity: y === 3 ? 0.78 : 0.36,
                depthWrite: false,
            })
        );
        marker.position.set(0.5, y, 0);
        ruler.add(marker);
    }
}
scene.add(ruler);

/* ── scripted camera moves ──
   Beats ease the camera to a preset before a demo. While state.camLocked is true
   orbit is off and tickCam drives the camera; releasing hands control back. */
let camFrom = null, camFromLook = null, camTo = null, camToLook = null;
let camT = 1, camDur = 1;

export function setCam(name, instant = false) {
    const preset = CAMS[name];
    if (instant) {
        camera.position.copy(preset.pos);
        camera.lookAt(preset.look);
        orbitCtrl.target.copy(preset.look);
        orbitCtrl.update();
        camT = 1;
        return;
    }
    camFrom = camera.position.clone();
    camFromLook = orbitCtrl.target.clone();
    camTo = preset.pos.clone();
    camToLook = preset.look.clone();
    // A move the student can barely see reads as lag, so collapse it to a snap.
    camDur = camFrom.distanceTo(camTo) < 0.5 ? 0.001 : 0.85;
    camT = 0;
}

export function tickCam(dt) {
    // A scripted move and OrbitControls' damping both write the camera every
    // frame, so exactly one of them may run at a time or they fight and the
    // camera judders. The scripted move always wins while it is in flight.
    if (camT < 1 && camTo) {
        camT = Math.min(camT + dt / camDur, 1);
        const e = camT < .5 ? 4 * camT ** 3 : 1 - Math.pow(-2 * camT + 2, 3) / 2;
        camera.position.lerpVectors(camFrom, camTo, e);
        orbitCtrl.target.lerpVectors(camFromLook, camToLook, e);
        camera.lookAt(orbitCtrl.target);
        return;
    }
    if (orbitCtrl.enabled) orbitCtrl.update();
}

/* Hand camera control back to the student, orbiting around the preset's look. */
export function releaseCamera(name = 'hero') {
    orbitCtrl.target.copy(CAMS[name].look);
    state.camLocked = false;
    orbitCtrl.enabled = true;
    orbitCtrl.update();
}

export function resetView() {
    state.camLocked = false;
    orbitCtrl.enabled = true;
    setCam(CAM_FOR_BEAT[state.beatIdx] || 'hero');
}
