/* ═══════════════════════════════════════════════
   STATE
   Mutable runtime state shared across modules.
═══════════════════════════════════════════════ */
export const state = {
    /* beat flow */
    beatIdx: 0,
    beatLocked: false,   // true while a Watch demo is playing
    camLocked: false,    // true during scripted camera moves

    /* per-beat interaction tracking - reset at the top of each beat */
    playPressed: false,       // beat 2: play has been pressed at least once
    scrubbedFrames: new Set(),// beat 3: distinct in-between frames visited
    easingsTried: new Set(),  // beat 4: interpolation rules the student clicked

    /* Cleared by any edit to the keyframes, so the challenge asks the student to
       watch the animation they actually finished rather than an earlier one. */
    playedSinceEdit: false,
};
