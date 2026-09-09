// Exercise the shipped browser simulation in Node with the local Three.js QA dependency.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const threeURL = pathToFileURL(path.join(os.tmpdir(), 'fundamentals-3d-qa/node_modules/three/build/three.module.js')).href;
const source = fs.readFileSync(path.join(root, 'polished/labs/particle-cannon/js/particles.js'), 'utf8').replace("from 'three'", `from '${threeURL}'`);
const sim = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const { POOL, DEFAULTS, params, setParam, emit, fireBurst, updateParticles, resetParticles, getLive, points } = sim;
const STEP = 1 / 60;
function muzzle(position = [0, 2, 0], direction = [1, 0, 0]) {
    return { emissionWorld(p, d) { p.set(...position); d.set(...direction).normalize(); } };
}
function fresh(overrides = {}) {
    resetParticles();
    for (const [key, value] of Object.entries({ ...DEFAULTS, spread: 0, gravity: 0, ...overrides })) setParam(key, value);
}
const steady = muzzle();
assert.deepEqual(params, { count: 80, rate: 0, life: 3, speed: 4, spread: 45, gravity: 3, size: .16, palette: 'party', shape: 'square' });
assert.ok(POOL <= 480);
fresh();
assert.equal(fireBurst(steady), 80);
assert.equal(getLive(), 80, 'burst live count must update immediately, including paused playback');
const positions = points.geometry.attributes.position.array;
assert.deepEqual(Array.from(positions.slice(0, 3)), [0, 2, 0], 'burst must draw immediately at the muzzle');
updateParticles(STEP);
assert.ok(Math.abs(positions[0] - 4 * STEP) < 1e-6);
fresh();
assert.equal(fireBurst(steady, 1), 1, 'Fire One creates exactly one piece');
assert.equal(getLive(), 1);
assert.equal(fireBurst(null), 0, 'a detached cannon cannot emit');

// Every palette must produce multiple stable, saturated colors in a burst.
for (const palette of Object.keys(sim.PALETTES)) {
    fresh({ palette });
    fireBurst(steady, 10);
    const colors = points.geometry.attributes.color.array;
    const initial = Array.from(colors.slice(0, 30));
    assert.ok(new Set(Array.from({ length: 10 }, (_, i) => initial.slice(i * 3, i * 3 + 3).join(','))).size >= 3);
    assert.ok(initial.some(value => value < .1), 'confetti needs saturated colors on the pale stage');
    updateParticles(.5);
    assert.deepEqual(Array.from(colors.slice(0, 30)), initial, 'paper retains its color as it ages');
}
assert.equal(points.material.transparent, false, 'paper uses opaque rendering');
assert.ok(points.material.alphaTest > 0, 'shape masks have crisp edges');
const maps = new Set();
for (const shape of ['square', 'circle', 'star']) { setParam('shape', shape); maps.add(points.material.map); }
assert.equal(maps.size, 3, 'each shape has a distinct silhouette');
setParam('size', .3);
assert.equal(points.material.size, .3);

// Emitted particles keep their copied world transform when the cannon moves.
fresh({ speed: 8 });
const location = [0, 1, 0], direction = [1, 0, 0], moving = muzzle(location, direction);
const first = emit(moving);
location[0] = 10; direction[0] = 0; direction[1] = 1;
const second = emit(moving);
updateParticles(STEP);
assert.ok(first.position.x > 0 && first.position.x < 1 && first.position.y === 1);
assert.ok(second.position.x === 10 && second.velocity.y === 8);

// Gravity integration should agree across common frame rates.
function ballistic(step) {
    fresh({ speed: 6, gravity: 9 });
    const p = emit(muzzle([0, 4, 0]));
    for (let i = 0; i < Math.round(1 / step); i++) updateParticles(step);
    return p.position.clone();
}
assert.ok(ballistic(1 / 30).distanceTo(ballistic(1 / 60)) < 1e-9);
assert.ok(Math.abs(ballistic(STEP).y + .5) < 1e-9);
fresh({ life: .5 });
fireBurst(steady, 20);
updateParticles(.49);
assert.equal(getLive(), 20);
updateParticles(.02);
assert.equal(getLive(), 0, 'all pieces expire at the requested lifetime');

// The pool is fixed, refuses excess births, and is reusable after clear.
fresh();
assert.equal(fireBurst(steady, 300), 300);
assert.equal(fireBurst(steady, 300), POOL - 300);
assert.equal(getLive(), POOL);
assert.equal(emit(steady), null);
resetParticles();
assert.equal(getLive(), 0);
assert.equal(fireBurst(steady, 300), 300);
assert.equal(points.geometry.attributes.position.count, POOL);
fresh({ rate: 24 });
for (let i = 0; i < 60; i++) updateParticles(STEP, steady);
assert.equal(getLive(), 24, 'continuous mode preserves fractional emission across frames');
fresh();
for (let i = 0; i < 60; i++) updateParticles(STEP, steady);
assert.equal(getLive(), 0, 'burst mode does not secretly emit continuously');

// The half-angle of every launch stays within the selected full spread.
fresh({ spread: 30 });
let widest = 0;
for (let i = 0; i < 400; i++) {
    const p = emit(steady);
    widest = Math.max(widest, Math.acos(Math.min(1, p.velocity.clone().normalize().x)) * 180 / Math.PI);
}
assert.ok(widest <= 15.001 && widest > 10);
for (const [key, [min, max]] of Object.entries(sim.LIMITS)) {
    assert.equal(setParam(key, -100), min);
    assert.equal(setParam(key, 10000), max);
    assert.equal(setParam(key, NaN), max);
    assert.equal(setParam(key, Infinity), max);
}
setParam('palette', 'ocean'); setParam('palette', 'invalid'); assert.equal(params.palette, 'ocean');
setParam('shape', 'star'); setParam('shape', 'invalid'); assert.equal(params.shape, 'star');
fresh();
assert.equal(fireBurst(steady, Infinity), 0);
assert.equal(fireBurst(steady, 10000), 300, 'individual bursts respect count limit');
updateParticles(-1);
assert.equal(getLive(), 300, 'negative time cannot move the simulation backwards');
updateParticles(10000, steady);
assert.equal(getLive(), 0, 'large time steps terminate without unbounded birth loops');
resetParticles();
console.log('PASS particle playground: immediate bursts, Fire One, world muzzle independence, palettes, shapes, size, gravity, frame-rate consistency, expiry, bounded pool, continuous rate, spread, input bounds, clear/reuse');
