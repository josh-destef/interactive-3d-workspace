/* ═══════════════════════════════════════════════
   CONTROL DOCK
   The bottom-center rail of emitter controls.

   The dock is empty when the lesson starts and grows one control per step,
   same as every other lab here: a student on the lifetime step sees a
   lifetime slider and nothing else, so there is never a question about which
   control the caption is talking about.
═══════════════════════════════════════════════ */
import { params, setParam, spawnBurst } from './particles.js';

const dock = document.getElementById('dock');
const listeners = [];

export function onControlChange(fn) { listeners.push(fn); }
function emit(key) { listeners.forEach(fn => fn(key)); }

/* ── slider unit conversion ──
   Sliders carry small integers so their steps are even; the params they drive
   are the physical units (seconds, meters per second, a 0-1 fraction). Rate
   is the one slider that already is its own unit. */
function sliderToValue(key, raw) {
    switch (key) {
        case 'life': return raw / 10;
        case 'speed': return raw / 10;
        case 'drag': return raw / 100;
        default: return raw;   // rate
    }
}
function valueToSlider(key, value) {
    switch (key) {
        case 'life': return Math.round(value * 10);
        case 'speed': return Math.round(value * 10);
        case 'drag': return Math.round(value * 100);
        default: return Math.round(value);   // rate
    }
}
function formatValue(key, value) {
    switch (key) {
        case 'life': return value.toFixed(2);
        case 'speed': return value.toFixed(2);
        case 'drag': return value.toFixed(2);
        default: return String(Math.round(value));   // rate
    }
}

/* ── sliders ── */
const sliders = {};
['life', 'rate', 'speed', 'drag'].forEach(key => {
    const input = document.querySelector(`input[data-ctl="${key}"]`);
    sliders[key] = input;
    input.addEventListener('input', () => {
        setParam(key, sliderToValue(key, Number(input.value)));
        syncFromValues();
        emit(key);
    });
});

/* ── emitter shape buttons ── */
const shapeButtons = Array.from(document.querySelectorAll('#shape-buttons .dock-btn'));
shapeButtons.forEach(b => {
    b.addEventListener('click', () => {
        setParam('shape', b.dataset.shape);
        syncFromValues();
        emit('shape:' + b.dataset.shape);
    });
});

/* ── gravity toggle ── */
const gravityBtn = document.getElementById('btn-gravity');
gravityBtn.addEventListener('click', () => {
    setParam('gravity', !params.gravity);
    syncFromValues();
    emit('gravity');
});

/* ── look toggles ── */
const colorlifeBtn = document.getElementById('btn-colorlife');
colorlifeBtn.addEventListener('click', () => {
    setParam('colorLife', !params.colorLife);
    syncFromValues();
    emit('colorLife');
});

const blendBtn = document.getElementById('btn-blend');
blendBtn.addEventListener('click', () => {
    setParam('additive', !params.additive);
    syncFromValues();
    emit('additive');
});

/* ── burst ── */
const burstBtn = document.getElementById('btn-burst');
burstBtn.addEventListener('click', () => {
    spawnBurst(100);
    emit('burst');
});

/* ── reveal ── */

export function revealControls(keys) {
    dock.querySelectorAll('.ctl').forEach(el => {
        el.classList.toggle('on', keys.includes(el.dataset.group));
    });
    dock.classList.toggle('on', keys.length > 0);
}

export function hideDock() { revealControls([]); }

/* Controls go dead while a demo drives them - a student grabbing the same
   slider mid-demo would fight the animation and see nonsense. */
export function lockDock(on) {
    dock.classList.toggle('locked', !!on);
}

/* Pulse a control so the student's eye lands on the thing the caption just
   named. Used when a step reveals a control without running a demo over it. */
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
        input.value = valueToSlider(key, params[key]);
        const out = document.querySelector(`.ctl-val[data-for="${key}"]`);
        if (out) out.textContent = formatValue(key, params[key]);
    });
    shapeButtons.forEach(b => {
        const active = b.dataset.shape === params.shape;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', String(active));
    });
    gravityBtn.classList.toggle('active', params.gravity);
    gravityBtn.setAttribute('aria-pressed', String(params.gravity));
    gravityBtn.textContent = params.gravity ? 'Gravity on' : 'Gravity off';
    colorlifeBtn.classList.toggle('active', params.colorLife);
    colorlifeBtn.setAttribute('aria-pressed', String(params.colorLife));
    colorlifeBtn.textContent = params.colorLife ? 'Color over life' : 'Single color';
    blendBtn.classList.toggle('active', params.additive);
    blendBtn.setAttribute('aria-pressed', String(params.additive));
    blendBtn.textContent = params.additive ? 'Additive blend' : 'Alpha blend';
}

/* ── demo support ──
   Watch demos drive the real controls, not fakes, so what the student
   watches is exactly what they are about to do. */

export function demoSetSlider(key, raw) {
    sliders[key].value = raw;
    setParam(key, sliderToValue(key, raw));
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

/* Viewport center of any dock button, for the demo cursor. */
export function buttonPoint(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function shapeButtonEl(shape) {
    return shapeButtons.find(b => b.dataset.shape === shape) || null;
}
export function gravityButtonEl() { return gravityBtn; }
export function colorlifeButtonEl() { return colorlifeBtn; }
export function blendButtonEl() { return blendBtn; }

syncFromValues();
