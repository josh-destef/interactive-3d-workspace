import * as THREE from 'three';

// Carry a visual copy: the original named rig nodes remain available to the
// shared cannon helper, with the shoulder, upper arm and elbow untouched.
export function createAttachmentInteraction({canvas, camera, orbit, scene, getState, onRemove = () => {}, onAttach = () => {}, onHint = () => {}, onNear = () => {}}) {
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    const ownerDocument = canvas.ownerDocument, ownerWindow = ownerDocument?.defaultView;
    let drag = null, looseArm = null, disposed = false;
    const screen = point => {
        const p = point.clone().project(camera), r = canvas.getBoundingClientRect();
        return new THREE.Vector2(r.left + (p.x + 1) * r.width / 2, r.top + (1 - p.y) * r.height / 2);
    };
    function ray(event) {
        const r = canvas.getBoundingClientRect();
        if (!r.width || !r.height) return false;
        pointer.set((event.clientX - r.left) / r.width * 2 - 1, -(event.clientY - r.top) / r.height * 2 + 1);
        camera.updateMatrixWorld(); scene.updateMatrixWorld(true); raycaster.setFromCamera(pointer, camera);
        return true;
    }
    function pick(event, state) {
        if (!ray(event)) return null;
        const candidates = state.removed ? [state.preview] : [state.shell, state.hand];
        return raycaster.intersectObjects(candidates.filter(Boolean), true).find(hit => {
            for (let node = hit.object; node; node = node.parent) if (!node.visible) return false;
            return true;
        });
    }
    function makeLooseArm(state) {
        const group = new THREE.Group();
        group.name = 'DetachedForearmAndHand';
        group.position.copy(scene.worldToLocal(state.elbow.getWorldPosition(new THREE.Vector3())));
        scene.add(group); group.updateMatrixWorld();
        for (const source of [state.shell, state.hand]) {
            const copy = source.clone(true);
            const matrix = new THREE.Matrix4().copy(group.matrixWorld).invert().multiply(source.matrixWorld);
            matrix.decompose(copy.position, copy.quaternion, copy.scale);
            copy.visible = true; group.add(copy);
        }
        return group;
    }
    function down(event) {
        const state = getState();
        if (disposed || !state.enabled || event.button !== 0 || drag || !state.elbow) return;
        if (!state.removed && (!state.shell || !state.hand)) return;
        const hit = pick(event, state); if (!hit) return;
        event.preventDefault(); event.stopImmediatePropagation();
        const object = state.removed ? state.preview : makeLooseArm(state);
        const world = object.getWorldPosition(new THREE.Vector3());
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), hit.point);
        drag = {id: event.pointerId, kind: state.removed ? 'cannon' : 'arm', object, origin: object.position.clone(), world, plane, anchor: hit.point.clone(), start: new THREE.Vector2(event.clientX, event.clientY), state, orbitEnabled: orbit.enabled, shellVisible: state.shell?.visible, handVisible: state.hand?.visible};
        if (drag.kind === 'arm') {state.shell.visible = false; state.hand.visible = false;}
        orbit.enabled = false;
        try {canvas.setPointerCapture?.(event.pointerId);} catch { /* Pointer may already have been cancelled by the browser. */ }
        canvas.style.cursor = 'grabbing';
        onHint(drag.kind === 'arm' ? 'Pull the forearm and hand away from the elbow.' : 'Bring the cannon’s connection end to the highlighted elbow.');
    }
    function near() {
        const elbow = drag.state.elbow.getWorldPosition(new THREE.Vector3());
        // The canonical cannon asset root is its elbow connection, not its muzzle.
        const mount = drag.object.getWorldPosition(new THREE.Vector3());
        return mount.distanceTo(elbow) <= .8 || screen(mount).distanceTo(screen(elbow)) <= 60;
    }
    function move(event) {
        if (disposed) return;
        const state = getState();
        if (!drag) {canvas.style.cursor = state.enabled && pick(event, state) ? 'grab' : ''; return;}
        if (event.pointerId !== drag.id) return;
        if (!state.enabled) {cancel(); return;}
        event.preventDefault(); if (!ray(event)) return;
        const point = raycaster.ray.intersectPlane(drag.plane, new THREE.Vector3()); if (!point) return;
        const world = drag.world.clone().add(point.sub(drag.anchor));
        drag.object.position.copy(drag.object.parent ? drag.object.parent.worldToLocal(world) : world);
        drag.object.updateMatrixWorld(true);
        if (drag.kind === 'cannon') {
            const close = near(); onNear(close);
            onHint(close ? 'Release to snap the cannon onto the elbow.' : 'Move the cannon’s connection end toward the elbow.');
        }
    }
    function release() {
        if (!drag) return;
        const d = drag;
        // releasePointerCapture can synchronously dispatch lostpointercapture.
        // Clear first so that event cannot roll back an already accepted drop.
        drag = null;
        orbit.enabled = d.orbitEnabled; canvas.style.cursor = ''; onNear(false);
        try {if (canvas.hasPointerCapture?.(d.id)) canvas.releasePointerCapture(d.id);} catch { /* Capture may already be lost. */ }
    }
    function restore(d) {
        if (d.kind === 'arm') {
            d.object.removeFromParent(); d.state.shell.visible = d.shellVisible; d.state.hand.visible = d.handVisible;
        } else {d.object.position.copy(d.origin); d.object.updateMatrixWorld(true);}
    }
    function up(event) {
        if (!drag || event.pointerId !== drag.id) return;
        move(event); if (!drag) return;
        const d = drag;
        if (d.kind === 'arm') {
            if (d.start.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) >= 45) {
                looseArm?.removeFromParent(); looseArm = d.object; release(); onRemove();
            } else {restore(d); release(); onHint('Grab the forearm or hand and drag it farther away to remove it.');}
        } else if (near()) {release(); onAttach();}
        else {restore(d); release(); onHint('Not quite at the elbow. Try again; the cannon will snap when it is close.');}
    }
    function cancel() {if (!drag) return; const d = drag; restore(d); release();}
    const pointerCancel = event => {if (drag && event.pointerId === drag.id) cancel();};
    const escape = event => {if (event.key === 'Escape') cancel();};
    const blur = () => cancel();
    canvas.addEventListener('pointerdown', down, {capture: true});
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', pointerCancel);
    canvas.addEventListener('lostpointercapture', pointerCancel);
    ownerDocument?.addEventListener('keydown', escape);
    ownerWindow?.addEventListener('blur', blur);
    const reset = () => {cancel(); looseArm?.removeFromParent(); looseArm = null; canvas.style.cursor = '';};
    return {
        cancel, reset,
        setVisible(visible) {if (looseArm) looseArm.visible = visible;},
        dispose() {
            reset(); disposed = true;
            canvas.removeEventListener('pointerdown', down, {capture: true});
            canvas.removeEventListener('pointermove', move);
            canvas.removeEventListener('pointerup', up);
            canvas.removeEventListener('pointercancel', pointerCancel);
            canvas.removeEventListener('lostpointercapture', pointerCancel);
            ownerDocument?.removeEventListener('keydown', escape);
            ownerWindow?.removeEventListener('blur', blur);
        },
    };
}
