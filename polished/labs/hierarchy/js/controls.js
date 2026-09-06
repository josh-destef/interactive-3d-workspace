/* ═══════════════════════════════════════════════
   CONTROL DOCK
   The bottom-center rail of joint controls, plus the local/world readout card.

   The dock is empty when the lesson starts and grows one control per step. This
   is the whole anti-clutter strategy, and it matters more here than anywhere:
   the source this lab replaces handed a beginner five joints, a scene tree, a
   transform table and four pose presets in one screen, and none of them meant
   anything yet.
═══════════════════════════════════════════════ */
import { NODE_LABELS, POSE_PRESETS, PRESET_DURATION } from './config.js';
import { animate01 } from './anim.js';
import { lerp } from './utils.js';
import {
    joints, setJoint, setJoints, selectNode, getSelectedNode,
    localPosition, worldPosition,
} from './arm.js';

const dock = document.getElementById('dock');
const readout = document.getElementById('readout');
const listeners = [];

export function onControlChange(fn) { listeners.push(fn); }
function emit(key) { listeners.forEach(fn => fn(key)); }

/* ── build ── */

const sliders = {};
['base', 'shoulder', 'elbow', 'wrist', 'grip'].forEach(key => {
    const input = document.querySelector(`input[data-ctl="${key}"]`);
    sliders[key] = input;
    input.addEventListener('input', () => {
        setJoint(key, Number(input.value));
        syncFromValues();
        emit(key);
    });
});

const nodeButtons = dock.querySelectorAll('.node-btn');
nodeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        selectNode(btn.dataset.node);
        syncFromValues();
        emit('node:' + btn.dataset.node);
    });
});

const presetButtons = dock.querySelectorAll('[data-preset]');
presetButtons.forEach(btn => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
});

/* ── reveal ── */

export function revealControls(keys) {
    dock.querySelectorAll('.ctl').forEach(el => {
        el.classList.toggle('on', keys.includes(el.dataset.group));
    });
    dock.classList.toggle('on', keys.length > 0);
}

export function hideDock() { revealControls([]); }

export function showReadout(on) {
    readout.classList.toggle('on', !!on);
}

/* Controls go dead while a demo drives them - a student grabbing the same slider
   mid-demo would fight the animation and see nonsense. */
export function lockDock(on) {
    dock.classList.toggle('locked', !!on);
}

/* Pulse a control so the student's eye lands on the thing the caption just named.
   Used when a step reveals a control without running a demo over it. */
export function flashControl(key) {
    const el = dock.querySelector(`.ctl[data-group="${key}"]`);
    if (!el) return;
    el.classList.remove('flash');
    void el.offsetWidth;   // restart the animation
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 2400);
}

/* ── value <-> DOM sync ── */

export function syncFromValues() {
    Object.entries(sliders).forEach(([key, input]) => {
        input.value = joints[key];
        const out = document.querySelector(`.ctl-val[data-for="${key}"]`);
        if (!out) return;
        out.textContent = key === 'grip' ? `${joints[key]}%` : `${Math.round(joints[key])}°`;
    });
    const selected = getSelectedNode();
    nodeButtons.forEach(b => {
        const active = b.dataset.node === selected;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', String(active));
    });
    document.getElementById('ro-node').textContent = NODE_LABELS[selected];
}

/* ── pose presets ──
   Animated, never snapped. A preset that teleports the arm shows a before and an
   after and nothing in between, and the in-between is the only part of this lab
   that teaches anything. */
function applyPreset(name) {
    const preset = POSE_PRESETS[name];
    if (!preset) return;
    const from = { ...joints };
    animate01(PRESET_DURATION, t => {
        const next = {};
        Object.keys(from).forEach(key => {
            next[key] = Math.round(lerp(from[key], preset[key], t));
        });
        setJoints(next);
        syncFromValues();
    }, () => emit('preset:' + name));
}

/* ── readout ──
   Driven from the render loop rather than from control changes, because the
   world row's highlight has to fade back down on its own once the arm stops. */
const readoutCells = {
    local: ['x', 'y', 'z'].map(a => document.getElementById(`ro-local-${a}`)),
    world: ['x', 'y', 'z'].map(a => document.getElementById(`ro-world-${a}`)),
};
const worldFlashUntil = [0, 0, 0];

export function updateReadout() {
    if (!readout.classList.contains('on')) return;
    const local = localPosition();
    const world = worldPosition();
    const now = performance.now();

    [local.x, local.y, local.z].forEach((v, i) => {
        const txt = v.toFixed(1);
        if (readoutCells.local[i].textContent !== txt) readoutCells.local[i].textContent = txt;
    });

    [world.x, world.y, world.z].forEach((v, i) => {
        const cell = readoutCells.world[i];
        const txt = v.toFixed(1);
        if (cell.textContent !== txt) {
            cell.textContent = txt;
            cell.classList.add('changed');
            worldFlashUntil[i] = now + 400;
        } else if (worldFlashUntil[i] && now > worldFlashUntil[i]) {
            // Dropping the class hands the cell back to its own transition, so
            // the highlight fades instead of blinking off.
            worldFlashUntil[i] = 0;
            cell.classList.remove('changed');
        }
    });
}

/* ── demo support ──
   Watch demos drive the real controls, not stand-ins, so what the student
   watches is exactly what they are about to do. */

export function demoSetSlider(key, value) {
    setJoint(key, value);
    syncFromValues();
}

/* Move the selection without firing a change event, so a beat can pin the
   readout to a node and a demo can click through the tree without either one
   counting toward the gate the student still has to clear. */
export function setSelectedNode(name) {
    selectNode(name);
    syncFromValues();
}

/* Viewport position of a slider's thumb, for the demo cursor to sit on. */
export function sliderThumbPoint(key) {
    const input = sliders[key];
    if (!input) return null;
    const r = input.getBoundingClientRect();
    const t = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min));
    const thumb = 16;   // keeps the cursor on the knob at both ends of the track
    return { x: r.left + thumb / 2 + t * (r.width - thumb), y: r.top + r.height / 2 };
}

/* Viewport position of a scene-tree button, for the demo cursor. */
export function nodeButtonPoint(name) {
    const b = dock.querySelector(`.node-btn[data-node="${name}"]`);
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width * 0.75, y: r.top + r.height / 2 };
}

syncFromValues();
