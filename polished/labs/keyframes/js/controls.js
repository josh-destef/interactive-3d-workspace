/* ═══════════════════════════════════════════════
   CONTROL DOCK
   The bottom-center rail: timeline, pose sliders, motion graph, interpolation,
   object and recipes.

   The dock is empty when the lesson starts and grows one control per step. This
   is the whole anti-clutter strategy, and it is the fix for the version of this
   lab where a timeline, a graph, a keyframe list and four recipes were all on
   screen before the student knew what a keyframe was.
═══════════════════════════════════════════════ */
import { POSE_SLIDERS, EASINGS, ACTORS, RECIPES, LAST_FRAME, MAX_HEIGHT } from './config.js';
import { clamp } from './utils.js';
import { getActorType } from './actor.js';
import {
    keys, keyAt, poseAt, getFrame, getPose, getEasing, isPlaying,
    setFrame, setPose, setKeyframe, deleteKeyframe, setEasing, setActor,
    setPlaying, loadRecipe, onModelChange,
} from './animation.js';

const dock = document.getElementById('dock');
const goalList = document.getElementById('goal-list');
const frameValue = document.getElementById('frame-value');
const timeline = document.getElementById('timeline');
const keyMarkers = document.getElementById('key-markers');
const keyList = document.getElementById('key-list');
const playBtn = document.getElementById('btn-play');
const setKeyBtn = document.getElementById('btn-set-key');
const curve = document.getElementById('curve');
const cctx = curve.getContext('2d');

const listeners = [];
export function onControlChange(fn) { listeners.push(fn); }
function emit(key) { listeners.forEach(fn => fn(key)); }

/* ── build ── */

const sliders = {};
Object.entries(POSE_SLIDERS).forEach(([name, cfg]) => {
    const input = document.querySelector(`input[data-ctl="${name}"]`);
    sliders[name] = input;
    input.addEventListener('input', () => {
        // Posing while the animation runs would be a fight the student loses
        // every frame, so touching a pose slider stops playback.
        setPlaying(false);
        setPose({ [cfg.channel]: Number(input.value) / cfg.scale });
        emit(name);
    });
});

function buildOptions(containerId, entries, attr, onPick) {
    const row = document.getElementById(containerId);
    entries.forEach(([key, label]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'opt-btn';
        b.dataset[attr] = key;
        b.textContent = label;
        b.addEventListener('click', () => onPick(key));
        row.appendChild(b);
    });
    return row;
}

const easingRow = buildOptions('easings', Object.entries(EASINGS), 'easing', key => {
    setEasing(key);
    emit('easing:' + key);
});

const actorRow = buildOptions('actors', Object.entries(ACTORS), 'actor', key => {
    setActor(key);
    emit('actor:' + key);
});

buildOptions('recipes', Object.entries(RECIPES).map(([k, r]) => [k, r.label]), 'recipe', key => {
    loadRecipe(key);
    emit('recipe:' + key);
});

timeline.addEventListener('input', () => {
    setPlaying(false);
    setFrame(Number(timeline.value));
    emit('frame');
});

playBtn.addEventListener('click', () => {
    const next = !isPlaying();
    setPlaying(next);
    emit(next ? 'play' : 'pause');
});

setKeyBtn.addEventListener('click', () => {
    setPlaying(false);
    setKeyframe();
    emit('key');
});

/* ── reveal ── */

export function revealControls(names) {
    dock.querySelectorAll('.ctl').forEach(el => {
        el.classList.toggle('on', names.includes(el.dataset.group));
    });
    dock.classList.toggle('on', names.length > 0);
    // A hidden canvas measures zero, so the graph can only be sized once the beat
    // that reveals it has actually put it on screen.
    sizeCurve();
    drawCurve();
}

export function hideDock() { revealControls([]); }

/* Controls go dead while a demo drives them - a student grabbing the same slider
   mid-demo would fight the animation and see nonsense. */
export function lockDock(on) {
    dock.classList.toggle('locked', !!on);
}

/* Pulse a control so the student's eye lands on the thing the caption just named.
   Used when a step reveals a control without running a demo over it. */
export function flashControl(name) {
    const el = dock.querySelector(`.ctl[data-group="${name}"]`);
    if (!el) return;
    el.classList.remove('flash');
    void el.offsetWidth;   // restart the animation
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 2400);
}

/* ── challenge checklist ── */

export function showGoals(on) {
    goalList.classList.toggle('on', !!on);
    if (!on) goalList.querySelectorAll('.goal-row').forEach(r => r.classList.remove('met'));
}

export function setGoal(name, met) {
    const row = goalList.querySelector(`.goal-row[data-goal="${name}"]`);
    if (row) row.classList.toggle('met', !!met);
}

/* ── model -> DOM ── */

const valueText = {
    height: pose => pose.y.toFixed(1),
    turn: pose => `${Math.round(pose.turn)}°`,
    size: pose => pose.size.toFixed(2),
};

/* The chip row and the diamond markers are rebuilt from scratch, which is fine
   when a key is added or deleted and wasteful thirty times a second during
   playback. So they are only rebuilt when the set of frames actually changes. */
let keySig = '';

function renderKeys() {
    const sig = keys.map(k => k.frame).join(',');
    if (sig !== keySig) {
        keySig = sig;
        keyList.innerHTML = '';
        keyMarkers.innerHTML = '';
        keys.forEach(k => {
            const chip = document.createElement('div');
            chip.className = 'key-chip';
            chip.dataset.frame = k.frame;
            chip.innerHTML = `F${k.frame}<button type="button" class="chip-del" aria-label="Delete keyframe at frame ${k.frame}">&times;</button>`;
            chip.addEventListener('click', e => {
                if (e.target.closest('.chip-del')) {
                    deleteKeyframe(k.frame);
                    emit('delkey');
                } else {
                    setPlaying(false);
                    setFrame(k.frame);
                    emit('frame');
                }
            });
            keyList.appendChild(chip);

            const marker = document.createElement('span');
            marker.className = 'key-marker';
            marker.style.left = `${(k.frame / LAST_FRAME) * 100}%`;
            keyMarkers.appendChild(marker);
        });
        if (!keys.length) keyList.innerHTML = '<span class="key-empty">no keyframes yet</span>';
    }
    keyList.querySelectorAll('.key-chip').forEach(chip => {
        chip.classList.toggle('active', Number(chip.dataset.frame) === getFrame());
    });
}

function syncFromModel() {
    const pose = getPose();
    const frame = getFrame();

    Object.entries(POSE_SLIDERS).forEach(([name, cfg]) => {
        sliders[name].value = Math.round(pose[cfg.channel] * cfg.scale);
        const out = document.querySelector(`.ctl-val[data-for="${name}"]`);
        if (out) out.textContent = valueText[name](pose);
    });

    timeline.value = frame;
    frameValue.textContent = frame;
    // The button says what it is about to do. Overwriting a key you forgot was
    // there is the one destructive thing in this lab.
    setKeyBtn.textContent = `${keyAt(frame) ? 'Replace' : 'Set'} keyframe at ${frame}`;
    playBtn.classList.toggle('playing', isPlaying());
    playBtn.setAttribute('aria-label', isPlaying() ? 'Pause animation' : 'Play animation');

    easingRow.querySelectorAll('.opt-btn').forEach(b => {
        const active = b.dataset.easing === getEasing();
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', String(active));
    });
    actorRow.querySelectorAll('.opt-btn').forEach(b => {
        const active = b.dataset.actor === getActorType();
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', String(active));
    });

    renderKeys();
    drawCurve();
}

onModelChange(syncFromModel);

/* ── motion graph ── */

let cw = 0, ch = 0;

function sizeCurve() {
    const r = curve.getBoundingClientRect();
    if (!r.width || !r.height) return;
    // Backing store in device pixels, drawing in CSS pixels: a 2px curve on a
    // stretched canvas is the difference between an instrument and a smudge.
    const dpr = Math.min(devicePixelRatio, 2);
    cw = r.width;
    ch = r.height;
    curve.width = Math.round(cw * dpr);
    curve.height = Math.round(ch * dpr);
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawCurve() {
    if (!cw) return;
    const pad = 8;
    const plotY = v => ch - pad - (clamp(v, 0, MAX_HEIGHT) / MAX_HEIGHT) * (ch - pad * 2);

    cctx.clearRect(0, 0, cw, ch);

    cctx.strokeStyle = 'rgba(255,255,255,.09)';
    cctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
        const y = (ch / 4) * i;
        cctx.beginPath();
        cctx.moveTo(0, y);
        cctx.lineTo(cw, y);
        cctx.stroke();
    }

    /* the invented line: one sample per frame, straight off the same poseAt the
       object itself is posed with, so the graph cannot disagree with the scene */
    cctx.strokeStyle = '#ff9022';
    cctx.lineWidth = 2;
    cctx.beginPath();
    for (let f = 0; f <= LAST_FRAME; f++) {
        const x = (f / LAST_FRAME) * cw;
        const y = plotY(poseAt(f).y);
        if (f === 0) cctx.moveTo(x, y);
        else cctx.lineTo(x, y);
    }
    cctx.stroke();

    /* the stored poses */
    cctx.fillStyle = '#ffda22';
    keys.forEach(k => {
        cctx.fillRect((k.frame / LAST_FRAME) * cw - 3, plotY(k.pose.y) - 3, 6, 6);
    });

    /* the playhead */
    cctx.strokeStyle = 'rgba(255,255,255,.55)';
    cctx.lineWidth = 1;
    const px = (getFrame() / LAST_FRAME) * cw;
    cctx.beginPath();
    cctx.moveTo(px, 0);
    cctx.lineTo(px, ch);
    cctx.stroke();
}

export function resizeDock() {
    sizeCurve();
    drawCurve();
}

/* ── demo support ──
   Watch demos drive the real controls, not fakes, so what the student watches is
   exactly what they are about to do. */

export function demoSetPose(name, value) {
    const cfg = POSE_SLIDERS[name];
    setPose({ [cfg.channel]: value / cfg.scale });
}

function thumbPoint(input) {
    const r = input.getBoundingClientRect();
    const t = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min));
    const thumb = 16;   // keeps the cursor on the knob at both ends of the track
    return { x: r.left + thumb / 2 + t * (r.width - thumb), y: r.top + r.height / 2 };
}

/* Viewport position of a slider's thumb, for the demo cursor to sit on. The
   timeline is a range input like the others, so it answers to the same name. */
export function sliderThumbPoint(name) {
    const input = name === 'timeline' ? timeline : sliders[name];
    return input ? thumbPoint(input) : null;
}

/* Viewport position of any dock button, for the demo cursor. */
export function buttonPoint(selector) {
    const el = dock.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

syncFromModel();
