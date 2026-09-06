/* ═══════════════════════════════════════════════
   THE CHALLENGE
   A reference Gizmobot appears next to the student's. They tune until the two
   read the same, then press Check match.

   Deliberately not live-scored. A number that ticks while you drag turns the
   exercise into "watch the readout go up", and the student stops looking at the
   shells - which was the entire skill being taught. Scoring only on submit
   keeps their eyes on the render and makes the check a real commitment.

   ── being stuck is handled, not punished ──
   The pass mark is high, so three things keep it from turning into a wall:

     1. Every check names the single property that is furthest off and which
        way to move it. One correction at a time is what a beginner can act on.
     2. Need a hint? escalates on request - first how to read the shell, then
        the property they are missing, then the reference values. The student
        decides how much help they want; nothing is pushed at them.
     3. Passing reveals the reference's real numbers next to their own, so the
        exercise ends with the answer rather than with a percentage.
═══════════════════════════════════════════════ */
import * as THREE from 'three';
import { MATCH_PASS, SUBJECT_LABEL_Y } from './config.js';
import { camera } from './stage.js';
import { values, studentRoot, targetRoot, setMatchLayout, setTargetMaterial } from './subject.js';
import { makeRandomTarget } from './matchTarget.js';
import { state } from './state.js';

const resultEl = document.getElementById('match-result');
const hintEl = document.getElementById('mr-hint');
const revealEl = document.getElementById('mr-reveal');
const hintBtn = document.getElementById('btn-hint');
const pctEl = document.getElementById('mr-pct');
const noteEl = document.getElementById('mr-note');
const labels = {
    target: document.getElementById('label-target'),
    student: document.getElementById('label-student'),
};

/* ── scoring ──
   Each property scores 100 at an exact hit and falls to 0 at a tolerance chosen
   so "visibly wrong" lands near zero and "close enough to fool the eye" stays
   near full marks. Three.js converts hex input to its linear working space, so
   compare those components directly rather than converting them a second time. */
const TOLERANCE = { color: 0.42, roughness: 34, metalness: 42 };
const WEIGHT = { color: 0.3, roughness: 0.35, metalness: 0.35 };

const scratch = new THREE.Color();

function toLinear(hex) {
    scratch.set(hex);
    return [scratch.r, scratch.g, scratch.b];
}

function colorDistance(a, b) {
    const la = toLinear(a), lb = toLinear(b);
    return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}

function scoreOne(distance, tolerance) {
    return Math.max(0, 1 - distance / tolerance) * 100;
}

export function scoreMatch() {
    const target = state.matchTarget;
    const parts = {
        color: scoreOne(colorDistance(values.color, target.color), TOLERANCE.color),
        roughness: scoreOne(Math.abs(values.roughness - target.roughness), TOLERANCE.roughness),
        metalness: scoreOne(Math.abs(values.metalness - target.metalness), TOLERANCE.metalness),
    };
    const total = Math.round(
        parts.color * WEIGHT.color +
        parts.roughness * WEIGHT.roughness +
        parts.metalness * WEIGHT.metalness
    );
    return { parts, total, target };
}

/* The single most useful sentence we can give back: name the property that is
   furthest off, and which way to move it. One correction at a time is what a
   beginner can act on. */
function buildNote({ parts, total, target }) {
    if (total >= MATCH_PASS) {
        return '<b>You matched it.</b> Here is what the random reference was actually set to:';
    }

    const worst = Object.entries(parts).sort((a, b) => a[1] - b[1])[0][0];
    let note;

    if (worst === 'metalness') {
        note = values.metalness < target.metalness
            ? '<b>Metalness is too low.</b> The reference has color in its reflections. Raise Metalness.'
            : '<b>Metalness is too high.</b> The reference has a mostly white highlight. Lower Metalness.';
    } else if (worst === 'roughness') {
        note = values.roughness < target.roughness
            ? '<b>Your surface is too smooth.</b> Your highlight is tighter and sharper than the reference. Raise roughness to spread it out.'
            : '<b>Your surface is too rough.</b> Your highlight is broader and softer than the reference. Lower roughness to pull it in.';
    } else {
        note = '<b>The color is off.</b> Compare the shaded sides, away from the bright highlights.';
    }

    // Close, and only one property away - worth saying so, because "82%" on its
    // own reads as failure when it is very nearly there.
    if (total >= MATCH_PASS - 12) {
        note += ' You are close - this is the last thing between you and a match.';
    } else if (state.matchChecks >= 2 && state.hintLevel === 0) {
        note += ' Stuck? <b>Need a hint?</b> will walk you through it.';
    }
    return note;
}

/* ── hints ──
   Three levels, each one asked for. The first teaches a way of looking, the
   second describes what to look for, and only the third gives the answer away -
   so a student can take exactly as much help as they want and no more. */
function hintFor(level) {
    const target = state.matchTarget;
    const parts = scoreMatch().parts;
    const worst = Object.entries(parts).sort((a, b) => a[1] - b[1])[0][0];

    if (level === 1) {
        return '<b>Look in this order:</b> colored or white reflection for metalness; sharp or soft reflection for roughness; then color in the shade.';
    }

    if (level === 2) {
        if (worst === 'metalness') {
            return target.metalness >= 50
                ? '<b>The reference is metal.</b> Take metalness most of the way up and see how differently the surface behaves.'
                : '<b>The reference is not metal.</b> Bring metalness back down to nothing and let the color speak for itself.';
        }
        if (worst === 'roughness') {
            const zone = target.roughness >= 70 ? 'well into the chalky end'
                : target.roughness <= 32 ? 'well into the polished end'
                    : 'somewhere around the middle of the track';
            return '<b>Roughness is the one to fix.</b> On the reference it sits ' + zone + '.';
        }
        return '<b>The color is the one to fix.</b> The reference is ' + target.hue + '.';
    }

    return '<b>The reference is ' + target.feel + '.</b> ' +
        'Use base color <b>' + target.color.toUpperCase() + '</b>, Roughness <b>' +
        (target.roughness / 100).toFixed(2) + '</b>, and Metalness <b>' +
        (target.metalness / 100).toFixed(2) + '</b>.';
}

export function nextHint() {
    if (state.hintLevel >= 3) return;
    state.hintLevel++;
    hintEl.innerHTML = hintFor(state.hintLevel);
    hintEl.classList.add('on');
    // The result panel is the hint's home, so it has to be open to hold one -
    // but without `scored` the score head stays hidden, so asking for a hint
    // before checking anything never shows the student a 0%.
    resultEl.classList.add('on');
    updateHintButton();
}

function updateHintButton() {
    if (!hintBtn) return;
    hintBtn.textContent = state.hintLevel === 0 ? 'Need a hint?'
        : state.hintLevel >= 3 ? 'No hints left'
            : 'Another hint';
    hintBtn.disabled = state.hintLevel >= 3;
}

/* ── the reveal ──
   What the reference was actually set to, next to what the student set, once
   they have earned it. The percentage says how they did; this says what the
   material was, which is the part they can carry into the next thing they
   build. */
function showReveal(target) {
    const fmt = v => (v / 100).toFixed(2);
    const chip = hex => '<i class="mrv-sw" style="background:' + hex + '"></i>' + String(hex).toUpperCase();

    document.getElementById('mrv-t-color').innerHTML = chip(target.color);
    document.getElementById('mrv-y-color').innerHTML = chip(values.color);
    document.getElementById('mrv-t-roughness').textContent = fmt(target.roughness);
    document.getElementById('mrv-y-roughness').textContent = fmt(values.roughness);
    document.getElementById('mrv-t-metalness').textContent = fmt(target.metalness);
    document.getElementById('mrv-y-metalness').textContent = fmt(values.metalness);
    revealEl.classList.add('on');
}

export function checkMatch() {
    const result = scoreMatch();
    state.matchChecks++;
    if (result.total >= MATCH_PASS) state.matchPassed = true;

    resultEl.classList.add('scored');
    pctEl.textContent = result.total;
    Object.entries(result.parts).forEach(([prop, score]) => {
        const bar = resultEl.querySelector('.mr-row[data-prop="' + prop + '"] i');
        if (bar) bar.style.width = Math.round(score) + '%';
    });
    noteEl.innerHTML = buildNote(result);
    if (result.total >= MATCH_PASS) showReveal(result.target);
    resultEl.classList.toggle('pass', result.total >= MATCH_PASS);
    resultEl.classList.add('on');
    // restart the pop so a repeat check still registers as a new answer
    resultEl.classList.remove('bump');
    void resultEl.offsetWidth;
    resultEl.classList.add('bump');

    return result;
}

export function startMatch() {
    state.matchTarget = makeRandomTarget(state.matchTarget);
    state.matchPassed = false;
    state.matchChecks = 0;
    state.hintLevel = 0;

    setTargetMaterial(state.matchTarget);
    setMatchLayout(true);
    clearResult();
    updateHintButton();
    Object.values(labels).forEach(l => l.classList.add('on'));
}

function clearResult() {
    resultEl.classList.remove('on', 'pass', 'bump', 'scored');
    hintEl.classList.remove('on');
    hintEl.innerHTML = '';
    revealEl.classList.remove('on');
}

export function endMatch() {
    setMatchLayout(false);
    clearResult();
    Object.values(labels).forEach(l => l.classList.remove('on'));
}

/* ── floating labels ──
   Projected each frame so they stay pinned to their robot while the student
   orbits. Anchored above the head rather than beside it, so the two never
   trade places when the camera swings past center. */
const worldPoint = new THREE.Vector3();

function placeLabel(root, el) {
    root.getWorldPosition(worldPoint);
    worldPoint.y += SUBJECT_LABEL_Y;
    worldPoint.project(camera);
    const x = (worldPoint.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-worldPoint.y * 0.5 + 0.5) * window.innerHeight;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    // behind the camera: z leaves [-1,1] and the projection flips
    el.style.opacity = worldPoint.z > 1 ? 0 : '';
}

export function updateMatchLabels() {
    if (!targetRoot.visible) return;
    placeLabel(targetRoot, labels.target);
    placeLabel(studentRoot, labels.student);
}
