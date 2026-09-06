import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const workspace = process.cwd();
const sourcePath = path.join(workspace, 'polished', 'labs', 'navigate-and-transform', 'assets', 'gizmobot.glb');
const assetPath = path.join(workspace, 'polished', 'labs', 'material-lab', 'assets', 'gizmobot-material-lab.glb');
const reportPath = path.join(workspace, 'polished', 'labs', 'material-lab', 'assets', 'gizmobot-material-lab.report.json');
const subjectPath = path.join(workspace, 'polished', 'labs', 'material-lab', 'js', 'subject.js');
const beatsPath = path.join(workspace, 'polished', 'labs', 'material-lab', 'js', 'beats.js');
const matchPath = path.join(workspace, 'polished', 'labs', 'material-lab', 'js', 'match.js');
const matchTargetPath = path.join(workspace, 'polished', 'labs', 'material-lab', 'js', 'matchTarget.js');
const controlsPath = path.join(workspace, 'polished', 'labs', 'material-lab', 'js', 'controls.js');
const configPath = path.join(workspace, 'polished', 'labs', 'material-lab', 'js', 'config.js');
const stagePath = path.join(workspace, 'polished', 'labs', 'material-lab', 'js', 'stage.js');
const mainPath = path.join(workspace, 'polished', 'labs', 'material-lab', 'js', 'main.js');
const labIndexPath = path.join(workspace, 'polished', 'labs', 'material-lab', 'index.html');

const expectedMaterials = [
    'Shell_Paint',
    'Dark_Parts',
    'Orange_Accents',
    'Green_Accents',
    'Face_Glow',
    'Logo_Decal',
];

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function sha256(buffer) {
    return createHash('sha256').update(buffer).digest('hex');
}

function parseGlb(buffer) {
    assert(buffer.toString('ascii', 0, 4) === 'glTF', 'Asset is not a GLB file');
    assert(buffer.readUInt32LE(4) === 2, 'Asset is not glTF 2.0');
    assert(buffer.readUInt32LE(8) === buffer.length, 'GLB header length is incorrect');

    let offset = 12;
    let json = null;
    while (offset < buffer.length) {
        const length = buffer.readUInt32LE(offset);
        const type = buffer.readUInt32LE(offset + 4);
        offset += 8;
        if (type === 0x4e4f534a) {
            json = JSON.parse(buffer.subarray(offset, offset + length).toString('utf8').trimEnd());
        }
        offset += length;
    }
    assert(json, 'GLB has no JSON chunk');
    return json;
}

const [source, asset, reportText, subject, beats, match, matchTargetSource, controls, config, stage, main, labIndex] = await Promise.all([
    readFile(sourcePath),
    readFile(assetPath),
    readFile(reportPath, 'utf8'),
    readFile(subjectPath, 'utf8'),
    readFile(beatsPath, 'utf8'),
    readFile(matchPath, 'utf8'),
    readFile(matchTargetPath, 'utf8'),
    readFile(controlsPath, 'utf8'),
    readFile(configPath, 'utf8'),
    readFile(stagePath, 'utf8'),
    readFile(mainPath, 'utf8'),
    readFile(labIndexPath, 'utf8'),
]);

const report = JSON.parse(reportText);
const gltf = parseGlb(asset);
const materials = new Map((gltf.materials ?? []).map((material, index) => [material.name, { ...material, index }]));

assert(sha256(source) === report.source_sha256, 'The original Gizmobot no longer matches the recorded source hash');
assert(sha256(asset) === report.output_sha256, 'The teaching GLB no longer matches its build report');
assert(expectedMaterials.length === materials.size, `Expected exactly ${expectedMaterials.length} materials, found ${materials.size}`);
for (const name of expectedMaterials) assert(materials.has(name), `Missing semantic material: ${name}`);

for (const name of ['Face_Glow', 'Logo_Decal']) {
    assert(materials.get(name).alphaMode === 'BLEND', `${name} must export as a transparent overlay`);
}
assert(materials.get('Face_Glow').emissiveTexture, 'Face_Glow has no emissive mask texture');
assert((materials.get('Face_Glow').emissiveFactor ?? []).some(value => value > 0), 'Face_Glow has no emissive factor');

const primitives = (gltf.meshes ?? []).flatMap(mesh => mesh.primitives ?? []);
const usedMaterialIndices = new Set(primitives.map(primitive => primitive.material));
for (const name of expectedMaterials) {
    assert(usedMaterialIndices.has(materials.get(name).index), `${name} is not assigned to any mesh primitive`);
}
for (const primitive of primitives) {
    assert(primitive.attributes?.POSITION !== undefined, 'A primitive is missing positions');
    assert(primitive.attributes?.NORMAL !== undefined, 'A primitive is missing normals');
    assert(primitive.attributes?.TEXCOORD_0 !== undefined, 'A primitive lost its UV mapping');
}

assert((gltf.images ?? []).length >= 4, 'Expected packed colour, face and logo images');
for (const image of gltf.images ?? []) {
    assert(image.bufferView !== undefined || image.uri, `Image ${image.name ?? '(unnamed)'} is missing its data`);
}

for (const node of gltf.nodes ?? []) {
    assert(!node.translation || node.translation.every(value => value === 0), `Node ${node.name} has an unexpected translation`);
    assert(!node.rotation || (node.rotation[0] === 0 && node.rotation[1] === 0 && node.rotation[2] === 0 && node.rotation[3] === 1), `Node ${node.name} has an unexpected rotation`);
    assert(!node.scale || node.scale.every(value => value === 1), `Node ${node.name} has an unexpected scale`);
}

assert((subject.match(/\.loadAsync\(/g) ?? []).length === 1, 'Material Lab must load the teaching GLB exactly once');
assert(!subject.includes('SphereGeometry'), 'Material Lab still constructs a teaching sphere');
assert(subject.includes("role === 'Shell_Paint'"), 'Shell_Paint is not independently assigned');
assert(subject.includes("role === 'Face_Glow'"), 'Face_Glow is not independently assigned');
assert(subject.includes('targetMaterial') && subject.includes('studentMaterial'), 'Challenge shells are not independent');
assert(!/new THREE\.(PointLight|SpotLight|DirectionalLight)\(/.test(subject), 'Face glow adds a light and may illuminate the room');
assert((beats.match(/\n\s{8}title:/g) ?? []).length === 10, 'Material Lab no longer has exactly 10 beats');

const labSource = [subject, beats, match, matchTargetSource, controls, config, stage, main, labIndex].join('\n');
const obsoleteExampleTerm = ['rec', 'ipe'].join('');
assert(!new RegExp(`\\b${obsoleteExampleTerm}s?\\b`, 'i').test(labSource), 'Material Lab still uses the old lesson term');
assert(match.includes('makeRandomTarget(state.matchTarget)'), 'Challenge does not generate each reference');
assert(!match.includes('MATERIAL_EXAMPLES'), 'Challenge still selects from the Material examples');
assert(stage.includes("lightOrb.name = 'Light_Orbit_Handle'"), 'Lighting step has no visible orbit handle');
assert(stage.includes('intersectPlane(orbDragPlane'), 'Light dragging is not constrained to its orbit plane');
assert(stage.includes('setKeyAzimuth(deg)') && stage.includes('onOrbChange(deg)'), 'Dragging the orb does not move and synchronize the key light');
assert(main.includes('onLightOrbChange(setLightFromOrb)'), 'Orb dragging is not connected to the lesson controls');
assert(beats.includes('moveDemoCursor(lightOrbScreenPoint())'), 'The lighting demonstration does not teach direct orb dragging');
assert(beats.includes('setLightOrbVisible(idx === BEAT.LIGHT || idx === BEAT.DONE)'), 'The orb is not limited to relevant lesson states');
for (const colour of ['candle', 'warm', 'neutral', 'daylight', 'cool']) {
    assert(labIndex.includes(`data-light-color="${colour}"`), `Missing ${colour} light colour choice`);
}
assert(!labIndex.includes('data-ctl="intensity"'), 'Lighting interaction exposes an intensity control');
assert(config.includes('LIGHT_RANGE = { min: -180, max: 180 }'), 'Light orbit does not cover the full fixed circle');
const directLights = stage.match(/new THREE\.(?:SpotLight|PointLight|DirectionalLight|HemisphereLight|AmbientLight)\(/g) ?? [];
assert(directLights.length === 1 && directLights[0].includes('PointLight'), 'The orb is not the scene\'s only direct point light');
assert(stage.includes('scene.add(key);') && !stage.includes('key.target'), 'The visible orb and actual point light are not the same source');
assert(stage.includes('renderer.toneMappingExposure = 0.92'), 'Studio exposure no longer matches the restrained lighting setup');
assert(stage.includes('material.envMapIntensity = 0.02 + 0.22 * t'), 'Environment reflection is not held below the direct light');

const targetModuleUrl = `data:text/javascript;base64,${Buffer.from(matchTargetSource).toString('base64')}`;
const { makeRandomTarget } = await import(targetModuleUrl);
let seed = 0x5eed1234;
const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 0x100000000;
};
const exampleTriples = new Set([
    '#c66f48/82/0', '#ff9022/30/0', '#22252b/95/0',
    '#ffdb93/18/100', '#fad1c2/30/100', '#c5c7c8/48/100',
]);
const generated = [];
for (let i = 0; i < 40; i++) generated.push(makeRandomTarget(generated.at(-1), random));
assert(new Set(generated.map(target => `${target.color}/${target.roughness}/${target.metalness}`)).size === generated.length, 'Random references repeated in a deterministic sample');
for (const target of generated) {
    assert(/^#[0-9a-f]{6}$/.test(target.color), `Invalid generated colour: ${target.color}`);
    assert(target.roughness >= 10 && target.roughness <= 90, 'Generated roughness is outside its teaching range');
    assert((target.metalness >= 0 && target.metalness <= 15) || (target.metalness >= 85 && target.metalness <= 100), 'Generated metalness is visually ambiguous');
    assert(!exampleTriples.has(`${target.color}/${target.roughness}/${target.metalness}`), 'A challenge reference came from the Material examples');
}

console.log('PASS Material Lab Gizmobot asset and integration');
console.log(`  source sha256: ${report.source_sha256}`);
console.log(`  output sha256: ${report.output_sha256}`);
console.log(`  materials: ${expectedMaterials.join(', ')}`);
console.log(`  primitives: ${primitives.length}; images: ${(gltf.images ?? []).length}; nodes: ${(gltf.nodes ?? []).length}`);
console.log(`  random challenge sample: ${generated.length} unique generated references`);
