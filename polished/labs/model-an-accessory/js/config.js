/* ═══════════════════════════════════════════════
   CONFIG
   The lesson, in data: beats, copy, camera presets, and the handful of
   measured numbers everything else is placed against.

   The Gizmobot figures are measured, not eyeballed. They come from
   robot-assembly/assets/assembly-report.json, whose source mesh has the same
   sha256 as the GLB this lab loads, converted from that report's object space
   into world space with the GLB node's own transform:

       world = object * (0.979, 1.183, 1.183) + (0, 0, -0.156)

   Reading the report's numbers straight in would drop the shoulders about
   0.31 and the straps would cut through his back.
═══════════════════════════════════════════════ */
import { V3 } from '../../../kit/js/stage.js';

export const GIZMOBOT_URL = '../../../assets/models/gizmobot.glb';

/* ── beats ──
   0 is the intro and 14 the celebration, so the numbered steps a student
   sees run 1-12 - the same convention as every other lab here. */
export const BEAT = {
    INTRO: 0, ADD: 1, SIZE: 2, EDIT: 3, INSET: 4, EXTRUDE: 5, BEVEL: 6,
    DETAIL: 7, PARTS: 8, GROUP: 9, MOUNT: 10, MATERIAL: 11, ATTACH: 12,
    CHALLENGE: 13, QUIZ: 14, DONE: 15,
};
export const TOTAL_BEATS = 16;
export const NUMBERED_STEPS = 13;

/* ── measured Gizmobot ── */
export const GIZMO = {
    height: 3.317,
    torsoTop: 2.282,
    torsoBottom: 1.126,
    torsoHeight: 1.156,
    torsoHalfWidth: 0.477,
    backPlateZ: -0.412,
    /* z is negated from the measurement because the model is turned to
       face +Z on load; see gizmobot.js */
    /* The attachment port, in Gizmobot's OWN space. He is turned to face +Z on
       load, so his back plate is his local +Z; parenting the port to him means
       it turns with him and the snap keeps working at any angle. */
    portLocal: V3(0, 1.74, 0.44),
    portRadius: 0.17,
};

/* Where a new object lands: upper-back height, clear of the back plate.
   A unit cube here sits 0.09 off his back, and is already almost exactly
   torso-sized - so step 2 is "make this a pack", not "find the scale". */
export const SPAWN = V3(0, 1.80, -1.00);

/* ── camera presets ──
   He faces +Z, so every working view sits behind him at -Z. */
export const CAMS = {
    bench: { pos: V3(2.9, 2.7, -4.4), look: V3(0, 1.75, -0.55) },
    back: { pos: V3(0.2, 2.0, -4.3), look: V3(0, 1.80, -0.95) },
    side: { pos: V3(4.5, 2.1, -1.6), look: V3(0, 1.78, -0.85) },
    shoulder: { pos: V3(1.7, 2.9, -3.1), look: V3(0, 2.02, -0.45) },
    full: { pos: V3(3.4, 2.5, -6.2), look: V3(0, 1.60, -0.30) },
};

/* ── limits ──
   Every one of these is "far enough to be unmistakable, nowhere near far
   enough to make a mess a beginner cannot undo". */
export const LIMITS = {
    maxObjects: 8,
    /* Small parts such as the antenna tip need to be able to become genuinely
       tiny; the old .15 floor made the sphere and cylinder feel stuck. */
    scaleMin: 0.03,
    scaleMax: 3.0,
    extrudeMin: 0,
    extrudeMax: 0.9,
    bevelMax: 0.4,            // unit box, so this stops short of self-intersection
    segMin: 1,
    segMax: 4,
    snap: 0.05,
    insetMax: 0.38,           // an inset past this leaves a sliver, not a face
    insetMinSpan: 0.12,
    /* how close the plug has to get before the magnet takes over. Generous:
       a snap that only fires on a near-perfect drag reads as broken. */
    snapDistance: 0.42,
    mountHalfWidth: 0.40,     // the plug slides on the inner face, in local
    mountHalfHeight: 0.40,    // face coords, and cannot leave it
};

export const COLORS = ['#f2f0eb', '#ff9022', '#67bd45', '#3a91b8', '#8b5cf6', '#25303c'];

/* ── the words ──
   One `panel` string per beat, true before the demo, during it, and after.
   A student who looks away and back must not find different instructions. */
export const COPY = {
    0: {
        step: '', title: 'Gizmobot needs a back module',
        body: 'Everything here starts as one plain cube. Here is a finished one, already clipped onto his back.',
        panel: '<b>Drag with the mouse to look around this example.</b> You are going to build your own version of it, one small step at a time.',
        cta: 'Start with an empty bench',
    },
    1: {
        step: 1, title: 'Start with a cube',
        body: 'A cube is the simplest thing you can start a model from. Almost everything gets built out of one.',
        panel: '<b>Press the &#xFF0B; Cube button below.</b> A cube appears behind Gizmobot, roughly the size of his body. That is your starting block - it is not meant to look like anything yet.',
        cta: 'Watch a cube appear',
    },
    2: {
        step: 2, title: 'Make it the right size',
        body: 'Move uses coloured arrows. Scale uses coloured square handles for one direction, or the grey ring for the whole object.',
        panel: '<b>Choose Scale, then drag a coloured square handle inward to flatten the cube.</b> Switch to Move and drag an arrow if it needs repositioning. The Move, Rotate and Scale bar is the same transform family you met in the previous lesson, now shown with icons.',
        cta: 'Watch Scale and Move',
    },
    3: {
        step: 3, title: 'Two ways to work',
        body: 'Object Mode moves a whole object around. Edit Mode changes the shape it is made of. Same cube, two different jobs.',
        panel: '<b>Press Edit, then click on two different flat sides of your cube.</b> Each side lights up on its own. A flat side like that is called a <b>face</b>, and in Edit Mode you can work on one face at a time.',
        cta: 'Watch the faces light up',
    },
    4: {
        step: 4, title: 'Draw a smaller face inside',
        body: 'Inset draws a smaller face inside the face you picked. Nothing sticks out yet - you are just marking off the part you want to work on.',
        panel: '<b>Choose Inset, click the outside face of your module (the side facing you), then drag its orange corner square toward the middle.</b> Watch the orange patch shrink. That smaller patch is the piece you will pull out next.',
        cta: 'Watch a smaller face appear',
    },
    5: {
        step: 5, title: 'Pull that face out',
        body: 'Extrude pushes a face outward and builds new sides behind it. Because you inset first, only the middle part moves.',
        panel: '<b>Choose Extrude in the upper-left tool strip, then drag the arrow sticking out of the face.</b> A raised panel grows out of your module. If you had skipped the inset, the whole side would have moved and it would just look like a bigger box.',
        cta: 'Watch the panel come out',
    },
    6: {
        step: 6, title: 'Round off the sharp edges',
        body: 'Bevel rounds every edge where two faces meet. A small amount is enough to stop it looking like a plain box.',
        panel: '<b>Choose Bevel in the upper-left tool strip, then drag the orange ball at the corner of your module inward.</b> The hard edges soften as you go; a small movement is enough.',
        cta: 'Watch the edges round off',
    },
    7: {
        step: 7, title: 'Add a pocket',
        body: 'A second cube, made small and flat, reads as a pocket stuck on the front.',
        panel: '<b>Press &#xFF0B; Cube to add the pocket piece.</b> Continue unlocks as soon as it appears. You can then choose Scale to make it small and flat, and Move to place it against your module.',
        cta: 'Watch a pocket go on',
    },
    8: {
        step: 8, title: 'Add an aerial',
        body: 'Not everything is a cube. A long thin cylinder makes a good pole, and a sphere makes a ball for the top of it.',
        panel: '<b>Add one Cylinder and one Sphere.</b> Continue unlocks when both appear. You can then use Scale to make a thin pole and a small tip, and Move to arrange them as an aerial.',
        cta: 'Watch an aerial go up',
    },
    9: {
        step: 9, title: 'Join the two pieces',
        body: 'The pole and the ball are two separate objects. Grouping them makes the computer treat them as one thing.',
        panel: '<b>Click the pole, hold Shift and click the ball, then press &#xFF0B; Group.</b> They become one selectable aerial, so later transforms keep the two pieces together.',
        cta: 'Watch them join up',
    },
    10: {
        step: 10, title: 'Add the connector',
        body: 'Look at the round port on Gizmobot\'s back. Your module needs the matching half so the two can clip together.',
        panel: '<b>Select the main cube, then press &#xFF0B; Add connector.</b> A round connector appears in a safe position on the side facing Gizmobot.',
        cta: 'Watch the connector go on',
    },
    11: {
        step: 11, title: 'Give it a colour',
        body: 'Colour is a material. It changes what the surface looks like, not what shape it is.',
        panel: '<b>Click one piece of your module, then click a colour below.</b> Nothing about its shape changes—you are painting the selected piece, not modelling it.',
        cta: 'Watch it get painted',
    },
    12: {
        step: 12, title: 'Clip it on',
        body: 'The connector and his port pull together like two magnets once they are close enough.',
        panel: '<b>This step puts one Move gizmo around your complete module.</b> Choose Move and use the coloured arrows one direction at a time to bring its connector to the round port. When both rings light up, let go and it clips on.',
        cta: 'Watch it clip on',
    },
    13: {
        step: 13, title: 'Make it yours',
        body: 'Every tool is unlocked now. There is nothing to copy and no right answer.',
        panel: '<b>Make three changes of your own.</b> Reshape it, add another cube, inset and pull out a new panel, round more edges, or change the colours. The list below ticks off the kinds of change you make.',
        cta: 'Unlock everything',
    },
    14: {
        step: 'Check', title: 'What did you just learn?',
        body: 'Three questions about the ideas you used. Every answer explains itself, right or wrong.',
        panel: '<b>Answer all three.</b> Think about what changed when you switched modes, and what happened when Gizmobot turned around.',
        cta: 'Show the questions',
    },
    15: {
        step: '', title: 'He is wearing your work',
        panel: 'You built this from simple shapes: <b>two cubes, a cylinder and a sphere</b>. You reshaped, grouped, coloured and attached them as one useful model. Keep experimenting, or save it as a <b>.glb</b> file to open elsewhere.',
    },
};

/* ── what is on screen when ──
   A control arrives with the step that teaches it and never leaves. */
export const CONTROLS = {
    0: [], 1: ['add'], 2: ['add'], 3: ['add', 'mode'], 4: ['add', 'mode'],
    5: ['add', 'mode'], 6: ['add', 'mode'], 7: ['add', 'mode'], 8: ['add', 'mode'],
    9: ['add', 'mode', 'group'],
    10: ['add', 'mode', 'group', 'mount'],
    11: ['add', 'mode', 'group', 'mount', 'colour'],
    12: ['add', 'mode', 'group', 'mount', 'colour'],
    13: ['add', 'mode', 'group', 'mount', 'colour'],
    14: [],
    15: ['add', 'mode', 'group', 'mount', 'colour', 'save'],
};

/* The tool rail is viewport chrome rather than dock controls, so it gets its
   own progression. Undo is available from the moment anything can change. */
export const RAIL = {
    0: [],
    1: ['select', 'undo', 'redo'],
    2: ['select', 'move', 'rotate', 'scale', 'undo', 'redo'],
    3: ['select', 'move', 'rotate', 'scale', 'undo', 'redo'],
    4: ['select', 'move', 'rotate', 'scale', 'inset', 'undo', 'redo'],
    5: ['select', 'move', 'rotate', 'scale', 'inset', 'extrude', 'undo', 'redo'],
    6: ['select', 'move', 'rotate', 'scale', 'inset', 'extrude', 'bevel', 'undo', 'redo'],
    7: ['select', 'move', 'rotate', 'scale', 'inset', 'extrude', 'bevel', 'undo', 'redo'],
};
/* every later guided beat keeps the taught rail; Duplicate arrives when
   free play explicitly introduces it. */
for (let i = 8; i < TOTAL_BEATS; i++) RAIL[i] = RAIL[7];
RAIL[13] = [...RAIL[7].slice(0, -2), 'duplicate', 'undo', 'redo'];
RAIL[15] = RAIL[13];
RAIL[14] = [];

/* Only cubes until the antenna needs a shaft and a tip. */
export const PRIMITIVES = {
    box: { from: BEAT.ADD, label: 'Cube' },
    cylinder: { from: BEAT.PARTS, label: 'Cylinder' },
    sphere: { from: BEAT.PARTS, label: 'Sphere' },
};

export const AXIS_COLORS = { x: 0xc0453a, y: 0x2e8b2e, z: 0x3a6fa8 };
