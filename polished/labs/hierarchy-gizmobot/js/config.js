/* ═══════════════════════════════════════════════
   CONFIG
   Static constants and lesson-wide settings.
═══════════════════════════════════════════════ */
import { V3 } from './utils.js?v=selector5';

/* Intro, six guided steps, an exit check, then free play. */
export const TOTAL_BEATS = 6;
export const NUMBERED_STEPS = 5;

/* where the block waits before anyone has touched it */
export const PICKUP_POS = V3(1.6763029996544465, 3.8665722053252565, -.12);

/* the grip has to be this closed, and the fingertip this near, before the block
   is considered caught. Two thresholds, not one, so "around it" and "closed on
   it" are separate conditions - which is what the caption promises. The radius
   is measured to the block's centre, so it tracks the block's half-width: a
   palm resting on the face of the larger block still reads as near enough. */
export const GRIP_CATCH = 0.72;
export const GRIP_RELEASE = 0.28;
export const CATCH_RADIUS = 0.8;

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
export const BEAT_CAMS = ['hero', 'hero', 'hero', 'hero', 'hero', 'hero'];

/* ── the chain ──
   Display names for the scene-tree buttons and the readout header. The keys are
   the same strings the dock, the beats and the axes helper all pass around. */
export const NODE_LABELS = {
    base: 'Arm root',
    shoulder: 'Shoulder',
    elbow: 'Elbow',
    wrist: 'Wrist', mitt: 'Mitt', pointer: 'Pointer', thumb: 'Thumb',
};

/* the joint angles the lesson opens on: the arm straight up, claw open */
export const START_POSE = { base: 0, shoulder: 0, elbow: 0, wrist: 0, grip: 0, mitt: 0, pointer: 0, thumb: 0 };

/* ── pose presets ──
   Offered only in free play. Reach parks the claw on the block, so a student who
   never solved the challenge by hand can still see the pickup happen. */
export const POSE_PRESETS = {
    straight: { label: 'Straight', base: 0, shoulder: 0, elbow: 0, wrist: 0, grip: 0 },
    folded: { label: 'Folded', base: 0, shoulder: -50, elbow: 110, wrist: -65, grip: 35 },
    wave: { label: 'Wave', base: 32, shoulder: -25, elbow: -45, wrist: 65, grip: 0 },
    /* Solved against the actual three-link chain so the fingertip lands on the
       pickup station instead of merely pointing in its direction. */
    reach: { label: 'Reach', base: 0, shoulder: -65, elbow: 55, wrist: 35, grip: 80 },
};

/* how long a preset takes to travel to its pose. A snap would show none of the
   propagation this whole lab is about, so presets are always animated. */
export const PRESET_DURATION = 0.5;

// Each joint rotates at a fixed connection to its parent.
export const PARTS = ['base','shoulder','elbow','wrist','mitt','pointer','thumb'];
export const FINGER_LIMITS = { mitt:85, pointer:85, thumb:70 };
export const ROTATION_KEYS = Object.fromEntries(PARTS.map(part => [part,
    part in FINGER_LIMITS ? (part === 'thumb' ? {x:part} : {z:part}) : {
        x:part+'_x', y:part === 'base' ? part : part+'_y', z:part === 'base' ? part+'_z' : part,
    }
]));
for (const part of PARTS) {
    for (const key of Object.values(ROTATION_KEYS[part])) START_POSE[key] ??= 0;
}
export const GRASP_POS = V3(1.0, -.48, -.12);
