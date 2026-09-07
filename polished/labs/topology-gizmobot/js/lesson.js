/* ═══════════════════════════════════════════════
   THE LESSON
   Four things per beat, and the kit's beat runner does the rest:

     stage  where the camera is and what the scene looks like
     demo   what the student watches (optional)
     gate   what the student has to do before Continue appears (optional)
     copy   in config.js, because the words are the lesson

   Read this file next to config.js and you have the whole lab.
═══════════════════════════════════════════════ */
import {
    BEAT, TOTAL_BEATS, NUMBERED_STEPS, COPY, CONTROLS, CAMS, PROGRESS,
    EXPLORE, ANSWER, BUDGET,
} from './config.js';
import { values, setValue, reset, stats } from './subject.js';
import { setMeterMode, update as updateMeter } from './meter.js';
import { QUESTIONS } from './quizQuestions.js';

import { createBeats } from '../../../kit/js/beats.js';
import { runSequence, hold, tweenTo } from '../../../kit/js/anim.js';
import { trackSpan, trackTried } from '../../../kit/js/gate.js';
import {
    toggleDemoCursor, moveDemoCursor, setDemoCursorDown, centerPoint, sliderPoint,
} from '../../../kit/js/demoCursor.js';
import {
    setSegment, bindSegment, paintSlider, setSlider, setReadout,
} from '../../../kit/js/controls.js';
import { startQuiz, endQuiz } from '../../../kit/js/quiz.js';
import { celebrate, configureUI } from '../../../kit/js/ui.js';

let stage = null;
let beats = null;

const detailInput = document.querySelector('input[data-ctl="detail"]');

/* Everything the student can see about their own state, in one call. The demo
   drives the same controls the student does, so it goes through here too. */
function syncControls() {
    setSlider(detailInput, values.detail);
    setReadout('detail', values.detail);
    setSegment('structure-seg', 'structure', values.structure);
    setSegment('shading-seg', 'shading', values.shading);
    setSegment('seams-seg', 'seams', values.seams);
    updateMeter();
}

function set(key, value) {
    setValue(key, value);
    syncControls();
}

/* ══════════════════════════════════════════════
   THE DEMOS
   A demo drives the real control the student is about to use, not a
   simplified stand-in. That is the whole point of a worked example: the thing
   they watched is the thing their hand then does.
   ══════════════════════════════════════════════ */

/* Travel to a control from the middle of the screen. A cursor that simply
   appears on the thing it is about to use is a cursor nobody notices. */
function travelTo(pointOf) {
    let start = null;
    return {
        duration: 0.85,
        fn: t => {
            if (t === 0) {
                start = centerPoint();
                toggleDemoCursor(true);
                moveDemoCursor(start);
            }
            const end = pointOf();
            moveDemoCursor({
                x: start.x + (end.x - start.x) * t,
                y: start.y + (end.y - start.y) * t,
            });
        },
    };
}

function segmentPoint(id, attr, value) {
    return () => {
        const btn = document.querySelector(`#${id} [data-${attr}="${value}"]`);
        const r = btn.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
}

/* One click on a segmented button: travel, press, release, and let the value
   land halfway through so the press and the change read as one action. */
function clickSegment(id, attr, key, value) {
    return [
        travelTo(segmentPoint(id, attr, value)),
        {
            duration: 0.35, fn: t => {
                setDemoCursorDown(t < 0.6);
                if (t >= 0.5 && values[key] !== value) set(key, value);
            },
        },
    ];
}

function demoStructure(done) {
    runSequence([
        ...clickSegment('structure-seg', 'structure', 'structure', 'edges'),
        hold(1.4),
        ...clickSegment('structure-seg', 'structure', 'structure', 'points'),
        hold(1.4),
        ...clickSegment('structure-seg', 'structure', 'structure', 'surface'),
        hold(0.4),
    ], done);
}

function demoDetail(done) {
    /* tweenTo captures the starting value on the first tick, so the motion is
       the same on every machine - see anim.js for why that is not automatic. */
    const dragTo = level => tweenTo(1.5,
        () => values.detail,
        v => {
            const step = Math.round(v);
            if (step !== values.detail) set('detail', step);
            moveDemoCursor(sliderPoint(detailInput, values.detail));
        },
        level);

    runSequence([
        travelTo(() => sliderPoint(detailInput, values.detail)),
        { duration: 0.25, fn: t => { if (t === 0) setDemoCursorDown(true); } },
        dragTo(5),
        hold(1.2),
        dragTo(0),
        { duration: 0.3, fn: t => { if (t === 0) setDemoCursorDown(false); } },
        hold(0.3),
    ], done);
}

function demoShading(done) {
    runSequence([
        ...clickSegment('shading-seg', 'shading', 'shading', 'flat'),
        hold(1.6),
        ...clickSegment('shading-seg', 'shading', 'shading', 'smooth'),
        hold(0.4),
    ], done);
}

function demoSeams(done) {
    runSequence([
        ...clickSegment('seams-seg', 'seams', 'seams', 'show'),
        hold(1.8),
    ], done);
}

/* The crowd arrives rather than appearing: twelve figures fading up at full
   detail, with the meter already deep over budget, is the whole problem
   statement delivered in one shot. */
function demoCrowd(done) {
    runSequence([
        {
            duration: 1.0, fn: t => {
                if (t === 0) { set('crowd', true); stage.flyTo(CAMS.crowd); }
            },
        },
        hold(1.4),
    ], done);
}

/* ══════════════════════════════════════════════
   THE SCENE, PER BEAT
   ══════════════════════════════════════════════ */
function stageFor(idx) {
    endQuiz();
    stage.orbitCtrl.enabled = idx !== BEAT.QUIZ;
    /* The crowd needs to be seen from further back than any single-figure
       beat wants to allow. */
    stage.orbitCtrl.maxDistance = idx === BEAT.BUDGET || idx === BEAT.DONE ? 20 : 14;

    if (idx !== BEAT.BUDGET) set('crowd', false);

    switch (idx) {
        case BEAT.INTRO:
            reset();
            syncControls();
            setMeterMode('hidden');
            stage.flyTo(CAMS.hero, true);
            break;
        case BEAT.SURFACE:
            set('detail', 0);
            setMeterMode('counts');
            stage.flyTo(CAMS.head);
            break;
        case BEAT.DETAIL:
            set('structure', 'surface');
            setMeterMode('counts');
            stage.flyTo(CAMS.head);
            break;
        case BEAT.SHADING:
            set('detail', 2);
            set('structure', 'surface');
            set('shading', 'smooth');
            setMeterMode('counts');
            stage.flyTo(CAMS.head);
            break;
        case BEAT.SEAMS:
            set('detail', 0);
            set('structure', 'surface');
            set('shading', 'smooth');
            set('seams', 'hide');
            setMeterMode('seams');
            stage.flyTo(CAMS.head);
            break;
        case BEAT.BUDGET:
            /* Full detail on purpose. The student has to see the scene fail
               before they are asked to fix it. */
            set('detail', 0);
            set('structure', 'surface');
            set('seams', 'hide');
            setMeterMode('budget');
            stage.flyTo(CAMS.hero);
            break;
        case BEAT.QUIZ:
            set('detail', ANSWER);
            setMeterMode('hidden');
            stage.flyTo(CAMS.hero);
            break;
        case BEAT.DONE:
            setMeterMode('counts');
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

    configureUI({ steps: NUMBERED_STEPS, beats: TOTAL_BEATS, progress: PROGRESS });

    detailInput.addEventListener('input', () => {
        set('detail', Number(detailInput.value));
        beats.notify('detail');
    });
    bindSegment('structure-seg', 'structure', v => { set('structure', v); beats.notify('structure'); });
    bindSegment('shading-seg', 'shading', v => { set('shading', v); beats.notify('shading'); });
    bindSegment('seams-seg', 'seams', v => { set('seams', v); beats.notify('seams'); });

    document.getElementById('btn-reset-view')
        .addEventListener('click', () => stage.flyTo(values.crowd ? CAMS.crowd : CAMS.hero));

    beats = createBeats({
        total: TOTAL_BEATS,
        copy: COPY,
        controls: CONTROLS,
        stage: stageFor,
        onEnter,
        demos: {
            [BEAT.SURFACE]: demoStructure,
            [BEAT.DETAIL]: demoDetail,
            [BEAT.SHADING]: demoShading,
            [BEAT.SEAMS]: demoSeams,
            [BEAT.BUDGET]: demoCrowd,
        },
        /* Where each gated control starts, so a span is measured from the value
           the step opened on rather than from the student's first change.
           Re-applied after the demo, too. */
        seeds: {
            [BEAT.DETAIL]: () => ({ detail: values.detail }),
        },
        gates: {
            /* both of the other two views, not just a poke at one of them */
            [BEAT.SURFACE]: key => key === 'structure'
                && trackTried('structure', values.structure) >= EXPLORE.structure,
            /* a real walk down the ladder, not a nudge of one rung */
            [BEAT.DETAIL]: key => key === 'detail'
                && trackSpan('detail', values.detail) >= EXPLORE.detail,
            /* flat shading is the one that makes the point */
            [BEAT.SHADING]: key => key === 'shading'
                && trackTried('shading', values.shading) >= 1 && values.shading === 'flat',
            [BEAT.SEAMS]: key => key === 'seams' && values.seams === 'show',
            /* under budget AND still recognisable - level 5 fits and does not
               count, which is the lesson of the step */
            [BEAT.BUDGET]: key => key === 'detail'
                && stats().sceneTriangles <= BUDGET && values.detail <= ANSWER,
            /* every question answered - see onEnter */
            [BEAT.QUIZ]: key => key === 'quiz',
            /* the last beat is free play: there is nowhere to continue to, so a
               gate that never opens keeps Continue off the screen and Back to
               Home the only way out. */
            [BEAT.DONE]: () => false,
        },
    });

    paintSlider(detailInput);
    syncControls();
    beats.run(BEAT.INTRO);
}
