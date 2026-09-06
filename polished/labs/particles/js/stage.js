/* ═══════════════════════════════════════════════
   STAGE
   Renderer, scene, camera, orbit controls, and the light rig.

   Points are unlit - vertex-colored and additively or alpha blended - so the
   rig only has to serve the emitter body and the floor's shadow, not the
   particles themselves.
═══════════════════════════════════════════════ */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMS } from './config.js';
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
orbitCtrl.enablePan = false;          // nothing to pan to; keeps the emitter centered
orbitCtrl.target.copy(CAMS.hero.look);
orbitCtrl.minDistance = 4;
orbitCtrl.maxDistance = 18;
orbitCtrl.maxPolarAngle = Math.PI / 2 - 0.06;   // stay above the floor
orbitCtrl.update();

/* ── light rig ──
   Ambient + hemisphere + warm key + cool rim, matching the navigate lab.

   A directional key rather than the spot this lab used to run: a cone lights a
   circle and leaves everything outside it in shadow, which turned the floor into
   a dark grey pool with a bright patch in the middle - the opposite of the light,
   even stage the other labs share. */
scene.add(new THREE.AmbientLight(0xffffff, 0.34));
scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d4cc, 0.95));

const key = new THREE.DirectionalLight(0xfff5e0, 1.85);
key.position.set(4, 8, 5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -8;
key.shadow.camera.right = 8;
key.shadow.camera.top = 8;
key.shadow.camera.bottom = -8;
key.shadow.camera.far = 30;
// A directional light's shadow camera is orthographic and nothing rebuilds its
// projection for us; without this the frustum stays at its 10x10 default.
key.shadow.camera.updateProjectionMatrix();
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
scene.add(key, key.target);

const rim = new THREE.DirectionalLight(0xdde4ff, 0.6);
rim.position.set(-5, 4, -3);
scene.add(rim);

/* ── floor ──
   A shadow-catcher rather than a surface. The opaque disc this lab used to draw
   put a hard curved horizon across the middle of the screen; catching the shadow
   onto the clear colour instead leaves nothing to cut the frame in half.

   The grid is deliberately fainter than in the other labs. A full-strength grid
   competes with a few hundred moving points for the eye, but with no floor and no
   grid at all the emitter reads as floating in a void, and the arcs that gravity
   and drag draw have nothing to be arcs *against*. */
const floor = new THREE.Mesh(
    new THREE.CircleGeometry(12, 64),
    new THREE.ShadowMaterial({ opacity: 0.3 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(20, 20, 0x000000, 0x000000);
grid.material.transparent = true;
grid.material.opacity = 0.06;
scene.add(grid);

/* ── scripted camera moves ──
   Beats ease the camera to a preset before a demo. While state.camLocked is
   true orbit is off and tickCam drives the camera; releasing hands control
   back. */
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
    const key = state.beatIdx === 0 ? 'solo' : state.beatIdx === 8 ? 'wide' : 'hero';
    setCam(key);
}
