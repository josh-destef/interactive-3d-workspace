/* ═══════════════════════════════════════════════
   CONFIG
   Static constants and lesson-wide settings.
═══════════════════════════════════════════════ */
import { V3 } from './utils.js';

/* Intro, six guided steps, an exit check, then free play. */
export const TOTAL_BEATS = 9;
export const NUMBERED_STEPS = 6;

/* where the block waits before anyone has touched it */
export const PICKUP_POS = V3(2.75, 3.15, 0);

/* the grip has to be this closed, and the fingertip this near, before the block
   is considered caught. Two thresholds, not one, so "around it" and "closed on
   it" are separate conditions - which is what the caption promises. */
export const GRIP_CATCH = 0.72;
export const GRIP_RELEASE = 0.28;
export const CATCH_RADIUS = 0.62;

/* camera presets */
export const CAMS = {
    /* three-quarter framing that reads the whole chain from pedestal to claw */
    hero: { pos: V3(8, 6, 9), look: V3(0, 2.4, 0) },
    /* pulled back for the base sweep, which throws the claw a long way sideways
       and would otherwise leave the frame at both ends of the swing */
    wide: { pos: V3(9.5, 5.5, 10.5), look: V3(0, 2.6, 0) },
    /* pushed in for the joint steps, where the thing to watch is one hinge */
    arm: { pos: V3(5.5, 4.6, 7), look: V3(0, 2.8, 0) },
    /* offset toward the block so the arm and its target share the frame */
    reach: { pos: V3(6.5, 5.2, 7.5), look: V3(1.2, 3.0, 0) },
};

/* Which preset each beat lives at, so Reset View returns the student to the
   framing their step was written for rather than always to the hero shot. */
export const BEAT_CAMS = ['hero', 'wide', 'arm', 'arm', 'arm', 'arm', 'reach', 'hero', 'hero'];

/* ── the chain ──
   Display names for the scene-tree buttons and the readout header. The keys are
   the same strings the dock, the beats and the axes helper all pass around. */
export const NODE_LABELS = {
    base: 'Base',
    shoulder: 'Shoulder',
    elbow: 'Elbow',
    wrist: 'Wrist',
};

/* the joint angles the lesson opens on: the arm straight up, claw open */
export const START_POSE = { base: 0, shoulder: 0, elbow: 0, wrist: 0, grip: 0 };

/* ── pose presets ──
   Offered only in free play. Reach parks the claw on the block, so a student who
   never solved the challenge by hand can still see the pickup happen. */
export const POSE_PRESETS = {
    straight: { label: 'Straight', base: 0, shoulder: 0, elbow: 0, wrist: 0, grip: 0 },
    folded: { label: 'Folded', base: 0, shoulder: -50, elbow: 110, wrist: -65, grip: 35 },
    wave: { label: 'Wave', base: 32, shoulder: -25, elbow: -45, wrist: 65, grip: 0 },
    /* Solved against the actual three-link chain so the fingertip lands on the
       pickup station instead of merely pointing in its direction. */
    reach: { label: 'Reach', base: 0, shoulder: -98, elbow: 56, wrist: 69, grip: 80 },
};

/* how long a preset takes to travel to its pose. A snap would show none of the
   propagation this whole lab is about, so presets are always animated. */
export const PRESET_DURATION = 0.5;
