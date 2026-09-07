/* ═══════════════════════════════════════════════
   MODAL OPERATORS
   Press a key, move the mouse, click to confirm.

   This is the layer above the gizmos, and the reason this lab is a step on
   from Navigate + Transform rather than a second helping of it. A gizmo says
   "drag this handle". A modal operator says "the object is following you now",
   which is how a modelling tool is actually driven.

   Three things make it safe for a beginner: Esc puts everything back exactly,
   an axis key narrows a vague drag into a definite one, and typing a number
   ends the guessing. Precision lives here, inside the running action, instead
   of in a panel of numeric fields beside it.
═══════════════════════════════════════════════ */
import * as THREE from 'three';
import { LIMITS } from './config.js';
import {
    getEntry, setExtrude, getExtrude, setBevel, setSegments, setInset, getInset,
    placeMount, duplicateObject,
} from './model.js';
import { session, activeId, emitSession, setTool, select } from './session.js';
import { gizmoTarget, targetCentre } from './gizmos.js';
import { showReadout, hideReadout } from './interaction.js';
import { push } from './history.js';
import { clamp } from '../../../kit/js/utils.js';

let cv, camera, orbitCtrl, stage;
let onChange = () => { };

const op = {
    kind: null,        // move | rotate | scale | extrude | bevel
    axis: null,        // 'x' | 'y' | 'z' | null for free
    entry: null,
    face: null,
    startX: 0, startY: 0,
    lastX: 0, lastY: 0,
    startPos: new THREE.Vector3(),
    startScale: new THREE.Vector3(),
    startQuat: new THREE.Quaternion(),
    startVal: 0,
    startDist: 1,
    typed: '',
};

export function initModal(createdStage, { onChange: cb } = {}) {
    stage = createdStage;
    cv = document.getElementById('cv');
    camera = stage.camera;
    orbitCtrl = stage.orbitCtrl;
    if (cb) onChange = cb;

    window.addEventListener('pointermove', track);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('contextmenu', e => { if (session.modal) { e.preventDefault(); cancel(); } });
}

const screenOf = world => {
    const p = world.clone().project(camera);
    const r = cv.getBoundingClientRect();
    return { x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (-p.y * 0.5 + 0.5) * r.height };
};
function axisPPU(centre, axisWorld) {
    const a = screenOf(centre);
    const b = screenOf(centre.clone().add(axisWorld));
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    return len > 0.001 ? { ppu: len, dir: { x: dx / len, y: dy / len } } : { ppu: 1, dir: { x: 1, y: 0 } };
}
const axisVec = a => new THREE.Vector3(a === 'x' ? 1 : 0, a === 'y' ? 1 : 0, a === 'z' ? 1 : 0);
const fmt = n => (Math.abs(n) < 0.0005 ? '0.00' : n.toFixed(2));

/* ── start ── */
export function startModal(kind) {
    const entry = getEntry(activeId());
    const target = gizmoTarget();
    if (!entry || !target) return false;
    if (kind === 'extrude' || kind === 'bevel' || kind === 'inset') {
        if (session.mode !== 'edit' || entry.kind !== 'box') return false;
        if (kind !== 'bevel' && !session.face) return false;
    }

    op.kind = kind;
    op.axis = null;
    op.entry = entry;
    op.face = session.face;
    op.typed = '';
    op.startPos.copy(target.position);
    op.startScale.copy(target.scale);
    op.startQuat.copy(target.quaternion);
    op.startVal = kind === 'extrude' ? getExtrude(entry, session.face?.id)
        : kind === 'inset' ? getInset(entry, session.face?.id)
            : kind === 'bevel' ? entry.bevel : 0;

    const centre = screenOf(targetCentre());
    op.startX = op.lastX = centre.x + 40;
    op.startY = op.lastY = centre.y;
    op.startDist = 40;

    session.modal = kind;
    orbitCtrl.enabled = false;
    cv.classList.add('modal');
    emitSession();
    apply();
    return true;
}

/* ── run ── */
function track(e) {
    if (!session.modal) return;
    op.lastX = e.clientX;
    op.lastY = e.clientY;
    apply();
}

function apply() {
    const target = gizmoTarget();
    const entry = op.entry;
    if (!target || !entry) return;

    const centre = targetCentre();
    const centreScreen = screenOf(centre);
    const dx = op.lastX - op.startX;
    const dy = op.lastY - op.startY;
    const typedValue = op.typed === '' ? null : parseFloat(op.typed);
    const label = op.kind.toUpperCase();

    if (op.kind === 'move') {
        target.position.copy(op.startPos);
        if (op.axis) {
            const s = axisPPU(centre, axisVec(op.axis));
            const amount = typedValue !== null ? typedValue : (dx * s.dir.x + dy * s.dir.y) / s.ppu;
            target.position[op.axis] += amount;
            showReadout(label, op.axis.toUpperCase() + ': ' + fmt(amount), op.axis);
        } else {
            /* no axis chosen yet: slide in the plane the camera is looking at */
            const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
            const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
            const sx = axisPPU(centre, right).ppu;
            const sy = axisPPU(centre, up).ppu;
            target.position.addScaledVector(right, dx / sx).addScaledVector(up, -dy / sy);
            showReadout(label, fmt(dx / sx) + ', ' + fmt(-dy / sy));
        }
        placeMount();
    } else if (op.kind === 'scale') {
        const dist = Math.hypot(op.lastX - centreScreen.x, op.lastY - centreScreen.y);
        const f = typedValue !== null ? typedValue : clamp(dist / op.startDist, 0, 8);
        target.scale.copy(op.startScale);
        if (op.axis) {
            target.scale[op.axis] = clamp(op.startScale[op.axis] * f, LIMITS.scaleMin, LIMITS.scaleMax);
            showReadout(label, op.axis.toUpperCase() + ': ' + fmt(target.scale[op.axis]), op.axis);
        } else {
            target.scale.set(
                clamp(op.startScale.x * f, LIMITS.scaleMin, LIMITS.scaleMax),
                clamp(op.startScale.y * f, LIMITS.scaleMin, LIMITS.scaleMax),
                clamp(op.startScale.z * f, LIMITS.scaleMin, LIMITS.scaleMax),
            );
            showReadout(label, fmt(target.scale.x) + ', ' + fmt(target.scale.y) + ', ' + fmt(target.scale.z));
        }
        placeMount();
    } else if (op.kind === 'rotate') {
        const a0 = Math.atan2(op.startY - centreScreen.y, op.startX - centreScreen.x);
        const a1 = Math.atan2(op.lastY - centreScreen.y, op.lastX - centreScreen.x);
        const axisWorld = op.axis ? axisVec(op.axis) : camera.getWorldDirection(new THREE.Vector3()).negate();
        let delta = typedValue !== null ? THREE.MathUtils.degToRad(typedValue) : (a1 - a0);
        if (typedValue === null && op.axis) {
            delta *= axisWorld.dot(camera.getWorldDirection(new THREE.Vector3())) > 0 ? 1 : -1;
        }
        target.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(axisWorld.normalize(), delta).multiply(op.startQuat));
        showReadout(label, Math.round(THREE.MathUtils.radToDeg(delta)) + '°', op.axis);
        placeMount();
    } else if (op.kind === 'extrude') {
        const n = op.face.n.clone().applyQuaternion(target.getWorldQuaternion(new THREE.Quaternion()));
        const s = axisPPU(centre, n);
        const amount = typedValue !== null ? typedValue : op.startVal + (dx * s.dir.x + dy * s.dir.y) / s.ppu;
        const d = setExtrude(entry, op.face.id, amount);
        showReadout(label, op.face.axis.toUpperCase() + ': ' + fmt(d), op.face.axis);
        placeMount();
    } else if (op.kind === 'inset') {
        const amount = typedValue !== null ? typedValue : op.startVal + (-dx) / 200;
        showReadout(label, fmt(setInset(entry, op.face.id, amount)));
    } else if (op.kind === 'bevel') {
        const amount = typedValue !== null ? typedValue : op.startVal + (-dx) / 240;
        const r = setBevel(entry, amount);
        showReadout(label, fmt(r) + '   ' + entry.seg + ' seg');
    }
    onChange(op.kind);
}

/* ── end ── */
export function confirm() {
    if (!session.modal) return;
    finish();
    push();
    onChange('commit');
}

export function cancel() {
    if (!session.modal) return;
    const target = gizmoTarget();
    const entry = op.entry;
    if (target && entry) {
        if (op.kind === 'extrude') setExtrude(entry, op.face.id, op.startVal);
        else if (op.kind === 'inset') setInset(entry, op.face.id, op.startVal);
        else if (op.kind === 'bevel') setBevel(entry, op.startVal);
        else {
            target.position.copy(op.startPos);
            target.scale.copy(op.startScale);
            target.quaternion.copy(op.startQuat);
        }
        placeMount();
    }
    finish();
    onChange('cancel');
}

function finish() {
    session.modal = null;
    op.kind = null;
    op.typed = '';
    orbitCtrl.enabled = true;
    cv.classList.remove('modal');
    hideReadout();
    emitSession();
}

function onPointerDown(e) {
    if (!session.modal) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.button === 2) cancel(); else confirm();
}

/* The wheel is where segment count lives - it has no panel anywhere. */
function onWheel(e) {
    if (session.modal !== 'bevel' || !op.entry) return;
    setSegments(op.entry, op.entry.seg + (e.deltaY < 0 ? 1 : -1));
    showReadout('BEVEL', fmt(op.entry.bevel) + '   ' + op.entry.seg + ' seg');
    onChange('bevel');
}

/* ── keys ──
   One handler. Everything a modal operator understands is read here, and
   everything else falls through to the lab's own shortcuts. */
export function handleKey(e) {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '');
    if (typing) return false;
    const k = e.key.toLowerCase();

    if (session.modal) {
        if (k === 'escape') { cancel(); return true; }
        if (k === 'enter') { confirm(); return true; }
        if (k === 'x' || k === 'y' || k === 'z') {
            op.axis = op.axis === k ? null : k;
            op.typed = '';
            apply();
            return true;
        }
        if (/^[0-9]$/.test(k) || (k === '.' && !op.typed.includes('.'))) { op.typed += k; apply(); return true; }
        if (k === '-') { op.typed = op.typed.startsWith('-') ? op.typed.slice(1) : '-' + op.typed; apply(); return true; }
        if (k === 'backspace') { op.typed = op.typed.slice(0, -1); apply(); return true; }
        return true;   // a running modal swallows everything else
    }

    if (e.ctrlKey || e.metaKey) {
        if (k === 'b') { setTool('bevel'); startModal('bevel'); return true; }
        return false;   // undo/redo/group are the lab's, not this module's
    }
    if (e.shiftKey && k === 'd') {
        const copy = duplicateObject(activeId());
        if (copy) {
            select(copy.id);
            onChange('duplicate');
            startModal('move');
        }
        return true;
    }
    if (k === 'g') { setTool('move'); return startModal('move'); }
    if (k === 'r') { setTool('rotate'); return startModal('rotate'); }
    if (k === 's') { setTool('scale'); return startModal('scale'); }
    if (k === 'e') { setTool('extrude'); return startModal('extrude'); }
    if (k === 'i') { setTool('inset'); return startModal('inset'); }
    return false;
}

export const modalRunning = () => !!session.modal;
