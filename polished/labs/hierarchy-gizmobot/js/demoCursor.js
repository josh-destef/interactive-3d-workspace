/* ═══════════════════════════════════════════════
   DEMO CURSOR
   The pixel pointer that drives the sliders during a Watch demo.

   Unlike the navigate lab, where the cursor tracks a 3D gizmo handle, everything
   this lab demonstrates lives in the DOM. So this is a plain viewport-space
   cursor that gets parked on a real control.
═══════════════════════════════════════════════ */
const el = document.getElementById('demo-cursor');

/* Where the cursor is right now, so a move step can ease from wherever the last
   one left it instead of teleporting. */
let current = { x: 0, y: 0 };

export function toggleDemoCursor(on) {
    el.classList.toggle('on', !!on);
    if (!on) el.classList.remove('down');
}

export function moveDemoCursor(point) {
    if (!point) return;
    current = point;
    el.style.left = `${point.x}px`;
    el.style.top = `${point.y}px`;
}

export function getDemoCursorPoint() { return current; }

export function setDemoCursorDown(down) {
    el.classList.toggle('down', !!down);
}
