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
    baseLeft: false,          // beat 1: base pushed past -40
    baseRight: false,         // beat 1: base pushed past +40
    shoulderBack: false,      // beat 2: shoulder pushed past -50
    shoulderFwd: false,       // beat 2: shoulder pushed past +50
    travel: {},               // beat 3: min/max seen per joint, to measure a sweep
    nodesTried: new Set(),    // beat 4: distinct tree nodes selected
    wristTurned: false,       // beat 5: wrist taken 30 degrees off centre
    gripClosed: false,        // beat 5: grip taken above 70
    gripOpened: false,        // beat 5: and brought back below 30
    pickupTold: false,        // beat 6: the reparenting caption has been shown
};
