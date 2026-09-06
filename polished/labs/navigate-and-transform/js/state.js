/* ═══════════════════════════════════════════════
   STATE
   Mutable runtime state shared across modules.
   Anything that gets reassigned during the lesson lives here so
   modules can read and write it without circular-import gymnastics.
═══════════════════════════════════════════════ */
export const state = {
    /* beat flow */
    beatIdx: 0,
    beatLocked: false,
    camLocked: false, // true during scripted animations

    /* character (assigned after the GLB loads) */
    character: null,
    characterHeight: 2.0,
    characterControlRadius: 1.0,

    /* per-beat interaction tracking - reset each beat */
    orbitAccum: 0,                  // accumulated orbit degrees (beat 1)
    zoomMin: 999,                   // closest zoom reached (beat 2)
    zoomed: false,                  // whether zoom was used at all (beat 2)
    panAccum: 0,                    // accumulated pan distance (beat 3)
    axisDrag: { x: 0, y: 0, z: 0 }, // per-axis drag distance (beats 5-7)
    axesUsed: new Set(),            // which axes dragged (beat 8)
    scaledUp: false,                // scale > 1.2 achieved (beat 9)
    scaledDown: false,              // scale < 0.85 achieved (beat 9)
    axisScaleUsed: new Set(),       // which axes stretched (beat 10)
    rotatedAxis: new Set(),         // rotated any axis (beat 11)
};
