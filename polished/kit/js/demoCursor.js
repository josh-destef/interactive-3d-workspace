/* ═══════════════════════════════════════════════
   DEMO CURSOR
   The pixel pointer that drives a Watch demo.

   Two kinds of lab need it in two coordinate spaces:

     - a lab whose demos drive DOM controls (sliders, buttons) positions it in
       viewport pixels           -> moveDemoCursor({x, y}) with #demo-cursor.fixed
     - a lab whose demos happen in the 3D scene positions it by projecting a
       world point onto the canvas -> moveDemoCursor3D(vector3, camera)

   Both drive the same element, so a lab that does both (drag a gizmo, then
   press a button) needs nothing extra.

   The press glow says WHICH MOUSE BUTTON is down:

     orange  the left button
     green   the right button

   That is the whole rule, and it is worth keeping strict. The glow is the
   only thing telling a student the cursor acted rather than passed over, and
   the one interaction a beginner cannot guess at is which button to hold - so
   the colour is spent on saying that and nothing else. Do not recruit green
   for "a click rather than a drag"; a left-click and a left-drag are the same
   button and read as the same colour.

   Every demo starts the cursor near the middle of the screen before it
   travels to its target. A cursor that simply appears in the bottom corner is
   a cursor nobody notices.
═══════════════════════════════════════════════ */

const el = document.getElementById('demo-cursor');

/* The pointer art. Each subpath is one horizontal run of pixels, which is why
   it is unreadable and why it lives here rather than being pasted into every
   lab's markup. `shape-rendering: crispEdges` is what keeps it pixel art
   instead of a blurry small arrow. */
export const CURSOR_SVG =
    '<svg width="22" height="30" viewBox="0 0 11 15" shape-rendering="crispEdges" aria-hidden="true">' +
    '<path fill="#1a1a2e" d="M0 0h1v1h-1z M0 1h2v1h-2z M0 2h1v1h-1z M2 2h1v1h-1z M0 3h1v1h-1z M3 3h1v1h-1z ' +
    'M0 4h1v1h-1z M4 4h1v1h-1z M0 5h1v1h-1z M5 5h1v1h-1z M0 6h1v1h-1z M6 6h1v1h-1z M0 7h1v1h-1z M7 7h1v1h-1z ' +
    'M0 8h1v1h-1z M8 8h1v1h-1z M0 9h1v1h-1z M9 9h1v1h-1z M0 10h1v1h-1z M6 10h5v1h-5z M0 11h1v1h-1z ' +
    'M3 11h1v1h-1z M6 11h1v1h-1z M0 12h1v1h-1z M2 12h1v1h-1z M4 12h1v1h-1z M7 12h1v1h-1z M0 13h2v1h-2z ' +
    'M4 13h1v1h-1z M7 13h1v1h-1z M5 14h2v1h-2z"/>' +
    '<path fill="#ffffff" d="M1 2h1v1h-1z M1 3h2v1h-2z M1 4h3v1h-3z M1 5h4v1h-4z M1 6h5v1h-5z M1 7h6v1h-6z ' +
    'M1 8h7v1h-7z M1 9h8v1h-8z M1 10h5v1h-5z M1 11h2v1h-2z M4 11h2v1h-2z M1 12h1v1h-1z M5 12h2v1h-2z ' +
    'M5 13h2v1h-2z"/></svg>';

/** Fill a cursor element with the pointer art, if it is not already inline. */
export function paintCursor(target = el) {
    if (target && !target.innerHTML.trim()) target.innerHTML = CURSOR_SVG;
}

/* Where the cursor is now, so a move can ease from wherever the last one left
   it instead of teleporting. */
let current = { x: 0, y: 0 };

export function toggleDemoCursor(on) {
    if (!el) return;
    // full reset either way, so no press state leaks between demos
    el.classList.toggle('on', !!on);
    if (!on) el.classList.remove('down', 'click', 'right');
}

/* ── viewport-space (DOM controls) ── */
export function moveDemoCursor(point) {
    if (!el || !point) return;
    current = point;
    el.style.left = point.x + 'px';
    el.style.top = point.y + 'px';
}

export function getDemoCursorPoint() { return current; }

/* Where a demo begins: the middle of the viewport, a little above center so
   the pointer does not sit on top of the thing the student is meant to watch. */
export function centerPoint() {
    return { x: window.innerWidth / 2, y: window.innerHeight * 0.44 };
}

/* The center of a control, for a demo that has to travel to a real element
   rather than to a guessed coordinate - so the demo stays correct when the
   layout reflows. */
export function pointAt(elementOrSelector, { xFrac = 0.5, yFrac = 0.5 } = {}) {
    const target = typeof elementOrSelector === 'string'
        ? document.querySelector(elementOrSelector)
        : elementOrSelector;
    if (!target) return centerPoint();
    const r = target.getBoundingClientRect();
    return { x: r.left + r.width * xFrac, y: r.top + r.height * yFrac };
}

/* The point on a range input's track for a given value - where the thumb would
   sit. A slider demo eases between two of these. */
export function sliderPoint(input, value) {
    if (!input) return centerPoint();
    const r = input.getBoundingClientRect();
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const t = (Number(value) - min) / (max - min || 1);
    // The thumb travels between half-a-thumb inside each end of the track.
    const inset = 8;
    return { x: r.left + inset + (r.width - inset * 2) * t, y: r.top + r.height / 2 };
}

/* ── canvas-space (3D scenes) ── */

/* Normalised device coords (-1..1, y up), which is what `.project(camera)`
   returns. `wrap` is the element the cursor is positioned inside. */
export function moveDemoCursorNDC(x, y, wrap) {
    const box = wrap || document.getElementById('canvas-wrap');
    if (!el || !box) return;
    const px = (x * 0.5 + 0.5) * box.clientWidth;
    const py = (y * -0.5 + 0.5) * box.clientHeight;
    current = { x: px, y: py };
    el.style.transform = `translate(${px}px, ${py}px)`;
}

/* Canvas fractions (0..1, y down) - the form most hand-authored demo paths
   are written in, because "a third of the way across" is easier to reason
   about than a device coordinate. */
export function moveDemoCursorFrac(x, y, wrap) {
    const box = wrap || document.getElementById('canvas-wrap');
    if (!el || !box) return;
    const px = x * box.clientWidth;
    const py = y * box.clientHeight;
    current = { x: px, y: py };
    el.style.transform = `translate(${px}px, ${py}px)`;
}

/* Follow a point in the scene - a gizmo arrow head, a joint, a handle. */
export function moveDemoCursor3D(worldPos, camera, wrap) {
    if (!camera || !worldPos) return;
    const p = worldPos.clone().project(camera);
    moveDemoCursorNDC(p.x, p.y, wrap);
}

/* ── press feedback ──
   setDemoCursorDown(true)          left button  - orange
   setDemoCursorDown(true, 'right') right button - green

   'click' is accepted as a legacy alias for green because Material Lab's
   module used that word, but nothing ships it; prefer 'right'. */
export function setDemoCursorDown(down, button = 'left') {
    if (!el) return;
    const isRight = button === 'right' || button === 'click';
    el.classList.toggle('down', !!down);
    el.classList.toggle('right', !!down && isRight);
    el.classList.toggle('click', !!down && isRight);
}
