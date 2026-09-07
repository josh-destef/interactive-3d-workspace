/* ═══════════════════════════════════════════════
   STAGE
   Renderer, scene, camera, orbit controls, floor and the fixed light rig.

   Nothing about the lighting is a lesson here, so the rig is fixed and quiet:
   one key with a shadow, one cool fill, one hemisphere wash. The shadow is the
   part that matters. It is the only cue that tells a student the claw is out
   over the floor rather than behind the pedestal, and the pickup challenge is
   unsolvable without that depth read.
═══════════════════════════════════════════════ */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMS, BEAT_CAMS } from './config.js?v=selector5';
import { state } from './state.js?v=selector5';

export const W = () => document.getElementById('canvas-wrap').clientWidth;
export const H = () => document.getElementById('canvas-wrap').clientHeight;

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
orbitCtrl.enablePan = false;          // the arm is the whole subject; nothing to pan to
orbitCtrl.target.copy(CAMS.hero.look);
orbitCtrl.minDistance = 5;
orbitCtrl.maxDistance = 18;
orbitCtrl.minPolarAngle = 0.2;
orbitCtrl.maxPolarAngle = Math.PI / 2 - 0.06;   // stay above the floor
orbitCtrl.update();

/* ── light rig ──
   Ambient + hemisphere + warm key + cool rim, at the same intensities as the
   navigate lab. With ACES gone these are read straight, so the key is a little
   under 2 rather than the 2.6 the tone curve used to swallow.

   A directional key rather than a spot: the claw travels most of the way across
   a 24-unit grid, and a cone tight enough to look like studio lighting would
   drop the arm out of its own shadow halfway through the reach. */
scene.add(new THREE.AmbientLight(0xffffff, 0.34));
scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d4cc, 0.95));

const key = new THREE.DirectionalLight(0xfff5e0, 1.85);
key.position.set(6, 11, 7);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -12;
key.shadow.camera.right = 12;
key.shadow.camera.top = 12;
key.shadow.camera.bottom = -12;
key.shadow.camera.near = 1;
key.shadow.camera.far = 34;
// A directional light's shadow camera is orthographic, and nothing rebuilds its
// projection for us. Skip this and the frustum stays at its 10x10 default, which
// clips the shadow off the moment the claw reaches past the pedestal.
key.shadow.camera.updateProjectionMatrix();
key.shadow.bias = -0.0005;
key.shadow.normalBias = 0.02;
scene.add(key, key.target);

const rimLight = new THREE.DirectionalLight(0xdde4ff, 0.6);
rimLight.position.set(-7, 4.5, -4);
scene.add(rimLight);

/* ── floor ──
   A shadow-catcher rather than a surface. An opaque plane has an edge, and that
   edge draws a horizon across the screen that says "you are standing on a disc",
   which is exactly the wrong read for a scene the student orbits freely. Catching
   the shadow onto the clear colour leaves the grid as the only ground cue, and the
   grid runs off the frame in every direction. */
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.ShadowMaterial({ opacity: 0.3 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

/* The grid earns extra weight in this lab: world position is a number in the
   readout card until there is a ruler under the arm to check it against.
   Neutral black rather than blue-grey so it reads as a ruler, not as a colour. */
const grid = new THREE.GridHelper(24, 24, 0x000000, 0x000000);
grid.material.transparent = true;
grid.material.opacity = 0.1;
scene.add(grid);

/* ── scripted camera moves ──
   Beats ease the camera to a preset before a demo. While state.camLocked is true
   orbit is off and tickCam drives the camera; releasing hands control back. */
let camFrom = null, camFromLook = null, camTo = null, camToLook = null;
let camT = 1, camDur = 1;

export function setCam(key, instant = false) {
    const preset = CAMS[key];
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
export function releaseCamera(key = 'hero') {
    orbitCtrl.target.copy(CAMS[key].look);
    state.camLocked = false;
    orbitCtrl.enabled = true;
    orbitCtrl.update();
}

export function resetView() {
    state.camLocked = false;
    orbitCtrl.enabled = true;
    setCam(BEAT_CAMS[state.beatIdx] || 'hero');
}
