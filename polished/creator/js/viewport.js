import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createStage, V3 } from '../../kit/js/stage.js';
import { createTransformGizmos } from '../../kit/js/transformGizmos.js';
import { nearestSurfaceOffset } from './snapping.js';
import { MATERIAL_MODEL_URL, cloneMaterialModel, applyModelMaterial } from './materialModel.js';
import { triangulateMesh } from './mesh.js';
import { ASSEMBLY_MODEL_SCALE } from './assemblyData.js';

const AXIS_COLORS = { x: 0xc0453a, y: 0x2e8b2e, z: 0x3a6fa8 };
const AXES = { x: V3(1, 0, 0), y: V3(0, 1, 0), z: V3(0, 0, 1) };
const HOME = { pos: V3(5.8, 4.1, 8.2), look: V3(0, 0.9, 0) };
const GIZMOBOT_URL = new URL('../../../assets/models/gizmobot.glb', import.meta.url);
const ASSEMBLY_URL = new URL('../../labs/robot-assembly/assets/gizmobot-assembly.glb', import.meta.url);
const MIN_SCALE = 0.02;

function geometryFor(entity) {
    const mesh = entity.components.mesh;
    if (mesh) {
        const { indices, faceIndices } = triangulateMesh(mesh);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.vertices.flat(), 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        geometry.userData.faceIndices = [...faceIndices];
        geometry.userData.creatorMesh = true;
        return geometry;
    }
    const g = entity.components.geometry || {};
    switch (entity.type) {
    case 'cube': return new THREE.BoxGeometry(g.width ?? 1, g.height ?? 1, g.depth ?? 1);
    case 'sphere': return new THREE.SphereGeometry(g.radius ?? .5, 32, 20);
    case 'cylinder': return new THREE.CylinderGeometry(g.radius ?? .5, g.radius ?? .5, g.height ?? 1, 32);
    case 'cone': return new THREE.ConeGeometry(g.radius ?? .5, g.height ?? 1, 32);
    case 'plane': return new THREE.PlaneGeometry(g.width ?? 1, g.height ?? 1);
    default: return null;
    }
}

function materialFor(entity) {
    const m = entity.components.material || {};
    return new THREE.MeshStandardMaterial({
        color: m.color ?? '#ff9022', roughness: m.roughness ?? .55,
        emissive: m.color ?? '#ff9022', emissiveIntensity: m.emissiveIntensity ?? 0,
        metalness: m.metalness ?? .05, side: entity.type === 'plane' ? THREE.DoubleSide : THREE.FrontSide,
        flatShading: Boolean(entity.components.mesh),
    });
}

function disposeTree(root) {
    root.traverse(node => {
        node.geometry?.dispose?.();
        if (Array.isArray(node.material)) node.material.forEach(m => m.dispose?.());
        else node.material?.dispose?.();
    });
}

function disposeOutline(root) {
    root.traverse(node => {
        if (Array.isArray(node.material)) node.material.forEach(material => material.dispose?.());
        else node.material?.dispose?.();
    });
    root.clear();
}

function entityList(project) {
    return Array.isArray(project.entities) ? project.entities : [...(project.entities || [])];
}

/** Build the Three.js view of a Creation Studio project. Project records remain authoritative. */
export function createViewport({ project, tools, canvasId = 'cv', wrapId = 'canvas-wrap', onStatus = () => {}, modelProfile = 'default' } = {}) {
    if (!project || !tools) throw new Error('createViewport requires project and tools');
    const canvas = document.getElementById(canvasId);
    const wrap = document.getElementById(wrapId);
    if (!canvas || !wrap) throw new Error(`Viewport elements #${canvasId} and #${wrapId} are required`);

    const materialProfile = modelProfile === 'materials';
    const assemblyProfile = modelProfile === 'assembly';
    const home = materialProfile ? { pos: V3(0, 2.6, 6.8), look: V3(0, 1.1, 0) }
        : assemblyProfile ? { pos: V3(4.6, 3.3, -7.8), look: V3(.6, .65, .35) } : HOME;
    const stage = createStage({ canvasId, wrapId, rig: materialProfile ? 'studio' : 'viewport', ground: !materialProfile, capture: materialProfile, position: home.pos.toArray(), target: home.look.toArray() });
    const inheritedResize = stage.resize;
    // The lesson stage deliberately keeps its subject within a small teaching
    // area. Creation Studio projects are unbounded, so retain the shared scene, renderer
    // and lighting while replacing only those lesson-constrained controls.
    stage.orbitCtrl.dispose();
    stage.orbitCtrl = new OrbitControls(stage.camera, canvas);
    stage.orbitCtrl.enableDamping = true;
    stage.orbitCtrl.dampingFactor = .08;
    stage.orbitCtrl.enablePan = true;
    stage.orbitCtrl.minDistance = .2;
    stage.orbitCtrl.maxDistance = 1000;
    stage.camera.far = 10000;
    stage.camera.updateProjectionMatrix();
    stage.orbitCtrl.target.copy(home.look);
    stage.orbitCtrl.update();
    stage.tickCam = () => stage.orbitCtrl.update();
    stage.flyTo = preset => {
        const damping = stage.orbitCtrl.enableDamping;
        stage.orbitCtrl.enableDamping = false;
        stage.orbitCtrl.update(); // consume any gesture delta before the preset
        stage.camera.position.copy(preset.pos);
        stage.orbitCtrl.target.copy(preset.look);
        stage.orbitCtrl.update();
        stage.orbitCtrl.enableDamping = damping;
    };
    const gizmos = createTransformGizmos({ scene: stage.scene, axisColors: AXIS_COLORS });
    const objects = new Map();
    const signatures = new Map();
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const outline = new THREE.Group();
    outline.name = 'CreatorSelectionOutline';
    outline.visible = false;
    stage.scene.add(outline);

    let disposed = false;
    let raf = 0;
    let hoveredHandle = null;
    let candidate = null;
    let drag = null;
    let activeObject = null;
    let activeEntity = null;
    let gizmobotSource = null;
    let assemblySource = null;
    const assemblyParts = new Map();
    let selectionOutlineEnabled = true;
    let previewTransforms = null;
    let interactionEnabled = true;
    let transformEditor = (id, patch) => project.updateTransform(id, patch);
    let view = 'perspective';
    let displayMode = 'solid';

    const isObjectMode = () => (tools.getEditingMode?.() ?? 'object') === 'object';
    const canInteract = () => interactionEnabled && isObjectMode();
    const snapSettings = () => tools.getSnapSettings?.() || {
        enabled: Boolean(tools.getSnapping?.()), mode: 'increment', moveStep: .25, rotateStep: 15, scaleStep: .1, surfaceDistance: .5,
    };
    const incrementSnap = (value, step) => {
        const settings = snapSettings();
        return settings.enabled && settings.mode === 'increment' ? Math.round(value / step) * step : value;
    };
    const incrementSnapFrom = (value, origin, step) => {
        const settings = snapSettings();
        return settings.enabled && settings.mode === 'increment' ? origin + Math.round((value - origin) / step) * step : value;
    };

    function surfaceSnap(destination, axisIndex) {
        const settings = snapSettings();
        if (!settings.enabled || settings.mode !== 'surface' || !activeObject || !activeEntity) return destination;
        activeObject.updateWorldMatrix(true, true);
        const movingBox = new THREE.Box3().setFromObject(activeObject);
        if (movingBox.isEmpty()) return destination;
        const delta = destination.getComponent(axisIndex) - activeObject.getWorldPosition(V3()).getComponent(axisIndex);
        movingBox.min.setComponent(axisIndex, movingBox.min.getComponent(axisIndex) + delta);
        movingBox.max.setComponent(axisIndex, movingBox.max.getComponent(axisIndex) + delta);
        const descendants = new Set();
        const collect = id => project.children(id).forEach(child => { descendants.add(child.id); collect(child.id); });
        collect(activeEntity.id);
        const ancestors = new Set();
        for (let parent = activeEntity.parentId; parent; parent = project.get(parent)?.parentId) ancestors.add(parent);
        const targets = [];
        for (const entity of project.entities) {
            if (entity.id === activeEntity.id || entity.id === 'creation' || descendants.has(entity.id) || ancestors.has(entity.id) || !effectivelyVisible(entity)) continue;
            const object = objects.get(entity.id);
            if (!object) continue;
            object.updateWorldMatrix(true, true);
            const target = new THREE.Box3().setFromObject(object);
            if (target.isEmpty()) continue;
            targets.push({ min: target.min.toArray(), max: target.max.toArray() });
        }
        const offset = nearestSurfaceOffset({ min: movingBox.min.toArray(), max: movingBox.max.toArray() }, targets, axisIndex, settings.surfaceDistance);
        if (offset !== null) destination.setComponent(axisIndex, destination.getComponent(axisIndex) + offset);
        return destination;
    }

    function applyDisplayMode(root) {
        root.traverse(node => {
            if (!node.isMesh) return;
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            for (const material of materials) {
                if (!material || !('wireframe' in material)) continue;
                if (material.userData.creatorSolidWireframe == null) material.userData.creatorSolidWireframe = material.wireframe;
                material.wireframe = displayMode === 'wireframe' || material.userData.creatorSolidWireframe;
                material.needsUpdate = true;
            }
        });
    }

    function effectivelyVisible(entity) {
        for (let current = entity; current; current = current.parentId ? project.get(current.parentId) : null) {
            if (current.visible === false) return false;
        }
        return true;
    }

    function cloneGizmobot(material) {
        if (!gizmobotSource) return null;
        if (materialProfile) return cloneMaterialModel(gizmobotSource, material);
        const clone = gizmobotSource.clone(true);
        // Each derived entity owns its render resources, which keeps deletion,
        // undo and duplication independent and makes disposal unambiguous.
        clone.traverse(node => {
            if (!node.isMesh) return;
            node.geometry = node.geometry.clone();
            node.material = Array.isArray(node.material)
                ? node.material.map(material => material.clone()) : node.material.clone();
            node.castShadow = true; node.receiveShadow = true;
        });
        return clone;
    }

    function cloneAssemblyPart(nodeName) {
        const source = assemblyParts.get(nodeName);
        if (!source) return null;
        const clone = source.clone(true);
        clone.position.set(0, 0, 0); clone.rotation.set(0, 0, 0);
        // Cloning a joint detaches it from the GLB root. Restore the root's
        // normalized authored proportions inside the editable part transform.
        clone.scale.fromArray(ASSEMBLY_MODEL_SCALE);
        clone.traverse(node => {
            if (!node.isMesh) return;
            node.geometry = node.geometry.clone();
            node.material = Array.isArray(node.material)
                ? node.material.map(material => material.clone()) : node.material.clone();
            node.castShadow = true; node.receiveShadow = true;
        });
        return clone;
    }

    const headExpressionMaps = new Map();
    const headOriginalMaps = new WeakMap();

    function frownMap(source) {
        if (!source) return source;
        if (headExpressionMaps.has(source)) return headExpressionMaps.get(source);
        const canvas = document.createElement('canvas');
        canvas.width = source.image.width;
        canvas.height = source.image.height;
        const context = canvas.getContext('2d');
        context.drawImage(source.image, 0, 0);
        // The authored face is sideways in the atlas. Reflect just the mouth
        // horizontally there to turn the on-model smile into a frown.
        const x = Math.round(canvas.width * .2075);
        const y = Math.round(canvas.height * .3475);
        const width = Math.round(canvas.width * .0225);
        const height = Math.round(canvas.height * .0535);
        context.save();
        context.translate(2 * x + width, 0);
        context.scale(-1, 1);
        context.drawImage(source.image, x, y, width, height, x, y, width, height);
        context.restore();
        // Preserve the GLB's UV transform, orientation, filtering and color space.
        const texture = source.clone();
        texture.source = new THREE.Source(canvas);
        texture.needsUpdate = true;
        headExpressionMaps.set(source, texture);
        return texture;
    }

    function setAssemblyHeadExpression(expression = 'smile') {
        if (!assemblyProfile) return false;
        const head = objects.get('part-head');
        if (!head) return false;
        head.traverse(node => {
            if (!node.isMesh) return;
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            for (const material of materials) {
                if (!headOriginalMaps.has(material)) {
                    headOriginalMaps.set(material, { map: material.map, emissiveMap: material.emissiveMap });
                }
                const original = headOriginalMaps.get(material);
                for (const key of ['map', 'emissiveMap']) {
                    material[key] = expression === 'frown' ? frownMap(original[key]) : original[key];
                }
                material.needsUpdate = true;
            }
        });
        head.userData.assemblyHeadExpression = expression === 'frown' ? 'frown' : 'smile';
        return true;
    }

    function setNdc(e) {
        const r = canvas.getBoundingClientRect();
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        return ndc;
    }

    function signature(entity) {
        return JSON.stringify([entity.type, entity.components.geometry || null, entity.components.mesh || null, entity.components.material || null, entity.components.assemblyPart || null]);
    }

    function makeObject(entity) {
        let object;
        if (!entity.components.mesh && (entity.type === 'group' || entity.type === 'gizmobot' || entity.type === 'assemblyPart')) object = new THREE.Group();
        else {
            object = new THREE.Mesh(geometryFor(entity), materialFor(entity));
            object.castShadow = object.receiveShadow = true;
        }
        object.name = entity.name;
        object.userData.creatorEntityId = entity.id;
        if (entity.type === 'gizmobot') {
            const model = cloneGizmobot(entity.components.material);
            if (model) object.add(model);
        }
        if (entity.type === 'assemblyPart') {
            const model = cloneAssemblyPart(entity.components.assemblyPart?.node);
            if (model) object.add(model);
        }
        applyDisplayMode(object);
        objects.set(entity.id, object);
        signatures.set(entity.id, signature(entity));
        stage.scene.add(object);
        return object;
    }

    function applyRecord(object, entity) {
        const t = previewTransforms?.get(entity.id) || entity.components.transform;
        object.name = entity.name;
        object.visible = entity.visible !== false;
        object.position.fromArray(t.position);
        object.rotation.set(...t.rotation, 'XYZ');
        object.scale.fromArray(t.scale);
        if (materialProfile && entity.type === 'gizmobot') applyModelMaterial(object, entity.components.material);
    }

    function replaceRenderable(entity, old) {
        const parent = old.parent;
        const children = [...old.children];
        old.remove(...children);
        parent?.remove(old);
        old.geometry?.dispose?.();
        if (Array.isArray(old.material)) old.material.forEach(material => material.dispose?.());
        else old.material?.dispose?.();
        objects.delete(entity.id);
        const next = makeObject(entity);
        children.forEach(child => next.add(child));
        return next;
    }

    function reconcile() {
        if (disposed) return;
        const entities = entityList(project);
        const current = new Set(entities.map(e => e.id));
        for (const [id, object] of objects) {
            if (current.has(id)) continue;
            // Surviving entity children may already have been reparented in
            // project state (ungroup/delete/undo). Preserve their resources.
            [...object.children].filter(child => child.userData.creatorEntityId && current.has(child.userData.creatorEntityId))
                .forEach(child => object.remove(child));
            object.parent?.remove(object);
            disposeTree(object);
            objects.delete(id); signatures.delete(id);
        }
        for (const entity of entities) {
            let object = objects.get(entity.id) || makeObject(entity);
            if (signatures.get(entity.id) !== signature(entity) && entity.type !== 'gizmobot') {
                object = replaceRenderable(entity, object);
                signatures.set(entity.id, signature(entity));
            }
        }
        // Parent only after every object exists: restored JSON does not need to
        // be sorted with parents before children.
        for (const entity of entities) {
            const object = objects.get(entity.id);
            const parent = entity.parentId ? objects.get(entity.parentId) : stage.scene;
            if (parent && object.parent !== parent) parent.add(object);
            applyRecord(object, entity);
        }
        stage.scene.updateMatrixWorld(true);
        syncSelection();
    }

    function syncSelection() {
        const id = project.selection.activeId;
        activeEntity = id ? project.get(id) : null;
        activeObject = id ? objects.get(id) : null;
        const usable = activeObject && effectivelyVisible(activeEntity) && canInteract();
        outline.visible = Boolean(usable && selectionOutlineEnabled);
        disposeOutline(outline);
        if (usable && selectionOutlineEnabled) {
            activeObject.updateWorldMatrix(true, false);
            const shell = activeObject.clone(true);
            shell.matrix.copy(activeObject.matrixWorld);
            shell.matrix.decompose(shell.position, shell.quaternion, shell.scale);
            shell.scale.multiplyScalar(1.025);
            shell.traverse(node => {
                if (!node.isMesh) return;
                node.material = new THREE.MeshBasicMaterial({ color: 0xff9022, side: THREE.BackSide, wireframe: displayMode === 'wireframe',
                    depthTest: true, depthWrite: false, transparent: true, opacity: .9 });
                node.castShadow = false;
                node.receiveShadow = false;
                node.renderOrder = -1;
                node.frustumCulled = false;
            });
            outline.add(shell);
        }
        const tool = tools.getActive();
        gizmos.showFor(tool, Boolean(usable && !activeEntity.locked));
        if (usable && !activeEntity.locked) gizmos.updateForObject(activeObject, stage.camera);
    }

    function updateOutlineMatrix() {
        const shell = outline.children[0];
        if (!shell || !activeObject) return;
        activeObject.updateWorldMatrix(true, false);
        activeObject.matrixWorld.decompose(shell.position, shell.quaternion, shell.scale);
        shell.scale.multiplyScalar(1.025);
        shell.updateMatrixWorld(true);
    }

    function applyDisplayedTransforms() {
        for (const entity of entityList(project)) {
            const object = objects.get(entity.id);
            if (object) applyRecord(object, entity);
        }
        stage.scene.updateMatrixWorld(true);
        updateOutlineMatrix();
        if (activeObject && canInteract()) gizmos.updateForObject(activeObject, stage.camera);
    }

    async function loadSceneAssets() {
        try {
            if (assemblyProfile) {
                const gltf = await new GLTFLoader().loadAsync(ASSEMBLY_URL.href);
                if (disposed) { disposeTree(gltf.scene); return; }
                assemblySource = gltf.scene;
                for (const entity of entityList(project).filter(item => item.type === 'assemblyPart')) {
                    const source = assemblySource.getObjectByName(entity.components.assemblyPart.node);
                    if (!source) throw new Error(`Missing assembly part: ${entity.name}`);
                    assemblyParts.set(entity.components.assemblyPart.node, source);
                    const host = objects.get(entity.id);
                    if (host && !host.children.length) host.add(cloneAssemblyPart(entity.components.assemblyPart.node));
                }
                for (const object of objects.values()) applyDisplayMode(object);
                stage.scene.updateMatrixWorld(true); syncSelection();
                return;
            }
            const gltf = await new GLTFLoader().loadAsync((materialProfile ? MATERIAL_MODEL_URL : GIZMOBOT_URL).href);
            if (disposed) { disposeTree(gltf.scene); return; }
            gizmobotSource = gltf.scene;
            for (const entity of entityList(project).filter(item => item.type === 'gizmobot')) {
                const host = objects.get(entity.id);
                if (host && !host.children.length) host.add(cloneGizmobot(entity.components.material));
            }
            for (const object of objects.values()) applyDisplayMode(object);
            stage.scene.updateMatrixWorld(true);
            syncSelection();
        } catch (error) {
            onStatus(assemblyProfile ? 'Gizmobot pieces could not be loaded. Please reload to try again.' : 'Gizmobot could not be loaded. Please reload to try again.');
            console.error('Creation Studio model load failed', error);
            throw error;
        }
    }

    function pickedEntity(e) {
        raycaster.setFromCamera(setNdc(e), stage.camera);
        const roots = entityList(project).filter(entity => !entity.parentId && effectivelyVisible(entity))
            .map(entity => objects.get(entity.id)).filter(Boolean);
        for (const hit of raycaster.intersectObjects(roots, true)) {
            let sceneVisible = true;
            for (let node = hit.object; node && node !== stage.scene; node = node.parent) {
                if (node.visible === false) { sceneVisible = false; break; }
            }
            if (!sceneVisible) continue;
            for (let node = hit.object; node; node = node.parent) {
                const id = node.userData.creatorEntityId;
                if (id && effectivelyVisible(project.get(id))) return id;
            }
        }
        return null;
    }

    function hitHandle(e) {
        raycaster.setFromCamera(setNdc(e), stage.camera);
        for (const item of gizmos.pickables()) {
            if (raycaster.intersectObject(item.mesh, false).length) return item.handle;
        }
        return null;
    }

    function screenPoint(world) {
        const p = world.clone().project(stage.camera), r = canvas.getBoundingClientRect();
        return { x: r.left + (p.x + 1) * r.width / 2, y: r.top + (1 - p.y) * r.height / 2 };
    }

    function axisScreen(center, axis) {
        const a = screenPoint(center), b = screenPoint(center.clone().add(axis));
        const x = b.x - a.x, y = b.y - a.y, length = Math.hypot(x, y) || 1;
        return { ppu: length, x: x / length, y: y / length };
    }

    function beginDrag(e, handle) {
        if (!activeObject || activeEntity?.locked || !canInteract()) return;
        e.preventDefault(); e.stopPropagation();
        project.beginTransaction(`${handle._kind === 'rotate' ? 'Rotate' : handle._kind.startsWith('scale') ? 'Scale' : 'Move'} ${activeEntity.name}`);
        activeObject.updateWorldMatrix(true, false);
        const center = gizmos.centre.clone();
        const worldPos = activeObject.getWorldPosition(V3());
        const worldQuat = activeObject.getWorldQuaternion(new THREE.Quaternion());
        const axis = handle._axKey ? AXES[handle._axKey].clone() : null;
        if (handle._kind === 'scaleAxis' && axis) axis.applyQuaternion(worldQuat);
        const info = axis ? axisScreen(center, axis) : { ppu: 1, x: 1, y: 0 };
        const c = screenPoint(center);
        const rotateAxis = handle._kind === 'rotate' ? AXES[handle._axKey].clone() : null;
        const rotatePlane = rotateAxis ? new THREE.Plane().setFromNormalAndCoplanarPoint(rotateAxis, center) : null;
        raycaster.setFromCamera(setNdc(e), stage.camera);
        const rotateStart = rotatePlane ? raycaster.ray.intersectPlane(rotatePlane, V3()) : null;
        drag = {
            pointerId: e.pointerId, handle, kind: handle._kind, axis: handle._axKey,
            startX: e.clientX, startY: e.clientY, startPosition: activeObject.position.clone(),
            startRotation: activeObject.rotation.toArray().slice(0, 3), startScale: activeObject.scale.clone(),
            worldPos, worldQuat, center: c, ppu: info.ppu, dirX: info.x, dirY: info.y,
            distance: Math.max(Math.hypot(e.clientX - c.x, e.clientY - c.y), 12),
            angle: Math.atan2(e.clientY - c.y, e.clientX - c.x), moved: false,
            rotateAxis, rotatePlane,
            rotateStart: rotateStart?.sub(center).normalize() || null,
        };
        canvas.setPointerCapture?.(e.pointerId);
        stage.orbitCtrl.enabled = false;
        gizmos.highlight(handle);
        canvas.style.cursor = 'grabbing';
    }

    function updateDrag(e) {
        if (!drag || e.pointerId !== drag.pointerId) return false;
        const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
        drag.moved ||= Math.hypot(dx, dy) > 2;
        const amount = (dx * drag.dirX + dy * drag.dirY) / drag.ppu;
        if (drag.kind === 'move') {
            const destination = drag.worldPos.clone().addScaledVector(AXES[drag.axis], amount);
            const axisIndex = 'xyz'.indexOf(drag.axis);
            // Assembly moves start from the part's current position, preserving
            // authored offsets while using the configured increment size.
            const settings = snapSettings();
            const snapped = assemblyProfile
                ? incrementSnapFrom(destination.getComponent(axisIndex), drag.worldPos.getComponent(axisIndex), settings.moveStep)
                : incrementSnap(destination.getComponent(axisIndex), settings.moveStep);
            destination.setComponent(axisIndex, snapped);
            surfaceSnap(destination, axisIndex);
            const local = activeObject.parent ? activeObject.parent.worldToLocal(destination) : destination;
            transformEditor(activeEntity.id, { position: local.toArray() });
        } else if (drag.kind === 'scaleAxis') {
            const scale = drag.startScale.toArray();
            const index = 'xyz'.indexOf(drag.axis);
            scale[index] = Math.max(MIN_SCALE, incrementSnap(scale[index] + amount, snapSettings().scaleStep));
            transformEditor(activeEntity.id, { scale });
        } else if (drag.kind === 'scaleUniform') {
            const factor = Math.max(MIN_SCALE / Math.min(...drag.startScale.toArray()), Math.hypot(e.clientX - drag.center.x, e.clientY - drag.center.y) / drag.distance);
            const scale = drag.startScale.clone().multiplyScalar(factor).toArray()
                .map(value => Math.max(MIN_SCALE, incrementSnap(value, snapSettings().scaleStep)));
            transformEditor(activeEntity.id, { scale });
        } else if (drag.kind === 'rotate') {
            raycaster.setFromCamera(setNdc(e), stage.camera);
            const point = drag.rotatePlane && raycaster.ray.intersectPlane(drag.rotatePlane, V3());
            let angle;
            if (point && drag.rotateStart && point.sub(gizmos.centre).lengthSq() > 1e-8) {
                const current = point.normalize();
                angle = Math.atan2(drag.rotateAxis.dot(drag.rotateStart.clone().cross(current)), drag.rotateStart.dot(current));
            } else {
                const now = Math.atan2(e.clientY - drag.center.y, e.clientX - drag.center.x);
                angle = now - drag.angle;
            }
            angle = incrementSnap(angle, THREE.MathUtils.degToRad(snapSettings().rotateStep));
            const worldDelta = new THREE.Quaternion().setFromAxisAngle(drag.rotateAxis, angle);
            const desiredWorld = worldDelta.multiply(drag.worldQuat);
            const parentWorld = activeObject.parent?.getWorldQuaternion(new THREE.Quaternion()) || new THREE.Quaternion();
            const local = parentWorld.invert().multiply(desiredWorld);
            const rotation = new THREE.Euler().setFromQuaternion(local, 'XYZ');
            transformEditor(activeEntity.id, { rotation: rotation.toArray().slice(0, 3) });
        }
        onStatus(`${drag.kind === 'rotate' ? 'Rotating' : drag.kind.startsWith('scale') ? 'Scaling' : 'Moving'} ${activeEntity.name}`);
        return true;
    }

    function finishDrag(cancel = false) {
        if (!drag) return;
        const ended = drag;
        drag = null;
        try { canvas.releasePointerCapture?.(ended.pointerId); } catch { /* capture may already be lost */ }
        gizmos.restoreColor(ended.handle);
        if (cancel || !ended.moved) project.cancelTransaction(); else project.commitTransaction();
        stage.orbitCtrl.enabled = true;
        canvas.style.cursor = '';
        onStatus(cancel ? 'Transform cancelled' : 'Transform applied');
    }

    function onPointerDown(e) {
        if (e.button !== 0 || !canInteract()) return;
        const handle = activeObject && hitHandle(e);
        if (handle) { beginDrag(e, handle); return; }
        candidate = { id: e.pointerId, x: e.clientX, y: e.clientY };
    }
    function onPointerMove(e) {
        if (updateDrag(e)) return;
        if (candidate && e.pointerId === candidate.id && Math.hypot(e.clientX - candidate.x, e.clientY - candidate.y) > 4) candidate = null;
        if (!activeObject) return;
        const handle = hitHandle(e);
        if (handle !== hoveredHandle) { gizmos.restoreColor(hoveredHandle); hoveredHandle = handle; }
        if (handle) gizmos.highlight(handle);
        canvas.style.cursor = handle ? 'grab' : '';
    }
    function onPointerUp(e) {
        if (drag) { if (e.pointerId === drag.pointerId) finishDrag(false); return; }
        if (!candidate || e.pointerId !== candidate.id) return;
        if (!canInteract()) { candidate = null; return; }
        if (!tools.isAllowed?.('select') && tools.isAllowed) { candidate = null; return; }
        const id = pickedEntity(e);
        if (e.shiftKey && id) {
            const selected = project.selection.ids || [];
            if (selected.includes(id)) project.selection.set(selected.filter(item => item !== id));
            else project.selection.add(id);
        } else if (id) project.selection.set(id);
        else project.selection.clear();
        candidate = null;
    }
    function onPointerCancel(e) {
        if (drag && e.pointerId === drag.pointerId) finishDrag(true);
        if (candidate?.id === e.pointerId) candidate = null;
    }
    function onLostPointerCapture(e) {
        if (drag && e.pointerId === drag.pointerId) finishDrag(true);
    }
    function onWindowBlur() { if (drag) finishDrag(true); candidate = null; }
    function onKeyDown(e) {
        if (e.key === 'Escape' && drag) { e.preventDefault(); finishDrag(true); }
    }

    function resetView() {
        setView('perspective');
        onStatus('View reset');
    }

    function installCamera(camera) {
        const oldControls = stage.orbitCtrl;
        oldControls.dispose();
        stage.camera = camera;
        stage.orbitCtrl = new OrbitControls(camera, canvas);
        stage.orbitCtrl.enableDamping = true;
        stage.orbitCtrl.dampingFactor = .08;
        stage.orbitCtrl.enablePan = true;
        stage.orbitCtrl.enableRotate = Boolean(camera.isPerspectiveCamera);
        stage.orbitCtrl.minDistance = .2;
        stage.orbitCtrl.maxDistance = 1000;
        stage.orbitCtrl.target.copy(oldControls.target);
        stage.orbitCtrl.update();
    }

    function setView(name) {
        const next = String(name || '').toLowerCase();
        if (!['perspective', 'front', 'right', 'top'].includes(next)) throw new Error(`Unknown viewport view: ${name}`);
        const target = stage.orbitCtrl.target.clone();
        const distance = Math.max(stage.camera.position.distanceTo(target), 1);
        const aspect = Math.max(wrap.clientWidth / Math.max(wrap.clientHeight, 1), .01);
        if (next === 'perspective') {
            const camera = new THREE.PerspectiveCamera(44, aspect, .01, 10000);
            camera.position.copy(home.pos);
            target.copy(home.look);
            installCamera(camera);
            stage.orbitCtrl.target.copy(target);
            stage.orbitCtrl.update();
        } else {
            const halfHeight = distance * Math.tan(THREE.MathUtils.degToRad(44 / 2));
            const camera = new THREE.OrthographicCamera(-halfHeight * aspect, halfHeight * aspect, halfHeight, -halfHeight, .01, 10000);
            const direction = next === 'front' ? V3(0, 0, 1) : next === 'right' ? V3(1, 0, 0) : V3(0, 1, 0);
            camera.position.copy(target).addScaledVector(direction, distance);
            camera.up.set(next === 'top' ? 0 : 0, next === 'top' ? 0 : 1, next === 'top' ? -1 : 0);
            installCamera(camera);
        }
        view = next;
        syncSelection();
        return view;
    }

    function resizeViewport() {
        const width = wrap.clientWidth, height = Math.max(wrap.clientHeight, 1), aspect = width / height;
        if (stage.camera.isPerspectiveCamera) stage.camera.aspect = aspect;
        else if (stage.camera.isOrthographicCamera) {
            const halfHeight = (stage.camera.top - stage.camera.bottom) / 2;
            stage.camera.left = -halfHeight * aspect;
            stage.camera.right = halfHeight * aspect;
        }
        stage.camera.updateProjectionMatrix();
        stage.renderer.setSize(width, height);
    }
    stage.resize = resizeViewport;
    window.addEventListener('resize', resizeViewport);

    function focusSelected() {
        if (!activeObject) { onStatus('Select an object to focus it'); return; }
        const box = new THREE.Box3().setFromObject(activeObject);
        if (box.isEmpty()) return;
        const center = box.getCenter(V3()), size = Math.max(box.getSize(V3()).length(), .8);
        const direction = stage.camera.position.clone().sub(stage.orbitCtrl.target).normalize();
        if (stage.camera.isOrthographicCamera) {
            const radius = Math.max(box.getBoundingSphere(new THREE.Sphere()).radius, .25) * 1.25;
            const aspect = Math.max(wrap.clientWidth / Math.max(wrap.clientHeight, 1), .01);
            const halfHeight = Math.max(radius, radius / aspect);
            stage.camera.left = -halfHeight * aspect;
            stage.camera.right = halfHeight * aspect;
            stage.camera.top = halfHeight;
            stage.camera.bottom = -halfHeight;
            stage.camera.updateProjectionMatrix();
        }
        stage.flyTo({ pos: center.clone().addScaledVector(direction, Math.max(3, size * 1.6)), look: center, duration: .55 }, matchMedia('(prefers-reduced-motion: reduce)').matches);
        onStatus(`Focused ${activeEntity.name}`);
    }

    canvas.addEventListener('pointerdown', onPointerDown, true);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('lostpointercapture', onLostPointerCapture);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onWindowBlur);
    const resizeObserver = new ResizeObserver(resizeViewport);
    resizeObserver.observe(wrap);
    const unsubscribeProject = project.subscribe(reconcile);
    const unsubscribeTools = tools.subscribe(syncSelection);

    reconcile();
    const ready = loadSceneAssets();
    function frame() {
        if (disposed) return;
        raf = requestAnimationFrame(frame);
        stage.tickCam(Math.min(stage.clock.getDelta(), .05));
        if (activeObject) {
            gizmos.updateForObject(activeObject, stage.camera);
            updateOutlineMatrix();
        }
        stage.renderer.render(stage.scene, stage.camera);
    }
    frame();

    function dispose() {
        if (disposed) return;
        disposed = true;
        finishDrag(true);
        cancelAnimationFrame(raf);
        unsubscribeProject?.(); unsubscribeTools?.();
        resizeObserver.disconnect();
        window.removeEventListener('resize', inheritedResize);
        window.removeEventListener('resize', resizeViewport);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('blur', onWindowBlur);
        canvas.removeEventListener('pointerdown', onPointerDown, true);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointercancel', onPointerCancel);
        canvas.removeEventListener('lostpointercapture', onLostPointerCapture);
        stage.orbitCtrl.dispose();
        for (const [id, object] of objects) {
            const entity = project.get(id);
            if (!entity?.parentId) disposeTree(object);
        }
        if (gizmobotSource) disposeTree(gizmobotSource);
        if (assemblySource) disposeTree(assemblySource);
        gizmos.layer.removeFromParent(); disposeOutline(outline); outline.removeFromParent();
        for (const texture of headExpressionMaps.values()) texture.dispose();
        headExpressionMaps.clear();
        stage.renderer.dispose();
        objects.clear(); signatures.clear();
    }

    return { resetView, focusSelected, dispose, ready, getObject: id => objects.get(id) || null, cloneModel: cloneGizmobot, cloneAssemblyPart, refreshSelection: syncSelection,
        setAssemblyHeadExpression,
        setSelectionOutline(enabled) { selectionOutlineEnabled = Boolean(enabled); syncSelection(); },
        getSelectionOutline: () => selectionOutlineEnabled,
        setView,
        getView: () => view,
        setGridVisible(visible) {
            stage.scene.traverse(node => { if (node.isGridHelper || node.type === 'GridHelper') node.visible = Boolean(visible); });
        },
        setDisplayMode(mode) {
            if (!['solid', 'wireframe'].includes(mode)) throw new Error(`Unknown display mode: ${mode}`);
            displayMode = mode;
            for (const object of objects.values()) applyDisplayMode(object);
            syncSelection();
        },
        getDisplayMode: () => displayMode,
        setPreviewTransforms(transforms) {
            previewTransforms = transforms == null ? null : new Map(transforms);
            applyDisplayedTransforms();
        },
        getDisplayedTransform(id) {
            const entity = project.get(id);
            if (!entity) return null;
            const transform = previewTransforms?.get(id) || entity?.components.transform;
            return transform ? structuredClone(transform) : null;
        },
        setInteractionEnabled(enabled) {
            interactionEnabled = Boolean(enabled);
            if (!interactionEnabled) { candidate = null; finishDrag(true); }
            syncSelection();
        },
        setTransformEditor(editor) { transformEditor = editor || ((id, patch) => project.updateTransform(id, patch)); },
        modelProfile, stage };
}
