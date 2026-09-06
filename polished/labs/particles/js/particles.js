/* ═══════════════════════════════════════════════
   PARTICLES
   The pool, the emitter body, and the CPU simulation that drives them.

   A fixed-size pool of records is simulated on the CPU every frame and pushed
   into two flat buffers - position and color - that back a single THREE.Points.
   Nothing about a particle exists as an object in the scene graph; it is a row
   in these arrays. That is what makes 600 of them cheap.
═══════════════════════════════════════════════ */
import * as THREE from 'three';
import { scene } from './stage.js';
import { state } from './state.js';
import { GRAVITY, POOL, PARTICLE_SIZE, SOLO_PARTICLE_SIZE, START_PARAMS } from './config.js';

/* ── buffers ──
   Dead particles are parked at y = -100 rather than removed - invisible, and
   far cheaper than rebuilding the buffer every time something dies. */
const positions = new Float32Array(POOL * 3);
const colorAttr = new Float32Array(POOL * 3);
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colorAttr, 3));

/* A radial alpha map turns WebGL's default square point into a soft spark. It is
   generated locally so the lab stays self-contained and sharp at any density. */
function makeSparkTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 31);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.28, 'rgba(255,255,255,0.98)');
    gradient.addColorStop(0.58, 'rgba(255,255,255,0.54)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

const sparkTexture = makeSparkTexture();

const material = new THREE.PointsMaterial({
    size: PARTICLE_SIZE,
    vertexColors: true,
    transparent: true,
    opacity: 0.96,
    map: sparkTexture,
    alphaTest: 0.025,
    depthWrite: false,
    blending: THREE.NormalBlending,
});

const points = new THREE.Points(geometry, material);
points.frustumCulled = false;
scene.add(points);

/* A second, larger pass is the halo around the crisp core. It shares both GPU
   buffers, so the richer effect costs one extra draw call rather than hundreds
   of meshes or lights. */
const glowMaterial = new THREE.PointsMaterial({
    size: PARTICLE_SIZE * 2.5,
    vertexColors: true,
    transparent: true,
    opacity: 0.12,
    map: sparkTexture,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
});
const glowPoints = new THREE.Points(geometry, glowMaterial);
glowPoints.frustumCulled = false;
glowPoints.renderOrder = -1;
scene.add(glowPoints);

/* The pad the particles appear to erupt from. Dark enough to anchor the eye and
   to read against the brightest particles, but the same slate as the hierarchy
   lab's pedestal rather than the near-black it used to be - on a paper-white
   stage that read as a hole punched in the floor. */
const emitter = new THREE.Group();

const emitterFoot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.66, 0.84, 0.28, 32),
    new THREE.MeshStandardMaterial({ color: 0x172033, roughness: 0.38, metalness: 0.24 })
);
emitterFoot.position.y = 0.14;
emitterFoot.castShadow = true;
emitterFoot.receiveShadow = true;

const emitterBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.62, 0.36, 32),
    new THREE.MeshStandardMaterial({ color: 0x31405b, roughness: 0.32, metalness: 0.3 })
);
emitterBody.position.y = 0.42;
emitterBody.castShadow = true;

const emitterLip = new THREE.Mesh(
    new THREE.TorusGeometry(0.43, 0.07, 10, 40),
    new THREE.MeshStandardMaterial({ color: 0xff9022, roughness: 0.28, metalness: 0.18 })
);
emitterLip.rotation.x = Math.PI / 2;
emitterLip.position.y = 0.62;
emitterLip.castShadow = true;

const emitterCore = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 32),
    new THREE.MeshBasicMaterial({ color: 0xffb12e, transparent: true, opacity: 0.84 })
);
emitterCore.rotation.x = -Math.PI / 2;
emitterCore.position.y = 0.625;

emitter.add(emitterFoot, emitterBody, emitterLip, emitterCore);
scene.add(emitter);

/* The current emitter shape is also visible as a faint launch guide. It turns
   an abstract button into a spatial rule before the first particle is born. */
const guideMaterial = new THREE.LineBasicMaterial({
    color: 0xff9022,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
});
function guide(geometry, y) {
    const lines = new THREE.LineSegments(new THREE.WireframeGeometry(geometry), guideMaterial);
    lines.position.y = y;
    lines.renderOrder = -2;
    scene.add(lines);
    return lines;
}
const shapeGuides = {
    cone: guide(new THREE.ConeGeometry(1.25, 2.4, 20, 1, true), 1.82),
    sphere: guide(new THREE.SphereGeometry(1.3, 14, 8), 1.45),
    line: guide(new THREE.BoxGeometry(2.5, 0.035, 0.035), 0.68),
};
function syncShapeGuide() {
    Object.entries(shapeGuides).forEach(([key, object]) => { object.visible = params.shape === key; });
}

/* ── the pool ── */
const particles = Array.from({ length: POOL }, () => ({
    alive: false,
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    age: 0,
    life: 1,
}));

export const params = { ...START_PARAMS };

let live = 0;
let oldest = 0;
let accumulator = 0;

/* ── rolling spawn cursor ──
   particles.find(item => !item.alive) is O(pool) per birth - fine at low
   rates, but a Burst 100 into a 600 pool would run that scan 100 times in one
   frame. Instead remember where the last free slot was and keep walking
   forward from there. Slots free up in roughly the order they were born, so
   this is amortized O(1) instead of O(pool) per spawn. */
let cursor = 0;
function findSlot() {
    for (let i = 0; i < POOL; i++) {
        const idx = (cursor + i) % POOL;
        if (!particles[idx].alive) {
            cursor = (idx + 1) % POOL;
            return idx;
        }
    }
    return -1;
}

function launchVelocity(v, shape, speed) {
    if (shape === 'sphere') {
        v.set(Math.random() - 0.5, Math.random() - 0.1, Math.random() - 0.5)
            .normalize().multiplyScalar(speed);
    } else if (shape === 'line') {
        v.set((Math.random() - 0.5) * 0.4, speed, (Math.random() - 0.5) * 0.4);
    } else {
        v.set((Math.random() - 0.5) * 1.5, 2.2 + Math.random() * 1.8, (Math.random() - 0.5) * 1.5)
            .normalize().multiplyScalar(speed);
    }
}

function spawnOne() {
    const idx = findSlot();
    if (idx < 0) return -1;
    const p = particles[idx];
    p.alive = true;
    p.age = 0;
    p.life = params.life * (0.72 + Math.random() * 0.56);
    p.position.set(0, 0.68, 0);
    if (params.shape === 'line') p.position.x = (Math.random() - 0.5) * 2.4;
    launchVelocity(p.velocity, params.shape, params.speed);
    return idx;
}

export function spawnBurst(count) {
    for (let i = 0; i < count; i++) if (spawnOne() < 0) break;
}

/* ── solo mode ──
   Beats 0-1 run one particle at a time: fixed lifetime and speed, a slight
   random tilt so it still reads as thrown rather than fired dead straight up. */
const SOLO_LIFE = 2.2;
const SOLO_SPEED = 6.5;
let soloIndex = -1;
const soloTelemetry = { position: new THREE.Vector3(), age: 0, life: SOLO_LIFE };

function spawnSolo() {
    const idx = findSlot();
    if (idx < 0) return;
    soloIndex = idx;
    const p = particles[idx];
    p.alive = true;
    p.age = 0;
    p.life = SOLO_LIFE;
    p.position.set(0, 0.68, 0);
    p.velocity.set((Math.random() - 0.5) * 1.0, 1, (Math.random() - 0.5) * 1.0)
        .normalize().multiplyScalar(SOLO_SPEED);
}

/* Kill every live particle - used when entering or leaving solo mode so the
   single-particle intro and the pooled stream never render into the same
   frame. */
function killAll() {
    for (let i = 0; i < POOL; i++) particles[i].alive = false;
    soloIndex = -1;
    accumulator = 0;
}

export function setSoloMode(on) {
    if (state.soloMode === on) return;
    state.soloMode = on;
    material.size = on ? SOLO_PARTICLE_SIZE : PARTICLE_SIZE;
    glowMaterial.size = on ? SOLO_PARTICLE_SIZE * 2.25 : PARTICLE_SIZE * 2.5;
    killAll();
}

/* ── color ──
   Hoisted once and lerped into rather than a `new THREE.Color()` per particle
   per frame - this loop runs up to 600 times a frame, every frame. */
/* Yellow -> red -> ember. The old end stops at a deep ember rather than at
   near-black: a particle that fades to black on a white stage reads as a speck of
   dirt, not as something cooling down. */
const cYoung = new THREE.Color(0xff9f1c);
const cMid = new THREE.Color(0xe63462);
const cOld = new THREE.Color(0x3a6fa8);
const cSingle = new THREE.Color(0xff9022);
const scratch = new THREE.Color();

function colorFor(progress) {
    if (!params.colorLife) return scratch.copy(cSingle);
    scratch.copy(cYoung).lerp(cMid, Math.min(progress / 0.72, 1));
    if (progress > 0.72) scratch.lerp(cOld, (progress - 0.72) / 0.28);
    return scratch;
}

/* ── simulation step ── */
export function updateParticles(dt) {
    if (state.soloMode) {
        if (soloIndex < 0 || !particles[soloIndex].alive) spawnSolo();
    } else {
        accumulator += params.rate * dt;
        const births = Math.floor(accumulator);
        accumulator -= births;
        for (let i = 0; i < births; i++) if (spawnOne() < 0) break;
    }

    live = 0;
    oldest = 0;
    for (let i = 0; i < POOL; i++) {
        const p = particles[i];
        const o = i * 3;
        if (!p.alive) { positions[o + 1] = -100; continue; }
        p.age += dt;
        if (p.age >= p.life) {
            p.alive = false;
            positions[o + 1] = -100;
            continue;
        }
        live++;
        if (p.age > oldest) oldest = p.age;
        if (params.gravity) p.velocity.y -= GRAVITY * dt;
        p.velocity.multiplyScalar(Math.max(0, 1 - params.drag * dt));
        p.position.addScaledVector(p.velocity, dt);
        positions[o] = p.position.x;
        positions[o + 1] = p.position.y;
        positions[o + 2] = p.position.z;
        const c = colorFor(p.age / p.life);
        colorAttr[o] = c.r;
        colorAttr[o + 1] = c.g;
        colorAttr[o + 2] = c.b;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
}

export function getLive() { return live; }
export function getOldest() { return oldest; }
export function getPoolFrac() { return live / POOL; }

/* Reuses one record so the DOM label can follow the solo particle without
   allocating a Vector3 sixty times a second. */
export function getSoloTelemetry() {
    if (soloIndex < 0 || !particles[soloIndex]?.alive) return null;
    const p = particles[soloIndex];
    soloTelemetry.position.copy(p.position);
    soloTelemetry.age = p.age;
    soloTelemetry.life = p.life;
    return soloTelemetry;
}

/* ── param <-> material sync ── */
function applyBlend() {
    material.blending = params.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    material.needsUpdate = true;
}

export function setParam(key, value) {
    params[key] = value;
    if (key === 'additive') applyBlend();
    if (key === 'shape') syncShapeGuide();
}

export function setParams(patch) {
    Object.assign(params, patch);
    if ('additive' in patch) applyBlend();
    if ('shape' in patch) syncShapeGuide();
}

syncShapeGuide();
