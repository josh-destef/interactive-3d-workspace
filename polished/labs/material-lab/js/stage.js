/* ═══════════════════════════════════════════════
   STAGE
   Renderer, scene, camera, orbit controls, and the studio light rig.

   The rig holds still while the surface properties are introduced. Once those
   are understood, the light gets its own comparison and the material holds still.
═══════════════════════════════════════════════ */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CAMS, SUBJECT_Y, LIGHT_START, LIGHT_COLORS, BEAT } from './config.js';
import { state } from './state.js';

export const W = () => window.innerWidth;
export const H = () => window.innerHeight;

export const clock = new THREE.Clock();

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd6d9de);

export const camera = new THREE.PerspectiveCamera(38, W() / H(), 0.05, 100);
camera.position.copy(CAMS.hero.pos);

const canvas = document.getElementById('cv');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(W(), H());
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;

/* A restrained environment reflection keeps metals readable without acting
   like a second broad studio light. Each material's envMapIntensity is held
   low below; the orb remains the only direct light in the scene. */
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

export const orbitCtrl = new OrbitControls(camera, canvas);
orbitCtrl.enableDamping = true;
orbitCtrl.dampingFactor = 0.08;
orbitCtrl.enablePan = false;          // nothing to pan to; keeps the subject centered
orbitCtrl.target.copy(CAMS.hero.look);
orbitCtrl.minDistance = 3.0;
orbitCtrl.maxDistance = 9.5;
orbitCtrl.minPolarAngle = 0.25;
orbitCtrl.maxPolarAngle = Math.PI / 2 - 0.06;   // stay above the floor
orbitCtrl.update();

/* ── single-light studio ──
   The orb and this point light are one source. There are no fill, rim, ambient,
   or hemisphere lights competing with it, so its highlight and shadow remain
   the clearest change in the scene. */
const KEY_ORBIT_RADIUS = 3.4;
const KEY_HEIGHT = 3.05;
const KEY_INTENSITY = 85;

const key = new THREE.PointLight(LIGHT_COLORS.warm.value, KEY_INTENSITY, 9, 2);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.near = 0.1;
key.shadow.camera.far = 9;
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
scene.add(key);

/* ── direct light handle ──
   The learner drags one visible orb. Its height and radius never change, so
   every pointer movement resolves to one angle around Gizmobot rather than to
   hidden XYZ controls. The larger transparent sphere is only a forgiving hit
   target; the colored orb is the single visible light marker. */
const lightOrb = new THREE.Group();
lightOrb.name = 'Light_Orbit_Handle';
lightOrb.visible = false;
scene.add(lightOrb);

const orbCoreMaterial = new THREE.MeshBasicMaterial({
    color: LIGHT_COLORS.warm.value,
    toneMapped: false,
});
const orbCore = new THREE.Mesh(new THREE.SphereGeometry(0.23, 24, 16), orbCoreMaterial);
orbCore.name = 'Light_Orb';
orbCore.renderOrder = 5;
lightOrb.add(orbCore);

const orbHit = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 12, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
);
orbHit.name = 'Light_Orb_Hit_Area';
lightOrb.add(orbHit);

export function setKeyColor(name) {
    const selected = LIGHT_COLORS[name] || LIGHT_COLORS.warm;
    key.color.set(selected.value);
    orbCoreMaterial.color.set(selected.value);
}

export function setLightOrbVisible(on) {
    lightOrb.visible = !!on;
    if (!on) canvas.style.cursor = '';
}

/* Swing the key light around the subject. Degrees, 0 = straight in front of the
   hero camera, positive to the student's right. */
export function setKeyAzimuth(deg) {
    const az = THREE.MathUtils.degToRad(deg);
    key.position.set(
        Math.sin(az) * KEY_ORBIT_RADIUS,
        KEY_HEIGHT,
        Math.cos(az) * KEY_ORBIT_RADIUS
    );
    lightOrb.position.copy(key.position);
}
setKeyAzimuth(LIGHT_START);

const orbScreen = new THREE.Vector3();
export function lightOrbScreenPoint() {
    lightOrb.getWorldPosition(orbScreen);
    orbScreen.project(camera);
    return {
        x: (orbScreen.x * 0.5 + 0.5) * W(),
        y: (-orbScreen.y * 0.5 + 0.5) * H(),
    };
}

const orbRaycaster = new THREE.Raycaster();
const orbPointer = new THREE.Vector2();
const orbDragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -KEY_HEIGHT);
const orbPlaneHit = new THREE.Vector3();
let draggingLight = false;
let restoreOrbit = true;
let onOrbChange = () => { };

export function onLightOrbChange(fn) { onOrbChange = fn; }

function updateOrbRay(event) {
    const rect = canvas.getBoundingClientRect();
    orbPointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    orbRaycaster.setFromCamera(orbPointer, camera);
}

function pointerHitsOrb(event) {
    if (!lightOrb.visible) return false;
    updateOrbRay(event);
    return orbRaycaster.intersectObject(orbHit, false).length > 0;
}

canvas.addEventListener('pointerdown', event => {
    if (state.beatLocked || state.reading || !pointerHitsOrb(event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    draggingLight = true;
    restoreOrbit = orbitCtrl.enabled;
    orbitCtrl.enabled = false;
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
}, true);

canvas.addEventListener('pointermove', event => {
    if (!draggingLight) {
        if (event.pointerType !== 'touch') canvas.style.cursor = pointerHitsOrb(event) ? 'grab' : '';
        return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    updateOrbRay(event);
    if (!orbRaycaster.ray.intersectPlane(orbDragPlane, orbPlaneHit)) return;
    const deg = THREE.MathUtils.radToDeg(Math.atan2(orbPlaneHit.x, orbPlaneHit.z));
    setKeyAzimuth(deg);
    onOrbChange(deg);
}, true);

function releaseLightOrb(event) {
    if (!draggingLight) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    draggingLight = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    orbitCtrl.enabled = restoreOrbit && !state.camLocked;
    canvas.style.cursor = pointerHitsOrb(event) ? 'grab' : '';
}

canvas.addEventListener('pointerup', releaseLightOrb, true);
canvas.addEventListener('pointercancel', releaseLightOrb, true);

/* ── floor ──
   Rough and near-white so it stays a stage rather than a surface the student
   starts reading. It catches the shadow, which also makes the light step clear. */
const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0xb9bec5,
    roughness: 0.95,
    metalness: 0,
    envMapIntensity: 0.16,
});
const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 64), floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

/* ── the room lights ──
   Emissive is easiest to understand when reflected lighting falls away. The
   room switch dims the lamps, background, floor and environment together so a
   bright reflection cannot survive in a room that is meant to be dark. */
const LIT = { bg: new THREE.Color(0xd6d9de), floor: new THREE.Color(0xb9bec5) };
const DARK = { bg: new THREE.Color(0x14141d), floor: new THREE.Color(0x1c1c26) };

const envTargets = [];
export function registerRoomMaterial(material) { envTargets.push(material); }

let roomTarget = 1;
let roomLevel = 1;

export function setRoomLights(on, instant = false) {
    roomTarget = on ? 1 : 0;
    if (instant) roomLevel = roomTarget;
    applyRoom();
}

export function roomLightsOn() { return roomTarget === 1; }

export function tickRoom(dt) {
    if (roomLevel === roomTarget) return;
    const step = dt / 0.5;
    roomLevel = roomTarget > roomLevel
        ? Math.min(roomLevel + step, roomTarget)
        : Math.max(roomLevel - step, roomTarget);
    applyRoom();
}

function applyRoom() {
    const t = roomLevel;
    key.intensity = KEY_INTENSITY * t;
    scene.background.lerpColors(DARK.bg, LIT.bg, t);
    floorMaterial.color.lerpColors(DARK.floor, LIT.floor, t);
    floorMaterial.envMapIntensity = 0.02 + 0.14 * t;
    for (const material of envTargets) material.envMapIntensity = 0.02 + 0.22 * t;
}

/* ── framing around the console ──
   The console spans the whole bottom of the screen, so the canvas the student
   can actually see is the band above it. Rather than aiming every camera preset
   at a fudged point below the model - which only lands for one console height
   and one screen - the projection itself is shifted up by half the console's
   real height. The subject then sits centered in the visible band at any size,
   and the presets can go on pointing at Gizmobot.

   setViewOffset also feeds camera.project(), so the challenge's floating labels
   stay pinned to their robots for free. */
let bandOffset = 0;

export function setBandOffset(px) {
    bandOffset = px || 0;
    applyFraming();
}

export function applyFraming() {
    const w = W(), h = H();
    camera.aspect = w / h;
    camera.setViewOffset(w, h, 0, bandOffset / 2, w, h);
}

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
    setCam(state.beatIdx === BEAT.CHALLENGE ? 'match' : 'hero');
}
