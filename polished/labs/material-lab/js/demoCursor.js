/* ═══════════════════════════════════════════════
   DEMO CURSOR
   The pixel pointer that drives the controls during a Watch demo.

   Everything this lab demonstrates lives in the DOM, so this is a plain
   viewport-space cursor parked on a real control. Every demo starts it in the
   middle of the screen before it travels down to the console - a cursor that
   simply appears in the bottom corner is a cursor nobody notices.
═══════════════════════════════════════════════ */
const el = document.getElementById('demo-cursor');

/* Where the cursor is right now, so a move step can ease from wherever the last
   one left it instead of teleporting. */
let current = { x: 0, y: 0 };

export function toggleDemoCursor(on) {
    el.classList.toggle('on', !!on);
    if (!on) el.classList.remove('down', 'click');
}

export function moveDemoCursor(point) {
    if (!point) return;
    current = point;
    el.style.left = `${point.x}px`;
    el.style.top = `${point.y}px`;
}

export function getDemoCursorPoint() { return current; }

/* Press feedback, in the two colors the Navigate + Transform lab uses: orange
   while dragging a slider, green for a single click on a swatch or an example. */
export function setDemoCursorDown(down, kind = 'drag') {
    el.classList.toggle('down', !!down);
    el.classList.toggle('click', !!down && kind === 'click');
}

/* Where a demo begins: the middle of the viewport, a little above center so the
   spotlight does not sit on top of the model the student is meant to watch. */
export function centerPoint() {
    return { x: window.innerWidth / 2, y: window.innerHeight * 0.44 };
}
