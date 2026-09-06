/* ═══════════════════════════════════════════════
   GALLERY
   Drives index.html - the kit's own reference page. Nothing here is part of
   the kit; it only exercises it.

   It is worth noting what this file does NOT import: three.js. ui.js,
   controls.js, quiz.js, demoCursor.js, mouseDiagram.js, anim.js and utils.js
   are all free of it, so a page with no 3D scene can still use the whole
   shell - including running a real scripted demo, which is what the Watch
   switch does below. Only beats.js and stage.js reach for three.
═══════════════════════════════════════════════ */
import {
    configureUI, setCaption, setMode, showWatch, hideWatch, showContinue,
    hideContinue, showReadCard, showChoice, celebrate, setProgress, setHint,
    trackSurfaceHeight,
} from './ui.js';
import {
    revealControls, buildSwatches, markActiveSwatch,
    buildExamples, markActiveExample, paintSlider, setReadout, bindSegment,
} from './controls.js';
import { startQuiz, endQuiz } from './quiz.js';
import { buildMouseDiagram, MOUSE_DIAGRAMS } from './mouseDiagram.js';
import { animate01, runSequence, tickAnims, clearAnims, hold, tweenTo } from './anim.js';
import {
    paintCursor, toggleDemoCursor, moveDemoCursor, setDemoCursorDown,
    centerPoint, sliderPoint,
} from './demoCursor.js';

configureUI({ steps: 6, beats: 8 });

/* Keeps --console-h current as the dock reveals rows, so the frame's canvas
   ends where the console begins. Same call a lab makes from its main.js. */
trackSurfaceHeight();

/* ══ the pointer ══
   One source of pixel art for the live cursor and for the three specimens. */
paintCursor();
document.querySelectorAll('[data-cursor]').forEach(paintCursor);

/* anim.js needs a clock. A lab gets one from its render loop; this page has
   no scene, so it runs the smallest possible one. */
let last = performance.now();
(function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    tickAnims(dt);
})(last);

/* ══ the miniature lab ══ */
const standIn = document.querySelector('.stand-in');
const sizeInput = document.getElementById('demo-size');

function applySize() {
    const s = Number(sizeInput.value) / 100;
    standIn.style.transform = `translate(-50%, -50%) scale(${s})`;
    setReadout('demo-size', s.toFixed(2));
    paintSlider(sizeInput);
}
sizeInput.addEventListener('input', applySize);
applySize();

buildSwatches('demo-swatches', ['#ff9022', '#c0453a', '#ffda22', '#00aa00', '#3a6fa8', '#8b5cf6'], hex => {
    standIn.style.background = `linear-gradient(150deg, ${hex}, ${hex} 45%, rgba(0,0,0,.35))`;
    markActiveSwatch('demo-swatches', hex);
});
markActiveSwatch('demo-swatches', '#ff9022');

/* One caption, written once, true before AND after the demo - the rule the
   whole system is built around. */
const CAPTION = [
    2,
    'Make it bigger and smaller',
    '<b>Drag the Size slider both ways.</b> Watch the shadow grow and shrink with it — that is how you can tell size changed rather than the camera moving.',
];

function reset() {
    clearAnims();
    toggleDemoCursor(false);
    setDemoCursorDown(false);
    hideContinue();
    setMode(null);
    endQuiz();
    setHint('');
    setCaption(...CAPTION);
    revealControls(['demo-size', 'demo-color']);
    setProgress(3);
}

/* ── the worked example, for real ──
   The same shape a lab's demo has: travel to the control from the middle of
   the screen, press, drag it both ways, release. It drives the actual slider,
   not a stand-in for one, which is the entire point of a worked example.

   Coordinates come from getBoundingClientRect every frame, so the demo stays
   correct if the page is scrolled or resized between runs. */
function runCursorDemo(done) {
    const thumb = () => sliderPoint(sizeInput, sizeInput.value);

    const dragTo = value => tweenTo(1.05,
        () => Number(sizeInput.value),
        v => {
            sizeInput.value = Math.round(v);
            applySize();
            moveDemoCursor(thumb());
        },
        value);

    let start = null;
    const travel = {
        duration: 0.9,
        fn: t => {
            if (t === 0) {
                start = centerPoint();
                toggleDemoCursor(true);
                moveDemoCursor(start);
            }
            const end = thumb();
            moveDemoCursor({
                x: start.x + (end.x - start.x) * t,
                y: start.y + (end.y - start.y) * t,
            });
        },
    };

    runSequence([
        travel,
        { duration: 0.3, fn: t => { if (t === 0) setDemoCursorDown(true); } },
        dragTo(155),
        hold(0.45),
        dragTo(62),
        hold(0.45),
        dragTo(100),
        { duration: 0.4, fn: t => { if (t === 0) setDemoCursorDown(false); } },
    ], () => {
        toggleDemoCursor(false);
        if (done) done();
    });
}

const ACTIONS = {
    read: () => showReadCard({
        step: 2,
        title: 'Make it bigger and smaller',
        body: 'Scale changes how large an object is without changing what it is. The shape stays the same; only its size changes.',
        cta: 'Watch it scale',
    }, () => ACTIONS.watch()),

    watch: () => {
        clearAnims();
        // The demo is driven in viewport coordinates, so the shell has to be
        // on screen for it to look like anything.
        document.querySelector('.frame').scrollIntoView({ block: 'center', behavior: 'smooth' });
        showWatch();
        setHint('the demo is driving the real slider');
        animate01(0.6, () => { }, () => runCursorDemo(() => ACTIONS.turn()));
    },

    turn: () => { hideWatch(); setHint(''); },

    continue: () => showContinue(),

    celebrate: () => {
        setCaption('', '<span class="cap-celebrate-icon">✨</span>Nicely done',
            'You changed an object’s <b>size</b> and its <b>color</b>, and saw that neither one changed the other.');
        setProgress(7);
        celebrate();
        showContinue();
    },

    choice: () => showChoice({
        title: 'Want to see how colors are mixed?',
        body: 'A short side lesson on red, green and blue. You can come back to it later — the main lesson carries on either way.',
        primary: 'Show me',
        secondary: 'Maybe later',
    }, reset, reset),

    quiz: () => startQuiz(QUESTIONS, () => showContinue()),

    reset,
};

document.querySelectorAll('[data-demo]').forEach(btn => {
    btn.addEventListener('click', () => ACTIONS[btn.dataset.demo]?.());
});

/* ══ the control board ══ */
const rough = document.getElementById('s-rough');
rough.addEventListener('input', () => {
    paintSlider(rough);
    setReadout('rough', (Number(rough.value) / 100).toFixed(2));
});
paintSlider(rough);

buildSwatches('pal', ['#c66f48', '#22252b', '#ffdb93', '#fad1c2', '#c5c7c8', '#f2f0eb'], hex =>
    markActiveSwatch('pal', hex));
markActiveSwatch('pal', '#ffdb93');

buildExamples('ex', {
    clay: { label: 'Clay', color: '#c66f48' },
    chrome: { label: 'Chrome', color: '#d8e0e8' },
    rubber: { label: 'Rubber', color: '#22252b' },
}, key => markActiveExample('ex', key));

bindSegment('seg-demo', 'room', () => { });
bindSegment('seg-light', 'light', () => { });

document.querySelectorAll('.rgb-row input').forEach(paintSlider);

/* ══ the mouse diagrams ══ */
document.getElementById('mice').innerHTML = Object.keys(MOUSE_DIAGRAMS)
    .filter(k => k !== 'click')
    .map(key =>
        `<div class="cell"><div class="cell-name">${key}</div>${buildMouseDiagram(key)}</div>`)
    .join('');

/* ══ the tokens ══ */
const TOKENS = [
    ['--orange', 'the one accent: actions, the student’s turn, their own work'],
    ['--green', 'step labels and keyboard hints — never a success/fail color'],
    ['--dark', 'the Watch state, and any surface that has to recede'],
    ['--axis-x', 'X, everywhere in 2D UI'],
    ['--axis-y', 'Y'],
    ['--axis-z', 'Z'],
    ['--ch-r', 'red channel'],
    ['--ch-g', 'green channel'],
    ['--ch-b', 'blue channel'],
];

document.getElementById('tokens').innerHTML = TOKENS.map(([name, use]) => `
    <div class="cell" style="max-width:230px">
        <div style="height:46px;border-radius:9px;background:var(${name});box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)"></div>
        <div class="cell-name">${name}</div>
        <div style="font-size:12px;font-weight:300;line-height:1.5;color:#777">${use}</div>
    </div>`).join('');

/* ══ quiz content, for the demo card ══ */
const QUESTIONS = [
    {
        q: 'You made the shape twice as big. What changed?',
        options: [
            { text: 'How large it is, but not what it is', correct: true, why: 'Right. Scale changes size only — the same shape, larger.' },
            { text: 'The camera moved closer', why: 'The camera stayed put. The shadow tells them apart: moving the camera does not change the shadow, and scaling does.' },
            { text: 'It became a different shape', why: 'A bigger version of a shape is still that shape. Changing what it is would mean editing the model.' },
        ],
    },
    {
        q: 'You changed the color. What happened to the shape?',
        options: [
            { text: 'Nothing — color and shape are separate', correct: true, why: 'Exactly. Shape comes from the model; color comes from its material.' },
            { text: 'It got slightly bigger', why: 'A bright color can look larger against a dark background, but nothing about the object changed.' },
            { text: 'It became smoother', why: 'Only its color changed. Smoothness is a different material property with its own control.' },
        ],
    },
];

reset();
