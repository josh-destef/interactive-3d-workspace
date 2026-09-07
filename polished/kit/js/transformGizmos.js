/* Shared move, rotate and scale manipulators.
   Labs own selection and drag semantics; this module owns the visuals, hit
   targets, highlighting and object-relative placement so they stay identical. */
import * as THREE from 'three';

export const ARROW_HEAD_Y = 1.325;
export const SCALE_RING_RADIUS = 1.35;
const ROTATE_RING_RADIUS = .85;
const ROTATE_BOUND_MULTIPLIER = 1.12 / ROTATE_RING_RADIUS;
const SCALE_RING_COLOR = 0x5f6672;
const HIGHLIGHT_COLOR = 0xffff00;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function createTransformGizmos({ scene, axisColors, negativeAxes = false } = {}) {
    if (!scene) throw new Error('createTransformGizmos requires a scene');
    const colors = [axisColors.x, axisColors.y, axisColors.z];
    const layer = new THREE.Group();
    layer.name = 'TransformGizmos';
    scene.add(layer);

    // Manipulators are UI laid over the scene. They must not disappear into the
    // selected mesh, especially when its pivot is at the visual centre.
    const visibleMaterial = (color, options = {}) => new THREE.MeshBasicMaterial({
        color, depthTest: false, depthWrite: false, transparent: true, opacity: 1, ...options,
    });
    const hitMaterial = () => new THREE.MeshBasicMaterial({ visible: false });
    const mark = (group, { kind, axis = null, color, meshes }) => {
        group._kind = kind; group._axKey = axis; group._color = color;
        group._meshes = group._visMeshes = meshes; group.visible = false;
        return group;
    };

    function makeArrow(color, direction, opacity = 1) {
        const group = new THREE.Group();
        const material = visibleMaterial(color, { opacity });
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 1.2, 10), material);
        const head = new THREE.Mesh(new THREE.ConeGeometry(.1, .25, 10), material);
        const hit = new THREE.Mesh(new THREE.CylinderGeometry(.4, .4, 1.6, 8), hitMaterial());
        shaft.position.y = .6; head.position.y = ARROW_HEAD_Y; hit.position.y = .8; hit._isHit = true;
        shaft.renderOrder = head.renderOrder = 998;
        group.add(shaft, head, hit);
        group.quaternion.setFromUnitVectors(V3(0, 1, 0), direction);
        group._axis = direction.clone();
        const axis = Math.abs(direction.x) ? 'x' : Math.abs(direction.y) ? 'y' : 'z';
        layer.add(mark(group, { kind: 'move', axis, color, meshes: [shaft, head] }));
        return group;
    }

    function makeScaleAxis(color, direction) {
        const group = new THREE.Group();
        const material = visibleMaterial(color, { depthTest: false });
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .9, 10), material);
        const box = new THREE.Mesh(new THREE.BoxGeometry(.16, .16, .16), material);
        const hit = new THREE.Mesh(new THREE.BoxGeometry(.4, .4, .4), hitMaterial());
        shaft.position.y = .45; box.position.y = hit.position.y = 1;
        shaft.renderOrder = 998; box.renderOrder = 999;
        hit._isHit = hit._isScaleAxisHit = true;
        group.add(shaft, box, hit);
        group.quaternion.setFromUnitVectors(V3(0, 1, 0), direction);
        group._baseQuat = group.quaternion.clone();
        const axis = Math.abs(direction.x) ? 'x' : Math.abs(direction.y) ? 'y' : 'z';
        layer.add(mark(group, { kind: 'scaleAxis', axis, color, meshes: [shaft, box] }));
        return group;
    }

    const arrows = {
        xPos: makeArrow(axisColors.x, V3(1, 0, 0)),
        yPos: makeArrow(axisColors.y, V3(0, 1, 0)),
        zPos: makeArrow(axisColors.z, V3(0, 0, 1)),
    };
    if (negativeAxes) {
        arrows.xNeg = makeArrow(axisColors.x, V3(-1, 0, 0), .35);
        arrows.yNeg = makeArrow(axisColors.y, V3(0, -1, 0), .35);
        arrows.zNeg = makeArrow(axisColors.z, V3(0, 0, -1), .35);
    }
    const allArrows = Object.values(arrows);

    const scaleHandle = new THREE.Group();
    const scaleUniformMesh = new THREE.Mesh(
        new THREE.TorusGeometry(SCALE_RING_RADIUS, .025, 12, 100),
        visibleMaterial(SCALE_RING_COLOR, { depthTest: false, transparent: true, opacity: .95 }),
    );
    scaleUniformMesh.renderOrder = 998;
    const scaleHit = new THREE.Mesh(new THREE.TorusGeometry(SCALE_RING_RADIUS, .32, 8, 50), hitMaterial());
    scaleHit._isHit = true;
    scaleHandle.add(scaleUniformMesh, scaleHit);
    layer.add(mark(scaleHandle, { kind: 'scaleUniform', color: SCALE_RING_COLOR, meshes: [scaleUniformMesh] }));

    const allScaleAxis = [
        makeScaleAxis(axisColors.x, V3(1, 0, 0)),
        makeScaleAxis(axisColors.y, V3(0, 1, 0)),
        makeScaleAxis(axisColors.z, V3(0, 0, 1)),
    ];

    const rotateHandle = new THREE.Group();
    const rotateOrb = new THREE.Mesh(
        new THREE.SphereGeometry(ROTATE_RING_RADIUS * .97, 32, 24),
        visibleMaterial(0x8a8a8a, { transparent: true, opacity: .05 }),
    );
    rotateOrb.renderOrder = 996; rotateHandle.add(rotateOrb);
    const rotRings = ['x', 'y', 'z'].map((axis, index) => {
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(ROTATE_RING_RADIUS, .02, 16, 128),
            visibleMaterial(colors[index], { opacity: .9 }),
        );
        if (axis === 'x') ring.rotation.y = Math.PI / 2;
        if (axis === 'y') ring.rotation.x = Math.PI / 2;
        ring.renderOrder = 997;
        const hit = new THREE.Mesh(new THREE.TorusGeometry(ROTATE_RING_RADIUS, .18, 8, 40), hitMaterial());
        hit._isHit = true; hit._axis = axis; hit._visMesh = ring; hit._color = colors[index];
        ring.add(hit);
        mark(ring, { kind: 'rotate', axis, color: colors[index], meshes: [ring] });
        ring.visible = true; rotateHandle.add(ring);
        return ring;
    });
    rotateHandle.visible = false; layer.add(rotateHandle);

    const bounds = new THREE.Box3();
    const boundsSize = V3();
    const objectScale = V3(1, 1, 1);
    const objectQuat = new THREE.Quaternion();
    const centre = V3();
    function updateMove(center, factor) { allArrows.forEach(handle => { handle.position.copy(center); handle.scale.setScalar(factor); }); }
    function updateUniformScale(center, camera, factor) { scaleHandle.position.copy(center); scaleHandle.scale.setScalar(Math.max(factor, .3)); scaleHandle.quaternion.copy(camera.quaternion); }
    function updateScaleAxes(center, quaternion, baseRadius, scale) {
        allScaleAxis.forEach(handle => {
            handle.position.copy(center);
            handle.quaternion.multiplyQuaternions(quaternion, handle._baseQuat);
            handle.scale.setScalar(Math.max(baseRadius * scale[handle._axKey] * 1.15, .25));
        });
    }
    function updateRotate(center, factor) {
        rotateHandle.position.copy(center);
        // The torus has a local radius below 1, so compensate for it: the
        // visible rings should sit just outside the selected object's bounds.
        rotateHandle.scale.setScalar(factor * ROTATE_BOUND_MULTIPLIER);
    }
    function updateForObject(object, camera) {
        if (!object) return null;
        bounds.setFromObject(object);
        if (bounds.isEmpty()) return null;
        bounds.getCenter(centre); bounds.getSize(boundsSize);
        object.getWorldScale(objectScale); object.getWorldQuaternion(objectQuat);
        const controlRadius = Math.max(Math.max(boundsSize.x, boundsSize.y, boundsSize.z) * .5, .25);
        const baseRadius = controlRadius / Math.max(objectScale.x, objectScale.y, objectScale.z, .0001);
        updateMove(centre, controlRadius);
        updateUniformScale(centre, camera, controlRadius);
        updateScaleAxes(centre, objectQuat, baseRadius, objectScale);
        updateRotate(centre, controlRadius);
        return { centre, controlRadius, baseRadius };
    }

    function hideAll() {
        allArrows.forEach(handle => { handle.visible = false; });
        allScaleAxis.forEach(handle => { handle.visible = false; });
        scaleHandle.visible = rotateHandle.visible = false;
    }
    function showFor(tool, hasTarget = true) {
        hideAll(); if (!hasTarget) return;
        if (tool === 'move') allArrows.forEach(handle => { handle.visible = true; });
        if (tool === 'scale') { scaleHandle.visible = true; allScaleAxis.forEach(handle => { handle.visible = true; }); }
        if (tool === 'rotate') rotateHandle.visible = true;
    }
    function restoreColor(handle) { handle?._meshes?.forEach(mesh => mesh.material.color.setHex(handle._color)); }
    function highlight(handle, color = HIGHLIGHT_COLOR) { handle?._meshes?.forEach(mesh => mesh.material.color.setHex(color)); }
    function pickables() {
        const result = [];
        const add = handle => { if (handle.visible) handle.traverse(node => { if (node._isHit) result.push({ mesh: node, handle }); }); };
        allScaleAxis.forEach(add); allArrows.forEach(add); add(scaleHandle);
        if (rotateHandle.visible) rotRings.forEach(add);
        return result;
    }

    hideAll();
    return {
        layer, arrows, allArrows, scaleHandle, scaleUniformMesh, allScaleAxis,
        rotateHandle, rotRings, centre, updateMove, updateUniformScale,
        updateScaleAxes, updateRotate, updateForObject, showFor, hideAll,
        restoreColor, highlight, pickables,
    };
}
