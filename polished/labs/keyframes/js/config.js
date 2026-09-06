/* ═══════════════════════════════════════════════
   CONFIG
   Static constants and lesson-wide settings.
═══════════════════════════════════════════════ */
import { V3 } from './utils.js';

/* Intro, six guided steps, an exit check, then free play. */
export const TOTAL_BEATS = 9;
export const NUMBERED_STEPS = 6;

/* ── time ──
   A hundred frames is short enough that a student can reach any moment in one
   drag, and round enough that "frame 50" means halfway without arithmetic. */
export const LAST_FRAME = 100;

/* frames of timeline per real second. Roughly film speed, which is fast enough
   to read as motion and slow enough to see the in-betweens. */
export const PLAY_FPS = 32;

/* ── the pose ──
   Three channels. Each slider runs in whole numbers and divides down to the pose
   value, so the input's own value is always exact and nothing has to be rounded
   back out of a float. The ranges themselves live on the inputs in index.html. */
export const POSE_SLIDERS = {
    height: { channel: 'y', scale: 10 },
    turn: { channel: 'turn', scale: 1 },
    size: { channel: 'size', scale: 100 },
};

/* the pose the lesson opens on: on the floor, unturned, life size */
export const START_POSE = { y: 0, turn: 0, size: 1 };

/* the graph plots height, so it needs to know how tall the world goes */
export const MAX_HEIGHT = 6;

/* ── camera presets ── */
export const CAMS = {
    /* Three-quarter hero framing with the launch pad and height ruler both in
       view. The extra headroom also protects tall recipe poses from clipping. */
    hero: { pos: V3(8.6, 6.0, 12.5), look: V3(0, 3.4, 0) },
    /* Squared-up profile. Vertical motion is the whole lesson from step 2 on;
       the 15-unit distance frames a height-6 key plus the rocket itself. */
    side: { pos: V3(0.5, 4.8, 15), look: V3(0, 4.1, 0) },
    /* Close enough to read turn and squash, but still tall enough for the arc
       seeded into that beat. */
    close: { pos: V3(7.2, 5.0, 10.8), look: V3(0, 3.35, 0) },
};

/* which preset Reset View returns to, per beat */
export const CAM_FOR_BEAT = ['hero', 'hero', 'side', 'side', 'side', 'close', 'side', 'hero', 'hero'];

/* ── interpolation rules ──
   Three, because three is the whole vocabulary: hold, straight line, curve. */
export const EASINGS = {
    step: 'Stepped',
    linear: 'Linear',
    ease: 'Ease',
};

/* ── objects ──
   The pose is data, so swapping the object keeps the animation. That is worth a
   student seeing once. */
export const ACTORS = {
    rocket: 'Rocket',
    cube: 'Cube',
    ball: 'Ball',
};

/* ── animation recipes ──
   Finished animations to take apart in free play, not answers to copy. Each one
   leans on a different channel: bounce is height, launch is timing, spin is turn,
   squash is size. */
export const RECIPES = {
    bounce: {
        label: 'Bounce', keys: [
            { frame: 0, pose: { y: 0, turn: 0, size: 1 } },
            { frame: 25, pose: { y: 3.7, turn: 45, size: 1 } },
            { frame: 50, pose: { y: 0, turn: 90, size: 1 } },
            { frame: 75, pose: { y: 2.1, turn: 140, size: 1 } },
            { frame: 100, pose: { y: 0, turn: 180, size: 1 } },
        ],
    },
    launch: {
        label: 'Launch', keys: [
            { frame: 0, pose: { y: 0, turn: 0, size: 1 } },
            { frame: 35, pose: { y: 0, turn: 0, size: 0.85 } },
            { frame: 55, pose: { y: 1.2, turn: 0, size: 1.12 } },
            { frame: 100, pose: { y: 6, turn: 15, size: 0.75 } },
        ],
    },
    spin: {
        label: 'Spin', keys: [
            { frame: 0, pose: { y: 1, turn: 0, size: 0.8 } },
            { frame: 50, pose: { y: 3.5, turn: 180, size: 1.3 } },
            { frame: 100, pose: { y: 1, turn: 360, size: 0.8 } },
        ],
    },
    squash: {
        label: 'Squash', keys: [
            { frame: 0, pose: { y: 0, turn: 0, size: 1 } },
            { frame: 30, pose: { y: 0, turn: 0, size: 1.5 } },
            { frame: 55, pose: { y: 4.5, turn: 180, size: 0.65 } },
            { frame: 100, pose: { y: 0, turn: 360, size: 1 } },
        ],
    },
};
