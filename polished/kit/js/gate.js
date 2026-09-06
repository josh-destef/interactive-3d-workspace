/* ═══════════════════════════════════════════════
   GATES
   How a step decides the student has done the thing.

   THE SPAN RULE

   A step about noticing a change unlocks on the *span* a student has driven a
   control across, not on them reaching particular values.

   This is deliberate. Gating on exact values - all three channels at 255,
   then all three at 0 - turns a step about noticing something into a
   scavenger hunt for the ends of a slider. A student who drags roughness from
   50 to 90 has already seen the thing the step is about; asking them to also
   find 0 before they may continue teaches nothing and reads as busy work. A
   confident drag in either direction is enough.

   Pick each threshold as "roughly one confident drag" - far enough that the
   change is unmistakable, nowhere near a demand for both ends of the track.

   THE OTHER RULE, from LEARNING-DESIGN.md: a demo must never satisfy its own
   gate. Call resetGates() when the student's turn begins, after the demo has
   finished moving things, or the step is already complete before they touch
   anything.
═══════════════════════════════════════════════ */

/* control key -> { min, max } of everything the student has driven it to */
let explored = {};

/* things touched at least once, for steps gated on "tried it" rather than
   "moved it far" - clicking a swatch, toggling a light */
let touched = new Set();

/** Seed a control with where it started, so the span is measured from there.

   Without this, tracking begins at the student's FIRST change rather than at
   the value the step opened on: a slider sitting at 100 that they drag to 160
   reads as a span of 0, because 100 was never recorded. The step then demands
   a second drag for no reason a student could ever work out.

   `createBeats` calls this for you through its `seeds` option, which also
   re-seeds after a demo has run and reset the gates. */
export function seedSpan(key, value) {
    explored[key] = { min: value, max: value };
}

/** Record a value, and hand back the total span covered on that control. */
export function trackSpan(key, value) {
    const seen = explored[key] || (explored[key] = { min: value, max: value });
    seen.min = Math.min(seen.min, value);
    seen.max = Math.max(seen.max, value);
    return seen.max - seen.min;
}

export function span(key) {
    const seen = explored[key];
    return seen ? seen.max - seen.min : 0;
}

/** Record that something distinct was tried; hands back how many so far. */
export function trackTried(key, value) {
    touched.add(key + ':' + String(value).toLowerCase());
    return countTried(key);
}

export function countTried(key) {
    let n = 0;
    touched.forEach(entry => { if (entry.startsWith(key + ':')) n++; });
    return n;
}

/** Clear everything. Call at the start of each beat AND after a demo runs. */
export function resetGates() {
    explored = {};
    touched = new Set();
}
