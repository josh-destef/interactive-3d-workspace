/* ═══════════════════════════════════════════════
   CONTROL DOCK
   Controls arrive with the step that teaches them. Quick colors introduce
   the idea immediately; RGB then becomes the precise color control.
═══════════════════════════════════════════════ */
import { COLOR_SWATCHES, MATERIAL_EXAMPLES } from './config.js';
import { values, setValue, setValues, applyValues } from './subject.js';
import { hexToRgb, rgbToHex } from './utils.js';

const dock = document.getElementById('dock');
const listeners = [];

export function onControlChange(fn) { listeners.push(fn); }
function emit(key) { listeners.forEach(fn => fn(key)); }

/* ── quick colors ── */
const swatchRow = document.getElementById('swatches');
COLOR_SWATCHES.forEach(hex => {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.type = 'button';
    b.style.background = hex;
    b.dataset.color = hex;
    b.setAttribute('aria-label', 'color ' + hex);
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
        setValue('color', hex);
        syncFromValues();
        emit('color');
    });
    swatchRow.appendChild(b);
});

/* ── material examples ── */
const exampleRow = document.getElementById('material-examples');
Object.entries(MATERIAL_EXAMPLES).forEach(([key, example]) => {
    const b = document.createElement('button');
    b.className = 'material-example';
    b.type = 'button';
    b.dataset.example = key;
    b.setAttribute('aria-label', `${example.label} material example`);
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = '<span class="example-ball" style="background:' + example.color + '"></span>' + example.label;
    b.addEventListener('click', () => {
        setValues({ color: example.color, roughness: example.roughness, metalness: example.metalness });
        syncFromValues();
        emit('example:' + key);
    });
    exampleRow.appendChild(b);
});

/* ── material sliders ── */
const sliders = {};
['roughness', 'metalness', 'emissive'].forEach(key => {
    const input = document.querySelector('input[data-ctl="' + key + '"]');
    sliders[key] = input;
    input.addEventListener('input', () => {
        setValue(key, Number(input.value));
        syncFromValues();
        emit(key);
    });
});

/* ── light position ── */
const lightInput = document.querySelector('input[data-ctl="light"]');
sliders.light = lightInput;
let onLight = () => { };
export function onLightChange(fn) { onLight = fn; }
lightInput.addEventListener('input', () => {
    const deg = Number(lightInput.value);
    onLight(deg);
    syncLight(deg);
    emit('light');
});

/* The range remains a keyboard-accessible view of the same one-dimensional
   orbit. Direct dragging calls this path too, so both controls stay in sync. */
export function setLightFromOrb(deg) {
    syncLight(deg);
    emit('light');
}

/* ── light color ── */
const lightColorRow = document.getElementById('light-colors');
let onLightColor = () => { };
export function onLightColorChange(fn) { onLightColor = fn; }

lightColorRow.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => {
        const name = button.dataset.lightColor;
        syncLightColor(name);
        onLightColor(name);
        emit('light-color');
    });
});

export function syncLightColor(name) {
    lightColorRow.querySelectorAll('button').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.lightColor === name));
    });
}

export function demoSetLightColor(name) {
    syncLightColor(name);
    onLightColor(name);
}

/* ── room switch ── */
const roomSeg = document.getElementById('room-seg');
let onRoom = () => { };
export function onRoomChange(fn) { onRoom = fn; }

roomSeg.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
        const on = b.dataset.room === 'on';
        setRoomButtons(on);
        onRoom(on);
        emit('room');
    });
});

function setRoomButtons(on) {
    roomSeg.querySelectorAll('button').forEach(b => {
        b.setAttribute('aria-pressed', String((b.dataset.room === 'on') === on));
    });
}

export function syncRoom(on) { setRoomButtons(on); }

export function demoSetRoom(on) {
    setRoomButtons(on);
    onRoom(on);
}

export function roomPoint(which) {
    return centerOf(roomSeg.querySelector('button[data-room="' + which + '"]'));
}

/* ── R / G / B ── */
const rgbInputs = {};
['r', 'g', 'b'].forEach(ch => {
    const input = document.querySelector('input[data-rgb="' + ch + '"]');
    rgbInputs[ch] = input;
    input.addEventListener('input', () => {
        setValue('color', readRGB());
        syncFromValues();
        emit('rgb');
    });
});

function readRGB() {
    return rgbToHex(
        Number(rgbInputs.r.value),
        Number(rgbInputs.g.value),
        Number(rgbInputs.b.value)
    );
}

export function rgbChannels() {
    return {
        r: Number(rgbInputs.r.value),
        g: Number(rgbInputs.g.value),
        b: Number(rgbInputs.b.value),
    };
}

/* ── reveal and state ── */
export function revealControls(keys) {
    dock.querySelectorAll('.ctl').forEach(el => {
        el.classList.toggle('on', keys.includes(el.dataset.group));
    });
    dock.classList.toggle('on', keys.length > 0);
    document.getElementById('console').classList.toggle('has-dock', keys.length > 0);
}

export function hideDock() { revealControls([]); }
export function lockDock(on) { dock.classList.toggle('locked', !!on); }

export function flashControl(key) {
    const el = dock.querySelector('.ctl[data-group="' + key + '"]');
    if (!el) return;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 2400);
}

function paintSlider(input) {
    const min = Number(input.min), max = Number(input.max);
    const pct = ((Number(input.value) - min) / (max - min)) * 100;
    input.style.setProperty('--fill', pct + '%');
}

export function syncFromValues() {
    ['roughness', 'metalness', 'emissive'].forEach(key => {
        const input = sliders[key];
        input.value = values[key] ?? 0;
        paintSlider(input);
        const out = document.querySelector('.ctl-val[data-for="' + key + '"]');
        if (out) out.textContent = ((values[key] ?? 0) / 100).toFixed(2);
    });

    const { r, g, b } = hexToRgb(values.color);
    if (readRGB().toLowerCase() !== String(values.color).toLowerCase()) {
        rgbInputs.r.value = r;
        rgbInputs.g.value = g;
        rgbInputs.b.value = b;
    }
    Object.entries({ r, g, b }).forEach(([ch, value]) => {
        paintSlider(rgbInputs[ch]);
        document.querySelector('.rgb-val[data-for="' + ch + '"]').textContent = value;
    });
    document.getElementById('rgb-chip').style.background = values.color;
    document.getElementById('rgb-hex').textContent = String(values.color).toUpperCase();

    swatchRow.querySelectorAll('.swatch').forEach(el => {
        const active = el.dataset.color.toLowerCase() === String(values.color).toLowerCase();
        el.classList.toggle('active', active);
        el.setAttribute('aria-pressed', String(active));
    });

    exampleRow.querySelectorAll('.material-example').forEach(el => {
        const p = MATERIAL_EXAMPLES[el.dataset.example];
        const active = p.color.toLowerCase() === String(values.color).toLowerCase()
            && p.roughness === values.roughness
            && p.metalness === values.metalness;
        el.classList.toggle('active', active);
        el.setAttribute('aria-pressed', String(active));
    });
}

export function syncLight(deg) {
    const rounded = Math.round(deg);
    lightInput.value = rounded;
    paintSlider(lightInput);
    document.querySelector('.ctl-val[data-for="light"]').textContent = rounded + '°';
}

/* ── demo support ── */
export function demoSetSlider(key, value) {
    setValue(key, value);
    syncFromValues();
}

export function demoSetRGB(ch, value) {
    rgbInputs[ch].value = value;
    setValue('color', readRGB());
    syncFromValues();
}

export function demoSetLight(deg) {
    onLight(deg);
    syncLight(deg);
}

function thumbPoint(input) {
    if (!input) return null;
    const r = input.getBoundingClientRect();
    if (!r.width) return null;
    const t = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min));
    const thumb = 16;
    return { x: r.left + thumb / 2 + t * (r.width - thumb), y: r.top + r.height / 2 };
}

export const sliderThumbPoint = key => thumbPoint(sliders[key]);
export const rgbThumbPoint = ch => thumbPoint(rgbInputs[ch]);

function centerOf(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export const swatchPoint = hex => centerOf(swatchRow.querySelector('.swatch[data-color="' + hex + '"]'));
export const examplePoint = key => centerOf(exampleRow.querySelector('.material-example[data-example="' + key + '"]'));

applyValues();
syncFromValues();
