/* ═══════════════════════════════════════════════
   BEAT SYSTEM
   Each beat reveals one control, plays a Watch demo over it, then waits for the
   student to use it themselves before Continue unlocks.

   The order is the lesson: a keyframe is a pose plus a time, two of them make
   motion, the frames between them are invented rather than stored, interpolation
   is the rule that invents them, and a keyframe holds every channel at once.
   Nothing about transforms is taught here - that is the lab next door. This one
   is about time, which is why the pose sits on three sliders and not on a gizmo.
═══════════════════════════════════════════════ */
import { TOTAL_BEATS, START_POSE } from './config.js';
import { state } from './state.js';
import { setCam, releaseCamera, orbitCtrl } from './stage.js';
import { runSequence, clearAnims } from './anim.js';
import { lerp } from './utils.js';
import {
    keys, keyAt, getFrame, seed, setFrame, setKeyframe, setEasing, setPlaying,
} from './animation.js';
import {
    revealControls, hideDock, lockDock, flashControl, showGoals, setGoal,
    demoSetPose, sliderThumbPoint, buttonPoint,
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

/* ── beat baselines ──
   Each beat parks the model where its demo begins. Replay demo re-runs the beat,
   so without one call that sets the keys, the playhead and the rule outright, a
   second viewing would start from wherever the student left off and show
   something other than what the caption describes. */
const RISE = [
    { frame: 0, pose: { y: 0, turn: 0, size: 1 } },
    { frame: 60, pose: { y: 4.5, turn: 0, size: 1 } },
];

/* Three keys, so the graph has a shape rather than a slope - stepped, linear and
   ease are indistinguishable on a single straight run. */
const ARC = [
    { frame: 0, pose: { y: 0, turn: 0, size: 1 } },
    { frame: 45, pose: { y: 4.5, turn: 0, size: 1 } },
    { frame: 100, pose: { y: 1.2, turn: 0, size: 1 } },
];

const SEEDS = {
    0: () => seed(),
    1: () => seed(),
    2: () => seed({ keys: [{ frame: 0, pose: { ...START_POSE } }] }),
    3: () => seed({ keys: RISE }),
    4: () => seed({ keys: ARC }),
    5: () => seed({ keys: ARC }),
    6: () => seed(),
    7: () => seed({ keys: ARC }),
    8: () => seed({ keys: ARC }),
};

/* ── demo step builders ──
   Every demo drives the real control, so what the student watches is exactly
   what they are about to do. */

/* Put the cursor on screen at a control without moving it there first. */
function cursorAt(getPoint, duration = 0.5) {
    return {
        duration, fn: t => {
            if (t !== 0) return;
            toggleDemoCursor(true);
            moveDemoCursor(getPoint());
        },
    };
}

/* Ease the cursor from wherever it is to a point, recomputed each frame because
   the dock can still be settling into place when a demo starts. */
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

/* Drag a pose slider from one value to another with the cursor riding the thumb. */
function dragSlider(name, from, to, duration = 1.4) {
    return {
        duration, fn: t => {
            if (t === 0) setDemoCursorDown(true);
            demoSetPose(name, Math.round(lerp(from, to, t)));
            moveDemoCursor(sliderThumbPoint(name));
        },
    };
}

/* Drag the playhead. Slow on purpose where the point is the in-betweens. */
function dragTimeline(from, to, duration = 1.4) {
    return {
        duration, fn: t => {
            if (t === 0) setDemoCursorDown(true);
            setFrame(Math.round(lerp(from, to, t)));
            moveDemoCursor(sliderThumbPoint('timeline'));
        },
    };
}

/* Press a dock button. The point is taken before the action runs, because Set
   keyframe renames itself to Replace keyframe and the cursor would jump. */
function clickButton(selector, action, duration = 0.6) {
    let point = null;
    return {
        duration, fn: t => {
            if (t === 0) {
                point = buttonPoint(selector);
                setDemoCursorDown(true);
                action();
            }
            if (t > 0.55) setDemoCursorDown(false);
            if (point) moveDemoCursor(point);
        },
    };
}

/* Let go and hold still - the pause is where the student actually looks at the
   rocket instead of the moving control. */
function hold(getPoint, duration = 0.9) {
    return {
        duration, fn: t => {
            if (t === 0) setDemoCursorDown(false);
            if (getPoint) moveDemoCursor(getPoint());
        },
    };
}

/* Put the model back where the beat started. A demo here authors real keyframes,
   and leaving them behind would satisfy the beat's gate before the student had
   touched anything - Continue would appear over work they did not do. */
function reseed(idx, duration = 0.6) {
    return { duration, fn: t => { if (t === 0) SEEDS[idx](); } };
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

/* ═══════════════════════════════════════════════ */

const READ = [
    { step: '', title: 'Animation saves the important moments', body: 'You choose a few poses. The computer fills the gaps between them.', cta: 'Start the lab' },
    { step: 1, title: 'Save one moment', body: 'A keyframe stores a pose at a time. Its diamond marks that moment on the timeline.' },
    { step: 2, title: 'Change needs two keys', body: 'Two different poses at two different times are enough to make motion.' },
    { step: 3, title: 'What happens between the keys?', body: 'The computer calculates every unstored pose between them. This is interpolation.' },
    { step: 4, title: 'The same keys can move differently', body: 'Change the interpolation and you change how the motion travels—not where it starts or ends.' },
    { step: 5, title: 'One object, several changing values', body: 'Height, turn and size are separate animation channels.' },
    { step: 6, title: 'Make a tiny launch', body: 'Create a start, an airborne pose and a landing, then play it.', cta: 'Start the challenge' },
    null,
    { step: 'Done', title: 'Timing is editable data', body: 'Load a recipe, move a key, change interpolation, or swap the actor while keeping the same animation.', cta: 'Enter free play' },
];

export function runBeat(idx, { skipRead = false } = {}) {
    state.beatIdx = idx;
    state.beatLocked = false;
    hideContinue();
    setMode(null);
    clearAnims();
    toggleDemoCursor(false);
    lockDock(false);
    setPlaying(false);

    /* reset per-beat interaction tracking */
    state.playPressed = false;
    state.playedSinceEdit = false;
    state.scrubbedFrames = new Set();
    state.easingsTried = new Set();

    showGoals(idx === 6);
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
           BEAT 0: an object with no keyframes
           Nothing to do but look. The rocket is motionless because there is
           genuinely nothing stored about it, which is the point.
        ───────────────────────────────────────── */
        case 0:
            hideDock();
            SEEDS[0]();
            setCam('hero', true);
            orbitCtrl.enabled = true;
            setCaption('', 'What animation actually stores',
                'A <b>keyframe</b> is a saved pose at a specific time. This rocket has no keys yet.'
                + buildMouseDiagram('orbit'));
            setTimeout(showContinue, 900);
            break;

        /* ─────────────────────────────────────────
           BEAT 1: a keyframe is a pose plus a time
           One button, one diamond. The pose is already correct, so the only new
           idea is that storing it is a thing you have to ask for.
        ───────────────────────────────────────── */
        case 1:
            revealControls(['time']);
            SEEDS[1]();
            setCaption(1, 'A keyframe is a pose plus a time',
                '<b>Press Set keyframe.</b> The diamond means “save this ground pose at frame 0.”');
            playDemo([
                cursorAt(() => sliderThumbPoint('timeline')),
                cursorTo(() => buttonPoint('#btn-set-key'), 0.7),
                clickButton('#btn-set-key', setKeyframe),
                hold(() => buttonPoint('#btn-set-key'), 1.3),
                reseed(1),
            ]);
            break;

        /* ─────────────────────────────────────────
           BEAT 2: two keys make motion
           The camera squares up here and stays there: from now on the thing to
           read is vertical distance, and at three-quarters a rise reads partly
           as a move away from the camera.
        ───────────────────────────────────────── */
        case 2:
            revealControls(['time', 'pose']);
            SEEDS[2]();
            setCaption(2, 'Two moments is motion',
                '<b>Move to a later frame, raise the rocket, set another key, then press Play.</b>');
            playDemo([
                cursorAt(() => sliderThumbPoint('timeline')),
                dragTimeline(0, 60, 1.3),
                hold(() => sliderThumbPoint('timeline'), 0.5),
                cursorTo(() => sliderThumbPoint('height'), 0.6),
                dragSlider('height', 0, 45, 1.3),
                hold(() => sliderThumbPoint('height'), 0.7),
                cursorTo(() => buttonPoint('#btn-set-key'), 0.6),
                clickButton('#btn-set-key', setKeyframe),
                hold(() => buttonPoint('#btn-set-key'), 0.7),
                cursorTo(() => buttonPoint('#btn-play'), 0.6),
                clickButton('#btn-play', () => setPlaying(true)),
                hold(() => buttonPoint('#btn-play'), 2.4),
                reseed(2),
            ], { camKey: 'side', release: 'side' });
            break;

        /* ─────────────────────────────────────────
           BEAT 3: the in-betweens are invented
           The slowest demo in the lab. The ghosts and the solid rocket have to be
           on screen together for long enough that the student notices the solid
           one is not sitting on either of them.
        ───────────────────────────────────────── */
        case 3:
            revealControls(['time', 'pose', 'graph']);
            SEEDS[3]();
            setCaption(3, 'The in-betweens are calculated',
                '<b>Drag slowly between the diamonds.</b> The ghosts are saved keys; the solid rocket is an interpolated pose.');
            playDemo([
                cursorAt(() => sliderThumbPoint('timeline')),
                dragTimeline(0, 60, 3.4),
                hold(() => sliderThumbPoint('timeline'), 0.9),
                dragTimeline(60, 14, 2.4),
                hold(() => sliderThumbPoint('timeline'), 0.9),
                reseed(3),
            ], { camKey: 'side', release: 'side' });
            break;

        /* ─────────────────────────────────────────
           BEAT 4: interpolation is the rule
           Three keys rather than two, because on a single straight run the three
           rules are almost impossible to tell apart.
        ───────────────────────────────────────── */
        case 4:
            revealControls(['time', 'pose', 'graph', 'easing']);
            SEEDS[4]();
            setCaption(4, 'Interpolation is a rule you pick',
                '<b>Try Stepped, Linear and Ease.</b> Stepped snaps, Linear keeps one speed, and Ease starts and stops gently.');
            playDemo([
                cursorAt(() => buttonPoint('[data-easing="ease"]')),
                cursorTo(() => buttonPoint('[data-easing="step"]'), 0.6),
                clickButton('[data-easing="step"]', () => setEasing('step')),
                hold(() => buttonPoint('[data-easing="step"]'), 1.5),
                cursorTo(() => buttonPoint('[data-easing="linear"]'), 0.5),
                clickButton('[data-easing="linear"]', () => setEasing('linear')),
                hold(() => buttonPoint('[data-easing="linear"]'), 1.5),
                cursorTo(() => buttonPoint('[data-easing="ease"]'), 0.5),
                clickButton('[data-easing="ease"]', () => setEasing('ease')),
                hold(() => buttonPoint('[data-easing="ease"]'), 1.5),
                reseed(4),
            ], { camKey: 'side', release: 'side' });
            break;

        /* ─────────────────────────────────────────
           BEAT 5: several channels at once
           No new control. The two sliders that have been sitting there unused
           since step 2 get their demo, and the camera comes in because the change
           is on the object rather than in where it is.
        ───────────────────────────────────────── */
        case 5:
            revealControls(['time', 'pose', 'graph', 'easing']);
            SEEDS[5]();
            setCaption(5, 'Channels: one curve per property',
                '<b>Make a key that changes Turn and Size.</b> Each property is its own channel; this graph shows Height only.');
            playDemo([
                cursorAt(() => sliderThumbPoint('timeline')),
                dragTimeline(0, 70, 1.1),
                cursorTo(() => sliderThumbPoint('turn'), 0.6),
                dragSlider('turn', 0, 180, 1.5),
                hold(() => sliderThumbPoint('turn'), 0.7),
                cursorTo(() => sliderThumbPoint('size'), 0.6),
                dragSlider('size', 100, 70, 1.1),
                hold(() => sliderThumbPoint('size'), 0.7),
                cursorTo(() => buttonPoint('#btn-set-key'), 0.6),
                clickButton('#btn-set-key', setKeyframe),
                hold(() => buttonPoint('#btn-set-key'), 1.1),
                reseed(5),
            ], { camKey: 'close', release: 'close' });
            break;

        /* ─────────────────────────────────────────
           BEAT 6: the challenge
           No demo. Everything the student needs has been demonstrated once, and
           the checklist in the dock is the only new thing on screen.
        ───────────────────────────────────────── */
        case 6:
            revealControls(['time', 'pose', 'graph', 'easing']);
            SEEDS[6]();
            setCam('side');
            orbitCtrl.enabled = true;
            setMode('interact');
            setCaption(6, 'Tell a three-pose story',
                '<b>Key a ground pose near 0, an airborne pose above height 3 with 90&deg;+ turn, and a ground pose near 100.</b> Then play it.');
            updateGoals();
            flashControl('time');
            break;

        case 7:
            hideDock();
            setCam('hero');
            orbitCtrl.enabled = true;
            setMode(null);
            setCaption('Check what you learned', 'Three animation decisions',
                'Pick an answer. The explanation will help if you miss.');
            startQuiz(showContinue);
            break;

        /* ─────────────────────────────────────────
           BEAT 8: free play
           Keeps the worked animation available for remixing.
        ───────────────────────────────────────── */
        case 8:
            revealControls(['time', 'pose', 'graph', 'easing', 'actor', 'recipes']);
            setCam('hero');
            orbitCtrl.enabled = true;
            setMode(null);
            setCaption('', '<span class="cap-celebrate-icon">🎉</span>You can key an animation',
                'Keys save poses in time. Interpolation fills the gaps. Channels let each property change separately.<br><br><b>Load a recipe and change one thing.</b>');
            document.getElementById('panel').classList.add('panel-celebrate');
            flashControl('recipes');
            setTimeout(showFinishButton, 300);
            break;
    }
}

/* ═══════════════════════════════════════════════
   COMPLETION CHECKS
   Called on every control change. Unlocks Continue once the beat's goal is met.

   Only real interaction reaches here: a Watch demo drives the model directly and
   never emits, so a demo can author whatever it likes without ticking a gate.
═══════════════════════════════════════════════ */

/* the four rows of the step 6 checklist */
function goals() {
    return {
        start: keys.some(k => k.frame <= 5 && k.pose.y <= 0.25),
        apex: keys.some(k => k.frame >= 10 && k.frame <= 90 && k.pose.y >= 3 && k.pose.turn >= 90),
        land: keys.some(k => k.frame >= 95 && k.pose.y <= 0.25),
        played: state.playedSinceEdit,
    };
}

function updateGoals() {
    Object.entries(goals()).forEach(([name, met]) => setGoal(name, met));
}

export function checkBeatComplete(key) {
    if (state.beatLocked || !key) return;

    // Track first, gate second: a student who explores early still gets credit,
    // but Continue only appears once it is their turn.
    if (key === 'play') {
        state.playPressed = true;
        state.playedSinceEdit = true;
    }
    // Editing the keys invalidates the last playthrough, so step 6 asks the
    // student to watch the animation they actually finished.
    if (key === 'key' || key === 'delkey' || key.startsWith('recipe:')) state.playedSinceEdit = false;
    if (key === 'frame' && state.beatIdx === 3 && !keyAt(getFrame())) state.scrubbedFrames.add(getFrame());
    if (key.startsWith('easing:')) state.easingsTried.add(key);

    if (state.beatIdx === 6) updateGoals();

    if (document.getElementById('btn-continue').classList.contains('on')) return;

    switch (state.beatIdx) {
        case 1: if (keys.length >= 1) showContinue(); break;
        case 2: if (keys.length >= 2 && state.playPressed) showContinue(); break;
        case 3: if (state.scrubbedFrames.size >= 6) showContinue(); break;
        case 4: if (state.easingsTried.size >= 3) showContinue(); break;
        case 5:
            if (keys.some(k => k.pose.turn >= 90) && keys.some(k => Math.abs(k.pose.size - 1) >= 0.2)) showContinue();
            break;
        case 6: if (Object.values(goals()).every(Boolean)) showContinue(); break;
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
