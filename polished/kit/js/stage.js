/* ═══════════════════════════════════════════════
   STAGE
   Renderer, scene, camera, orbit controls and a light rig - the three.js
   setup every lab writes identically and then tunes in two or three places.

       const stage = createStage({ rig: 'viewport', ground: true });

   TWO RIGS, because labs need light for two different reasons:

   'viewport'  A hemisphere fill, a warm key and a soft cool rim. Students
               orbit all the way around, so the back has to read as well as
               the front. The rim is a soft cool white rather than saturated
               blue, which used to tint the whole back side purple. Use this
               wherever the lesson is about moving, arranging or animating -
               the lighting is stagecraft and should be invisible.

   'studio'    One point light and a restrained environment reflection, and
               nothing else: no fill, no rim, no ambient competing with it.
               Use this wherever light itself is the subject, so that moving
               the key is the clearest change on screen.
═══════════════════════════════════════════════ */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clamp } from './utils.js';

/* Lives here rather than in utils.js so that utils - and therefore anim.js,
   and therefore every non-3D page that runs a scripted demo - stays free of
   three. A lab writing camera presets imports it from here. */
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function createStage({
    canvasId = 'cv',
    wrapId = 'canvas-wrap',
    rig = 'viewport',
    ground = true,
    background = 0xf8f8f6,
    fov = 44,
    position = [0, 2.5, 7],
    target = [0, 1, 0],
    /* three.js needs preserveDrawingBuffer to read the canvas back; only turn
       it on for a lab that offers the student a picture of their work. */
    capture = false,
} = {}) {
    const canvas = document.getElementById(canvasId);
    const wrap = document.getElementById(wrapId);
    const W = () => wrap.clientWidth;
    const H = () => wrap.clientHeight;

    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        preserveDrawingBuffer: capture,
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(W(), H());
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const clock = new THREE.Clock();

    const camera = new THREE.PerspectiveCamera(fov, W() / H(), 0.01, 200);
    camera.up.set(0, 1, 0);
    camera.position.set(...position);
    camera.lookAt(...target);

    const orbitCtrl = new OrbitControls(camera, canvas);
    orbitCtrl.enableDamping = true;
    orbitCtrl.dampingFactor = 0.08;
    orbitCtrl.minDistance = 3;
    orbitCtrl.maxDistance = 14;
    orbitCtrl.minPolarAngle = 0.2;                 // never below the floor
    orbitCtrl.maxPolarAngle = Math.PI * 0.55;      // never fully overhead
    orbitCtrl.target.set(...target);
    orbitCtrl.enabled = false;                     // beats switch this on

    /* Keep the student from orbiting the subject out of frame entirely. */
    orbitCtrl.addEventListener('change', () => {
        orbitCtrl.target.x = clamp(orbitCtrl.target.x, -10, 10);
        orbitCtrl.target.y = clamp(orbitCtrl.target.y, 0, 5);
        orbitCtrl.target.z = clamp(orbitCtrl.target.z, -10, 10);
    });

    /* ── lighting ── */
    const lights = {};
    if (rig === 'studio') {
        scene.background = new THREE.Color(0xd6d9de);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.92;
        lights.key = new THREE.PointLight(0xffd3a5, 85, 9, 2);
        lights.key.position.set(2.4, 3.05, 2.4);
        lights.key.castShadow = true;
        lights.key.shadow.mapSize.set(1024, 1024);
        lights.key.shadow.camera.near = 0.1;
        lights.key.shadow.camera.far = 9;
        lights.key.shadow.bias = -0.0004;
        lights.key.shadow.normalBias = 0.02;
        scene.add(lights.key);
        /* The lab adds its own environment map if it needs one; see
           material-lab/js/stage.js for the PMREM + RoomEnvironment version. */
    } else {
        renderer.setClearColor(background, 1);
        lights.ambient = new THREE.AmbientLight(0xffffff, 0.3);
        lights.hemi = new THREE.HemisphereLight(0xffffff, 0xd8d4cc, 0.45);
        lights.key = new THREE.DirectionalLight(0xfff5e0, 1.2);
        lights.key.position.set(5, 8, 5);
        lights.key.castShadow = true;
        lights.key.shadow.mapSize.set(1024, 1024);
        lights.rim = new THREE.DirectionalLight(0xdde4ff, 0.55);
        lights.rim.position.set(-4, 2, -6);
        Object.values(lights).forEach(l => scene.add(l));
    }

    /* ── floor ──
       A faint grid and a shadow-only plane. Without a contact shadow, a model
       reads as floating no matter how good the lighting is. */
    if (ground) {
        const grid = new THREE.GridHelper(20, 20, 0x000000, 0x000000);
        grid.material.opacity = 0.1;
        grid.material.transparent = true;
        scene.add(grid);

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(20, 20),
            new THREE.ShadowMaterial({ opacity: 0.3 }),
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);
    }

    /* ── camera moves ──
       A scripted move has to fight the orbit controls for the camera, so it
       owns both the position and the target for its duration. `camLocked`
       tells the rest of the lab a move is in progress. */
    const camState = { locked: false, from: null, to: null, t: 0, dur: 1 };

    function flyTo(preset, instant = false) {
        const to = { pos: preset.pos.clone(), look: preset.look.clone() };
        if (instant) {
            camera.position.copy(to.pos);
            orbitCtrl.target.copy(to.look);
            orbitCtrl.update();
            return;
        }
        camState.from = { pos: camera.position.clone(), look: orbitCtrl.target.clone() };
        camState.to = to;
        camState.t = 0;
        camState.dur = preset.duration || 1.2;
        camState.locked = true;
    }

    function tickCam(dt) {
        if (!camState.locked) { orbitCtrl.update(); return; }
        camState.t = Math.min(camState.t + dt / camState.dur, 1);
        const e = camState.t < .5
            ? 4 * camState.t ** 3
            : 1 - Math.pow(-2 * camState.t + 2, 3) / 2;
        camera.position.lerpVectors(camState.from.pos, camState.to.pos, e);
        orbitCtrl.target.lerpVectors(camState.from.look, camState.to.look, e);
        orbitCtrl.update();
        if (camState.t >= 1) camState.locked = false;
    }

    function resize() {
        camera.aspect = W() / H();
        camera.updateProjectionMatrix();
        renderer.setSize(W(), H());
    }
    window.addEventListener('resize', resize);

    /* Project a world point to pixels inside the canvas wrap - for pinning a
       .model-label over an object, or aiming the demo cursor at one. */
    function toScreen(worldPos) {
        const p = worldPos.clone().project(camera);
        return { x: (p.x * 0.5 + 0.5) * W(), y: (p.y * -0.5 + 0.5) * H() };
    }

    return {
        renderer, scene, camera, clock, orbitCtrl, lights,
        W, H, flyTo, tickCam, camState, resize, toScreen,
    };
}

/* Fade out the loading overlay once the scene is genuinely ready.

   The delay is not cosmetic. An environment map is generated over the first
   frames, and starting a lesson under a half-built one shows the student a
   material that then changes on its own. */
export function hideLoading(delay = 180) {
    const el = document.getElementById('loading');
    if (!el) return Promise.resolve();
    return new Promise(resolve => {
        setTimeout(() => {
            el.classList.add('fade');
            setTimeout(() => { el.style.display = 'none'; }, 800);
            resolve();
        }, delay);
    });
}

export function failLoading(message = 'Could not load this lesson') {
    const el = document.getElementById('loading');
    if (!el) return;
    el.textContent = message;
    el.classList.add('error');
}
