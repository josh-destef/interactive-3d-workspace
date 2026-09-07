/* ═══════════════════════════════════════════════
   SUBJECT
   Gizmobot at six densities, and the only place this lesson's state lives.

   The GLB holds one node with six mesh children, LOD0 through LOD5, sharing a
   single material and a single set of textures. LOD0 is the untouched source
   mesh; the rungs below it were baked by scripts/build-topology-gizmobot.py.
   Switching detail level is therefore a geometry swap, not a load - which is
   what lets the slider be a slider rather than a menu.

   Every mutation goes through `setValue` / `applyValues`, so the demo, the
   student's controls and a reset cannot disagree about what is on screen.
═══════════════════════════════════════════════ */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MODEL_URL, CROWD } from './config.js';

export const values = {
    detail: 0,
    structure: 'surface',   // surface | edges | points
    shading: 'smooth',      // smooth | flat
    seams: 'hide',          // hide | show
    crowd: false,
};

const START = { ...values };

const rungs = [];        // one entry per LOD, filled on load
let material = null;
let hero = null;         // the single figure, with the overlays parented to it
let heroMesh = null;
let crowd = null;        // the twelve, built once and hidden until step 5
let base = null;         // the GLB node's own transform, reused by every copy

/* ── measuring a rung ──
   Cheap, and needed by the meter on every level the slider passes through, so
   it is kept apart from the overlay meshes below. A position stored more than
   once is a corner the surface was cut at - for the texture, or for a hard
   edge - and counting those is the whole of step 4. */
function analyze(rung) {
    if (rung.seamPositions) return rung;
    const pos = rung.geometry.attributes.position;
    const seen = new Map();
    for (let i = 0; i < pos.count; i++) {
        const key = `${pos.getX(i)},${pos.getY(i)},${pos.getZ(i)}`;
        seen.set(key, (seen.get(key) || 0) + 1);
    }
    const doubled = [];
    for (let i = 0; i < pos.count; i++) {
        const key = `${pos.getX(i)},${pos.getY(i)},${pos.getZ(i)}`;
        if (seen.get(key) > 1) doubled.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    }
    rung.uniquePositions = seen.size;
    rung.splitCorners = pos.count - seen.size;
    rung.seamPositions = doubled;
    return rung;
}

/* ── overlays ──
   Wireframe, corner points and seam points are built the first time a level
   asks to be seen through, and then kept. Building all six up front costs a
   visible pause on load; building them on every slider move costs a stutter on
   every drag. */
function overlaysFor(rung) {
    if (rung.overlays) return rung.overlays;
    analyze(rung);

    const wire = new THREE.LineSegments(
        new THREE.WireframeGeometry(rung.geometry),
        new THREE.LineBasicMaterial({ color: 0x172033, transparent: true, opacity: 0.5 }),
    );

    const points = new THREE.Points(
        rung.geometry,
        new THREE.PointsMaterial({ color: 0x1a1a2e, size: 0.035, sizeAttenuation: true }),
    );

    const seamGeo = new THREE.BufferGeometry();
    seamGeo.setAttribute('position', new THREE.Float32BufferAttribute(rung.seamPositions, 3));
    const seams = new THREE.Points(
        seamGeo,
        /* drawn over the surface rather than through it: a seam you can only
           find by orbiting to the far side is a seam nobody finds */
        new THREE.PointsMaterial({ color: 0x3a6fa8, size: 0.05, sizeAttenuation: true, depthTest: false }),
    );
    seams.renderOrder = 5;

    rung.overlays = { wire, points, seams };
    [wire, points, seams].forEach(o => { o.visible = false; heroMesh.add(o); });
    return rung.overlays;
}

export function loadSubject(scene) {
    return new Promise((resolve, reject) => {
        new GLTFLoader().load(MODEL_URL, gltf => {
            base = gltf.scene.getObjectByName('Gizmobot');

            for (let i = 0; ; i++) {
                const node = gltf.scene.getObjectByName(`LOD${i}`);
                if (!node) break;
                const mesh = node.isMesh ? node : node.children.find(c => c.isMesh);
                if (!material) material = mesh.material.clone();
                rungs.push({
                    geometry: mesh.geometry,
                    triangles: mesh.geometry.index.count / 3,
                    vertices: mesh.geometry.attributes.position.count,
                });
            }
            if (!rungs.length) { reject(new Error('no LOD meshes in ' + MODEL_URL)); return; }

            /* One mesh, whose geometry is swapped, rather than six meshes with
               five of them hidden: the overlays hang off this one node, so they
               never have to be re-parented when the level changes. */
            heroMesh = new THREE.Mesh(rungs[0].geometry, material);
            heroMesh.castShadow = true;
            heroMesh.receiveShadow = true;
            hero = wrap(heroMesh);
            hero.name = 'Gizmobot';
            scene.add(hero);

            crowd = new THREE.Group();
            crowd.name = 'Crowd';
            crowd.visible = false;
            for (let i = 0; i < CROWD.count; i++) {
                const mesh = new THREE.Mesh(rungs[0].geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                const copy = wrap(mesh);
                const col = i % CROWD.cols;
                const row = Math.floor(i / CROWD.cols);
                copy.position.x = (col - (CROWD.cols - 1) / 2) * CROWD.gapX;
                copy.position.z = (row - 1) * CROWD.gapZ;
                /* A deterministic scatter of angles, so twelve identical models
                   read as a crowd rather than as a printing error. */
                copy.rotation.y = ((i * 37) % 61 - 30) * Math.PI / 180;
                crowd.add(copy);
            }
            scene.add(crowd);

            applyValues();
            resolve(hero);
        }, undefined, reject);
    });
}

/* The GLB's own node carries a non-uniform scale and a z offset. Every copy
   gets its own wrapper with that same transform, so the figures stand where
   the asset says they stand and the crowd's placement is layered on top. */
function wrap(mesh) {
    const holder = new THREE.Group();
    const inner = new THREE.Group();
    inner.position.copy(base.position);
    inner.quaternion.copy(base.quaternion);
    inner.scale.copy(base.scale);
    inner.add(mesh);
    holder.add(inner);
    holder.userData.mesh = mesh;
    return holder;
}

export function setValue(key, value) {
    values[key] = value;
    applyValues();
}

export function applyValues() {
    if (!heroMesh) return;
    const rung = rungs[values.detail];

    heroMesh.geometry = rung.geometry;
    crowd.children.forEach(copy => { copy.userData.mesh.geometry = rung.geometry; });

    material.flatShading = values.shading === 'flat';
    material.needsUpdate = true;

    /* Only the level on screen needs its overlays; the rest stay unbuilt until
       the slider reaches them. */
    const needed = values.structure !== 'surface' || values.seams === 'show';
    rungs.forEach(r => r.overlays && Object.values(r.overlays)
        .forEach(o => { o.visible = false; }));
    if (needed) {
        const { wire, points, seams } = overlaysFor(rung);
        wire.visible = values.structure === 'edges';
        points.visible = values.structure === 'points';
        seams.visible = values.seams === 'show';
    }

    hero.visible = !values.crowd;
    crowd.visible = values.crowd;
}

export function reset() {
    Object.assign(values, START);
    applyValues();
}

/* What the meter reads. Counts come off the geometry being drawn rather than
   out of config, so the numbers on screen cannot drift from the asset. */
export function stats() {
    const rung = analyze(rungs[values.detail]);
    const copies = values.crowd ? CROWD.count : 1;
    return {
        triangles: rung.triangles,
        vertices: rung.vertices,
        splitCorners: rung.splitCorners,
        copies,
        sceneTriangles: rung.triangles * copies,
    };
}

export const levelCount = () => rungs.length;
export const getHero = () => hero;
