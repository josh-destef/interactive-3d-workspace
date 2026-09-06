/* ═══════════════════════════════════════════════
   CONFIG
   Static constants and lesson-wide settings.
═══════════════════════════════════════════════ */
import { V3 } from './utils.js';

/* Intro, six guided steps, an exit check, then free play. */
export const TOTAL_BEATS = 9;
export const NUMBERED_STEPS = 6;

/* ── camera presets ── */
export const CAMS = {
    /* default framing - the whole fountain, with room to orbit around it */
    hero: { pos: V3(7, 4.5, 8), look: V3(0, 2, 0) },
    /* pushed in tight for the single-particle intro, where one dot has to
       fill the frame */
    solo: { pos: V3(4.5, 2.8, 5.5), look: V3(0, 1.6, 0) },
    /* pulled back for high rates and bursts, so the plume stays in frame
       instead of blowing past the edges of the canvas */
    wide: { pos: V3(9, 5.5, 10), look: V3(0, 2.6, 0) },
};

/* ── simulation constants ── */
export const GRAVITY = 7.4;
export const POOL = 600;
export const PARTICLE_SIZE = 0.12;
/* drawn larger in solo mode - a single dot at normal size is hard to see */
export const SOLO_PARTICLE_SIZE = 0.3;

/* the lesson opens on a slow, countable stream once the single-particle intro
   hands off - fast enough to feel alive, slow enough to count by eye */
export const START_PARAMS = {
    life: 2.0, rate: 8, speed: 4.0, drag: 0.2,
    gravity: true, colorLife: true, additive: false, shape: 'cone',
};

/* ── beat 6 challenge thresholds ── */
export const CHALLENGE_LIVE_MIN = 80;
export const CHALLENGE_LIVE_MAX = 220;
export const CHALLENGE_DRAG_MIN = 0.1;
export const CHALLENGE_DRAG_MAX = 0.5;
/* the state must hold this long before Continue unlocks, so a passing score
   that flickers by on the way past does not count */
export const CHALLENGE_HOLD_MS = 1200;
