/* QA for the topology lab.
 *
 * Two things are checked, because two things can break independently:
 *
 *   the asset   the ladder is monotonic, LOD0 is the source mesh byte for byte,
 *               and all three embedded textures survived the bake untouched
 *   the lesson  subject.js reports the counts the meter puts on screen, the
 *               crowd really does swap every figure's geometry, and the budget
 *               has exactly one right answer
 *
 * Run from the repository root with the shared `fundamentals-3d-qa` Three.js
 * dependency in the system temp directory:
 *
 *     node scripts/qa-topology-gizmobot.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const lab = path.join(root, 'polished/labs/topology-gizmobot');
const threeUrl = pathToFileURL(
    path.join(os.tmpdir(), 'fundamentals-3d-qa/node_modules/three/build/three.module.js')).href;
const THREE = await import(threeUrl);
const moduleUrl = src => 'data:text/javascript;base64,' + Buffer.from(src).toString('base64');

/* ── the GLB, read by hand ── */
function readGlb(file) {
    const buf = fs.readFileSync(file);
    const jsonLength = buf.readUInt32LE(12);
    const doc = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'));
    const bin = buf.subarray(28 + jsonLength);
    return { doc, bin, buf };
}

const baked = readGlb(path.join(lab, 'assets/gizmobot-topology.glb'));
const source = readGlb(path.join(root, 'polished/labs/navigate-and-transform/assets/gizmobot.glb'));
const report = JSON.parse(fs.readFileSync(path.join(lab, 'assets/topology-report.json'), 'utf8'));

const SIZES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const WIDTHS = { 5126: 4, 5123: 2, 5125: 4 };

function accessorBytes({ doc, bin }, index) {
    const a = doc.accessors[index];
    const v = doc.bufferViews[a.bufferView];
    const width = SIZES[a.type] * WIDTHS[a.componentType];
    const start = (v.byteOffset || 0) + (a.byteOffset || 0);
    return bin.subarray(start, start + a.count * (v.byteStride || width));
}

function accessorArray(glb, index) {
    const a = glb.doc.accessors[index];
    const bytes = accessorBytes(glb, index);
    const copy = Buffer.from(bytes);          // realign: byteStride is dense here
    const Ctor = a.componentType === 5126 ? Float32Array
        : a.componentType === 5123 ? Uint16Array : Uint32Array;
    return new Ctor(copy.buffer, copy.byteOffset, a.count * SIZES[a.type]);
}

/* ── the asset ── */
const lodNodes = baked.doc.nodes.filter(n => /^LOD\d+$/.test(n.name));
assert.equal(lodNodes.length, report.levels.length, 'node count matches the report');
assert.deepEqual(
    lodNodes.map(n => n.name),
    report.levels.map(l => `LOD${l.level}`),
    'the ladder is named LOD0..LODn in order');

const counts = lodNodes.map(node => {
    const prim = baked.doc.meshes[node.mesh].primitives[0];
    return {
        triangles: baked.doc.accessors[prim.indices].count / 3,
        vertices: baked.doc.accessors[prim.attributes.POSITION].count,
        material: prim.material,
    };
});
counts.forEach((c, i) => {
    assert.equal(c.triangles, report.levels[i].triangles, `LOD${i} triangle count matches the report`);
    assert.equal(c.vertices, report.levels[i].vertices, `LOD${i} vertex count matches the report`);
    assert.equal(c.material, 0, `LOD${i} uses the one shared material`);
    assert.ok(c.vertices < 65536, `LOD${i} fits 16-bit indices`);
});
for (let i = 1; i < counts.length; i++) {
    assert.ok(counts[i].triangles < counts[i - 1].triangles,
        `LOD${i} is strictly coarser than LOD${i - 1}`);
}

/* LOD0 must BE the source mesh, not a re-encoding of it. */
const srcPrim = source.doc.meshes[0].primitives[0];
const lod0Prim = baked.doc.meshes[lodNodes[0].mesh].primitives[0];
for (const semantic of Object.keys(srcPrim.attributes)) {
    assert.ok(accessorBytes(source, srcPrim.attributes[semantic])
        .equals(accessorBytes(baked, lod0Prim.attributes[semantic])),
        `LOD0 ${semantic} is byte-identical to the source`);
}
assert.ok(accessorBytes(source, srcPrim.indices).equals(accessorBytes(baked, lod0Prim.indices)),
    'LOD0 indices are byte-identical to the source');

/* The textures are the reason the bake appends to the original BIN chunk
   instead of rewriting it. */
const images = glb => glb.doc.images.map(img => {
    const v = glb.doc.bufferViews[img.bufferView];
    return glb.bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
});
const srcImages = images(source);
const bakedImages = images(baked);
assert.equal(bakedImages.length, srcImages.length, 'every source texture is still there');
srcImages.forEach((img, i) => assert.ok(img.equals(bakedImages[i]),
    `embedded texture ${i} is byte-identical to the source`));
assert.deepEqual(baked.doc.materials, source.doc.materials, 'the material is unchanged');

/* ── the lesson ── */
const configUrl = moduleUrl(fs.readFileSync(path.join(lab, 'js/config.js'), 'utf8')
    .replace("import { V3 } from '../../../kit/js/stage.js';",
        `import * as THREE from '${threeUrl}'; const V3 = (x, y, z) => new THREE.Vector3(x, y, z);`));
const config = await import(configUrl);

/* Build the real node tree with real geometry, minus the browser-only image
   decoding the loader would otherwise do. */
const loaderUrl = moduleUrl(`import * as THREE from '${threeUrl}';
const LEVELS = ${JSON.stringify(lodNodes.map((node, i) => {
    const prim = baked.doc.meshes[node.mesh].primitives[0];
    return {
        name: node.name,
        position: Array.from(accessorArray(baked, prim.attributes.POSITION)),
        index: Array.from(accessorArray(baked, prim.indices)),
    };
}))};
const BASE = ${JSON.stringify({
    translation: baked.doc.nodes[0].translation,
    scale: baked.doc.nodes[0].scale,
})};
export class GLTFLoader {
  load(url, onLoad) {
    const root = new THREE.Group();
    const base = new THREE.Group();
    base.name = 'Gizmobot';
    if (BASE.translation) base.position.fromArray(BASE.translation);
    if (BASE.scale) base.scale.fromArray(BASE.scale);
    root.add(base);
    for (const level of LEVELS) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(level.position, 3));
      geo.setIndex(level.index);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
      mesh.name = level.name;
      base.add(mesh);
    }
    onLoad({ scene: root });
  }
}`);

const subjectSrc = fs.readFileSync(path.join(lab, 'js/subject.js'), 'utf8')
    .replace("from 'three'", `from '${threeUrl}'`)
    .replace("from 'three/addons/loaders/GLTFLoader.js'", `from '${loaderUrl}'`)
    .replace("from './config.js'", `from '${configUrl}'`);
const subject = await import(moduleUrl(subjectSrc));

const scene = new THREE.Scene();
await subject.loadSubject(scene);
assert.equal(subject.levelCount(), report.levels.length, 'the lab sees every rung');

/* What the meter puts on screen, per level. */
for (let level = 0; level < subject.levelCount(); level++) {
    subject.setValue('detail', level);
    const s = subject.stats();
    assert.equal(s.triangles, report.levels[level].triangles, `level ${level} triangles`);
    assert.equal(s.vertices, report.levels[level].vertices, `level ${level} vertices`);
    assert.ok(s.splitCorners > 0, `level ${level} has seam corners to show`);
    assert.ok(s.splitCorners < s.vertices, `level ${level} is not all seam`);
}

/* The headline number of step 4: 9,942 corners for 7,736 distinct positions. */
subject.setValue('detail', 0);
assert.equal(subject.stats().splitCorners, report.sourceVertices - report.weldedPositions,
    'the split-corner count is the source vertex count minus its distinct positions');

/* The crowd has to swap EVERY figure, not just the first. */
subject.setValue('crowd', true);
for (const level of [0, 3, 5]) {
    subject.setValue('detail', level);
    const crowd = scene.getObjectByName('Crowd');
    const drawn = crowd.children.map(c => c.userData.mesh.geometry.index.count / 3);
    assert.equal(drawn.length, config.CROWD.count, 'the crowd is the configured size');
    assert.ok(drawn.every(t => t === report.levels[level].triangles),
        `every figure is at level ${level}`);
    assert.equal(subject.stats().sceneTriangles,
        report.levels[level].triangles * config.CROWD.count, 'the scene total is per figure');
}

/* ── the challenge has exactly one answer ── */
const fits = report.levels.filter(l => l.triangles * config.CROWD.count <= config.BUDGET);
const passes = report.levels.filter(l =>
    l.triangles * config.CROWD.count <= config.BUDGET && l.level <= config.ANSWER);
assert.equal(passes.length, 1, 'exactly one level satisfies the gate');
assert.equal(passes[0].level, config.ANSWER, 'and it is the configured answer');
assert.equal(fits[0].level, config.ANSWER,
    'the answer is the most detailed level that fits, so there is nothing better to find');
assert.ok(fits.length > 1,
    'cheaper levels also fit — without them the step is arithmetic, not judgement');

/* ── the beat map holds together ── */
assert.equal(Object.keys(config.COPY).length, config.TOTAL_BEATS, 'every beat has copy');
assert.equal(Object.keys(config.CONTROLS).length, config.TOTAL_BEATS, 'every beat declares controls');
assert.equal(Object.keys(config.PROGRESS).length, config.TOTAL_BEATS, 'every beat has a progress mark');
assert.equal(new Set(Object.values(config.BEAT)).size, config.TOTAL_BEATS, 'beat indices are distinct');
const numbered = Object.values(config.COPY).filter(c => typeof c.step === 'number');
assert.equal(numbered.length, config.NUMBERED_STEPS, 'the numbered steps match NUMBERED_STEPS');
assert.deepEqual(numbered.map(c => c.step), [1, 2, 3, 4, 5], 'and they run 1..n in order');

const dock = fs.readFileSync(path.join(lab, 'index.html'), 'utf8');
for (const group of new Set(Object.values(config.CONTROLS).flat())) {
    assert.ok(dock.includes(`data-group="${group}"`), `the dock has a "${group}" control`);
}

console.log(JSON.stringify({
    levels: report.levels.map(l => l.triangles),
    lod0IsSourceGeometry: true,
    texturesPreserved: srcImages.length,
    crowd: config.CROWD.count,
    budget: config.BUDGET,
    answer: config.ANSWER,
    levelsThatFit: fits.map(l => l.level),
    ok: true,
}, null, 2));
