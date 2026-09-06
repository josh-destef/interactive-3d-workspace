/* ═══════════════════════════════════════════════
   STATE
   Mutable runtime state shared across modules.
═══════════════════════════════════════════════ */
export const state = {
    /* beat flow */
    beatIdx: 0,
    beatLocked: false,   // true while a Watch demo is playing
    camLocked: false,    // true during scripted camera moves

    /* beats 0-1: the emitter spawns and recycles exactly one particle instead
       of running the pooled stream - only ever true there */
    soloMode: false,

    /* per-beat interaction tracking - reset at the top of each beat */
    lifeLow: false,          // beat 1: lifetime pushed below 0.9s
    lifeHigh: false,         // beat 1: pushed above 3.5s
    rateHigh: false,         // beat 2: rate pushed above 120
    rateLow: false,          // beat 2: brought back below 30
    speedHigh: false,        // beat 3: launch speed pushed above 6.5
    shapesTried: new Set(),  // beat 3: distinct emitter shapes selected
    gravityWasOff: false,    // beat 4: gravity turned off at least once
    gravityBackOn: false,    // beat 4: turned back on after being off
    dragHigh: false,         // beat 4: drag pushed above 0.5
    colorToggled: false,     // beat 5: color-over-life flipped at least once
    blendToggled: false,     // beat 5: blend mode flipped at least once
};
