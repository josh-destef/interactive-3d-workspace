/* ═══════════════════════════════════════════════
   BEAT SYSTEM
   Each beat reveals one control, plays a Watch demo over it, then waits for
   the student to use it themselves before Continue unlocks.

   The order is the lesson: one particle's story, told one term at a time.
   Age kills it, so age comes first. Rate times lifetime is how many exist,
   which only means something once age is understood. Velocity decides where
   a particle is thrown; forces bend it after that; age also drives how it
   looks. The challenge at the end asks for nothing new - just all six terms
   held in the head at once.
═══════════════════════════════════════════════ */
import { TOTAL_BEATS } from './config.js';
import { state } from './state.js';
import { setCam, releaseCamera, orbitCtrl } from './stage.js';
import { runSequence, clearAnims } from './anim.js';
import { lerp } from './utils.js';
import { params, setParam, setParams, setSoloMode } from './particles.js';
import { showReadout, showChecklist, resetChallenge } from './readout.js';
import {
    revealControls, hideDock, lockDock, flashControl,
    demoSetSlider, sliderThumbPoint, syncFromValues, buttonPoint,
    shapeButtonEl, gravityButtonEl, colorlifeButtonEl, blendButtonEl,
} from './controls.js';
import {
    toggleDemoCursor, moveDemoCursor, setDemoCursorDown, getDemoCursorPoint,
} from './demoCursor.js';
import {
    setCaption, setMode, showWatch, hideWatch,
    showContinue, hideContinue, setProgress, showFinishButton,
    showReadCard,
} from './ui.js';
import { buildMouseDiagram } from './mouseDiagram.js';
import { startQuiz, endQuiz } from './quiz.js';

/* ── demo step builders ──
   Every demo drives the real control, so what the student watches is exactly
   what they are about to do. */

/* Ease the cursor from wherever it is to a point, recomputed each frame
   because the dock can still be settling into place when a demo starts. */
function cursorTo(getPoint, duration = 0.55) {
    let from = null;
    return {
        duration, fn: t => {
            const to = getPoint();
            if (!to) return;
            if (t === 0 || !from) from = { ...getDemoCursorPoint() };
            moveDemoCursor({ x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) });
        },
    };
}

/* Drag a slider from one raw value to another with the cursor riding the thumb. */
function dragSlider(key, from, to, duration = 1.5) {
    return {
        duration, fn: t => {
            if (t === 0) setDemoCursorDown(true);
            demoSetSlider(key, Math.round(lerp(from, to, t)));
            moveDemoCursor(sliderThumbPoint(key));
        },
    };
}

/* Press a button once. Used for shape, gravity, and the two look toggles -
   near enough to instant that a drag has nothing to demonstrate. */
function clickButton(fn, duration = 0.5) {
    return {
        duration, fn: t => {
            if (t === 0) { setDemoCursorDown(true); fn(); syncFromValues(); }
            if (t > 0.6) setDemoCursorDown(false);
        },
    };
}

/* Let go and hold still - the pause is where the student actually looks at
   the fountain instead of the moving control. Pass a slider key to keep the
   cursor riding its thumb, or nothing to leave it where the last click left it. */
function hold(key, duration = 0.9) {
    return {
        duration, fn: t => {
            if (t === 0) setDemoCursorDown(false);
            if (key) moveDemoCursor(sliderThumbPoint(key));
        },
    };
}

/* Shared demo scaffolding: lock everything down, run the steps, hand back. */
function playDemo(steps, { camKey = 'hero', release = 'hero' } = {}) {
    orbitCtrl.enabled = false;
    state.beatLocked = true;
    state.camLocked = true;
    lockDock(true);
    showWatch();
    setCam(camKey);
    runSequence(steps, () => {
        toggleDemoCursor(false);
        setDemoCursorDown(false);
        lockDock(false);
        releaseCamera(release);
        hideWatch();
        state.beatLocked = false;
    });
}

/* holds the beat-1 solo-to-stream handoff timer and the beat-7 finish-button
   timer, so replaying a beat can never leave a stale one armed */
let pendingTimer = null;

/* ═══════════════════════════════════════════════ */

const READ = [
    { step: '', title: 'One dot becomes an effect', body: 'A particle is born, moves, changes, then disappears. Repeat that many times and you get sparks, smoke or rain.', cta: 'Start the lab' },
    { step: 1, title: 'How long should it live?', body: 'Lifetime controls how long each particle stays before its slot is reused.' },
    { step: 2, title: 'How many should exist?', body: 'Rate creates particles. Lifetime keeps them around. Together they control the live count.' },
    { step: 3, title: 'Where should it go?', body: 'Launch speed and emitter shape decide how a particle starts moving.' },
    { step: 4, title: 'What changes the path?', body: 'Gravity and drag reshape motion after launch. There is no stored path.' },
    { step: 5, title: 'Make it change as it ages', body: 'Colour and opacity can follow each particle from birth to death.' },
    { step: 6, title: 'Build a spark fountain', body: 'Combine shape, motion, colour and a sensible live count.', cta: 'Start the challenge' },
    null,
    { step: 'Done', title: 'One loop, many effects', body: 'Change the same birth, simulation and rendering rules to move from sparks toward rain, dust, smoke or magic.', cta: 'Enter free play' },
];

export function runBeat(idx, { skipRead = false } = {}) {
    state.beatIdx = idx;
    state.beatLocked = false;
    hideContinue();
    setMode(null);
    clearAnims();
    toggleDemoCursor(false);
    lockDock(false);
    if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }

    /* reset per-beat interaction tracking */
    state.lifeLow = false;
    state.lifeHigh = false;
    state.rateHigh = false;
    state.rateLow = false;
    state.speedHigh = false;
    state.shapesTried = new Set();
    state.gravityWasOff = false;
    state.gravityBackOn = false;
    state.dragHigh = false;
    state.colorToggled = false;
    state.blendToggled = false;

    setSoloMode(false);
    showReadout(idx >= 2);
    showChecklist(idx === 6);
    if (idx !== 7) endQuiz();
    setProgress(idx);

    if (!skipRead && idx !== 7) {
        showReadCard(READ[idx], () => enterBeat(idx));
        return;
    }
    enterBeat(idx);
}

function enterBeat(idx) {

    switch (idx) {

        /* ─────────────────────────────────────────
           BEAT 0: meet one particle
           No dock. A single dot, born, thrown, aged, recycled - everything
           after this beat is one more term added to its story.
        ───────────────────────────────────────── */
        case 0:
            hideDock();
            setSoloMode(true);
            setCam('solo', true);
            orbitCtrl.enabled = true;
            setCaption('', 'What a particle is',
                'One particle stores a <b>position</b>, <b>velocity</b>, <b>age</b> and <b>lifetime</b>.'
                + buildMouseDiagram('orbit'));
            pendingTimer = setTimeout(showContinue, 1400);
            break;

        /* ─────────────────────────────────────────
           BEAT 1: lifetime
           Stays in solo mode for the first second so the student is still
           watching one dot when the caption names age and lifetime, then
           switches to a slow, countable stream for the demo.
        ───────────────────────────────────────── */
        case 1:
            revealControls(['life']);
            setSoloMode(true);
            setCam('solo', true);
            orbitCtrl.enabled = true;
            setParams({ life: 2.0 });
            syncFromValues();
            setCaption(1, 'How long does each one last?',
                '<b>Drag Lifetime low, then high.</b> Short lives blink out; long lives leave trails.');
            pendingTimer = setTimeout(() => {
                setSoloMode(false);
                setParams({ rate: 8 });
                syncFromValues();
                playDemo([
                    { duration: 0.6, fn: t => { if (t === 0) { toggleDemoCursor(true); moveDemoCursor(sliderThumbPoint('life')); } } },
                    dragSlider('life', 20, 4, 1.4),
                    hold('life', 1.1),
                    dragSlider('life', 4, 50, 1.8),
                    hold('life', 1.2),
                    dragSlider('life', 50, 20, 0.9),
                ], { camKey: 'solo', release: 'solo' });
            }, 1000);
            break;

        /* ─────────────────────────────────────────
           BEAT 2: rate and the budget equation
           The readout card arrives here and stays for the rest of the lesson.
           The demo sweeps rate with the card in frame so the live count is
           visibly settling while the student watches.
        ───────────────────────────────────────── */
        case 2:
            revealControls(['life', 'rate']);
            setParams({ life: 2.0, rate: 8 });
            syncFromValues();
            setCaption(2, 'How many exist at once?',
                '<b>Move Rate up and down.</b> At a steady rate, the live count is roughly Rate &times; average Lifetime.');
            playDemo([
                { duration: 0.6, fn: t => { if (t === 0) { toggleDemoCursor(true); moveDemoCursor(sliderThumbPoint('rate')); } } },
                dragSlider('rate', 8, 150, 1.8),
                hold('rate', 1.6),
                dragSlider('rate', 150, 20, 1.5),
                hold('rate', 1.0),
            ]);
            break;

        /* ─────────────────────────────────────────
           BEAT 3: launch velocity and emitter shape
        ───────────────────────────────────────── */
        case 3:
            revealControls(['life', 'rate', 'speed', 'shape']);
            setParams({ speed: 4.0, shape: 'cone' });
            syncFromValues();
            setCaption(3, 'Choose the starting motion',
                '<b>Raise Launch speed and try two shapes.</b> Cone spreads upward, Sphere fires around, and Line changes the starting positions.');
            playDemo([
                { duration: 0.6, fn: t => { if (t === 0) { toggleDemoCursor(true); moveDemoCursor(sliderThumbPoint('speed')); } } },
                dragSlider('speed', 40, 80, 1.6),
                hold('speed', 1.1),
                cursorTo(() => buttonPoint(shapeButtonEl('sphere')), 0.6),
                clickButton(() => setParam('shape', 'sphere')),
                hold(null, 1.1),
                cursorTo(() => buttonPoint(shapeButtonEl('line')), 0.6),
                clickButton(() => setParam('shape', 'line')),
                hold(null, 1.1),
                cursorTo(() => buttonPoint(shapeButtonEl('cone')), 0.6),
                clickButton(() => setParam('shape', 'cone')),
                hold(null, 0.8),
            ]);
            break;

        /* ─────────────────────────────────────────
           BEAT 4: forces
           Gravity and drag are the two forces on offer, demoed as a clean
           on/off and a clean up/down so each reads as one variable at a time.
        ───────────────────────────────────────── */
        case 4:
            revealControls(['life', 'rate', 'speed', 'shape', 'gravity', 'drag']);
            setParams({ gravity: true, drag: 0.1 });
            syncFromValues();
            setCaption(4, 'Bend and slow the path',
                '<b>Turn Gravity off and on, then raise Drag.</b> Gravity bends the path; drag slows it down.');
            playDemo([
                { duration: 0.6, fn: t => { if (t === 0) { toggleDemoCursor(true); moveDemoCursor(buttonPoint(gravityButtonEl())); } } },
                clickButton(() => setParam('gravity', false)),
                hold(null, 1.3),
                cursorTo(() => buttonPoint(gravityButtonEl()), 0.4),
                clickButton(() => setParam('gravity', true)),
                hold(null, 1.2),
                cursorTo(() => sliderThumbPoint('drag'), 0.6),
                dragSlider('drag', 10, 80, 1.5),
                hold('drag', 1.2),
                dragSlider('drag', 80, 10, 1.0),
            ]);
            break;

        /* ─────────────────────────────────────────
           BEAT 5: age drives the look
        ───────────────────────────────────────── */
        case 5:
            revealControls(['life', 'rate', 'speed', 'shape', 'gravity', 'drag', 'look']);
            setParams({ colorLife: true, additive: false });
            syncFromValues();
            setCaption(5, 'Change the look over time',
                '<b>Toggle Colour over life, then Additive.</b> Age changes each particle; blending changes how particles combine with the background.');
            playDemo([
                { duration: 0.6, fn: t => { if (t === 0) { toggleDemoCursor(true); moveDemoCursor(buttonPoint(colorlifeButtonEl())); } } },
                clickButton(() => setParam('colorLife', false)),
                hold(null, 1.1),
                cursorTo(() => buttonPoint(colorlifeButtonEl()), 0.4),
                clickButton(() => setParam('colorLife', true)),
                hold(null, 1.0),
                cursorTo(() => buttonPoint(blendButtonEl()), 0.6),
                clickButton(() => setParam('additive', true)),
                hold(null, 1.3),
            ]);
            break;

        /* ─────────────────────────────────────────
           BEAT 6: challenge - author a spark fountain
           No demo: every control needed has already been demoed once. The
           readout card becomes a live checklist instead.
        ───────────────────────────────────────── */
        case 6:
            revealControls(['life', 'rate', 'speed', 'shape', 'gravity', 'drag', 'look']);
            // Back to normal blending: step 5 leaves additive on, and an additive
            // fountain is close to invisible against this stage - which is fine as a
            // one-step lesson and useless as something to tune for ten minutes.
            setParams({ additive: false });
            syncFromValues();
            resetChallenge();
            setCam('hero');
            orbitCtrl.enabled = true;
            setMode('interact');
            setCaption(6, 'Build a spark fountain',
                '<b>Make a cone fountain with 80–220 live particles, Gravity and Colour over life on, and Drag from 0.1–0.5.</b>');
            break;

        case 7:
            hideDock();
            showReadout(false);
            setCam('hero');
            orbitCtrl.enabled = true;
            setMode(null);
            setCaption('Check what you learned', 'Three system decisions',
                'Pick an answer. If you miss, the explanation will help.');
            startQuiz(showContinue);
            break;

        /* ─────────────────────────────────────────
           BEAT 8: free play
        ───────────────────────────────────────── */
        case 8:
            revealControls(['life', 'rate', 'speed', 'shape', 'gravity', 'drag', 'look', 'burst']);
            setCam('wide');
            orbitCtrl.enabled = true;
            setMode(null);
            setCaption('', '<span class="cap-celebrate-icon">🎉</span>You can read a particle system',
                'Rate and Lifetime set the count. Velocity and forces shape the path. Age shapes the look.<br><br><b>Try Burst 100</b>, then turn the stream into a different effect.');
            document.getElementById('panel').classList.add('panel-celebrate');
            flashControl('burst');
            pendingTimer = setTimeout(showFinishButton, 300);
            break;
    }
}

/* ═══════════════════════════════════════════════
   COMPLETION CHECKS
   Called on every control change. Unlocks Continue once the beat's goal is
   met. Beat 6 is the exception - it is checked every frame from the render
   loop instead, since "live particles" moves on its own between clicks.
═══════════════════════════════════════════════ */
export function checkBeatComplete(key) {
    if (state.beatLocked) return;

    // Track first, gate second: a student who explores during the demo still
    // gets credit, but Continue only appears once it is their turn.
    switch (state.beatIdx) {
        case 1:
            if (key === 'life') {
                if (params.life <= 0.9) state.lifeLow = true;
                if (params.life >= 3.5) state.lifeHigh = true;
            }
            break;
        case 2:
            if (key === 'rate') {
                if (params.rate >= 120) state.rateHigh = true;
                if (params.rate <= 30) state.rateLow = true;
            }
            break;
        case 3:
            if (key === 'speed' && params.speed >= 6.5) state.speedHigh = true;
            if (key && key.startsWith('shape:')) state.shapesTried.add(key);
            break;
        case 4:
            if (key === 'gravity') {
                if (!params.gravity) state.gravityWasOff = true;
                if (params.gravity && state.gravityWasOff) state.gravityBackOn = true;
            }
            if (key === 'drag' && params.drag >= 0.5) state.dragHigh = true;
            break;
        case 5:
            if (key === 'colorLife') state.colorToggled = true;
            if (key === 'additive') state.blendToggled = true;
            break;
    }

    if (document.getElementById('btn-continue').classList.contains('on')) return;

    switch (state.beatIdx) {
        case 1: if (state.lifeLow && state.lifeHigh) showContinue(); break;
        case 2: if (state.rateHigh && state.rateLow) showContinue(); break;
        case 3: if (state.speedHigh && state.shapesTried.size >= 2) showContinue(); break;
        case 4: if (state.gravityBackOn && state.dragHigh) showContinue(); break;
        case 5: if (state.colorToggled && state.blendToggled) showContinue(); break;
    }
}

/* ═══════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════ */
export function nextBeat() {
    if (state.beatLocked) return;
    if (state.beatIdx < TOTAL_BEATS - 1) runBeat(state.beatIdx + 1);
}

export function replayBeat() {
    if (state.beatLocked) return;
    runBeat(state.beatIdx, { skipRead: true });
}
