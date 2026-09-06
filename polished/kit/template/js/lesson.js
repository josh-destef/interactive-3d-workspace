/* ═══════════════════════════════════════════════
   THE LESSON
   Four things per beat, and the kit's beat runner does the rest:

     stage  where the camera is and what the scene looks like
     demo   what the student watches (optional)
     gate   what the student has to do before Continue appears (optional)
     copy   in config.js, because the words are the lesson

   Read this file next to config.js and you have the whole lab.
═══════════════════════════════════════════════ */
import { BEAT, TOTAL_BEATS, COPY, CONTROLS, CAMS, COLOR_SWATCHES, EXPLORE } from './config.js';
import { values, setValue, reset } from './subject.js';
import { QUESTIONS } from './quizQuestions.js';

import { createBeats } from '../../js/beats.js';
import { runSequence, hold, tweenTo } from '../../js/anim.js';
import { trackSpan, trackTried } from '../../js/gate.js';
import {
    toggleDemoCursor, moveDemoCursor, setDemoCursorDown, centerPoint, sliderPoint,
} from '../../js/demoCursor.js';
import {
    buildSwatches, markActiveSwatch, paintSlider, setSlider, setReadout,
} from '../../js/controls.js';
import { startQuiz, endQuiz } from '../../js/quiz.js';
import { celebrate, configureUI } from '../../js/ui.js';

let stage = null;
let beats = null;

/* ── the controls ── */
const sizeInput = document.querySelector('input[data-ctl="size"]');

function syncControls() {
    setSlider(sizeInput, values.size);
    setReadout('size', (values.size / 100).toFixed(2));
    markActiveSwatch('swatches', values.color);
}

/* ══════════════════════════════════════════════
   THE DEMO
   A demo drives the real control the student is about to use - not a
   simplified stand-in. That is the whole point of a worked example: the thing
   they watched is the thing their hand then does.
   ══════════════════════════════════════════════ */
function demoSize(done) {
    /* Drag the slider to a value, moving the cursor with the thumb. tweenTo
       captures the starting value on the first tick, so the motion is the
       same on every machine - see anim.js for why that is not automatic. */
    const dragTo = value => tweenTo(1.1,
        () => values.size,
        v => {
            setValue('size', Math.round(v));
            syncControls();
            moveDemoCursor(sliderPoint(sizeInput, values.size));
        },
        value);

    /* Travel to the control from the middle of the screen. A cursor that
       simply appears on the slider is a cursor nobody notices. */
    let start = null;
    const travel = {
        duration: 0.85,
        fn: t => {
            if (t === 0) {
                start = centerPoint();
                toggleDemoCursor(true);
                moveDemoCursor(start);
            }
            const end = sliderPoint(sizeInput, values.size);
            moveDemoCursor({
                x: start.x + (end.x - start.x) * t,
                y: start.y + (end.y - start.y) * t,
            });
        },
    };

    runSequence([
        travel,
        { duration: 0.25, fn: t => { if (t === 0) setDemoCursorDown(true); } },
        dragTo(170),
        hold(0.5),
        dragTo(55),
        hold(0.5),
        dragTo(100),
        { duration: 0.3, fn: t => { if (t === 0) setDemoCursorDown(false); } },
    ], done);
}

/* ══════════════════════════════════════════════
   THE SCENE, PER BEAT
   ══════════════════════════════════════════════ */
function stageFor(idx) {
    endQuiz();
    stage.orbitCtrl.enabled = idx !== BEAT.QUIZ;

    switch (idx) {
        case BEAT.INTRO:
            reset();
            syncControls();
            stage.flyTo(CAMS.hero, true);
            break;
        case BEAT.SIZE:
            stage.flyTo(CAMS.hero);
            break;
        case BEAT.COLOR:
            stage.flyTo(CAMS.close);
            break;
        case BEAT.QUIZ:
            stage.flyTo(CAMS.hero);
            break;
        case BEAT.DONE:
            stage.flyTo(CAMS.hero);
            break;
    }
}

function onEnter(idx) {
    /* The quiz reports completion the same way every other control reports a
       change - through notify - so the gate below stays the one place that
       decides when Continue appears. */
    if (idx === BEAT.QUIZ) startQuiz(QUESTIONS, () => beats.notify('quiz'));
    if (idx === BEAT.DONE) celebrate();
}

/* ══════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════ */
export function startLesson(createdStage) {
    stage = createdStage;

    configureUI({
        steps: 2,
        beats: TOTAL_BEATS,
        /* Optional beats would distort an evenly-divided bar; a map keeps the
           bar tracking the main course. */
        progress: {
            [BEAT.INTRO]: 0,
            [BEAT.SIZE]: 30,
            [BEAT.COLOR]: 62,
            [BEAT.QUIZ]: 85,
            [BEAT.DONE]: 100,
        },
    });

    buildSwatches('swatches', COLOR_SWATCHES, hex => {
        setValue('color', hex);
        syncControls();
        beats.notify('color');
    });

    sizeInput.addEventListener('input', () => {
        setValue('size', Number(sizeInput.value));
        syncControls();
        beats.notify('size');
    });

    document.getElementById('btn-reset-view')
        .addEventListener('click', () => stage.flyTo(CAMS.hero));

    beats = createBeats({
        total: TOTAL_BEATS,
        copy: COPY,
        controls: CONTROLS,
        stage: stageFor,
        onEnter,
        demos: {
            [BEAT.SIZE]: demoSize,
        },
        /* Where each gated control starts, so the span below is measured from
           the value the step opened on rather than from the student's first
           change. Re-applied after the demo, too. */
        seeds: {
            [BEAT.SIZE]: () => ({ size: values.size }),
        },
        gates: {
            /* a confident drag in either direction, not both ends of the track */
            [BEAT.SIZE]: key => key === 'size'
                && trackSpan('size', values.size) >= EXPLORE.size,
            /* one deliberate choice is the whole point of the step */
            [BEAT.COLOR]: key => key === 'color'
                && trackTried('color', values.color) >= 1,
            /* every question answered - see onEnter */
            [BEAT.QUIZ]: key => key === 'quiz',
            /* the last beat is free play: there is nowhere to continue to, so
               a gate that never opens keeps Continue off the screen and Back
               to Home the only way out. */
            [BEAT.DONE]: () => false,
        },
    });

    paintSlider(sizeInput);
    syncControls();
    beats.run(BEAT.INTRO);
}
