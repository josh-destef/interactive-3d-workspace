/* ═══════════════════════════════════════════════
   READOUT
   The live/pool/oldest/blend card and the budget equation. Revealed at beat 2
   and kept for the rest of the lesson; the beat 6 challenge repurposes the
   same card as a live checklist.
═══════════════════════════════════════════════ */
import { getLive, getOldest, getPoolFrac, params } from './particles.js';
import { state } from './state.js';
import { showContinue } from './ui.js';
import {
    CHALLENGE_LIVE_MIN, CHALLENGE_LIVE_MAX,
    CHALLENGE_DRAG_MIN, CHALLENGE_DRAG_MAX, CHALLENGE_HOLD_MS,
} from './config.js';

const readoutEl = document.getElementById('readout');
const liveEl = document.getElementById('ro-live');
const poolEl = document.getElementById('ro-pool');
const oldestEl = document.getElementById('ro-oldest');
const blendEl = document.getElementById('ro-blend');
const budgetEl = document.getElementById('ro-budget');
const statusEl = document.getElementById('ro-status');
const checkRows = {
    count: document.querySelector('#ro-checklist [data-cond="count"]'),
    gravity: document.querySelector('#ro-checklist [data-cond="gravity"]'),
    color: document.querySelector('#ro-checklist [data-cond="color"]'),
    drag: document.querySelector('#ro-checklist [data-cond="drag"]'),
    shape: document.querySelector('#ro-checklist [data-cond="shape"]'),
};

export function showReadout(on) {
    readoutEl.classList.toggle('on', !!on);
}

export function showChecklist(on) {
    readoutEl.classList.toggle('show-checklist', !!on);
}

export function resetChallenge() {
    holdMs = 0;
    Object.values(checkRows).forEach(el => el.classList.remove('met'));
    statusEl.textContent = 'Tune the emitter';
}

/* Retargeting four DOM nodes every frame while a particle system runs is
   exactly the wrong place to spend the frame budget - the numbers only need
   to look live, not literally be live. */
let acc = 1;   // starts ready so the first frame populates the card instead of a blank flash
export function tickReadout(dt) {
    acc += dt;
    if (acc < 0.125) return;
    acc = 0;
    liveEl.textContent = getLive();
    poolEl.textContent = `${Math.round(getPoolFrac() * 100)}%`;
    oldestEl.textContent = `${getOldest().toFixed(1)} s`;
    blendEl.textContent = params.additive ? 'additive' : 'alpha';
    budgetEl.innerHTML =
        `rate ${Math.round(params.rate)} /s &times; lifetime ${params.life.toFixed(1)} s ` +
        `&asymp; ${Math.round(params.rate * params.life)} alive`;
}

/* ── beat 6 challenge ──
   Called every frame while the challenge beat is active, since "live" moves
   on its own between control changes. Holding the full state for
   CHALLENGE_HOLD_MS - not just touching it once - is what stops a passing
   score flickering by on the way past from counting. */
let holdMs = 0;
export function tickChallenge(dt) {
    const live = getLive();
    const okCount = live >= CHALLENGE_LIVE_MIN && live <= CHALLENGE_LIVE_MAX;
    const okGravity = params.gravity;
    const okColor = params.colorLife;
    const okDrag = params.drag >= CHALLENGE_DRAG_MIN && params.drag <= CHALLENGE_DRAG_MAX;
    const okShape = params.shape === 'cone';
    const allOk = okCount && okGravity && okColor && okDrag && okShape;

    checkRows.count.classList.toggle('met', okCount);
    checkRows.gravity.classList.toggle('met', okGravity);
    checkRows.color.classList.toggle('met', okColor);
    checkRows.drag.classList.toggle('met', okDrag);
    checkRows.shape.classList.toggle('met', okShape);

    holdMs = allOk ? holdMs + dt * 1000 : 0;

    if (live < CHALLENGE_LIVE_MIN) statusEl.textContent = 'Increase rate or lifetime';
    else if (live > CHALLENGE_LIVE_MAX) statusEl.textContent = 'Reduce rate or lifetime';
    else if (!okGravity || !okColor || !okDrag || !okShape) statusEl.textContent = 'Check shape, gravity, colour and drag';
    else statusEl.textContent = 'Holding — nice fountain';

    if (allOk && holdMs >= CHALLENGE_HOLD_MS && !state.beatLocked) showContinue();
}
