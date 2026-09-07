/* ═══════════════════════════════════════════════
   INTERACTION
   Raycast, drag, commit. The pointer half of the lab.

   Priority on pointerdown: a visible gizmo handle beats an object, an object
   beats a face, and everything beats orbit. A beginner who grazes a handle
   should transform the thing rather than spin the camera, so the hit meshes
   are far fatter than the handles they stand in for.

   Every axis drag measures in SCREEN pixels and converts once, using how many
   pixels that world axis currently covers. Dragging then tracks the pointer
   at any camera angle without a plane-intersection singularity when you look
   straight down an axis.
═══════════════════════════════════════════════ */
import * as THREE from 'three';
import { LIMITS, GIZMO } from './config.js';
import {
    state, getEntry, entryForObject3D, faceFromPoint, setExtrude, getExtrude,
    setBevel, setSegments, setInset, getInset, faceCentreWorld, placeMount, moveMount, addMount, removeMount,
    setMountActive, distanceToPort,
    snapToPort, INNER_FACE, FACES,
} from './model.js';
import { portWorldPoint, setPortActive } from './gizmobot.js';
import { session, select, setFace, emitSession, activeId } from './session.js';
import {
    pickables, restoreColor, highlight, targetCentre, gizmoTarget,
    faceHighlight, insetHandle,
} from './gizmos.js';
import { push, suspend } from './history.js';
import { clamp } from '../../../kit/js/utils.js';

let cv, camera, orbitCtrl, stage;
let onChange = () => { };
let placingMount = false;
let snapArmed = false;

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const readoutEl = () => document.getElementById('modal-readout');

/* ── live drag ── */
const drag = {
    kind: null, handle: null, axis: null, entry: null, face: null,
    startX: 0, startY: 0, ppu: 1,
    startPos: new THREE.Vector3(), startScale: new THREE.Vector3(),
    startQuat: new THREE.Quaternion(), startVal: 0,
    startSeg: 0, target: null, pointerId: null,
    mountCreated: false, mountStartU: 0, mountStartV: 0,
    screenDir: { x: 1, y: 0 }, centreScreen: { x: 0, y: 0 },
    startDist: 1, startAngle: 0, accum: 0,
};

let hovered = null;

export function initInteraction(createdStage, { onChange: cb } = {}) {
    stage = createdStage;
    cv = document.getElementById('cv');
    camera = stage.camera;
    orbitCtrl = stage.orbitCtrl;
    if (cb) onChange = cb;

    /* Capture before OrbitControls' bubble listener. A click that lands on a
       model or handle belongs to the modelling tool; empty canvas still falls
       through to orbit normally. */
    cv.addEventListener('pointerdown', onDown, { capture: true });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onCancel);
    window.addEventListener('blur', onCancel);
    window.addEventListener('wheel', onDragWheel, { passive: false });
    cv.addEventListener('pointermove', onHover);
}

export function setMountPlacement(on) { placingMount = on; session.placingMount = on; }
/* step 11 only: a move drag watches the port and the magnet takes over */
export function setSnapArmed(on) {
    snapArmed = on;
    if (!on) { setPortActive(false); setMountActive(false); }
}

/* ── readout ──
   The only numeric feedback in the lab, and it lives with the action rather
   than in a panel the student would have to look away to read. */
export function showReadout(label, value, axis = null) {
    const el = readoutEl();
    if (!el) return;
    el.textContent = label + '   ' + value;
    el.classList.remove('axis-x', 'axis-y', 'axis-z');
    if (axis) el.classList.add('axis-' + axis);
    el.classList.add('on');
}
export function hideReadout() {
    readoutEl()?.classList.remove('on');
}

/* ── screen helpers ── */
function toNDC(e) {
    const r = cv.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    return ndc;
}
function toScreen(world) {
    const p = world.clone().project(camera);
    const r = cv.getBoundingClientRect();
    return { x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (-p.y * 0.5 + 0.5) * r.height };
}
/** Pixels covered by one world unit along `axisWorld`, plus its screen direction. */
function axisScreen(centre, axisWorld) {
    const a = toScreen(centre);
    const b = toScreen(centre.clone().add(axisWorld));
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    return len > 0.001
        ? { ppu: len, dir: { x: dx / len, y: dy / len } }
        : { ppu: 1, dir: { x: 1, y: 0 } };
}
const snap = (v, on) => (on ? Math.round(v / LIMITS.snap) * LIMITS.snap : v);
const fmt = n => (Math.abs(n) < 0.0005 ? '0.00' : n.toFixed(2));

/* ── picking ── */
function hitGizmo(e) {
    raycaster.setFromCamera(toNDC(e), camera);
    const list = pickables();
    for (const { mesh, handle } of list) {
        if (raycaster.intersectObject(mesh, false).length) return handle;
    }
    return null;
}

function hitObject(e) {
    raycaster.setFromCamera(toNDC(e), camera);
    const meshes = state.entries.filter(x => x.kind !== 'group').map(x => x.mesh);
    const hits = raycaster.intersectObjects(meshes, false);
    return hits.length ? hits[0] : null;
}

/* ── pointer down ── */
function onDown(e) {
    if (e.button !== 0 || session.modal) return;

    const target = gizmoTarget();
    const handle = target ? hitGizmo(e) : null;
    if (handle) {
        e.stopPropagation();
        beginHandleDrag(e, handle);
        return;
    }

    const hit = hitObject(e);
    if (hit) e.stopPropagation();

    /* placing the mount: a click on the module's inner face puts the plug
       there, and holding the button slides it around on that face */
    if (placingMount && hit) {
        const entry = entryForObject3D(hit.object);
        if (entry && entry.kind === 'box') {
            const face = faceFromPoint(entry, hit.point);
            if (face && face.id === INNER_FACE) {
                /* An existing connector can only be dragged on the box that
                   owns it. Coordinates from another box are a different local
                   space and must never be applied to the original owner. */
                if (state.mount && state.mount.objectId !== entry.id) return;
                const local = entry.mesh.worldToLocal(hit.point.clone());
                drag.mountCreated = !state.mount;
                drag.mountStartU = state.mount?.u || 0;
                drag.mountStartV = state.mount?.v || 0;
                if (drag.mountCreated) addMount(entry.id, local.x, local.y);
                else moveMount(local.x, local.y);
                drag.kind = 'mount';
                drag.entry = entry;
                drag.pointerId = e.pointerId;
                session.dragging = true;
                orbitCtrl.enabled = false;
                cv.setPointerCapture?.(e.pointerId);
                onChange('mount');
                return;
            }
        }
    }

    if (!hit) {
        if (session.mode === 'object') { select([]); onChange('select'); }
        return;
    }

    const entry = entryForObject3D(hit.object);
    if (!entry) return;

    /* in edit mode, a click on the object being edited picks a face instead
       of re-selecting the object */
    if (session.mode === 'edit' && entry.id === activeId()) {
        const face = faceFromPoint(entry, hit.point);
        if (face) { setFace(face); onChange('face'); }
        return;
    }

    /* a member of a group selects its group, which is what grouping is for */
    const top = entry.parentId ? getEntry(entry.parentId) : entry;
    select(top.id, { additive: e.shiftKey || e.ctrlKey || e.metaKey });
    onChange('select');
}

function beginHandleDrag(e, handle) {
    const target = gizmoTarget();
    const entry = getEntry(activeId());
    if (!target || !entry) return;

    orbitCtrl.enabled = false;
    session.dragging = true;
    cv.classList.add('grabbing');

    drag.kind = handle._kind;
    drag.handle = handle;
    drag.entry = entry;
    drag.target = target;
    drag.face = session.face;
    drag.pointerId = e.pointerId;
    drag.startX = e.clientX;
    drag.startY = e.clientY;
    drag.startPos.copy(target.position);
    drag.startScale.copy(target.scale);
    drag.startQuat.copy(target.quaternion);
    cv.setPointerCapture?.(e.pointerId);

    const centre = targetCentre();
    drag.centreScreen = toScreen(centre);

    if (drag.kind === 'move' || drag.kind === 'scaleAxis') {
        drag.axis = handle._axKey;
        const world = new THREE.Vector3(
            drag.axis === 'x' ? 1 : 0, drag.axis === 'y' ? 1 : 0, drag.axis === 'z' ? 1 : 0,
        );
        if (drag.kind === 'scaleAxis') world.applyQuaternion(target.getWorldQuaternion(new THREE.Quaternion()));
        const s = axisScreen(centre, world);
        drag.ppu = s.ppu; drag.screenDir = s.dir;
    } else if (drag.kind === 'scaleUniform') {
        drag.startDist = Math.max(Math.hypot(e.clientX - drag.centreScreen.x, e.clientY - drag.centreScreen.y), 12);
    } else if (drag.kind === 'rotate') {
        drag.axis = handle._axKey;
        drag.startAngle = Math.atan2(e.clientY - drag.centreScreen.y, e.clientX - drag.centreScreen.x);
        drag.accum = 0;
    } else if (drag.kind === 'extrude') {
        drag.startVal = getExtrude(entry, session.face?.id);
        const n = session.face ? session.face.n.clone().applyQuaternion(target.getWorldQuaternion(new THREE.Quaternion())) : new THREE.Vector3(0, 1, 0);
        const s = axisScreen(centre, n);
        drag.ppu = s.ppu; drag.screenDir = s.dir;
    } else if (drag.kind === 'bevel') {
        drag.startVal = entry.bevel;
        drag.startSeg = entry.seg;
        drag.ppu = 240;
        const handleScreen = toScreen(handle.getWorldPosition(new THREE.Vector3()));
        const centreScreen = toScreen(targetCentre());
        const vx = centreScreen.x - handleScreen.x;
        const vy = centreScreen.y - handleScreen.y;
        const len = Math.hypot(vx, vy);
        drag.screenDir = len > 1 ? { x: vx / len, y: vy / len } : { x: -1, y: 0 };
    } else if (drag.kind === 'inset') {
        drag.startVal = getInset(entry, session.face?.id);
        /* Measured from the corner handle toward the middle of the face, so
           the gesture means the same thing at any camera angle: pull inward,
           get more inset. Dragging the whole way to the middle is a full
           inset, which is why the distance itself sets the scale. */
        const handleScreen = toScreen(insetHandle.getWorldPosition(new THREE.Vector3()));
        const faceScreen = toScreen(faceCentreWorld(entry, session.face));
        const vx = faceScreen.x - handleScreen.x;
        const vy = faceScreen.y - handleScreen.y;
        const len = Math.hypot(vx, vy);
        drag.screenDir = len > 1 ? { x: vx / len, y: vy / len } : { x: -1, y: 0 };
        drag.ppu = Math.max(len, 40) / 0.5;
    }
    highlight(handle);
}

/* ── pointer move ── */
function onMove(e) {
    if (!session.dragging || !drag.kind) return;

    if (drag.kind === 'mount') {
        raycaster.setFromCamera(toNDC(e), camera);
        const hits = raycaster.intersectObject(drag.entry.mesh, false);
        if (hits.length) {
            const local = drag.entry.mesh.worldToLocal(hits[0].point.clone());
            moveMount(local.x, local.y);
            onChange('mount');
        }
        return;
    }

    const target = gizmoTarget();
    const entry = drag.entry;
    if (!target || !entry) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const along = (dx * drag.screenDir.x + dy * drag.screenDir.y) / drag.ppu;
    const held = e.ctrlKey || e.metaKey;

    if (drag.kind === 'move') {
        const d = snap(along, held);
        target.position.copy(drag.startPos);
        target.position[drag.axis] += d;
        showReadout('MOVE', drag.axis.toUpperCase() + ': ' + fmt(d), drag.axis);
        placeMount();
        updateSnapFeedback();
        onChange('move');
    } else if (drag.kind === 'scaleAxis') {
        const base = drag.startScale[drag.axis];
        const next = clamp(snap(base + along, held), LIMITS.scaleMin, LIMITS.scaleMax);
        target.scale[drag.axis] = next;
        showReadout('SCALE', drag.axis.toUpperCase() + ': ' + fmt(next), drag.axis);
        placeMount();
        onChange('scale');
    } else if (drag.kind === 'scaleUniform') {
        const dist = Math.hypot(e.clientX - drag.centreScreen.x, e.clientY - drag.centreScreen.y);
        const f = clamp(dist / drag.startDist, 0, 6);
        target.scale.set(
            clamp(drag.startScale.x * f, LIMITS.scaleMin, LIMITS.scaleMax),
            clamp(drag.startScale.y * f, LIMITS.scaleMin, LIMITS.scaleMax),
            clamp(drag.startScale.z * f, LIMITS.scaleMin, LIMITS.scaleMax),
        );
        showReadout('SCALE', fmt(target.scale.x) + ', ' + fmt(target.scale.y) + ', ' + fmt(target.scale.z));
        placeMount();
        onChange('scale');
    } else if (drag.kind === 'rotate') {
        const angle = Math.atan2(e.clientY - drag.centreScreen.y, e.clientX - drag.centreScreen.x);
        let delta = angle - drag.startAngle;
        /* the ring facing away from the camera has to turn the other way, or
           dragging it feels inverted */
        const axisWorld = new THREE.Vector3(
            drag.axis === 'x' ? 1 : 0, drag.axis === 'y' ? 1 : 0, drag.axis === 'z' ? 1 : 0,
        );
        const facing = axisWorld.dot(camera.getWorldDirection(new THREE.Vector3())) > 0 ? 1 : -1;
        delta *= facing;
        if (held) delta = Math.round(delta / (Math.PI / 36)) * (Math.PI / 36);
        const q = new THREE.Quaternion().setFromAxisAngle(axisWorld, delta);
        target.quaternion.copy(q.multiply(drag.startQuat));
        showReadout('ROTATE', Math.round(THREE.MathUtils.radToDeg(delta)) + '°', drag.axis);
        placeMount();
        onChange('rotate');
    } else if (drag.kind === 'extrude') {
        const d = setExtrude(entry, drag.face.id, snap(drag.startVal + along, held));
        showReadout('EXTRUDE', drag.face.axis.toUpperCase() + ': ' + fmt(d), drag.face.axis);
        placeMount();
        onChange('extrude');
    } else if (drag.kind === 'bevel') {
        const r = setBevel(entry, drag.startVal + along);
        showReadout('BEVEL', fmt(r) + '   ' + entry.seg + ' seg');
        onChange('bevel');
    } else if (drag.kind === 'inset') {
        const i = setInset(entry, drag.face.id, drag.startVal + along);
        showReadout('INSET', fmt(i));
        onChange('inset');
    }
}

/** Both halves light up while the plug is inside the magnet's reach. */
function updateSnapFeedback() {
    if (!snapArmed) return;
    const near = distanceToPort(portWorldPoint()) <= LIMITS.snapDistance;
    setPortActive(near);
    setMountActive(near);
    return near;
}

/* ── pointer up ──
   One history entry per gesture, pushed on release. Pushing per frame would
   make undo walk back through a drag one pixel at a time. */
function onUp(e) {
    if (!session.dragging) return;
    if (e?.pointerId !== undefined && drag.pointerId !== null && e.pointerId !== drag.pointerId) return;
    const wasMount = drag.kind === 'mount';
    finishDragUI();

    /* let go inside the magnet's reach and the two pull together */
    if (snapArmed && snapToPort(portWorldPoint())) {
        setPortActive(false);
        setMountActive(false);
        placeMount();
        onChange('snapped');
        return;
    }
    push();
    onChange(wasMount ? 'mount' : 'commit');
}

function finishDragUI() {
    const pointerId = drag.pointerId;
    session.dragging = false;
    cv.classList.remove('grabbing');
    restoreColor(drag.handle);
    drag.kind = null;
    drag.handle = null;
    drag.target = null;
    drag.pointerId = null;
    orbitCtrl.enabled = true;
    hideReadout();
    if (pointerId !== null && cv.hasPointerCapture?.(pointerId)) cv.releasePointerCapture(pointerId);
}

function onCancel() {
    if (!session.dragging || !drag.kind) return;
    const kind = drag.kind;
    const target = drag.target;
    const entry = drag.entry;

    if (kind === 'mount') {
        if (drag.mountCreated) removeMount();
        else moveMount(drag.mountStartU, drag.mountStartV);
    } else if (target && entry) {
        if (kind === 'extrude') setExtrude(entry, drag.face.id, drag.startVal);
        else if (kind === 'inset') setInset(entry, drag.face.id, drag.startVal);
        else if (kind === 'bevel') {
            setSegments(entry, drag.startSeg);
            setBevel(entry, drag.startVal);
        } else {
            target.position.copy(drag.startPos);
            target.scale.copy(drag.startScale);
            target.quaternion.copy(drag.startQuat);
            placeMount();
        }
    }
    setPortActive(false);
    setMountActive(false);
    finishDragUI();
    onChange('cancel');
}

function onDragWheel(e) {
    if (!session.dragging || drag.kind !== 'bevel' || !drag.entry || !e.deltaY) return;
    e.preventDefault();
    wheelSegments(drag.entry, e.deltaY < 0 ? 1 : -1);
    onChange('bevel');
}

/* ── hover ── */
function onHover(e) {
    if (session.dragging || session.modal || !gizmoTarget()) return;
    const handle = hitGizmo(e);
    if (handle === hovered) return;
    restoreColor(hovered);
    hovered = handle;
    if (handle) highlight(handle);
    cv.style.cursor = handle ? 'grab' : '';
}

/* ── the scroll wheel changes bevel segments while a bevel drag runs ── */
export function wheelSegments(entry, dir) {
    if (!entry || entry.kind !== 'box') return;
    const next = Math.round(clamp(entry.seg + dir, LIMITS.segMin, LIMITS.segMax));
    if (next === entry.seg) return;
    setSegments(entry, next);
    showReadout('BEVEL', fmt(entry.bevel) + '   ' + entry.seg + ' seg');
}

export const isDragging = () => session.dragging;
