/* ═══════════════════════════════════════════════
   THE METER
   The counts, on screen, in the corner of the canvas.

   This lesson is about a number, so the number is never more than a glance
   away - and it is read off `subject.stats()`, which reads it off the geometry
   currently being drawn. Nothing here knows what the ladder is supposed to
   contain, which is why the meter cannot quietly disagree with the asset.
═══════════════════════════════════════════════ */
import { BUDGET, ANSWER } from './config.js';
import { stats, values } from './subject.js';

const el = id => document.getElementById(id);
const n = value => value.toLocaleString('en-US');

let mode = 'hidden';     // hidden | counts | seams | budget

export function setMeterMode(next) {
    mode = next;
    el('meter').hidden = mode === 'hidden';
    el('meter-seams').hidden = mode !== 'seams';
    el('meter-budget').hidden = mode !== 'budget';
    update();
}

export function update() {
    if (mode === 'hidden') return;
    const s = stats();

    el('meter-tris').textContent = n(s.triangles);
    el('meter-verts').textContent = n(s.vertices);
    el('meter-split').textContent = n(s.splitCorners);

    if (mode !== 'budget') return;

    const over = s.sceneTriangles > BUDGET;
    el('meter-crowd-label').textContent = `${s.copies} × Gizmobot`;
    el('meter-total').textContent = n(s.sceneTriangles);
    el('meter-total').classList.toggle('over', over);

    const fill = el('meter-fill');
    fill.style.width = `${Math.min(s.sceneTriangles / BUDGET, 1) * 100}%`;
    fill.classList.toggle('over', over);

    /* Three states, not two. A level that fits the budget but has stopped
       looking like Gizmobot is the trap this step is built around, so the
       meter has to be able to say "yes, and that is still not the answer"
       rather than just turning green and going quiet. */
    const note = el('meter-note');
    if (over) {
        note.textContent = `${n(s.sceneTriangles - BUDGET)} over budget`;
        note.className = 'over';
    } else if (values.detail > ANSWER) {
        note.textContent = 'Fits — but look at him';
        note.className = 'warn';
    } else {
        note.textContent = `${n(BUDGET - s.sceneTriangles)} to spare`;
        note.className = 'ok';
    }
}
