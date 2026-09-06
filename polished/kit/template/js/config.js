/* ═══════════════════════════════════════════════
   CONFIG
   Every decision this lesson makes, in one file: the beat map, the copy, the
   camera presets, the palette, the gate thresholds.

   Keeping them here rather than scattered through the beats means the
   teaching can be reviewed as teaching - read this file top to bottom and
   you have read the lesson.
═══════════════════════════════════════════════ */
import { V3 } from '../../js/stage.js';

/* ── beat map ──
   Named, not numbered, at every call site. A lesson gets a beat inserted in
   the middle at least once, and `BEAT.SIZE` survives that where `4` does not. */
export const BEAT = {
    INTRO: 0,
    SIZE: 1,
    COLOR: 2,
    QUIZ: 3,
    DONE: 4,
};
export const TOTAL_BEATS = 5;

/* How many steps the student is told there are. Intro and celebration are not
   numbered - a student does not need "Step 1 of 5: hello". */
export const NUMBERED_STEPS = 2;

/* ── camera presets ── */
export const CAMS = {
    hero: { pos: V3(2.6, 2.4, 6.4), look: V3(0, 1, 0) },
    close: { pos: V3(1.2, 1.9, 3.9), look: V3(0, 1, 0) },
};

export const COLOR_SWATCHES = [
    '#ff9022', '#c0453a', '#ffda22', '#00aa00', '#3a6fa8', '#8b5cf6',
];

/* ── gates ──
   How far a control has to move before the step counts as done. Roughly one
   confident drag - see kit/js/gate.js for why this is a span, not a value. */
export const EXPLORE = {
    size: 45,     // out of the slider's 40..180
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
            beat opens with a card at all. Say what happens next, not "OK".
            Leave it out on a beat with nothing to agree to. */
export const COPY = {
    [BEAT.INTRO]: {
        step: '',
        title: 'Say hello to the shape',
        body: 'This is the object you will be changing. Have a look at it from every side before you start.',
        panel: '<b>Drag to orbit around it.</b> Every lesson starts with a look at the thing you are about to change.',
        cta: 'Start',
    },
    [BEAT.SIZE]: {
        step: 1,
        title: 'Make it bigger and smaller',
        body: 'Scale changes how large an object is without changing what it is. The shape stays the same; only its size changes.',
        panel: '<b>Drag the Size slider both ways.</b> Watch the shadow on the floor grow and shrink with it - that is how you can tell size changed rather than the camera moving.',
        cta: 'Watch it scale',
    },
    [BEAT.COLOR]: {
        step: 2,
        title: 'Give it a color',
        body: 'Color is part of the object’s material - the surface, not the shape. The same shape can be any color at all.',
        panel: '<b>Pick a color you like.</b> Notice the shape did not change at all. Color and form are two separate things.',
        cta: 'Pick a color',
    },
    [BEAT.QUIZ]: {
        step: 'Check',
        title: 'What did you notice?',
        body: 'Two quick questions about what just happened. A wrong answer costs nothing - the reason underneath is the part worth reading.',
        panel: '<b>Answer both questions.</b> Every answer explains itself, including the ones that are not right.',
        cta: 'Show the questions',
    },
    [BEAT.DONE]: {
        step: '',
        title: '<span class="cap-celebrate-icon">✨</span>Nicely done',
        body: '',
        panel: 'You changed an object’s <b>size</b> and its <b>color</b>, and saw that neither one changed the other. Keep playing, or head back for the next lesson.',
        cta: '',
    },
};

/* ── which controls each beat unlocks ──
   A control arrives with the step that teaches it and never before. */
export const CONTROLS = {
    [BEAT.INTRO]: [],
    [BEAT.SIZE]: ['size'],
    [BEAT.COLOR]: ['size', 'color'],
    [BEAT.QUIZ]: [],
    [BEAT.DONE]: ['size', 'color'],
};
