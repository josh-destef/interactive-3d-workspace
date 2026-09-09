import { BEAT, TOTAL_BEATS, NUMBERED_STEPS, COPY, CONTROLS, RAIL, CAMS, COLORS, PRIMITIVES, LIMITS } from './config.js';
import { state, addObject, duplicateObject, groupObjects, getEntry, setColor, serialize, restore, clearAll, addMount, snapToPort, rootEntries } from './model.js';
import { session, select, setTool, activeId, onSession } from './session.js';
import { initGizmos, setGizmoTarget, updateGizmos, showFor } from './gizmos.js';
import { initInteraction, setModellingEnabled, setSnapArmed } from './interaction.js';
import { initOutliner, renderRows, setReadout } from './outliner.js';
import { initHistory, push, undo, redo, resetHistory, canUndo, canRedo } from './history.js';
import { loadGizmobot, gizmobot, resetTurn, portWorldPoint, turn } from './gizmobot.js';
import { saveModule } from './subject.js';
import { createBeats } from '../../../kit/js/beats.js';
import { buildSwatches, markActiveSwatch, flashControl } from '../../../kit/js/controls.js';
import { startQuiz, endQuiz } from '../../../kit/js/quiz.js';
import { celebrate, configureUI, hideContinue } from '../../../kit/js/ui.js';
import { runSequence, hold } from '../../../kit/js/anim.js';
import { QUESTIONS } from './quizQuestions.js';

let beats, stage, mountColour = '#ff9022';
let detailStart = 0;
let preview = [];
const pieceCount = () => state.entries.filter(e => e.kind !== 'group').length;
const canAdd = kind => {
    const idx = beats?.state.idx;
    if (pieceCount() >= LIMITS.maxObjects) return false;
    if (idx === BEAT.ADD) return kind === 'box' && pieceCount() === 0;
    return idx >= BEAT.DETAIL && idx !== BEAT.QUIZ && !!PRIMITIVES[kind];
};
export function tickLesson() { if (stage) updateGizmos(stage.camera); }
function changed(kind) { if (kind === 'snapped') { attach(); push(); } if (beats?.state.idx === BEAT.ATTACH && !state.attached) hideContinue(); sync(); beats?.notify(kind); }
function sync() {
    const entry = getEntry(activeId()); const target = beats?.state.idx === BEAT.ATTACH ? state.root : entry?.mesh;
    setSnapArmed(beats?.state.idx === BEAT.ATTACH && !state.attached);
    /* Keep scene structure anchored in the inspector even before the learner
       adds a piece; the empty state explains what will appear here. */
    document.getElementById('outliner')?.classList.toggle('on', beats?.state.idx !== BEAT.QUIZ);
    const colourLabel = document.querySelector('[data-group="colour"] .ctl-label');
    if (colourLabel) colourLabel.textContent = entry && entry.kind !== 'group' ? `Colour · ${entry.name}` : 'Select a piece to colour';
    document.querySelectorAll('#swatches .swatch').forEach(b => { b.disabled = !entry || entry.kind === 'group'; });
    markActiveSwatch('swatches', entry?.color);
    setGizmoTarget(target); showFor({ tool: session.tool, hasTarget: !!target }); renderRows(session.selected); setReadout(entry);
    document.querySelectorAll('.rail-btn[data-tool], .transform-btn[data-tool]').forEach(b => { if (!['undo', 'redo', 'duplicate'].includes(b.dataset.tool)) b.setAttribute('aria-pressed', String(b.dataset.tool === session.tool)); });
    const group = document.getElementById('btn-group'); if (group) group.disabled = !requiredPieces();
    const undoBtn = document.querySelector('[data-tool="undo"]'), redoBtn = document.querySelector('[data-tool="redo"]'); if (undoBtn) undoBtn.disabled = !canUndo(); if (redoBtn) redoBtn.disabled = !canRedo();
    document.querySelectorAll('[data-add]').forEach(b => { b.disabled = !canAdd(b.dataset.add); });
}
const requiredPieces = () => pieceCount() >= 4 && state.entries.some(e => e.kind === 'box') && state.entries.some(e => e.kind === 'cylinder') && state.entries.some(e => e.kind === 'sphere');
export async function startLesson(createdStage) {
    stage = createdStage; await loadGizmobot(stage.scene); initGizmos(stage.scene); initHistory({ serialize, restore: snap => restore(snap, { gizmobot: gizmobot() }) }); initInteraction(stage, { onChange: changed, canInteract: () => !blocked() });
    initOutliner({ onPick: id => { if (!beats?.state.locked && !beats?.state.reading) { select(id); changed('select'); } } }); onSession(sync); configureUI({ steps: NUMBERED_STEPS, beats: TOTAL_BEATS });
    buildSwatches('swatches', COLORS, hex => { if (blocked()) return; const entry = getEntry(activeId()); if (!entry || entry.kind === 'group') return; setColor(entry, hex); push(); changed('colour'); });
    wire(); beats = createBeats({ total: TOTAL_BEATS, copy: COPY, controls: CONTROLS, stage: stageFor, onEnter, demos: { [BEAT.INTRO]: explodeExample }, gates: GATES }); resetHistory(); beats.run(0);
}
const blocked = () => !beats || beats.state.locked || beats.state.reading;
function stageFor(idx) {
    endQuiz(); resetTurn(); if (idx === BEAT.DETAIL) detailStart = pieceCount(); stage.orbitCtrl.enabled = idx !== BEAT.QUIZ;
    setModellingEnabled(idx !== BEAT.INTRO && idx !== BEAT.QUIZ);
    if (idx === BEAT.INTRO) { clearAll(); example(); }
    if (idx === BEAT.ADD && state.entries.length && !state.entries.some(e => e.userMade)) { clearAll(); resetHistory(); }
    setTool(idx <= BEAT.ADD ? 'select' : 'move'); setSnapArmed(idx === BEAT.ATTACH && !state.attached);
    reveal(RAIL[idx] || []); for (const [kind, def] of Object.entries(PRIMITIVES)) { const btn = document.querySelector(`[data-add="${kind}"]`); if (btn) btn.hidden = idx < def.from; }
    if (idx === BEAT.COLOUR) select(state.entries.find(e => e.kind !== 'group')?.id);
    if (idx === BEAT.ATTACH) select(state.entries.find(e => e.kind === 'group')?.id);
    stage.flyTo(idx >= BEAT.ATTACH ? CAMS.full : CAMS.bench, idx === 0); sync();
}
function onEnter(idx) { if (idx === BEAT.QUIZ) startQuiz(QUESTIONS, () => beats.notify('quiz')); if (idx === BEAT.DONE) { celebrate(); turn(); } if (idx === BEAT.ANTENNA) flashControl('add'); }
function reveal(keys) { const rail = document.getElementById('rail'); rail?.classList.toggle('on', keys.length > 0); rail?.querySelectorAll('.rail-btn').forEach(b => b.classList.toggle('on', keys.includes(b.dataset.tool))); document.getElementById('transform-bar')?.classList.toggle('on', keys.some(k => ['move', 'rotate', 'scale'].includes(k))); }
function example() {
    const body = addObject('box');
    body.mesh.position.set(0, 1.8, -.74);
    body.mesh.scale.set(.84, .94, .34);
    setColor(body, COLORS[3]);

    const detail = addObject('box');
    detail.mesh.position.set(0, 1.46, -.95);
    detail.mesh.scale.set(.48, .2, .14);
    setColor(detail, COLORS[5]);

    const pole = addObject('cylinder');
    pole.mesh.position.set(.26, 2.46, -.83);
    pole.mesh.scale.set(.05, .58, .05);

    const ball = addObject('sphere');
    ball.mesh.position.set(.26, 2.79, -.83);
    ball.mesh.scale.setScalar(.11);
    setColor(ball, COLORS[1]);

    preview = [body, detail, pole, ball].map((entry, i) => ({ entry, home: entry.mesh.position.clone(), offset: entry.mesh.position.clone().set(...[[-.7, 0, 0], [.65, -.35, -.3], [.4, .25, 0], [.4, .55, 0]][i]) }));
}
function explodeExample(done) {
    const pose = t => preview.forEach(({ entry, home, offset }) => entry.mesh.position.copy(home).addScaledVector(offset, t));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { pose(1); done(); return; }
    runSequence([hold(.5), { duration: 1.4, fn: pose }, hold(2.4), { duration: 1.4, fn: t => pose(1 - t) }, hold(.6)], done);
}
const GATES = { 1: () => state.entries.some(e => e.kind === 'box'), 2: key => key === 'scale', 3: key => key === 'add' && pieceCount() > detailStart, 4: () => requiredPieces(), 5: () => state.entries.some(e => e.kind === 'group'), 6: key => key === 'colour', 7: () => state.attached, 8: key => ['move', 'scale', 'colour', 'add', 'duplicate'].includes(key), 9: key => key === 'quiz', 10: () => false };
function groupRig() { if (!requiredPieces()) return null; const pieces = state.entries.filter(e => e.kind !== 'group'); const group = groupObjects(pieces.map(e => e.id), 'Back Unit'); const body = pieces.find(e => e.kind === 'box'); if (group && body && !state.mount) addMount(body.id, mountColour); if (group) select(group.id); return group; }
function attach() { if (state.attached) return; const bot = gizmobot(); if (!bot) return; if (rootEntries().length > 1) groupObjects(rootEntries().map(e => e.id), 'Back Unit'); bot.attach(state.root); state.attached = true; setSnapArmed(false); }
function wire() {
 document.querySelectorAll('[data-add]').forEach(btn => btn.addEventListener('click', () => { if (blocked() || !canAdd(btn.dataset.add)) return; const entry = addObject(btn.dataset.add); if (!entry) return; entry.userMade = true; select(entry.id); push(); changed('add'); }));
 document.getElementById('btn-group')?.addEventListener('click', () => { if (blocked()) return; if (groupRig()) { push(); changed('group'); } });
 document.getElementById('btn-attach')?.addEventListener('click', () => { if (blocked()) return; if (snapToPort(portWorldPoint())) { attach(); push(); changed('attach'); } });
 document.getElementById('btn-save')?.addEventListener('click', async () => { if (!blocked()) await saveModule(); });
 document.querySelectorAll('.rail-btn[data-tool], .transform-btn[data-tool]').forEach(btn => btn.addEventListener('click', () => { if (blocked()) return; const tool = btn.dataset.tool; if (tool === 'undo') { undo(); changed('undo'); } else if (tool === 'redo') { redo(); changed('redo'); } else if (tool === 'duplicate') { const copy = duplicateObject(activeId()); if (copy) { select(copy.id); push(); changed('duplicate'); } } else { setTool(tool); changed('tool'); } }));
}
