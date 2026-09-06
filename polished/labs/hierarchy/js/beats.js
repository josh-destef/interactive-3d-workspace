/* ═══════════════════════════════════════════════
   BEAT SYSTEM
   Each beat reveals one control, plays a Watch demo over it, then waits for the
   student to use it themselves before Continue unlocks.

   The order is the lesson. Inheritance flows down a chain, so the base comes
   first and the claw comes last; a child's own numbers never change while it is
   carried, so the readout arrives before the tree; every node owns a coordinate
   system, so the axes arrive after the student has seen one node move another;
   and grabbing something is reparenting it, which only means anything once all
   four of those are in place.
═══════════════════════════════════════════════ */
import { TOTAL_BEATS } from './config.js';
import { state } from './state.js';
import { setCam, releaseCamera, orbitCtrl } from './stage.js';
import { runSequence, clearAnims } from './anim.js';
import { lerp } from './utils.js';
import { joints, setJoints, isHeld, resetPickup, setAxesVisible } from './arm.js';
import {
    revealControls, hideDock, lockDock, flashControl, showReadout,
    demoSetSlider, setSelectedNode, sliderThumbPoint, nodeButtonPoint, syncFromValues,
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

/* Drag a slider from one value to another with the cursor riding the thumb. */
function dragSlider(key, from, to, duration = 1.5) {
    return {
        duration, fn: t => {
            if (t === 0) setDemoCursorDown(true);
            demoSetSlider(key, Math.round(lerp(from, to, t)));
            moveDemoCursor(sliderThumbPoint(key));
        },
    };
}

/* Let go and hold still - the pause is where the student actually looks at the
   arm instead of the moving control. */
function hold(key, duration = 0.9) {
    return {
        duration, fn: t => {
            if (t === 0) setDemoCursorDown(false);
            if (key) moveDemoCursor(sliderThumbPoint(key));
        },
    };
}

/* Press a scene-tree button. Held down a little longer than a real click so the
   selection and the press are legible as one event. */
function clickNode(name, duration = 0.5) {
    return {
        duration, fn: t => {
            if (t === 0) {
                setDemoCursorDown(true);
                setSelectedNode(name);
            }
            if (t > 0.6) setDemoCursorDown(false);
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

/* Park the joints where the demo below starts from. Without this a student who
   drags a slider and then hits Replay watches the knob teleport. */
function park(pose) {
    setJoints(pose);
    syncFromValues();
}

/* ═══════════════════════════════════════════════ */

const READ = [
    { step: '', title: 'This arm is four objects', body: 'The base holds the shoulder, the shoulder holds the elbow, and the elbow holds the wrist. That chain is a hierarchy.', cta: 'Start the lab' },
    { step: 1, title: 'Move one, move many', body: 'When a parent moves, every object inside it comes along.' },
    { step: 2, title: 'Motion only travels down', body: 'Children follow parents. Children do not push motion back up the chain.' },
    { step: 3, title: 'Where is the wrist?', body: '<b>Local</b> answers “inside the elbow.” <b>World</b> answers “inside the whole scene.”' },
    { step: 4, title: 'Every object has its own up', body: 'Local axes turn with the object they belong to.' },
    { step: 5, title: 'The claw adds the whole chain', body: 'Its final pose combines the base, shoulder, elbow and wrist.' },
    { step: 6, title: 'Make the block follow the hand', body: 'Catch the block and it becomes part of the arm’s hierarchy.', cta: 'Start the challenge' },
    null,
    { step: 'Done', title: 'Keep experimenting', body: 'Use the pose presets, select different nodes, and watch local and world values tell two versions of the same pose.', cta: 'Enter free play' },
];

export function runBeat(idx, { skipRead = false } = {}) {
    state.beatIdx = idx;
    state.beatLocked = false;
    hideContinue();
    setMode(null);
    clearAnims();
    toggleDemoCursor(false);
    lockDock(false);

    /* reset per-beat interaction tracking */
    state.baseLeft = false;
    state.baseRight = false;
    state.shoulderBack = false;
    state.shoulderFwd = false;
    state.travel = {};
    state.nodesTried = new Set();
    state.wristTurned = false;
    state.gripClosed = false;
    state.gripOpened = false;
    state.pickupTold = false;

    /* The block goes home on every beat but the last, so a student who caught it
       while exploring still gets the challenge whole. Free play inherits
       whatever they were holding. */
    if (idx !== TOTAL_BEATS - 1) resetPickup();
    if (idx !== 7) endQuiz();

    setAxesVisible(idx >= 4 && idx !== 7);
    showReadout(idx >= 3 && idx !== 7);
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
           BEAT 0: what a hierarchy is
           Nothing to do but look. The arm stands straight so the stack of four
           groups reads as a stack before anything starts bending.
        ───────────────────────────────────────── */
        case 0:
            hideDock();
            park({ base: 0, shoulder: 0, elbow: 0, wrist: 0, grip: 0 });
            setCam('hero', true);
            orbitCtrl.enabled = true;
            setCaption('', 'What a hierarchy is',
                'Each piece is a <b>node</b>. The holder is the parent; the held piece is its child.'
                + buildMouseDiagram('orbit'));
            setTimeout(showContinue, 900);
            break;

        /* ─────────────────────────────────────────
           BEAT 1: a parent carries its children
           The root joint first, because it is the one whose effect is impossible
           to miss - every other piece in the scene swings with it.
        ───────────────────────────────────────── */
        case 1:
            revealControls(['base']);
            park({ base: 0, shoulder: 0, elbow: 0, wrist: 0, grip: 0 });
            setCaption(1, 'A parent carries its children',
                '<b>Turn the base left, then right.</b> Every child follows even though its own slider stays unchanged.');
            playDemo([
                { duration: 0.6, fn: t => { if (t === 0) { toggleDemoCursor(true); moveDemoCursor(sliderThumbPoint('base')); } } },
                dragSlider('base', 0, 70, 1.5),
                hold('base', 0.9),
                dragSlider('base', 70, -70, 2.1),
                hold('base', 0.9),
                dragSlider('base', -70, 0, 1.2),
            ], { camKey: 'wide', release: 'wide' });
            break;

        /* ─────────────────────────────────────────
           BEAT 2: motion only travels downward
           The same move one link up the chain. The base holding still while the
           shoulder swings is the half of the rule nobody states out loud.
        ───────────────────────────────────────── */
        case 2:
            revealControls(['base', 'shoulder']);
            park({ base: 0, shoulder: 0, elbow: 0, wrist: 0, grip: 0 });
            setCaption(2, 'Motion travels down, never up',
                '<b>Swing the shoulder forward and back.</b> The elbow and wrist follow. The base stays still.');
            playDemo([
                { duration: 0.6, fn: t => { if (t === 0) { toggleDemoCursor(true); moveDemoCursor(sliderThumbPoint('shoulder')); } } },
                dragSlider('shoulder', 0, 60, 1.4),
                hold('shoulder', 0.9),
                dragSlider('shoulder', 60, -60, 1.9),
                hold('shoulder', 0.9),
                dragSlider('shoulder', -60, 15, 1.0),
            ], { camKey: 'arm', release: 'arm' });
            break;

        /* ─────────────────────────────────────────
           BEAT 3: local vs world
           The readout arrives here and never leaves. The demo is deliberately
           slow: the point is not that the numbers change, it is that one row
           changes and the other one sits there.
        ───────────────────────────────────────── */
        case 3:
            revealControls(['base', 'shoulder', 'elbow']);
            park({ base: 0, shoulder: 0, elbow: 30, wrist: 0, grip: 0 });
            // Pinned to the wrist: the deepest node is the one whose local
            // position is most obviously not where it appears to be.
            setSelectedNode('wrist');
            setCaption(3, 'Local space and world space',
                '<b>Move the base or shoulder and watch the wrist readout.</b> World changes; Local stays fixed inside the elbow.');
            playDemo([
                { duration: 0.7, fn: t => { if (t === 0) { toggleDemoCursor(true); moveDemoCursor(sliderThumbPoint('shoulder')); } } },
                dragSlider('shoulder', 0, 45, 2.2),
                hold('shoulder', 1.3),
                dragSlider('shoulder', 45, -35, 2.6),
                hold('shoulder', 1.3),
                dragSlider('shoulder', -35, 10, 1.1),
            ], { camKey: 'arm', release: 'arm' });
            break;

        /* ─────────────────────────────────────────
           BEAT 4: every node owns a coordinate system
           Parked mid-fold on purpose. With the arm straight every node's axes
           point the same way and the step proves nothing.
        ───────────────────────────────────────── */
        case 4:
            revealControls(['base', 'shoulder', 'elbow', 'tree']);
            park({ base: 0, shoulder: -35, elbow: 60, wrist: -20, grip: 0 });
            setSelectedNode('wrist');
            setCaption(4, 'Every node has its own axes',
                '<b>Select two different nodes.</b> Their coloured axes show the directions each node calls X, Y and Z.');
            playDemo([
                // Seeded on the elbow slider, which was already on screen: the
                // tree block is still playing its reveal animation on frame one,
                // so its buttons are not where they will be a moment later.
                { duration: 0.6, fn: t => { if (t === 0) { toggleDemoCursor(true); moveDemoCursor(sliderThumbPoint('elbow')); } } },
                cursorTo(() => nodeButtonPoint('base'), 0.7),
                clickNode('base'),
                hold(null, 1.1),
                cursorTo(() => nodeButtonPoint('elbow'), 0.6),
                clickNode('elbow'),
                hold(null, 1.1),
                cursorTo(() => nodeButtonPoint('wrist'), 0.6),
                clickNode('wrist'),
                hold(null, 1.1),
            ], { camKey: 'arm', release: 'arm' });
            break;

        /* ─────────────────────────────────────────
           BEAT 5: the deepest child
           Parked folded up and away from the block, so the claw closing during
           the demo cannot catch it and spoil the challenge one step early.
        ───────────────────────────────────────── */
        case 5:
            revealControls(['base', 'shoulder', 'elbow', 'tree', 'wrist', 'grip']);
            park({ base: 0, shoulder: -20, elbow: 50, wrist: 0, grip: 0 });
            setSelectedNode('wrist');
            setCaption(5, 'The deepest child',
                '<b>Turn the wrist, then close and reopen the claw.</b> The fingertips combine every transform above them.');
            playDemo([
                { duration: 0.6, fn: t => { if (t === 0) { toggleDemoCursor(true); moveDemoCursor(sliderThumbPoint('wrist')); } } },
                dragSlider('wrist', 0, 60, 1.3),
                hold('wrist', 0.8),
                dragSlider('wrist', 60, -60, 1.7),
                hold('wrist', 0.8),
                dragSlider('wrist', -60, 0, 1.0),
                cursorTo(() => sliderThumbPoint('grip'), 0.7),
                dragSlider('grip', 0, 100, 1.2),
                hold('grip', 0.9),
                dragSlider('grip', 100, 0, 1.2),
                hold('grip', 0.7),
            ], { camKey: 'arm', release: 'arm' });
            break;

        /* ─────────────────────────────────────────
           BEAT 6: pick up the block
           No demo. Watching someone else solve a coordination problem teaches
           nothing about solving it, and the reparenting payoff only lands if the
           student is the one who closed the claw.
        ───────────────────────────────────────── */
        case 6:
            revealControls(['base', 'shoulder', 'elbow', 'tree', 'wrist', 'grip']);
            park({ base: 0, shoulder: 0, elbow: 0, wrist: 0, grip: 0 });
            setSelectedNode('wrist');
            setCam('reach');
            orbitCtrl.enabled = true;
            setMode('interact');
            setCaption(6, 'Pick up the block',
                '<b>Move the claw around the blue block, then close the grip.</b> Use the base to aim and the shoulder and elbow to reach.');
            flashControl('grip');
            break;

        case 7:
            hideDock();
            setCam('hero');
            orbitCtrl.enabled = true;
            setMode(null);
            setCaption('Check what you learned', 'Three scene-graph decisions',
                'Pick an answer. The explanation will help if you miss.');
            startQuiz(showContinue);
            break;

        /* ─────────────────────────────────────────
           BEAT 8: free play
        ───────────────────────────────────────── */
        case 8:
            revealControls(['base', 'shoulder', 'elbow', 'tree', 'wrist', 'grip', 'presets']);
            setCam('hero');
            orbitCtrl.enabled = true;
            setMode(null);
            setCaption('', '<span class="cap-celebrate-icon">🎉</span>You can read a scene tree',
                'Parents carry children. Local and world measure the same node in two ways. Reparenting changes who carries it.<br><br><b>Try a pose preset</b>, then select a joint and predict what will follow.');
            document.getElementById('panel').classList.add('panel-celebrate');
            flashControl('presets');
            setTimeout(showFinishButton, 300);
            break;
    }

    syncFromValues();
}

/* ═══════════════════════════════════════════════
   COMPLETION CHECKS
   Called on every control change. Unlocks Continue once the beat's goal is met.
═══════════════════════════════════════════════ */

/* Widest swing seen on a joint since the beat began. Beat 3 asks for travel
   rather than for a target angle, because there is no angle that proves anything
   - what proves it is the student watching one row move and the other not. */
function trackTravel(key, value) {
    const seen = state.travel[key];
    if (!seen) { state.travel[key] = { min: value, max: value }; return; }
    seen.min = Math.min(seen.min, value);
    seen.max = Math.max(seen.max, value);
}

function widestTravel() {
    return Object.values(state.travel).reduce((m, s) => Math.max(m, s.max - s.min), 0);
}

export function checkBeatComplete(key) {
    if (state.beatLocked) return;

    // Track first, gate second: a student who explores past the goal still gets
    // credit for the parts they hit on the way.
    switch (state.beatIdx) {
        case 1:
            if (key === 'base') {
                if (joints.base <= -40) state.baseLeft = true;
                if (joints.base >= 40) state.baseRight = true;
            }
            break;
        case 2:
            if (key === 'shoulder') {
                if (joints.shoulder <= -50) state.shoulderBack = true;
                if (joints.shoulder >= 50) state.shoulderFwd = true;
            }
            break;
        case 3:
            if (key === 'base' || key === 'shoulder') trackTravel(key, joints[key]);
            break;
        case 4:
            if (key && key.startsWith('node:')) state.nodesTried.add(key);
            break;
        case 5:
            if (key === 'wrist' && Math.abs(joints.wrist) >= 30) state.wristTurned = true;
            if (key === 'grip') {
                if (joints.grip >= 70) state.gripClosed = true;
                // Only after it has been closed: the claw starts open, so an
                // untouched slider would otherwise satisfy half the gate.
                if (state.gripClosed && joints.grip <= 30) state.gripOpened = true;
            }
            break;
        case 6:
            if (isHeld() && !state.pickupTold) {
                state.pickupTold = true;
                setCaption(6, 'Caught it - the block changed parents',
                    'The block is now a <b>child of the wrist</b>. This change of parent is called reparenting.<br><br><b>Swing the base.</b> The block follows its new family.');
                // Let the new caption land before the button competes with it.
                setTimeout(() => { if (state.beatIdx === 6) showContinue(); }, 600);
            }
            break;
    }

    if (document.getElementById('btn-continue').classList.contains('on')) return;

    switch (state.beatIdx) {
        case 1: if (state.baseLeft && state.baseRight) showContinue(); break;
        case 2: if (state.shoulderBack && state.shoulderFwd) showContinue(); break;
        case 3: if (widestTravel() >= 25) showContinue(); break;
        case 4: if (state.nodesTried.size >= 2) showContinue(); break;
        case 5: if (state.wristTurned && state.gripClosed && state.gripOpened) showContinue(); break;
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
