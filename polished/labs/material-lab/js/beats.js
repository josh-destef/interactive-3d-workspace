/* ═══════════════════════════════════════════════
   BEAT SYSTEM
   Each idea uses one learner-paced rhythm: read it, try it, notice it.

   The first act builds a surface: color, roughness and metalness. The
   second shows how light and emissive affect what the learner sees. The
   challenge combines those observations under one shared light.
═══════════════════════════════════════════════ */
import { BEAT, TOTAL_BEATS, START_MATERIAL, LIGHT_START, EXPLORE } from './config.js';
import { state, trackSpan, span, resetExploration } from './state.js';
import {
    setCam, orbitCtrl, setKeyAzimuth, setRoomLights, setLightOrbVisible,
} from './stage.js';
import { clearAnims, runSequence } from './anim.js';
import { values, resetValues, setValues, setTargetMaterial, setMatchLayout } from './subject.js';
import { startMatch, endMatch, checkMatch, nextHint } from './match.js';
import { hexToRgb, lerp } from './utils.js';
import {
    revealControls, hideDock, lockDock, flashControl, demoSetLightColor, demoSetRGB, setRgbExpanded,
    rgbThumbPoint, syncFromValues, syncLight, syncRoom,
} from './controls.js';
import {
    toggleDemoCursor, moveDemoCursor, setDemoCursorDown, getDemoCursorPoint, centerPoint,
} from './demoCursor.js';
import {
    setCaption, setMode, showWatch, showContinue, hideContinue,
    setProgress, showFinishButton, showReadCard, dismissReadCard, readCardOpen, showChoice, setContinueLabel,
} from './ui.js';

/* ── one idea and one action per beat ── */
const COPY = {
    [BEAT.INTRO]: {
        step: '',
        title: 'Give Gizmobot a new look',
        body: 'Gizmobot is wearing a light-colored shell. You will use materials to change the color and finish of that shell, then explore lighting and glow.',
        panel: '<b>Take a look around.</b> Drag to orbit around Gizmobot. The light-colored outer suit is the shell you will customize.',
        cta: 'Start customizing',
    },
    [BEAT.COLOR]: {
        step: 1,
        title: 'Make it yours',
        body: 'Pick a color for Gizmobot’s shell. Try a few. Keep your favorite.',
        panel: '<b>Pick a color you like.</b> The bright spot stays bright because the light has not moved. Your choice is the material’s <b>base color</b>.',
        cta: 'Choose a color',
    },
    [BEAT.RGB_WATCH]: {
        step: 'Optional color lesson',
        title: 'Three sliders, millions of colors',
        body: 'Computers mix red, green, and blue to make digital colors. Equal amounts make gray. Watch what happens when one slider moves.',
        panel: '<b>Watch the mouse.</b> It will move Red, Green, and Blue. Notice how Gizmobot’s shell changes.',
        cta: 'Watch RGB',
    },
    [BEAT.RGB_MIX]: {
        step: 'Optional color lesson',
        title: 'Mix a color',
        body: 'Now try it. Raise Red, mix Red and Blue, or bring all three sliders close together. Watch Gizmobot’s shell as you work.',
        panel: '<b>Make a color you like.</b> Choose Use this color when it is ready.',
        cta: 'My turn',
    },
    [BEAT.RGB_RETURN]: {
        step: 'Back to materials',
        title: 'Your color is ready',
        body: 'RGB tells the computer which color to make. In a 3D material, that color becomes the base color. Your mix will stay on Gizmobot.',
        panel: '<b>Next: Roughness.</b> Your color will stay with Gizmobot.',
        cta: 'Next: Roughness',
    },
    [BEAT.ROUGHNESS]: {
        step: 2,
        title: 'Shiny or dull?',
        body: 'Move Roughness all the way down. Then move it all the way up. Watch the bright reflection on the shell.',
        panel: '<b>Try both ends, then choose a finish.</b> Low roughness gives sharp reflections. High roughness makes them soft and spread out.',
        cta: 'Try Roughness',
    },
    [BEAT.METALNESS]: {
        step: 3,
        title: 'Plastic or metal?',
        body: 'Drag Metalness from one end to the other. Watch what happens to the shell.',
        panel: '<b>Try both ends, then choose a material.</b> At 0, the shell behaves like plastic. At 1, it behaves like metal. Roughness still controls how sharp the reflections look.',
        cta: 'Try Metalness',
    },
    [BEAT.LIGHT]: {
        step: 4,
        title: 'Move the light',
        body: 'Drag the glowing light around Gizmobot. Follow the bright spot on the shell and the shadow on the floor.',
        panel: '<b>Drag the orange light around the ring.</b> Then choose Warm, Daylight, or Cool. Which one suits your material?',
        cta: 'Move the light',
    },
    [BEAT.EMISSIVE]: {
        step: 5,
        title: 'See the face glow',
        body: 'Turn the room lights off. Gizmobot’s eyes and mouth stay visible because they are emissive.',
        panel: '<b>Turn the room lights off.</b> The face stays visible. This effect is called <b>emission</b>.',
        cta: 'Turn off the lights',
    },
    [BEAT.BODY_GLOW]: {
        step: 6,
        title: 'Make the body glow',
        body: 'The face glows in the dark. Gizmobot’s shell can glow too.',
        panel: '<b>Move Body glow.</b> Choose an amount you like.',
        cta: 'Try body glow',
    },
    [BEAT.RGB_CHALLENGE]: {
        step: 'Optional extra challenge',
        title: 'Match this color with RGB',
        body: 'The material and lighting are fixed. Use Red, Green, and Blue to match the reference color.',
        panel: '<b>Compare the colors.</b> Is yours warmer, cooler, brighter, or darker?',
        cta: 'Try the RGB match',
    },
    [BEAT.CHALLENGE]: {
        step: 'Challenge',
        title: 'Can you recreate this material?',
        body: 'Use Color, Roughness, and Metalness to match the reference.',
        panel: '<b>Look closely.</b> Is the reflection sharp or soft? Does the shell look like plastic or metal? Is the color close?',
        cta: 'Start the challenge',
    },
    [BEAT.DONE]: {
        step: '',
        title: 'You now understand 3D materials!',
        body: 'When you look at a 3D object, ask: <b>What color is it? How rough is it? Is it metal? What is the light doing? Does anything glow?</b>',
        panel: '<b>Everything is unlocked.</b> Try the material presets, move the light, or build a new look of your own.',
        cta: 'Keep experimenting',
    },
};

const RGB_TARGET = '#b56d9a';
const RGB_FIXED_MATERIAL = { roughness: 35, metalness: 0, emissive: 0 };

const CONTROLS = {
    [BEAT.INTRO]: [],
    [BEAT.COLOR]: ['color'],
    [BEAT.RGB_WATCH]: ['rgb'],
    [BEAT.RGB_MIX]: ['rgb', 'rgb-use'],
    [BEAT.RGB_RETURN]: [],
    [BEAT.ROUGHNESS]: ['roughness'],
    [BEAT.METALNESS]: ['metalness'],
    [BEAT.LIGHT]: ['light', 'light-color'],
    [BEAT.EMISSIVE]: ['room'],
    [BEAT.BODY_GLOW]: ['emissive'],
    [BEAT.CHALLENGE]: ['color', 'roughness', 'metalness', 'check'],
    [BEAT.RGB_CHALLENGE]: ['rgb', 'rgb-check'],
    [BEAT.DONE]: ['color', 'rgb', 'roughness', 'metalness', 'examples', 'light', 'light-color', 'emissive', 'room'],
};

export function runBeat(idx, { skipRead = false } = {}) {
    state.beatIdx = idx;
    state.beatLocked = false;
    state.reading = false;
    hideContinue();
    setContinueLabel();
    setMode(null);
    clearAnims();
    toggleDemoCursor(false);
    lockDock(false);
    document.getElementById('app').classList.remove('demo-running');
    document.getElementById('console').classList.remove('panel-celebrate');
    resetExploration();
    setLightOrbVisible(idx === BEAT.LIGHT || idx === BEAT.DONE);

    if (idx !== BEAT.CHALLENGE) endMatch();
    document.getElementById('rgb-result').classList.remove('on');
    if (idx !== BEAT.DONE) {
        const roomOn = idx !== BEAT.EMISSIVE && idx !== BEAT.BODY_GLOW;
        setRoomLights(roomOn, true);
        syncRoom(roomOn);
    }
    setProgress(idx);

    const copy = COPY[idx];
    if (idx === BEAT.RGB_OFFER || idx === BEAT.RGB_CHALLENGE_OFFER) {
        hideDock();
        stageFor(idx);
        enterBeat(idx);
        return;
    }
    setCaption(copy.step, copy.title, copy.panel || copy.body);
    revealControls(CONTROLS[idx]);
    if (!CONTROLS[idx].length) hideDock();
    stageFor(idx);

    if (!skipRead && idx !== BEAT.RGB_MIX) {
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

        case BEAT.ROUGHNESS:
            setValues({ roughness: 50 });
            syncFromValues();
            break;

        case BEAT.RGB_WATCH:
        case BEAT.RGB_MIX:
            setValues({ color: '#b4b4b4' });
            syncFromValues();
            setRgbExpanded(true);
            setCam('hero');
            break;

        case BEAT.METALNESS:
            setValues({ metalness: 0 });
            syncFromValues();
            setCam('close');
            break;

        case BEAT.LIGHT:
            setKeyAzimuth(LIGHT_START);
            syncLight(LIGHT_START);
            demoSetLightColor('warm');
            setCam('hero');
            break;

        case BEAT.EMISSIVE:
            syncFromValues();
            demoSetLightColor('warm');
            setCam('hero');
            break;

        case BEAT.BODY_GLOW:
            setValues({ emissive: 0 });
            syncFromValues();
            setCam('hero');
            break;

        case BEAT.RGB_RETURN:
            setRgbExpanded(false);
            setCam('hero');
            break;

        case BEAT.RGB_CHALLENGE:
            setValues({ color: '#b4b4b4', ...RGB_FIXED_MATERIAL });
            setTargetMaterial({ color: RGB_TARGET, ...RGB_FIXED_MATERIAL });
            setMatchLayout(true);
            syncFromValues();
            setRgbExpanded(true);
            setCam('match');
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
        case BEAT.ROUGHNESS:
        case BEAT.METALNESS:
        case BEAT.LIGHT:
        case BEAT.EMISSIVE:
        case BEAT.BODY_GLOW:
            orbitCtrl.enabled = true;
            setMode('interact');
            break;

        case BEAT.RGB_OFFER:
            showChoice(
                {
                    title: 'Want to learn where digital colors come from?',
                    body: 'Computers can mix red, green, and blue to create Gizmobot’s color. This short side lesson is optional.',
                    primary: 'Show me RGB',
                    secondary: 'Maybe later',
                },
                () => runBeat(BEAT.RGB_WATCH),
                () => runBeat(BEAT.ROUGHNESS),
            );
            break;

        case BEAT.RGB_WATCH:
            playRgbWatch();
            break;

        case BEAT.RGB_MIX:
            orbitCtrl.enabled = true;
            setMode('interact');
            break;

        case BEAT.RGB_RETURN:
            orbitCtrl.enabled = true;
            setMode('interact');
            showContinue();
            break;

        case BEAT.CHALLENGE:
            orbitCtrl.enabled = true;
            setMode('interact');
            flashControl('check');
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
            break;
        case BEAT.BODY_GLOW:
            if (key === 'emissive') trackSpan('emissive', values.emissive);
            break;

        case BEAT.RGB_CHALLENGE_OFFER:
            showChoice(
                {
                    title: 'Material matched',
                    body: 'You can finish now, or try one extra RGB color match.',
                    primary: 'Try an RGB match',
                    secondary: 'Finish lesson',
                },
                () => runBeat(BEAT.RGB_CHALLENGE),
                () => runBeat(BEAT.DONE),
            );
            break;

        case BEAT.RGB_CHALLENGE:
            orbitCtrl.enabled = true;
            setMode('interact');
            break;
    }

    if (document.getElementById('btn-continue').classList.contains('on')) return;

    switch (state.beatIdx) {
        case BEAT.COLOR:
            if (state.colorsTried.size >= 1) showContinue();
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
            if (key === 'room') showContinue();
            break;
        case BEAT.BODY_GLOW:
            if (span('emissive') >= EXPLORE.emissive) showContinue();
            break;
        case BEAT.CHALLENGE:
            if (state.matchPassed) showContinue();
            break;
    }
}

function playRgbWatch() {
    orbitCtrl.enabled = false;
    state.beatLocked = true;
    lockDock(true);
    showWatch();
    demoSetRGB('r', 180);
    demoSetRGB('g', 180);
    demoSetRGB('b', 180);

    let cursorFrom = null;
    const moveTo = (getPoint, duration = 0.65) => ({
        duration,
        fn: t => {
            const target = getPoint();
            if (!target) return;
            if (t === 0 || !cursorFrom) cursorFrom = { ...getDemoCursorPoint() };
            moveDemoCursor({
                x: lerp(cursorFrom.x, target.x, t),
                y: lerp(cursorFrom.y, target.y, t),
            });
            if (t === 1) cursorFrom = null;
        },
    });
    const dragRgb = (channel, from, to, duration = 1.15) => ({
        duration,
        fn: t => {
            if (t === 0) setDemoCursorDown(true);
            demoSetRGB(channel, Math.round(lerp(from, to, t)));
            moveDemoCursor(rgbThumbPoint(channel));
            if (t === 1) setDemoCursorDown(false);
        },
    });
    const pause = (getPoint, duration = 0.65) => ({
        duration,
        fn: () => moveDemoCursor(getPoint()),
    });

    toggleDemoCursor(true);
    moveDemoCursor(centerPoint());
    runSequence([
        moveTo(() => rgbThumbPoint('r'), 0.8),
        dragRgb('r', 180, 245),
        pause(() => rgbThumbPoint('r')),
        dragRgb('r', 245, 180, 0.8),
        moveTo(() => rgbThumbPoint('g'), 0.7),
        dragRgb('g', 180, 245),
        pause(() => rgbThumbPoint('g')),
        dragRgb('g', 245, 180, 0.8),
        moveTo(() => rgbThumbPoint('b'), 0.7),
        dragRgb('b', 180, 245),
        pause(() => rgbThumbPoint('b'), 0.8),
    ], () => {
        toggleDemoCursor(false);
        setDemoCursorDown(false);
        document.getElementById('app').classList.remove('demo-running');
        state.beatLocked = false;
        setContinueLabel('My turn');
        showContinue();
    });
}

export function nextBeat() {
    if (state.beatLocked || state.reading) return;
    if (state.beatIdx === BEAT.CHALLENGE) {
        runBeat(state.rgbLearned ? BEAT.RGB_CHALLENGE_OFFER : BEAT.DONE);
        return;
    }
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

export function onUseRgbColor() {
    if (state.beatIdx !== BEAT.RGB_MIX) return;
    state.rgbLearned = true;
    runBeat(BEAT.RGB_RETURN);
}

export function onCheckRgbMatch() {
    if (state.beatIdx !== BEAT.RGB_CHALLENGE) return;
    const current = hexToRgb(values.color);
    const target = hexToRgb(RGB_TARGET);
    const delta = { r: target.r - current.r, g: target.g - current.g, b: target.b - current.b };
    const distance = Math.hypot(delta.r, delta.g, delta.b);
    const result = document.getElementById('rgb-result');
    let feedback;

    if (distance < 74) {
        feedback = '<b>Great match.</b> You built this color with RGB.';
        showContinue();
    } else {
        const channel = Object.entries(delta).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
        const labels = { r: 'Red', g: 'Green', b: 'Blue' };
        const direction = channel[1] > 0 ? 'raise' : 'lower';
        feedback = '<b>Very close.</b> Try to ' + direction + ' ' + labels[channel[0]] + ' a little.';
    }
    result.innerHTML = feedback;
    result.classList.add('on');
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
