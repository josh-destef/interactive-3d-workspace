/* ═══════════════════════════════════════════════
   CONFIG
   Static constants and lesson-wide settings.
═══════════════════════════════════════════════ */
import { V3 } from './utils.js';

/* ── beat map ──
   Six main beats are numbered steps. RGB beats are optional side activities.
   their own labels. */
export const BEAT = {
    INTRO: 0,
    COLOR: 1,
    RGB_OFFER: 2,
    RGB_WATCH: 3,
    RGB_MIX: 4,
    RGB_RETURN: 5,
    ROUGHNESS: 6,
    METALNESS: 7,
    LIGHT: 8,
    EMISSIVE: 9,
    BODY_GLOW: 10,
    CHALLENGE: 11,
    RGB_CHALLENGE_OFFER: 12,
    RGB_CHALLENGE: 13,
    DONE: 14,
};
export const TOTAL_BEATS = 15;
export const NUMBERED_STEPS = 6;

/* the subject sits here; every camera preset looks at it */
export const SUBJECT_Y = 1.35;
export const SUBJECT_LABEL_Y = 2.62;
export const MODEL_SCALE = 0.72;

/* how far apart the two identically posed Gizmobots sit in the challenge */
export const MATCH_SPREAD = 1.72;

/* ── camera presets ──
   These aim at Gizmobot; lifting the subject clear of the console is
   the projection's job (see setBandOffset in stage.js), not a fudged look-at. */
export const CAMS = {
    /* three-quarter hero framing - a lit side, a shaded side, and the
       terminator between them, which is where roughness reads most clearly */
    hero: { pos: V3(2.8, 2.75, 7.0), look: V3(0, SUBJECT_Y, 0) },
    /* head-and-shoulders framing makes highlight width and color easy to read */
    close: { pos: V3(0.9, 2.45, 3.8), look: V3(0, 2.02, 0) },
    /* pulled back and squared up so both robots read at the same angle */
    match: { pos: V3(0, 3.0, 10.2), look: V3(0, SUBJECT_Y, 0) },
};

/* ── material examples ──
   The 2x2 a beginner needs: rough/smooth crossed with metal/not-metal, plus a
   third of each so no single reading ever generalises from one example.

   Metal colors are measured reflectances converted to sRGB, which is why gold
   is a pale straw rather than the deep yellow people reach for. Under an
   environment map that renders as convincing gold; the deep yellow renders as
   a dirty brass. Values are 0-100 to match the slider inputs directly.

   These are quick starting points for comparison and free play. Challenge
   references are generated independently rather than selected from this set. */
export const MATERIAL_EXAMPLES = {
    clay: {
        label: 'Clay', color: '#c66f48', roughness: 82, metalness: 0,
    },
    plastic: {
        label: 'Plastic', color: '#ff9022', roughness: 30, metalness: 0,
    },
    rubber: {
        label: 'Rubber', color: '#22252b', roughness: 95, metalness: 0,
    },
    chrome: {
        label: 'Chrome', color: '#d8e0e8', roughness: 8, metalness: 100,
    },
    copper: {
        label: 'Copper', color: '#fad1c2', roughness: 30, metalness: 100,
    },
    brushed: {
        label: 'Brushed metal', color: '#c5c7c8', roughness: 58, metalness: 100,
    },
};

/* Quick colors make the first step immediate. RGB takes over once the learner
   is ready to mix a color rather than choose one. */
export const COLOR_SWATCHES = [
    '#ff9022', '#c0453a', '#ffda22', '#00aa00', '#3a6fa8', '#8b5cf6',
    '#c66f48', '#22252b', '#ffdb93', '#fad1c2', '#c5c7c8', '#f2f0eb',
];

/* a match at or above this score unlocks Continue. It is a high bar on
   purpose - but the challenge hands out escalating hints on request, and shows
   the reference's real numbers once the student gets there, so the bar is
   something to be talked toward rather than guessed at. */
export const MATCH_PASS = 85;

/* The light stays fixed while material properties are introduced, then becomes
   its own comparison once those properties are understood. */
export const LIGHT_START = 38;
export const LIGHT_RANGE = { min: -180, max: 180 };
export const LIGHT_COLORS = {
    candle: { label: 'Candle', value: '#ffb36b' },
    warm: { label: 'Warm', value: '#ffd3a5' },
    neutral: { label: 'Neutral', value: '#fff1df' },
    daylight: { label: 'Daylight', value: '#ffffff' },
    cool: { label: 'Cool', value: '#d8e7ff' },
};

/* the material the lesson opens on: mid roughness, no metal, plain gray. It
   deliberately looks like nothing in particular, so every change reads. */
export const START_MATERIAL = { color: '#f2f0eb', roughness: 50, metalness: 0, emissive: 0 };

/* ── how much exploring unlocks Continue ──
   The span a student has to cover on a step's control before the step counts
   as done. Each one is roughly "a confident drag" - enough movement that the
   change on the shell is unmistakable, and nowhere near a demand for both
   ends of the track. See state.js for why this is a span and not a value. */
export const EXPLORE = {
    rgb: 70,          // out of 255, on any one channel
    roughness: 30,    // out of 100
    metalness: 35,    // out of 100
    light: 70,        // out of 320 degrees
    emissive: 30,     // out of 100
};
