/* ═══════════════════════════════════════════════
   CONFIG
   Every decision this lesson makes, in one file: the beat map, the copy, the
   camera presets, the crowd, the budget, the gate thresholds.

   One number is deliberately NOT here: the triangle and vertex counts. Those
   are read off the geometry that is actually on screen (see subject.js), so
   the meter cannot drift from the asset the way a copied-in figure would. The
   ladder itself is baked by scripts/build-topology-gizmobot.py.
═══════════════════════════════════════════════ */
import { V3 } from '../../../kit/js/stage.js';

export const MODEL_URL = 'assets/gizmobot-topology.glb';

/* ── beat map ──
   Named, not numbered, at every call site. A lesson gets a beat inserted in
   the middle at least once, and `BEAT.SEAMS` survives that where `4` does not. */
export const BEAT = {
    INTRO: 0,
    SURFACE: 1,
    DETAIL: 2,
    SHADING: 3,
    SEAMS: 4,
    BUDGET: 5,
    QUIZ: 6,
    DONE: 7,
};
export const TOTAL_BEATS = 8;

/* Intro, quiz and celebration are not numbered - a student does not need
   "Step 1 of 8: hello". */
export const NUMBERED_STEPS = 5;

/* ── camera presets ──
   Gizmobot stands 3.32 units tall, so every look sits higher than the kit
   default. `head` is close on the crown, which is where a change in triangle
   count shows first: it is the largest smooth curve on him. */
export const CAMS = {
    hero: { pos: V3(2.9, 2.7, 6.4), look: V3(0, 1.7, 0) },
    head: { pos: V3(1.5, 3.05, 3.0), look: V3(0, 2.45, 0) },
    crowd: { pos: V3(0.6, 4.9, 12.6), look: V3(0, 1.35, 0) },
};

/* ── the crowd challenge ──
   Twelve of him, and one budget for the lot. The budget is set so that exactly
   one rung is the answer: level 2 is 44,520 for the crowd and does not fit,
   level 3 is 22,260 and does, and levels 4 and 5 fit easily but have visibly
   come apart at the joints by the time you are looking at twelve of them.
   Checked on screen, not calculated - see qa/crowd-level-3.png and
   qa/crowd-level-4.png. */
export const CROWD = {
    count: 12,
    cols: 4,
    gapX: 2.55,
    gapZ: 3.1,
};
export const BUDGET = 24000;

/* The rung that both fits the budget and still holds together. Levels 4 and 5
   fit too, which is the point of the step: cheap enough is not the same as good
   enough, and the meter alone will not tell you which is which. */
export const ANSWER = 3;

/* ── gates ── */
export const EXPLORE = {
    /* both ends of the ladder, so "it looks the same" and "it fell apart" have
       both actually been seen rather than inferred from the number */
    detail: 3,
    structure: 2,     // surface plus at least one way of seeing through it
};

/* ── the copy ──
   One idea and one action per beat.

     step   the label above the title. A number, a phrase, or '' for none.
     title  the idea, as a sentence a beginner would say
     body   the Read card: one or two sentences setting the idea up
     panel  the console caption: the action, and the thing to notice.
            Written to be true before, during AND after the demo - it does
            not change when the student's turn begins.
     cta    the Read card's button, and the switch that decides whether the
            beat opens with a card at all. */
export const COPY = {
    [BEAT.INTRO]: {
        step: '',
        title: 'Meet the surface',
        body: 'Gizmobot looks solid, but he is a shell — a surface with nothing behind it. Have a good look at him before you start taking pieces out of it.',
        panel: '<b>Drag to orbit around him.</b> Nothing you can see from here tells you how much he costs to draw. That is what this lesson is about.',
        cta: 'Start',
    },
    [BEAT.SURFACE]: {
        step: 1,
        title: 'He is made of triangles',
        body: 'Every 3D surface is a mesh: corners, joined by edges, into flat triangles. The smooth curve of his head is an illusion assembled out of a few thousand flat pieces.',
        panel: '<b>Switch between Surface, Edges and Corners.</b> His shape never changes — you are only choosing how much of the structure underneath to draw.',
        cta: 'Show me the edges',
    },
    [BEAT.DETAIL]: {
        step: 2,
        title: 'Fewer triangles, same Gizmobot',
        body: 'Detail level walks down a ladder of the same model, each rung holding roughly half the triangles of the one above it. This is what a game does when a character moves away from the camera.',
        panel: '<b>Drag Detail level all the way down, then back up.</b> Watch the count fall — and watch how far it falls before his outline changes at all.',
        cta: 'Watch the count drop',
    },
    [BEAT.SHADING]: {
        step: 3,
        title: 'Shading is not geometry',
        body: 'Smooth shading blends light across the joins between triangles so the surface reads as curved. It is a trick of the lighting, not extra geometry.',
        panel: '<b>Switch to Flat, then back to Smooth.</b> Every triangle jumps out — and the count in the corner does not move. Nothing was added or taken away.',
        cta: 'Try flat shading',
    },
    [BEAT.SEAMS]: {
        step: 4,
        title: 'More corners than the shape needs',
        body: 'Two triangles meeting along an edge normally share their corners. But a texture has to be cut apart to lie flat, and along those cuts a corner gets stored twice — once for each side.',
        panel: '<b>Turn seams on.</b> Every blue corner is stored twice over. That gap is why the vertex count is higher than the shape by itself would need.',
        cta: 'Show me the seams',
    },
    [BEAT.BUDGET]: {
        step: 5,
        title: 'Twelve of him',
        body: 'A crowd shot needs twelve Gizmobots, and the whole scene has twenty-four thousand triangles to spend on all of them. Twelve of him at full detail come to a hundred and seventy-eight thousand.',
        panel: '<b>Find a level that fits the budget and still looks like Gizmobot.</b> Getting the meter to turn green is only half the job — check what it cost you.',
        cta: 'Fill the scene',
    },
    [BEAT.QUIZ]: {
        step: 'Check',
        title: 'What did you notice?',
        body: 'Three quick questions about what just happened. A wrong answer costs nothing — the reason underneath is the part worth reading.',
        panel: '<b>Answer all three.</b> Every answer explains itself, including the ones that are not right.',
        cta: 'Show the questions',
    },
    [BEAT.DONE]: {
        step: '',
        title: '<span class="cap-celebrate-icon">✨</span>Nicely done',
        body: '',
        panel: 'You found the level where Gizmobot costs an <b>eighth</b> of what he started at and still looks like himself. That judgement — how few triangles a shape can be spent on — is most of what topology is. Keep playing, or head back for the next lesson.',
        cta: '',
    },
};

/* ── which controls each beat unlocks ──
   A control arrives with the step that teaches it and never before. */
export const CONTROLS = {
    [BEAT.INTRO]: [],
    [BEAT.SURFACE]: ['structure'],
    [BEAT.DETAIL]: ['structure', 'detail'],
    [BEAT.SHADING]: ['structure', 'detail', 'shading'],
    [BEAT.SEAMS]: ['structure', 'detail', 'shading', 'seams'],
    /* No Edges or Corners here: the overlays hang off the single figure, and
       twelve wireframes at full detail is half a million line segments. The
       challenge is about the count and the silhouette anyway. */
    [BEAT.BUDGET]: ['detail', 'shading'],
    [BEAT.QUIZ]: [],
    [BEAT.DONE]: ['structure', 'detail', 'shading', 'seams'],
};

/* ── the progress bar ──
   Optional beats would distort an evenly-divided bar; a map keeps it tracking
   the main course. */
export const PROGRESS = {
    [BEAT.INTRO]: 0,
    [BEAT.SURFACE]: 14,
    [BEAT.DETAIL]: 32,
    [BEAT.SHADING]: 50,
    [BEAT.SEAMS]: 66,
    [BEAT.BUDGET]: 82,
    [BEAT.QUIZ]: 93,
    [BEAT.DONE]: 100,
};
