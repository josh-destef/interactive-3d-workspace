// Real Three.js raycasting against a minimal rig; DOM events are intentionally
// small fakes, including synchronous lostpointercapture on release.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const threeURL = pathToFileURL(path.join(os.tmpdir(), 'fundamentals-3d-qa/node_modules/three/build/three.module.js')).href;
const THREE = await import(threeURL);
const modulePath = path.resolve(import.meta.dirname, '../polished/labs/particle-cannon/js/attachmentInteraction.js');
const source = fs.readFileSync(modulePath, 'utf8').replace("from 'three'", `from '${threeURL}'`);
const {createAttachmentInteraction} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
class Events {
    listeners = new Map();
    addEventListener(type, fn) {if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn);}
    removeEventListener(type, fn) {this.listeners.get(type)?.delete(fn);}
    send(type, args = {}) {
        const event = {pointerId: 1, button: 0, clientX: 0, clientY: 500, preventDefault() {this.prevented = true;}, stopImmediatePropagation() {this.stopped = true;}, ...args};
        for (const fn of this.listeners.get(type) || []) fn(event);
        return event;
    }
}
function fixture({orbitEnabled = true, zoom = 1} = {}) {
    const canvas = new Events(), doc = new Events(), win = new Events();
    canvas.ownerDocument = doc; doc.defaultView = win; canvas.style = {};
    canvas.getBoundingClientRect = () => ({left: 0, top: 0, width: 1000, height: 1000});
    const captures = new Set();
    canvas.setPointerCapture = id => captures.add(id);
    canvas.hasPointerCapture = id => captures.has(id);
    canvas.releasePointerCapture = id => {captures.delete(id); canvas.send('lostpointercapture', {pointerId: id});};
    const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-5, 5, 5, -5, .1, 100);
    camera.position.set(0, 0, 10); camera.lookAt(0, 0, 0); camera.zoom = zoom; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    const rig = new THREE.Group(); scene.add(rig);
    const mesh = (name, x) => {const object = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, .5), new THREE.MeshBasicMaterial()); object.name = name; object.position.x = x; return object;};
    const shoulder = mesh('Shoulder', -2), upper = mesh('UpperArm', -1), elbow = mesh('Elbow', 0), shell = mesh('Forearm', 1), hand = mesh('Hand', 1.8);
    rig.add(shoulder, upper, elbow, shell, hand);
    const preview = new THREE.Group(); preview.position.x = 3; preview.add(mesh('CannonBody', .8)); scene.add(preview);
    const state = {enabled: true, removed: false, preview, shell, hand, elbow};
    const orbit = {enabled: orbitEnabled}, calls = {remove: 0, attach: 0, hints: [], near: []};
    const interaction = createAttachmentInteraction({canvas, camera, orbit, scene, getState: () => state,
        onRemove() {calls.remove++; state.removed = true;}, onAttach() {calls.attach++;}, onHint(hint) {calls.hints.push(hint);}, onNear(near) {calls.near.push(near);}});
    const px = x => 500 + x * 100 * zoom;
    const pointer = (type, x, options) => canvas.send(type, {clientX: px(x), ...options});
    return {canvas, doc, win, scene, camera, rig, shoulder, upper, elbow, shell, hand, preview, state, orbit, calls, interaction, pointer};
}
let f = fixture();
f.pointer('pointerdown', -4); assert.equal(f.orbit.enabled, true, 'empty stage remains available to orbit');
assert.equal(f.canvas.hasPointerCapture(1), false);
let event = f.pointer('pointerdown', 1);
assert.ok(event.prevented && event.stopped, 'picked drag suppresses orbit pointerdown');
assert.equal(f.orbit.enabled, false); assert.equal(f.shell.visible, false); assert.equal(f.hand.visible, false);
const carried = f.scene.getObjectByName('DetachedForearmAndHand');
assert.ok(carried && carried.children.length === 2);
assert.equal(f.shell.parent, f.rig); assert.equal(f.hand.parent, f.rig, 'original named nodes remain in rig');
f.pointer('pointermove', 2);
assert.ok(carried.position.x > .9);
f.pointer('pointerup', 2);
assert.equal(f.calls.remove, 1); assert.equal(f.orbit.enabled, true);
assert.equal(f.shell.visible, false, 'synchronous lost capture cannot undo successful removal');
assert.equal(carried.parent, f.scene, 'visual assembly stays carried away');
for (const part of [f.shoulder, f.upper, f.elbow]) {assert.equal(part.visible, true); assert.equal(part.parent, f.rig);}
assert.equal(f.elbow.position.x, 0, 'elbow transform is preserved');
f.interaction.setVisible(false); assert.equal(carried.visible, false);
f.interaction.setVisible(true); assert.equal(carried.visible, true);

// Reject a cannon release away from the elbow and restore its starting pose.
f.pointer('pointerdown', 3.8); f.pointer('pointermove', 3.3); f.pointer('pointerup', 3.3);
assert.equal(f.calls.attach, 0); assert.equal(f.preview.position.x, 3); assert.equal(f.orbit.enabled, true);
// The cannon body is offset from the root. Snap uses the root connection,
// even though the dragged hit ends .8 world units to the right of the elbow.
f.pointer('pointerdown', 3.8); f.pointer('pointermove', .8);
assert.ok(f.calls.near.includes(true), 'near feedback is emitted before dropping');
f.pointer('pointerup', .8);
assert.equal(f.calls.attach, 1); assert.ok(Math.abs(f.preview.position.x) < 1e-8, 'lost capture does not restore accepted drop');
assert.equal(f.calls.near.at(-1), false);
f.interaction.reset(); assert.equal(carried.parent, null); f.interaction.dispose();

// Small arm movement is a recoverable rejected removal.
f = fixture(); f.pointer('pointerdown', 1); f.pointer('pointerup', 1.2);
assert.equal(f.calls.remove, 0); assert.equal(f.shell.visible, true); assert.equal(f.hand.visible, true);
assert.equal(f.scene.getObjectByName('DetachedForearmAndHand'), undefined);
assert.equal(f.orbit.enabled, true); f.interaction.dispose();

for (const cancellation of ['pointercancel', 'lostpointercapture', 'Escape', 'blur', 'reset', 'dispose', 'disabled']) {
    for (const kind of ['arm', 'cannon']) {
        f = fixture({orbitEnabled: false});
        f.state.removed = kind === 'cannon';
        const start = kind === 'arm' ? 1 : 3.8;
        f.pointer('pointerdown', start); f.pointer('pointermove', start - 1);
        if (cancellation === 'Escape') f.doc.send('keydown', {key: 'Escape'});
        else if (cancellation === 'blur') f.win.send('blur');
        else if (cancellation === 'reset' || cancellation === 'dispose') f.interaction[cancellation]();
        else if (cancellation === 'disabled') {f.state.enabled = false; f.pointer('pointermove', start - 1);}
        else f.canvas.send(cancellation);
        assert.equal(f.orbit.enabled, false, `${cancellation} restores original disabled orbit state`);
        assert.equal(f.calls.remove + f.calls.attach, 0);
        assert.equal(f.shell.visible, true); assert.equal(f.hand.visible, true);
        assert.equal(f.preview.position.x, 3);
        assert.equal(f.scene.getObjectByName('DetachedForearmAndHand'), undefined);
        assert.equal(f.canvas.hasPointerCapture(1), false);
        f.interaction.dispose();
    }
}
// A second pointer cannot cancel or finish the active pointer's drag.
f = fixture(); f.pointer('pointerdown', 1); f.canvas.send('pointercancel', {pointerId: 2});
f.pointer('pointerup', 2, {pointerId: 2}); assert.equal(f.orbit.enabled, false);
f.pointer('pointerup', 2); assert.equal(f.calls.remove, 1); f.interaction.dispose();

// Screen-space forgiveness permits a near-looking connection at larger depth/scale.
f = fixture({zoom: .5}); f.state.removed = true;
f.pointer('pointerdown', 3.8); f.pointer('pointermove', 1.8); f.pointer('pointerup', 1.8);
assert.equal(f.calls.attach, 1, '50 pixel gap snaps even at a one-unit world gap');
f.interaction.dispose();
assert.ok([...f.canvas.listeners.values(), ...f.doc.listeners.values(), ...f.win.listeners.values()].every(set => set.size === 0), 'dispose removes every listener');
f.pointer('pointerdown', 1); assert.equal(f.orbit.enabled, true);
console.log('PASS attachment interaction: real raycast drag, visual clone removal, original rig/elbow preservation, rejection, root snap, projected forgiveness, reentrant capture release, pointer isolation, cancel/blur/reset, orbit restoration, dispose');
