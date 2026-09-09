import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createStage, V3 } from '../../kit/js/stage.js';
import { createTransformGizmos } from '../../kit/js/transformGizmos.js';

const AXIS_COLORS = { x: 0xc0453a, y: 0x2e8b2e, z: 0x3a6fa8 };
const AXES = { x: V3(1, 0, 0), y: V3(0, 1, 0), z: V3(0, 0, 1) };
const HOME = { pos: V3(5.8, 4.1, 8.2), look: V3(0, 0.9, 0) };
const GIZMOBOT_URL = new URL('../../../assets/models/gizmobot.glb', import.meta.url);
const MIN_SCALE = 0.02;

function geometryFor(entity) {
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
        metalness: m.metalness ?? .05, side: entity.type === 'plane' ? THREE.DoubleSide : THREE.FrontSide,
    });
}

function disposeTree(root) {
    root.traverse(node => {
        node.geometry?.dispose?.();
        if (Array.isArray(node.material)) node.material.forEach(m => m.dispose?.());
        else node.material?.dispose?.();
    });
}

function entityList(project) {
    return Array.isArray(project.entities) ? project.entities : [...(project.entities || [])];
}

/** Build the Three.js view of a Creator project. Project records remain authoritative. */
export function createViewport({ project, tools, canvasId = 'cv', wrapId = 'canvas-wrap', onStatus = () => {} } = {}) {
    if (!project || !tools) throw new Error('createViewport requires project and tools');
    const canvas = document.getElementById(canvasId);
    const wrap = document.getElementById(wrapId);
    if (!canvas || !wrap) throw new Error(`Viewport elements #${canvasId} and #${wrapId} are required`);

    const stage = createStage({ canvasId, wrapId, rig: 'viewport', ground: true, position: HOME.pos.toArray(), target: HOME.look.toArray() });
    // The lesson stage deliberately keeps its subject within a small teaching
    // area. Creator projects are unbounded, so retain the shared scene, renderer
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
    stage.orbitCtrl.target.copy(HOME.look);
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
    const outline = new THREE.BoxHelper(new THREE.Object3D(), 0xff9022);
    outline.name = 'CreatorSelectionOutline';
    outline.material.depthTest = false;
    outline.material.transparent = true;
    outline.material.opacity = .9;
    outline.renderOrder = 990;
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

    function effectivelyVisible(entity) {
        for (let current = entity; current; current = current.parentId ? project.get(current.parentId) : null) {
            if (current.visible === false) return false;
        }
        return true;
    }

    function cloneGizmobot() {
        if (!gizmobotSource) return null;
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

    function setNdc(e) {
        const r = canvas.getBoundingClientRect();
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        return ndc;
    }

    function signature(entity) {
        return JSON.stringify([entity.type, entity.components.geometry || null, entity.components.material || null]);
    }

    function makeObject(entity) {
        let object;
        if (entity.type === 'group' || entity.type === 'gizmobot') object = new THREE.Group();
        else {
            object = new THREE.Mesh(geometryFor(entity), materialFor(entity));
            object.castShadow = object.receiveShadow = true;
        }
        object.name = entity.name;
        object.userData.creatorEntityId = entity.id;
        if (entity.type === 'gizmobot') {
            const model = cloneGizmobot();
            if (model) object.add(model);
        }
        objects.set(entity.id, object);
        signatures.set(entity.id, signature(entity));
        stage.scene.add(object);
        return object;
    }

    function applyRecord(object, entity) {
        const t = entity.components.transform;
        object.name = entity.name;
        object.visible = entity.visible !== false;
        object.position.fromArray(t.position);
        object.rotation.set(...t.rotation, 'XYZ');
        object.scale.fromArray(t.scale);
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
        const usable = activeObject && effectivelyVisible(activeEntity);
        outline.visible = Boolean(usable);
        if (usable) outline.setFromObject(activeObject);
        const tool = tools.getActive();
        gizmos.showFor(tool, Boolean(usable && !activeEntity.locked));
        if (usable && !activeEntity.locked) gizmos.updateForObject(activeObject, stage.camera);
    }

    async function loadGizmobot() {
        try {
            const gltf = await new GLTFLoader().loadAsync(GIZMOBOT_URL.href);
            if (disposed) { disposeTree(gltf.scene); return; }
            gizmobotSource = gltf.scene;
            for (const entity of entityList(project).filter(item => item.type === 'gizmobot')) {
                const host = objects.get(entity.id);
                if (host && !host.children.length) host.add(cloneGizmobot());
            }
            stage.scene.updateMatrixWorld(true);
            syncSelection();
        } catch (error) {
            onStatus('Gizmobot could not be loaded. Please reload to try again.');
            console.error('Creator Gizmobot load failed', error);
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
        if (!activeObject || activeEntity?.locked) return;
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
            const local = activeObject.parent ? activeObject.parent.worldToLocal(destination) : destination;
            project.updateTransform(activeEntity.id, { position: local.toArray() });
        } else if (drag.kind === 'scaleAxis') {
            const scale = drag.startScale.toArray();
            const index = 'xyz'.indexOf(drag.axis);
            scale[index] = Math.max(MIN_SCALE, scale[index] + amount);
            project.updateTransform(activeEntity.id, { scale });
        } else if (drag.kind === 'scaleUniform') {
            const factor = Math.max(MIN_SCALE / Math.min(...drag.startScale.toArray()), Math.hypot(e.clientX - drag.center.x, e.clientY - drag.center.y) / drag.distance);
            project.updateTransform(activeEntity.id, { scale: drag.startScale.clone().multiplyScalar(factor).toArray() });
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
            const worldDelta = new THREE.Quaternion().setFromAxisAngle(drag.rotateAxis, angle);
            const desiredWorld = worldDelta.multiply(drag.worldQuat);
            const parentWorld = activeObject.parent?.getWorldQuaternion(new THREE.Quaternion()) || new THREE.Quaternion();
            const local = parentWorld.invert().multiply(desiredWorld);
            const rotation = new THREE.Euler().setFromQuaternion(local, 'XYZ');
            project.updateTransform(activeEntity.id, { rotation: rotation.toArray().slice(0, 3) });
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
        if (e.button !== 0) return;
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
        stage.flyTo({ pos: HOME.pos, look: HOME.look, duration: .65 }, matchMedia('(prefers-reduced-motion: reduce)').matches);
        onStatus('View reset');
    }

    function focusSelected() {
        if (!activeObject) { onStatus('Select an object to focus it'); return; }
        const box = new THREE.Box3().setFromObject(activeObject);
        if (box.isEmpty()) return;
        const center = box.getCenter(V3()), size = Math.max(box.getSize(V3()).length(), .8);
        const direction = stage.camera.position.clone().sub(stage.orbitCtrl.target).normalize();
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
    const resizeObserver = new ResizeObserver(stage.resize);
    resizeObserver.observe(wrap);
    const unsubscribeProject = project.subscribe(reconcile);
    const unsubscribeTools = tools.subscribe(syncSelection);

    reconcile();
    const ready = loadGizmobot();
    function frame() {
        if (disposed) return;
        raf = requestAnimationFrame(frame);
        stage.tickCam(Math.min(stage.clock.getDelta(), .05));
        if (activeObject) {
            gizmos.updateForObject(activeObject, stage.camera);
            outline.setFromObject(activeObject);
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
        window.removeEventListener('resize', stage.resize);
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
        gizmos.layer.removeFromParent(); outline.removeFromParent();
        outline.geometry.dispose(); outline.material.dispose();
        stage.renderer.dispose();
        objects.clear(); signatures.clear();
    }

    return { resetView, focusSelected, dispose, ready, getObject: id => objects.get(id) || null, stage };
}
