/* ═══════════════════════════════════════════════
   STATE
   Mutable runtime state shared across modules.
═══════════════════════════════════════════════ */
export const state = {
    /* beat flow */
    beatIdx: 0,
    beatLocked: false,   // true while a Watch demo is playing
    camLocked: false,    // true during scripted camera moves
    reading: false,      // true while the Read card is up, before the demo

    /* ── how far the student has explored this beat's control ──
       One entry per control the student has touched: the lowest and highest
       value they have driven it to. Continue unlocks on the *span* between
       those two, not on hitting particular numbers.

       This is deliberate. Gating on exact values - all three channels at 255,
       then all three at 0 - turns a step about noticing something into a
       scavenger hunt for the ends of a slider. A student who drags roughness
       from 50 to 90 has already seen the thing the step is about; asking them
       to also find 0 before they may continue teaches nothing and reads as
       busy work. A decent sweep in either direction is enough. */
    explored: {},             // control key -> { min, max }
    colorsTried: new Set(),   // color beat: distinct swatches clicked

    /* challenge */
    matchTarget: null,        // generated material the student is chasing
    matchPassed: false,       // whether a check has come back at or above pass
    matchChecks: 0,           // how many times Check match has been pressed
    hintLevel: 0,             // how many hints the student has asked for

    /* quiz */
    quizPassed: false,
};

/* Record a value the student drove a control to, and hand back the total span
   they have covered on it so far. */
export function trackSpan(key, value) {
    const seen = state.explored[key] || (state.explored[key] = { min: value, max: value });
    seen.min = Math.min(seen.min, value);
    seen.max = Math.max(seen.max, value);
    return seen.max - seen.min;
}

export function span(key) {
    const seen = state.explored[key];
    return seen ? seen.max - seen.min : 0;
}

export function resetExploration() {
    state.explored = {};
    state.colorsTried = new Set();
}
