import * as THREE from 'three';

// Particles copy the muzzle transform at birth, then travel in world space.
// One fixed pool bounds both memory and the amount of work per frame.
export const POOL = 480;
export const DEFAULTS = Object.freeze({ count: 80, rate: 0, life: 3, speed: 4, spread: 45, gravity: 3, size: .16, palette: 'party', shape: 'square' });
export const params = { ...DEFAULTS };
export const LIMITS = Object.freeze({ count: [1, 300], rate: [0, 100], life: [.5, 6], speed: [0, 12], spread: [0, 120], gravity: [0, 12], size: [.06, .4] });
export const PALETTES = Object.freeze({
    party: ['#e84476', '#18a88a', '#ebad20', '#7259db', '#269bdd'],
    sunset: ['#e95757', '#f49738', '#d43885', '#9360bf', '#edbe38'],
    ocean: ['#087eaa', '#25b7b4', '#445cc8', '#8059c4', '#32a57b'],
});
const paletteColors = Object.fromEntries(Object.entries(PALETTES).map(([name, colors]) => [name, colors.map(hex => new THREE.Color(hex))]));

// Binary alpha gives solid paper silhouettes, not glowing spark textures.
// DataTexture also keeps the shipped simulation importable in Node QA.
function shapeTexture(shape) {
    const side = 32, data = new Uint8Array(side * side * 4);
    for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
        const dx = (x + .5 - side / 2) / (side / 2), dy = (y + .5 - side / 2) / (side / 2);
        const radius = Math.hypot(dx, dy);
        let inside = Math.abs(dx) < .84 && Math.abs(dy) < .84;
        if (shape === 'circle') inside = radius < .9;
        if (shape === 'star') {
            // Polygon test against the alternating outer/inner star vertices.
            inside = false;
            for (let i = 0, j = 9; i < 10; j = i++) {
                const ai = i * Math.PI / 5 - Math.PI / 2, aj = j * Math.PI / 5 - Math.PI / 2;
                const ri = i % 2 ? .4 : .96, rj = j % 2 ? .4 : .96;
                const xi = Math.cos(ai) * ri, yi = Math.sin(ai) * ri;
                const xj = Math.cos(aj) * rj, yj = Math.sin(aj) * rj;
                if ((yi > dy) !== (yj > dy) && dx < (xj - xi) * (dy - yi) / (yj - yi) + xi) inside = !inside;
            }
        }
        const offset = (y * side + x) * 4;
        data[offset] = data[offset + 1] = data[offset + 2] = 255;
        data[offset + 3] = inside ? 255 : 0;
    }
    const texture = new THREE.DataTexture(data, side, side);
    texture.needsUpdate = true;
    return texture;
}
const textures = Object.fromEntries(['square', 'circle', 'star'].map(shape => [shape, shapeTexture(shape)]));
const positions = new Float32Array(POOL * 3), colors = new Float32Array(POOL * 3);
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
const material = new THREE.PointsMaterial({ size: params.size, map: textures.square, vertexColors: true, alphaTest: .5, transparent: false, depthWrite: true, sizeAttenuation: true });
export const points = new THREE.Points(geometry, material);
points.frustumCulled = false;

export function setParam(key, value) {
    if (Object.hasOwn(LIMITS, key)) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return params[key];
        const [min, max] = LIMITS[key];
        params[key] = THREE.MathUtils.clamp(key === 'count' ? Math.round(numeric) : numeric, min, max);
    } else if (key === 'palette' && Object.hasOwn(PALETTES, value)) params.palette = value;
    else if (key === 'shape' && Object.hasOwn(textures, value)) params.shape = value;
    if (key === 'size') material.size = params.size;
    if (key === 'shape') material.map = textures[params.shape];
    return params[key];
}

const pool = Array.from({ length: POOL }, () => ({ alive: false, position: new THREE.Vector3(), velocity: new THREE.Vector3(), color: new THREE.Color(), age: 0, life: 1, crossedTarget: false }));
let cursor = 0, live = 0, birthDebt = 0, colorCursor = 0;
// Retained for compatibility with existing lab integrations; the playground
// evaluates creative bursts rather than requiring precision target scores.
let target = null, hits = 0;
export function setTarget(value) { target = value; hits = 0; }
export function getHits() { return hits; }
export function getLive() { return live; }
function freeSlot() {
    for (let i = 0; i < POOL; i++) {
        const index = (cursor + i) % POOL;
        if (!pool[index].alive) { cursor = (index + 1) % POOL; return index; }
    }
    return -1;
}
const muzzlePosition = new THREE.Vector3(), muzzleDirection = new THREE.Vector3();
const axisA = new THREE.Vector3(), axisB = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0), SIDE = new THREE.Vector3(1, 0, 0);

export function emit(source) {
    if (!source || typeof source.emissionWorld !== 'function') return null;
    const index = freeSlot();
    if (index < 0) return null;
    const particle = pool[index];
    source.emissionWorld(muzzlePosition, muzzleDirection);
    muzzleDirection.normalize();
    if (muzzleDirection.lengthSq() === 0) muzzleDirection.copy(UP);
    particle.position.copy(muzzlePosition);
    axisA.crossVectors(muzzleDirection, UP);
    if (axisA.lengthSq() < 1e-6) axisA.crossVectors(muzzleDirection, SIDE);
    axisA.normalize();
    axisB.crossVectors(muzzleDirection, axisA).normalize();
    const swing = Math.tan(THREE.MathUtils.degToRad(params.spread) / 2) * Math.sqrt(Math.random());
    const around = Math.random() * Math.PI * 2;
    particle.velocity.copy(muzzleDirection)
        .addScaledVector(axisA, swing * Math.cos(around))
        .addScaledVector(axisB, swing * Math.sin(around))
        .normalize().multiplyScalar(params.speed);
    const palette = paletteColors[params.palette];
    particle.color.copy(palette[colorCursor++ % palette.length]);
    particle.life = params.life;
    particle.age = 0;
    particle.alive = true;
    particle.crossedTarget = false;
    return particle;
}

/** Fire a burst and immediately synchronize live count and draw buffers. */
export function fireBurst(source, count = params.count) {
    const numeric = Number(count);
    if (!Number.isFinite(numeric)) return 0;
    const requested = THREE.MathUtils.clamp(Math.round(numeric), 1, LIMITS.count[1]);
    let created = 0;
    for (let i = 0; i < requested; i++) {
        if (!emit(source)) break;
        created++;
    }
    updateParticles(0, null);
    return created;
}

export function updateParticles(dt, source = null) {
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    if (source && params.rate > 0) {
        birthDebt += params.rate * dt;
        const births = Math.min(POOL, Math.floor(birthDebt + 1e-10));
        birthDebt = Math.max(0, birthDebt - Math.floor(birthDebt + 1e-10));
        for (let i = 0; i < births; i++) if (!emit(source)) break;
    }
    live = 0;
    for (let i = 0; i < POOL; i++) {
        const p = pool[i], offset = i * 3;
        if (!p.alive) { positions[offset + 1] = -100; continue; }
        p.age += dt;
        if (p.age >= p.life) { p.alive = false; positions[offset + 1] = -100; continue; }
        const oldX = p.position.x, oldY = p.position.y, oldZ = p.position.z;
        // Exact constant-acceleration step preserves the path at 30/60 Hz.
        p.position.addScaledVector(p.velocity, dt);
        p.position.y -= .5 * params.gravity * dt * dt;
        p.velocity.y -= params.gravity * dt;
        if (target && !p.crossedTarget && oldX < target.x && p.position.x >= target.x) {
            p.crossedTarget = true;
            const t = (target.x - oldX) / (p.position.x - oldX);
            if (Math.hypot(oldY + (p.position.y - oldY) * t - target.y, oldZ + (p.position.z - oldZ) * t - target.z) <= target.radius) hits++;
        }
        p.position.toArray(positions, offset);
        p.color.toArray(colors, offset);
        live++;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    return live;
}
export function resetParticles() {
    for (let i = 0; i < POOL; i++) { pool[i].alive = false; positions[i * 3 + 1] = -100; }
    geometry.attributes.position.needsUpdate = true;
    cursor = live = birthDebt = hits = colorCursor = 0;
}
resetParticles();
