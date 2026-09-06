/* ═══════════════════════════════════════════════
   BEAT SYSTEM
   Each idea uses one learner-paced rhythm: read it, watch it, try it.

   The first act builds a surface: color, RGB, roughness and metalness. The
   second shows how light and emissive affect what the learner sees. The
   challenge combines those observations under one shared light.
═══════════════════════════════════════════════ */
import { BEAT, TOTAL_BEATS, MATCH_PASS, START_MATERIAL, LIGHT_START, EXPLORE } from './config.js';
import { state, trackSpan, span, resetExploration } from './state.js';
import {
    setCam, releaseCamera, orbitCtrl, setKeyAzimuth, setRoomLights,
    setLightOrbVisible, lightOrbScreenPoint,
} from './stage.js';
import { runSequence, clearAnims } from './anim.js';
import { lerp, hexToRgb } from './utils.js';
import { values, resetValues, setValues } from './subject.js';
import { startMatch, endMatch, checkMatch, nextHint } from './match.js';
import { startQuiz, endQuiz } from './quiz.js';
import {
    revealControls, hideDock, lockDock, flashControl,
    demoSetSlider, demoSetRGB, demoSetLight, demoSetLightColor, demoSetRoom,
    sliderThumbPoint, rgbThumbPoint, swatchPoint, roomPoint,
    rgbChannels, syncFromValues, syncLight, syncRoom,
} from './controls.js';
import {
    toggleDemoCursor, moveDemoCursor, setDemoCursorDown, getDemoCursorPoint, centerPoint,
} from './demoCursor.js';
import {
    setCaption, setMode, showWatch, hideWatch, showContinue, hideContinue,
    setProgress, showFinishButton, showReadCard, dismissReadCard, readCardOpen,
} from './ui.js';

/* ── demo building blocks ── */
function cursorTo(getPoint, duration = 0.55) {
    let from = null;
    return {
        duration,
        fn: t => {
            const to = getPoint();
            if (!to) return;
            if (t === 0 || !from) from = { ...getDemoCursorPoint() };
            moveDemoCursor({ x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) });
        },
    };
}

function dragSlider(key, from, to, duration = 1.5) {
    return {
        duration,
        fn: t => {
            if (t === 0) setDemoCursorDown(true);
            demoSetSlider(key, Math.round(lerp(from, to, t)));
            moveDemoCursor(sliderThumbPoint(key));
        },
    };
}

function dragRGB(ch, from, to, duration = 0.8) {
    return {
        duration,
        fn: t => {
            if (t === 0) setDemoCursorDown(true);
            demoSetRGB(ch, Math.round(lerp(from, to, t)));
            moveDemoCursor(rgbThumbPoint(ch));
        },
    };
}

function dragLight(from, to, duration = 1.6) {
    return {
        duration,
        fn: t => {
            if (t === 0) setDemoCursorDown(true);
            demoSetLight(Math.round(lerp(from, to, t)));
            moveDemoCursor(lightOrbScreenPoint());
        },
    };
}

function hold(getPoint, duration = 0.9) {
    return {
        duration,
        fn: t => {
            if (t === 0) setDemoCursorDown(false);
            if (getPoint) moveDemoCursor(getPoint());
        },
    };
}

function clickSwatch(hex, duration = 0.55) {
    return {
        duration,
        fn: t => {
            if (t === 0) {
                setDemoCursorDown(true, 'click');
                setValues({ color: hex });
                syncFromValues();
            }
            if (t > 0.6) setDemoCursorDown(false);
        },
    };
}

function clickRoom(on, duration = 0.55) {
    return {
        duration,
        fn: t => {
            if (t === 0) {
                setDemoCursorDown(true, 'click');
                demoSetRoom(on);
            }
            if (t > 0.6) setDemoCursorDown(false);
        },
    };
}

function playDemo(steps, { camKey = 'hero', release = 'hero', first = null } = {}) {
    orbitCtrl.enabled = false;
    state.beatLocked = true;
    state.camLocked = true;
    lockDock(true);
    showWatch();
    setCam(camKey);

    const intro = [
        {
            duration: 0.8,
            fn: t => {
                if (t === 0) {
                    toggleDemoCursor(true);
                    setDemoCursorDown(false);
                    moveDemoCursor(centerPoint());
                }
            },
        },
        cursorTo(() => (first ? first() : centerPoint()), 1),
        { duration: 0.35, fn: () => { if (first) moveDemoCursor(first()); } },
    ];

    runSequence(intro.concat(steps), () => {
        toggleDemoCursor(false);
        setDemoCursorDown(false);
        lockDock(false);
        releaseCamera(release);
        hideWatch();
        state.beatLocked = false;
    });
}

/* ── one idea and one action per beat ── */
const COPY = {
    [BEAT.INTRO]: {
        step: '',
        title: 'One model, many surfaces',
        body: 'Gizmobot’s mesh gives it shape. Materials control how each surface looks under light.',
        panel: '<b>Drag to orbit.</b> Find the shell, fixed details and face glow.',
        cta: 'Start the lab',
    },
    [BEAT.COLOR]: {
        step: 1,
        title: 'Start with color',
        body: 'Base color changes the shell paint. The bright highlight comes from the light, not from the color picker.',
        panel: '<b>Choose two swatches.</b> Watch only Shell Paint change while the details stay fixed.',
        cta: 'Show me',
    },
    [BEAT.RGB]: {
        step: 2,
        title: 'Mix a color',
        body: 'Screens mix red, green and blue light. Equal amounts make a gray; different amounts make a color.',
        panel: '<b>Move one RGB slider.</b> Then adjust another until you make a color you like.',
        cta: 'Show me',
    },
    [BEAT.ROUGHNESS]: {
        step: 3,
        title: 'Sharp or soft reflections',
        body: 'Roughness controls how spread out a reflection becomes: low is sharp and polished; high is broad and chalky.',
        panel: '<b>Sweep Roughness.</b> Compare one sharp highlight with one soft highlight.',
        cta: 'Show me',
    },
    [BEAT.METALNESS]: {
        step: 4,
        title: 'Metal or not metal',
        body: 'Every surface reflects. Metal uses its base color to tint reflections; non-metal keeps color beneath a mostly neutral highlight.',
        panel: '<b>Move Metalness from 0 to 1.</b> Compare colored plastic with a tinted mirror.',
        cta: 'Show me',
    },
    [BEAT.LIGHT]: {
        step: 5,
        title: 'Materials need light',
        body: 'Moving or recolouring a light changes what you see without changing the material.',
        panel: '<b>Drag the glowing orb.</b> Follow the shell highlight and floor shadow around Gizmobot.',
        cta: 'Show me',
    },
    [BEAT.EMISSIVE]: {
        step: 6,
        title: 'Visible in the dark',
        body: 'Emissive color stays visible without scene light. It looks self-lit, but does not automatically light nearby objects.',
        panel: '<b>Raise Glow, then turn the room lights off.</b> Watch only the eyes and mouth stay visible.',
        cta: 'Show me',
    },
    [BEAT.CHALLENGE]: {
        step: 'Challenge',
        title: 'Match the reference',
        body: 'Both robots share one pose and light. Check reflection color, highlight softness, then shell color.',
        panel: '<b>Match the reference, then press Check match.</b> Reach ' + MATCH_PASS + '%. Use a hint whenever you need one.',
        cta: 'Start the challenge',
    },
    [BEAT.QUIZ]: {
        step: 'Check what you learned',
        title: 'Four quick questions',
        body: 'Choose an answer. If it misses, the explanation helps you try again.',
    },
    [BEAT.DONE]: {
        step: 'Done',
        title: '<span class="cap-celebrate-icon">&#127881;</span>You built a material',
        body: 'You can now separate surface color, reflection softness, metal response, lighting and emissive.',
        panel: '<b>Try an example, then change one setting.</b> Say what changed before touching the next control.',
        cta: 'Play with everything',
    },
};

const CONTROLS = {
    [BEAT.INTRO]: [],
    [BEAT.COLOR]: ['color'],
    [BEAT.RGB]: ['rgb'],
    [BEAT.ROUGHNESS]: ['rgb', 'roughness'],
    [BEAT.METALNESS]: ['rgb', 'roughness', 'metalness'],
    [BEAT.LIGHT]: ['rgb', 'roughness', 'metalness', 'examples', 'light', 'light-color'],
    [BEAT.EMISSIVE]: ['rgb', 'roughness', 'metalness', 'examples', 'light', 'emissive', 'room'],
    [BEAT.CHALLENGE]: ['rgb', 'roughness', 'metalness', 'examples', 'check'],
    [BEAT.QUIZ]: [],
    [BEAT.DONE]: ['color', 'rgb', 'roughness', 'metalness', 'examples', 'light', 'light-color', 'emissive', 'room'],
};

export function runBeat(idx, { skipRead = false } = {}) {
    state.beatIdx = idx;
    state.beatLocked = false;
    state.reading = false;
    hideContinue();
    setMode(null);
    clearAnims();
    toggleDemoCursor(false);
    lockDock(false);
    document.getElementById('app').classList.remove('demo-running');
    document.getElementById('console').classList.remove('panel-celebrate');
    resetExploration();
    setLightOrbVisible(idx === BEAT.LIGHT || idx === BEAT.DONE);

    if (idx !== BEAT.CHALLENGE) endMatch();
    if (idx !== BEAT.QUIZ) endQuiz();
    if (idx !== BEAT.DONE) {
        setRoomLights(true, idx !== BEAT.EMISSIVE);
        syncRoom(true);
    }
    setProgress(idx);

    const copy = COPY[idx];
    setCaption(copy.step, copy.title, copy.panel || copy.body);
    revealControls(CONTROLS[idx]);
    if (!CONTROLS[idx].length) hideDock();
    stageFor(idx);

    if (!skipRead && idx !== BEAT.QUIZ) {
        state.reading = true;
        showReadCard(copy, () => {
            state.reading = false;
            enterBeat(idx);
        });
    } else {
        enterBeat(idx);
    }
}

function stageFor(idx) {
    switch (idx) {
        case BEAT.INTRO:
            resetValues();
            syncFromValues();
            setKeyAzimuth(LIGHT_START);
            syncLight(LIGHT_START);
            demoSetLightColor('warm');
            setCam('hero', true);
            break;

        case BEAT.RGB:
            setValues({ color: START_MATERIAL.color });
            syncFromValues();
            setCam('hero');
            break;

        case BEAT.ROUGHNESS:
            setValues({ roughness: 50, metalness: 0 });
            syncFromValues();
            break;

        case BEAT.METALNESS:
            setValues({ color: '#e2a24b', roughness: 25, metalness: 0 });
            syncFromValues();
            setCam('close');
            break;

        case BEAT.LIGHT:
            setValues({ color: '#3a6fa8', roughness: 35, metalness: 0, emissive: 0 });
            syncFromValues();
            setKeyAzimuth(LIGHT_START);
            syncLight(LIGHT_START);
            demoSetLightColor('warm');
            setCam('hero');
            break;

        case BEAT.EMISSIVE:
            setValues({ color: '#ff6a38', roughness: 40, metalness: 0, emissive: 0 });
            syncFromValues();
            demoSetLightColor('warm');
            setCam('hero');
            break;

        case BEAT.CHALLENGE:
            setValues({ ...START_MATERIAL });
            syncFromValues();
            setKeyAzimuth(LIGHT_START);
            syncLight(LIGHT_START);
            demoSetLightColor('warm');
            startMatch();
            setCam('match');
            break;

        case BEAT.QUIZ:
        case BEAT.DONE:
            setCam('hero');
            break;
    }
}

function enterBeat(idx) {
    switch (idx) {
        case BEAT.INTRO:
            orbitCtrl.enabled = true;
            setTimeout(showContinue, 500);
            break;

        case BEAT.COLOR:
            playDemo([
                clickSwatch('#c0453a'),
                hold(() => swatchPoint('#c0453a'), 0.9),
                cursorTo(() => swatchPoint('#3a6fa8'), 0.7),
                clickSwatch('#3a6fa8'),
                hold(() => swatchPoint('#3a6fa8'), 1),
            ], { first: () => swatchPoint('#c0453a') });
            break;

        case BEAT.RGB: {
            const start = hexToRgb(START_MATERIAL.color);
            playDemo([
                dragRGB('r', start.r, 245, 1),
                hold(() => rgbThumbPoint('r'), 0.8),
                cursorTo(() => rgbThumbPoint('g'), 0.55),
                dragRGB('g', start.g, 80, 1),
                hold(() => rgbThumbPoint('g'), 0.9),
                cursorTo(() => rgbThumbPoint('b'), 0.55),
                dragRGB('b', start.b, 55, 1),
                hold(() => rgbThumbPoint('b'), 1),
            ], { first: () => rgbThumbPoint('r') });
            break;
        }

        case BEAT.ROUGHNESS:
            playDemo([
                dragSlider('roughness', 50, 96, 1.5),
                hold(() => sliderThumbPoint('roughness'), 1.2),
                dragSlider('roughness', 96, 4, 1.9),
                hold(() => sliderThumbPoint('roughness'), 1.2),
                dragSlider('roughness', 4, 45, 0.9),
            ], { camKey: 'close', release: 'close', first: () => sliderThumbPoint('roughness') });
            break;

        case BEAT.METALNESS:
            playDemo([
                dragSlider('metalness', 0, 100, 1.4),
                hold(() => sliderThumbPoint('metalness'), 1.4),
                dragSlider('metalness', 100, 0, 1.4),
                hold(() => sliderThumbPoint('metalness'), 1.1),
            ], { camKey: 'close', release: 'close', first: () => sliderThumbPoint('metalness') });
            break;

        case BEAT.LIGHT:
            playDemo([
                dragLight(LIGHT_START, -132, 1.7),
                hold(() => lightOrbScreenPoint(), 1.2),
                dragLight(-132, 132, 2.6),
                hold(() => lightOrbScreenPoint(), 1.2),
                dragLight(132, LIGHT_START, 1.3),
            ], { first: () => lightOrbScreenPoint() });
            break;

        case BEAT.EMISSIVE:
            playDemo([
                clickRoom(false),
                hold(() => roomPoint('off'), 1.1),
                cursorTo(() => sliderThumbPoint('emissive'), 0.6),
                dragSlider('emissive', 0, 85, 1.4),
                hold(() => sliderThumbPoint('emissive'), 1.4),
                dragSlider('emissive', 85, 0, 1),
                hold(() => sliderThumbPoint('emissive'), 0.8),
                dragSlider('emissive', 0, 60, 0.8),
                cursorTo(() => roomPoint('on'), 0.6),
                clickRoom(true),
            ], { first: () => roomPoint('off') });
            break;

        case BEAT.CHALLENGE:
            orbitCtrl.enabled = true;
            setMode('interact');
            flashControl('check');
            break;

        case BEAT.QUIZ:
            orbitCtrl.enabled = true;
            setMode(null);
            startQuiz(() => {
                state.quizPassed = true;
                showContinue();
            });
            break;

        case BEAT.DONE:
            orbitCtrl.enabled = true;
            setMode(null);
            document.getElementById('console').classList.add('panel-celebrate');
            flashControl('emissive');
            setTimeout(showFinishButton, 300);
            break;
    }
}

export function checkBeatComplete(key) {
    if (state.beatLocked) return;

    switch (state.beatIdx) {
        case BEAT.COLOR:
            if (key === 'color') state.colorsTried.add(String(values.color).toLowerCase());
            break;
        case BEAT.RGB:
            if (key === 'rgb') {
                const channels = rgbChannels();
                Object.entries(channels).forEach(([ch, value]) => trackSpan('rgb-' + ch, value));
            }
            break;
        case BEAT.ROUGHNESS:
            if (key === 'roughness') trackSpan('roughness', values.roughness);
            break;
        case BEAT.METALNESS:
            if (key === 'metalness') trackSpan('metalness', values.metalness);
            break;
        case BEAT.LIGHT:
            if (key === 'light') {
                trackSpan('light', Number(document.querySelector('input[data-ctl="light"]').value));
            }
            break;
        case BEAT.EMISSIVE:
            if (key === 'emissive') trackSpan('emissive', values.emissive);
            break;
    }

    if (document.getElementById('btn-continue').classList.contains('on')) return;

    switch (state.beatIdx) {
        case BEAT.COLOR:
            if (state.colorsTried.size >= 2) showContinue();
            break;
        case BEAT.RGB:
            if (Math.max(span('rgb-r'), span('rgb-g'), span('rgb-b')) >= EXPLORE.rgb) showContinue();
            break;
        case BEAT.ROUGHNESS:
            if (span('roughness') >= EXPLORE.roughness) showContinue();
            break;
        case BEAT.METALNESS:
            if (span('metalness') >= EXPLORE.metalness) showContinue();
            break;
        case BEAT.LIGHT:
            if (span('light') >= EXPLORE.light) showContinue();
            break;
        case BEAT.EMISSIVE:
            if (span('emissive') >= EXPLORE.emissive) showContinue();
            break;
        case BEAT.CHALLENGE:
            if (state.matchPassed) showContinue();
            break;
    }
}

export function nextBeat() {
    if (state.beatLocked || state.reading) return;
    if (state.beatIdx < TOTAL_BEATS - 1) runBeat(state.beatIdx + 1);
}

export function replayBeat() {
    if (state.beatLocked || state.reading) return;
    runBeat(state.beatIdx, { skipRead: true });
}

export function onCheckMatch() {
    if (state.beatIdx !== BEAT.CHALLENGE) return;
    checkMatch();
    checkBeatComplete('check');
}

export function onNewTarget() {
    if (state.beatIdx !== BEAT.CHALLENGE) return;
    startMatch();
    setValues({ ...START_MATERIAL });
    syncFromValues();
}

export function onHint() {
    if (state.beatIdx === BEAT.CHALLENGE) nextHint();
}

export { dismissReadCard, readCardOpen };
