/* ═══════════════════════════════════════════════
   LESSON
   The beats, the gates, the worked examples, and the wiring that keeps the
   viewport, the tool rail and the object list saying the same thing.

   Everything a student can touch funnels through `changed()`, so there is one
   place that records progress, refreshes the interface and tells the beat
   runner something happened.
═══════════════════════════════════════════════ */
import * as THREE from 'three';
import {
    BEAT, TOTAL_BEATS, NUMBERED_STEPS, COPY, CONTROLS, RAIL, CAMS, COLORS,
    LIMITS, GIZMO, SPAWN, PRIMITIVES,
} from './config.js';
import {
    state, addObject, duplicateObject, groupObjects, getEntry, setColor,
    setExtrude, getExtrude, setBevel, setInset, getInset, serialize, restore, clearAll, addMount,
    setMountColour, placeMount, snapToPort, distanceToPort,
    worldSizeOf, FACES, INNER_FACE, rootEntries, faceCentreWorld,
} from './model.js';
import { session, select, setMode, setTool, setFace, activeId, onSession, emitSession } from './session.js';
import {
    initGizmos, setGizmoTarget, updateGizmos, updateFaceGizmos, showFor,
    scaleRingPoint, scaleAxisPoint, moveHandlePoint, extrudeArrowPoint,
    insetHandle, bevelHandle,
    hideFaceHighlight,
} from './gizmos.js';
import { initInteraction, setMountPlacement, setSnapArmed, showReadout, hideReadout } from './interaction.js';
import { initModal, handleKey, startModal, modalRunning } from './modal.js';
import { initOutliner, renderRows, setReadout } from './outliner.js';
import { initHistory, push, undo, redo, resetHistory, canUndo, canRedo } from './history.js';
import { loadGizmobot, gizmobot, setGhost, turn, resetTurn, portWorldPoint } from './gizmobot.js';
import { saveModule } from './subject.js';

import { createBeats } from '../../../kit/js/beats.js';
import { runSequence, hold, animate01 } from '../../../kit/js/anim.js';
import { trackSpan, trackTried } from '../../../kit/js/gate.js';
import { revealControls, buildSwatches, markActiveSwatch, flashControl } from '../../../kit/js/controls.js';
import {
    toggleDemoCursor, setDemoCursorDown, pointAt, moveDemoCursor,
    getDemoCursorPoint, centerPoint,
} from '../../../kit/js/demoCursor.js';
import { startQuiz, endQuiz } from '../../../kit/js/quiz.js';
import { celebrate, configureUI, setHint, clearHint } from '../../../kit/js/ui.js';
import { buildMouseDiagram } from '../../../kit/js/mouseDiagram.js';
import { QUESTIONS } from './quizQuestions.js';

let beats, stage;
let mountColour = '#ff9022';
const done = new Set();          // free-play moves made, for the last step
let additionsThisStep = {};

/* Keep the lesson a sequence of small, deliberate decisions. The aerial is
   the one exception: it needs both of its named parts before the next step can
   teach grouping. Free play is deliberately unlimited. */
const ADD_PLAN = {
    [BEAT.ADD]: { box: 1 },
    [BEAT.DETAIL]: { box: 1 },
    [BEAT.PARTS]: { cylinder: 1, sphere: 1 },
    [BEAT.CHALLENGE]: { box: Infinity, cylinder: Infinity, sphere: Infinity, duplicate: Infinity },
    [BEAT.DONE]: { box: Infinity, cylinder: Infinity, sphere: Infinity, duplicate: Infinity },
};
const canAdd = kind => (ADD_PLAN[beats?.state.idx]?.[kind] || 0) > (additionsThisStep[kind] || 0);
const recordAddition = kind => { additionsThisStep[kind] = (additionsThisStep[kind] || 0) + 1; };

function addLockedMessage() {
    const plan = ADD_PLAN[beats?.state.idx];
    const next = beats?.state.idx === BEAT.CHALLENGE ? '' : ' Finish this step; Free play unlocks more pieces.';
    setHint(plan ? 'That part is already added for this step.' + next : 'New pieces unlock in Free play.');
    setTimeout(clearHint, 2800);
}

/* The shared diagram makes a gesture literal rather than making a beginner
   translate "drag" into a hand movement. Keep it beside the instruction that
   uses it, as Navigate + Transform does. */
const POINTERS = {
    0: ['orbit'], 2: ['drag', 'move-any'], 3: ['click'], 4: ['drag'],
    5: ['drag'], 6: ['drag'], 7: ['drag', 'move-any'], 8: ['drag', 'move-any'],
    9: ['click'], 10: ['click'], 11: ['click'], 12: ['move-any'], 13: ['drag'],
};
function lessonCopyWithPointers() {
    return Object.fromEntries(Object.entries(COPY).map(([idx, copy]) => {
        const diagrams = (POINTERS[idx] || []).map(buildMouseDiagram).join('');
        return [idx, diagrams ? { ...copy, panel: copy.panel + diagrams } : copy];
    }));
}

/* ── the loop's share of the work ── */
export function tickLesson() {
    if (stage) updateGizmos(stage.camera);
    const entry = getEntry(activeId());
    if (entry) updateFaceGizmos(session.mode === 'edit' ? entry : null, session.face);
}

/* ── one funnel for every change ── */
function changed(kind) {
    const entry = getEntry(activeId());

    if (entry?.mesh) {
        const p = entry.mesh.position, s = entry.mesh.scale;
        trackSpan('px', p.x); trackSpan('py', p.y); trackSpan('pz', p.z);
        trackSpan('sx', s.x); trackSpan('sy', s.y); trackSpan('sz', s.z);
        trackSpan('bev', entry.bevel);
        trackSpan('ins', Object.values(entry.insets || {}).reduce((a, b) => a + b, 0));
        trackSpan('ext', Object.values(entry.extrusions).reduce((a, b) => a + b, 0));
    }
    if (kind === 'face' && session.face) trackTried('face', session.face.id);

    if (['move', 'rotate', 'scale'].includes(kind)) done.add('transform');
    if (kind === 'extrude') done.add('extrude');
    if (kind === 'inset') done.add('inset');
    if (kind === 'bevel') done.add('bevel');
    if (kind === 'add') done.add('add');
    if (kind === 'duplicate') done.add('duplicate');
    if (kind === 'colour') done.add('colour');
    /* the snap is the attach: asking for a button press after the magnet has
       visibly grabbed it would undo the whole point of the moment */
    if (kind === 'snapped' && !state.attached) {
        doAttach();
        /* The complete attached state is one undoable transaction. Recording
           before doAttach left redo with a merely-near connector. */
        push();
    }

    syncUI();
    beats?.notify(kind);
}

/* ── keep the interface honest ── */
function syncUI() {
    const entry = getEntry(activeId());
    /* The final fitting step moves the complete assembly. Earlier tools still
       target the selected object, but here the gizmo deliberately surrounds
       state.root so the pocket and aerial cannot be left behind. */
    const target = beats?.state.idx === BEAT.ATTACH ? state.root : entry?.mesh || null;
    setGizmoTarget(target);
    showFor({
        tool: session.tool, mode: session.mode,
        hasTarget: !!target, hasFace: !!session.face,
    });
    if (session.mode !== 'edit' || !entry) hideFaceHighlight();

    renderRows(session.selected);
    setReadout(entry);

    /* the rail says which tool is armed */
    document.querySelectorAll('.rail-btn[data-tool], .transform-btn[data-tool]').forEach(btn => {
        const tool = btn.dataset.tool;
        if (['undo', 'redo', 'duplicate'].includes(tool)) return;
        btn.setAttribute('aria-pressed', String(tool === session.tool));
    });
    const undoBtn = document.querySelector('.rail-btn[data-tool="undo"]');
    const redoBtn = document.querySelector('.rail-btn[data-tool="redo"]');
    if (undoBtn) undoBtn.disabled = !canUndo();
    if (redoBtn) redoBtn.disabled = !canRedo();

    document.querySelectorAll('#mode-seg button').forEach(b =>
        b.setAttribute('aria-pressed', String(b.dataset.mode === session.mode)));

    const groupBtn = document.getElementById('btn-group');
    if (groupBtn) groupBtn.disabled = session.selected.length < 2;

    const mountBtn = document.getElementById('btn-mount');
    if (mountBtn) {
        mountBtn.disabled = !!state.mount;
        mountBtn.textContent = state.mount ? 'Mount added' : '＋ Add mount';
    }

    document.querySelectorAll('[data-add]').forEach(btn => {
        const kind = btn.dataset.add;
        btn.disabled = !canAdd(kind);
        btn.setAttribute('aria-description', btn.disabled ? 'Unavailable until the next planned step or Free play.' : '');
    });
    const duplicateBtn = document.querySelector('.rail-btn[data-tool="duplicate"]');
    if (duplicateBtn) duplicateBtn.disabled = !canAdd('duplicate');

    document.getElementById('outliner')?.classList.toggle('on', state.entries.length > 0 || beats?.state.idx >= BEAT.ADD);

    setSelectionLine(entry);
    setGhost(session.mode === 'edit');
    updateChecklist();
}

function setSelectionLine(entry) {
    const el = document.getElementById('selection');
    if (!el) return;
    if (!entry) { el.textContent = 'YOUR WORKBENCH'; return; }
    if (session.mode === 'edit' && session.face) {
        el.textContent = 'FACE ' + String.fromCharCode(183) + ' ' + session.face.label;
        return;
    }
    const size = worldSizeOf(entry);
    const pct = Math.round((size.y / GIZMO.torsoHeight) * 100);
    el.textContent = entry.name.toUpperCase() + '  '
        + size.x.toFixed(2) + ' x ' + size.y.toFixed(2) + ' x ' + size.z.toFixed(2)
        + '  ' + String.fromCharCode(183) + '  ' + pct + '% OF TORSO HEIGHT';
}

function updateChecklist() {
    const box = document.getElementById('checklist');
    if (!box || box.hidden) return;
    const map = {
        shape: done.has('extrude') || done.has('inset') || done.has('bevel') || done.has('transform'),
        detail: done.has('add') || done.has('duplicate'),
        colour: done.has('colour'),
    };
    box.querySelectorAll('.ck').forEach(el => el.classList.toggle('done', !!map[el.dataset.ck]));
}

/* ── the tool rail ── */
function revealRail(keys) {
    const rail = document.getElementById('rail');
    if (!rail) return;
    rail.classList.toggle('on', keys.length > 0);
    rail.querySelectorAll('.rail-btn').forEach(btn =>
        btn.classList.toggle('on', keys.includes(btn.dataset.tool)));
    document.getElementById('transform-bar')?.classList.toggle('on', keys.some(k => ['move', 'rotate', 'scale'].includes(k)));
}

function guideTool(tool) {
    const button = document.querySelector(toolButtonSelector(tool));
    if (!button) return;
    button.classList.remove('teach');
    void button.offsetWidth;
    button.classList.add('teach');
    setTimeout(() => button.classList.remove('teach'), 3800);
}

function selectToolDemo(tool) {
    return [
        cursorToEl(toolButtonSelector(tool), 0.55), pressDown(),
        { duration: 0.16, fn: t => { if (t === 0) { setTool(tool); syncUI(); } } },
        pressUp(), hold(0.25),
    ];
}

const toolButtonSelector = tool => ['move', 'rotate', 'scale'].includes(tool)
    ? '.transform-btn[data-tool="' + tool + '"]'
    : '.rail-btn.on[data-tool="' + tool + '"]';

function axisScaleDemo(axis, getTarget, value, seconds = 0.65) {
    let from = null;
    return [
        cursorTo(() => scaleAxisPoint(axis), 0.35), pressDown(),
        tween(seconds, t => {
            const target = getTarget();
            if (!target) return;
            if (from === null) from = target.scale[axis];
            target.scale[axis] = THREE.MathUtils.lerp(from, value, t);
            placeCursorWorld(scaleAxisPoint(axis));
        }),
        pressUp(),
    ];
}

function axisMoveDemo(axis, getTarget, value, seconds = 0.65) {
    let from = null;
    return [
        cursorTo(() => moveHandlePoint(axis), 0.35), pressDown(),
        tween(seconds, t => {
            const target = getTarget();
            if (!target) return;
            if (from === null) from = target.position[axis];
            target.position[axis] = THREE.MathUtils.lerp(from, value, t);
            placeMount();
            placeCursorWorld(moveHandlePoint(axis));
        }),
        pressUp(),
    ];
}

/* ── worked examples ──
   A demo drives the real model and then restores the student's snapshot, so
   replaying one can never erase their work. None of them push history. */
function demo(build) {
    return finish => {
        const saved = serialize();
        const savedSession = {
            mode: session.mode, tool: session.tool,
            selected: [...session.selected], face: session.face,
        };
        moveDemoCursor(centerPoint());
        toggleDemoCursor(true);
        runSequence(build(), () => {
            restore(saved, { gizmobot: gizmobot() });
            setMode(savedSession.mode);
            setTool(savedSession.tool);
            select(savedSession.selected);
            setFace(savedSession.face);
            toggleDemoCursor(false);
            syncUI();
            finish();
        });
    };
}

/** Project a 3D target into the same fixed viewport coordinate system used
    by buttons. Keeping one coordinate system prevents offsets when a demo
    moves from a toolbar button to a gizmo and back again. */
function pointForWorld(world) {
    if (!world || !stage?.camera) return null;
    const p = world.clone().project(stage.camera);
    const r = document.getElementById('canvas-wrap')?.getBoundingClientRect();
    if (!r) return null;
    return { x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (-p.y * 0.5 + 0.5) * r.height };
}
function placeCursorWorld(world) {
    const p = pointForWorld(world);
    if (p) moveDemoCursor(p);
}

/** Ease the demo cursor to a live world point. */
function cursorTo(getWorld, seconds = 0.6) {
    let from = null;
    return {
        duration: seconds,
        fn: t => {
            const to = pointForWorld(getWorld());
            if (!to) return;
            if (!from) from = { ...getDemoCursorPoint() };
            moveDemoCursor({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
        },
    };
}
const pressDown = () => ({ duration: 0.18, fn: t => { if (t === 0) setDemoCursorDown(true); } });
const pressUp = () => ({ duration: 0.18, fn: t => { if (t === 0) setDemoCursorDown(false); } });

function cursorToEl(selector, seconds = 0.7) {
    let from = null;
    return {
        duration: seconds,
        fn: t => {
            const to = pointAt(selector);
            if (!to) return;
            if (!from) from = { ...getDemoCursorPoint() };
            moveDemoCursor({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
        },
    };
}

function tween(seconds, apply) {
    return { duration: seconds, fn: t => { apply(t); syncUI(); } };
}

const centreOf = entry => () => {
    if (!entry?.mesh) return null;
    return new THREE.Box3().setFromObject(entry.mesh).getCenter(new THREE.Vector3());
};

/* ── the lesson ── */
export async function startLesson(createdStage) {
    stage = createdStage;

    await loadGizmobot(stage.scene);
    initGizmos(stage.scene);
    initHistory({ serialize, restore: snap => restore(snap, { gizmobot: gizmobot() }) });
    initInteraction(stage, { onChange: changed });
    initModal(stage, { onChange: changed });
    initOutliner({
        onPick: (id, { additive }) => {
            if (beats?.state.locked || beats?.state.reading) return;
            select(id, { additive });
            changed('select');
        },
    });
    onSession(syncUI);

    configureUI({ steps: NUMBERED_STEPS, beats: TOTAL_BEATS });

    buildSwatches('swatches', COLORS, hex => {
        if (blocked()) return;
        mountColour = hex;
        markActiveSwatch('swatches', hex);
        /* paint whatever is selected; with nothing selected the mount is the
           sensible target, since it is the piece the step just introduced */
        const entry = getEntry(activeId());
        if (entry && entry.kind !== 'group') setColor(entry, hex);
        else setMountColour(hex);
        trackTried('colour', hex);
        push();
        changed('colour');
    });

    wireDock();
    wireRail();
    wireKeys();

    document.getElementById('btn-reset-view')
        ?.addEventListener('click', () => stage.flyTo(camFor(beats.state.idx)));

    beats = createBeats({
        total: TOTAL_BEATS, copy: lessonCopyWithPointers(), controls: CONTROLS,
        stage: stageFor, onEnter, demos: DEMOS, gates: GATES, seeds: SEEDS,
    });
    resetHistory();
    beats.run(0);
}

const blocked = () => !beats || beats.state.locked || beats.state.reading;

/* ── per-beat staging ── */
const camFor = idx => (
    idx === BEAT.INTRO || idx >= BEAT.MATERIAL ? CAMS.full
        : idx === BEAT.STRAPS ? CAMS.shoulder
            : idx >= BEAT.EDIT && idx <= BEAT.BEVEL ? CAMS.back
                : CAMS.bench
);

function stageFor(idx) {
    endQuiz();
    document.getElementById('console').scrollTop = 0;
    stage.orbitCtrl.enabled = idx !== BEAT.QUIZ;
    resetTurn();
    additionsThisStep = {};

    /* the opening example, then an empty bench the moment they start */
    if (idx === BEAT.INTRO) { clearAll(); buildExample(); }
    if (idx === BEAT.ADD && state.entries.length && !state.entries.some(e => e.userMade)) {
        clearAll();
        resetHistory();
    }

    setMode(idx >= BEAT.INSET && idx <= BEAT.BEVEL ? 'edit' : 'object');
    setTool(idx === BEAT.INSET ? 'inset' : idx === BEAT.EXTRUDE ? 'extrude'
        : idx === BEAT.BEVEL ? 'bevel' : idx >= BEAT.SIZE ? 'move' : 'select');
    /* The connector button adds it in a safe default position. Repositioning
       is optional later, so the teaching step does not arm a second hidden
       click workflow. */
    setMountPlacement(false);
    setSnapArmed(idx === BEAT.ATTACH && !state.attached);

    revealRail(RAIL[idx] || []);
    document.getElementById('checklist').hidden = idx !== BEAT.CHALLENGE;
    document.getElementById('outliner')?.classList.toggle('on', idx >= BEAT.ADD && idx !== BEAT.QUIZ);

    /* the two later primitives only exist once the antenna needs them */
    for (const [kind, def] of Object.entries(PRIMITIVES)) {
        const btn = document.querySelector('[data-add="' + kind + '"]');
        if (btn) btn.hidden = idx < def.from;
    }

    if (idx === BEAT.CHALLENGE) done.clear();
    if (idx === BEAT.MOUNT) setHint('Press Add connector to fit the matching plug.');
    else if (idx === BEAT.ATTACH && !state.attached) setHint('Drag the module toward the port on his back.');
    else clearHint();

    stage.flyTo(camFor(idx), idx === 0);
    syncUI();
}

function onEnter(idx) {
    if (idx === BEAT.QUIZ) startQuiz(QUESTIONS, () => beats.notify('quiz'));
    if (idx === BEAT.DONE) celebrate();
    if (idx === BEAT.PARTS) { flashControl('add'); }
    const tool = { [BEAT.SIZE]: 'scale', [BEAT.INSET]: 'inset', [BEAT.EXTRUDE]: 'extrude', [BEAT.BEVEL]: 'bevel', [BEAT.ATTACH]: 'move' }[idx];
    if (tool) guideTool(tool);
}

/** The example on the opening beat: what they are about to be able to make. */
function buildExample() {
    const body = addObject('box');
    body.mesh.position.set(0, 1.80, -0.74);
    body.mesh.scale.set(0.84, 0.94, 0.34);
    /* built the same way the lesson teaches it: inset a face, pull it out,
       then round everything off - so the example is honest about the tools */
    setInset(body, 5, 0.20);
    setExtrude(body, 5, 0.30);
    setBevel(body, 0.17);
    setColor(body, COLORS[3]);

    /* the pocket sits on the body's outer face, below the raised panel, and
       overlaps it slightly so the two read as one moulded piece */
    const pocket = addObject('box');
    pocket.mesh.position.set(0, 1.46, -0.95);
    pocket.mesh.scale.set(0.48, 0.20, 0.14);
    setBevel(pocket, 0.26);
    setColor(pocket, COLORS[5]);

    const pole = addObject('cylinder');
    pole.mesh.position.set(0.26, 2.46, -0.72);
    pole.mesh.scale.set(0.045, 0.58, 0.045);
    setColor(pole, COLORS[5]);

    const ball = addObject('sphere');
    ball.mesh.position.set(0.26, 2.79, -0.72);
    ball.mesh.scale.setScalar(0.11);
    setColor(ball, COLORS[1]);

    addMount(body.id, 0, 0, COLORS[1]);
    /* the example is shown already clipped on, which is the whole promise */
    snapToPort(portWorldPoint());
}

/* ── worked examples, one per teaching beat ── */
const DEMOS = {
    1: demo(() => [
        cursorToEl('[data-add="box"]', 0.7), pressDown(),
        { duration: 0.2, fn: t => { if (t === 0) { const e = addObject('box'); e.mesh.position.copy(SPAWN); select(e.id); syncUI(); } } },
        pressUp(), hold(0.6),
    ]),
    2: demo(() => {
        const e = getEntry(activeId()) || state.entries[0];
        if (!e) return [hold(0.2)];
        select(e.id);
        const s0 = e.mesh.scale.clone();
        return [
            ...selectToolDemo('scale'),
            ...axisScaleDemo('z', () => e.mesh, s0.z * 0.4, 0.9),
            hold(0.25),
            ...selectToolDemo('move'),
            ...axisMoveDemo('x', () => e.mesh, e.mesh.position.x + 0.18, 0.65),
            hold(0.5),
        ];
    }),
    3: demo(() => {
        const e = state.entries.find(x => x.kind === 'box');
        if (!e) return [hold(0.2)];
        select(e.id); setMode('object'); syncUI();
        return [
            cursorToEl('#mode-seg [data-mode="edit"]', 0.55), pressDown(),
            { duration: 0.16, fn: t => { if (t === 0) { setMode('edit'); syncUI(); } } }, pressUp(), hold(0.25),
            cursorTo(() => faceCentreWorld(e, FACES[5]), 0.5), pressDown(),
            { duration: 0.2, fn: t => { if (t === 0) { setFace(FACES[5]); syncUI(); } } }, pressUp(), hold(0.5),
            cursorTo(() => faceCentreWorld(e, FACES[2]), 0.5), pressDown(),
            { duration: 0.2, fn: t => { if (t === 0) { setFace(FACES[2]); syncUI(); } } }, pressUp(), hold(0.6),
        ];
    }),
    4: demo(() => {
        const e = state.entries.find(x => x.kind === 'box');
        if (!e) return [hold(0.2)];
        select(e.id); setMode('edit'); setFace(null); syncUI();
        const startInset = getInset(e, 5);
        return [
            ...selectToolDemo('inset'),
            cursorTo(() => faceCentreWorld(e, FACES[5]), 0.45), pressDown(),
            { duration: 0.16, fn: t => { if (t === 0) { setFace(FACES[5]); syncUI(); } } }, pressUp(), hold(0.2),
            cursorTo(() => insetHandle.getWorldPosition(new THREE.Vector3()), 0.5), pressDown(),
            tween(1.3, t => { setInset(e, 5, startInset + 0.18 * t); placeCursorWorld(insetHandle.getWorldPosition(new THREE.Vector3())); }),
            pressUp(), hold(0.7),
        ];
    }),
    5: demo(() => {
        const e = state.entries.find(x => x.kind === 'box');
        if (!e) return [hold(0.2)];
        select(e.id); setMode('edit'); setFace(FACES[5]);
        const startExtrude = getExtrude(e, 5);
        return [
            ...selectToolDemo('extrude'),
            cursorTo(() => extrudeArrowPoint(), 0.5), pressDown(),
            tween(1.2, t => { setExtrude(e, 5, startExtrude + 0.26 * t); placeCursorWorld(extrudeArrowPoint()); }),
            pressUp(), hold(0.6),
        ];
    }),
    6: demo(() => {
        const e = state.entries.find(x => x.kind === 'box');
        if (!e) return [hold(0.2)];
        select(e.id); setMode('edit'); setFace(FACES[5]);
        let handleStart = null;
        const startBevel = e.bevel;
        return [
            ...selectToolDemo('bevel'),
            cursorTo(() => bevelHandle.getWorldPosition(new THREE.Vector3()), 0.5), pressDown(),
            tween(1.2, t => {
                if (!handleStart) handleStart = bevelHandle.getWorldPosition(new THREE.Vector3());
                setBevel(e, startBevel + 0.14 * t);
                const inward = handleStart.clone().lerp(centreOf(e)(), t * 0.32);
                placeCursorWorld(inward);
            }),
            pressUp(), hold(0.6),
        ];
    }),
    7: demo(() => {
        const base = state.entries.find(x => x.kind === 'box');
        let made = null;
        return [
            cursorToEl('[data-add="box"]', 0.6), pressDown(),
            {
                duration: 0.2, fn: t => {
                    if (t !== 0) return;
                    made = addObject('box');
                    if (made) select(made.id);
                    syncUI();
                },
            },
            pressUp(), hold(0.25),
            ...selectToolDemo('scale'),
            ...axisScaleDemo('x', () => made?.mesh, 0.48, 0.5),
            ...axisScaleDemo('y', () => made?.mesh, 0.20, 0.5),
            ...axisScaleDemo('z', () => made?.mesh, 0.14, 0.5),
            ...selectToolDemo('move'),
            ...axisMoveDemo('x', () => made?.mesh, base ? base.mesh.position.x : 0, 0.45),
            ...axisMoveDemo('y', () => made?.mesh, base ? base.mesh.position.y - 0.25 : 1.55, 0.55),
            ...axisMoveDemo('z', () => made?.mesh, base ? base.mesh.position.z - 0.3 : -1.3, 0.55),
            hold(0.5),
        ];
    }),
    8: demo(() => {
        let shaft = null, tip = null;
        return [
            cursorToEl('[data-add="cylinder"]', 0.6), pressDown(),
            {
                duration: 0.2, fn: t => {
                    if (t !== 0) return;
                    shaft = addObject('cylinder');
                    if (shaft) select(shaft.id);
                    syncUI();
                },
            },
            pressUp(), hold(0.25),
            ...selectToolDemo('scale'),
            ...axisScaleDemo('x', () => shaft?.mesh, 0.05, 0.55),
            ...axisScaleDemo('z', () => shaft?.mesh, 0.05, 0.55),
            ...axisScaleDemo('y', () => shaft?.mesh, 0.58, 0.45),
            ...selectToolDemo('move'),
            ...axisMoveDemo('x', () => shaft?.mesh, 0.3, 0.45),
            ...axisMoveDemo('y', () => shaft?.mesh, 2.3, 0.55),
            ...axisMoveDemo('z', () => shaft?.mesh, -1.0, 0.45),
            hold(0.25),
            cursorToEl('[data-add="sphere"]', 0.6), pressDown(),
            {
                duration: 0.2, fn: t => {
                    if (t !== 0) return;
                    tip = addObject('sphere');
                    if (tip) select(tip.id);
                    syncUI();
                },
            },
            pressUp(), hold(0.25),
            ...selectToolDemo('scale'),
            cursorTo(() => scaleRingPoint(), 0.45),
            pressDown(),
            tween(0.8, t => { if (tip) tip.mesh.scale.setScalar(THREE.MathUtils.lerp(1, 0.11, t)); placeCursorWorld(scaleRingPoint()); }),
            pressUp(),
            ...selectToolDemo('move'),
            ...axisMoveDemo('x', () => tip?.mesh, 0.3, 0.45),
            ...axisMoveDemo('y', () => tip?.mesh, 2.68, 0.55),
            ...axisMoveDemo('z', () => tip?.mesh, -1.0, 0.45),
            hold(0.6),
        ];
    }),
    9: demo(() => {
        const parts = state.entries.filter(e => e.kind === 'cylinder' || e.kind === 'sphere').slice(0, 2);
        if (parts.length < 2) return [hold(0.2)];
        let group = null;
        return [
            cursorTo(centreOf(parts[0]), 0.5), pressDown(),
            { duration: 0.2, fn: t => { if (t === 0) { select(parts[0].id); syncUI(); } } }, pressUp(), hold(0.2),
            { duration: 0.15, fn: t => { if (t === 0) setHint('Hold Shift while you click the second piece.'); } },
            cursorTo(centreOf(parts[1]), 0.5), pressDown(),
            { duration: 0.2, fn: t => { if (t === 0) { select(parts.map(p => p.id)); syncUI(); } } }, pressUp(), hold(0.2),
            cursorToEl('#btn-group', 0.6), pressDown(),
            {
                duration: 0.3, fn: t => {
                    if (t !== 0) return;
                    group = groupObjects(parts.map(p => p.id), 'Antenna');
                    if (group) select(group.id);
                    syncUI();
                },
            },
            pressUp(),
            { duration: 0.15, fn: t => { if (t === 0) clearHint(); } },
            hold(0.5),
        ];
    }),
    10: demo(() => {
        const body = state.entries.find(x => x.kind === 'box');
        if (!body) return [hold(0.2)];
        return [
            cursorToEl('#btn-mount', 0.6), pressDown(),
            { duration: 0.2, fn: t => { if (t === 0) { addMount(body.id, 0, 0); syncUI(); } } },
            pressUp(), hold(0.6),
        ];
    }),
    11: demo(() => {
        const body = state.entries.find(x => x.kind === 'box');
        return [
            cursorTo(centreOf(body), 0.5), pressDown(),
            { duration: 0.2, fn: t => { if (t === 0 && body) { select(body.id); syncUI(); } } }, pressUp(), hold(0.2),
            cursorToEl('#swatches .swatch:nth-child(3)', 0.7), pressDown(),
            { duration: 0.3, fn: t => { if (t !== 0) return; if (body) setColor(body, COLORS[2]); syncUI(); } },
            pressUp(), hold(0.8),
        ];
    }),
    12: demo(() => {
        const start = state.root.position.clone();
        const port = portWorldPoint();
        const mount = state.mount ? state.mount.object3D.getWorldPosition(new THREE.Vector3()) : null;
        const target = port && mount ? start.clone().add(port.clone().sub(mount)) : start;
        return [
            ...selectToolDemo('move'),
            ...axisMoveDemo('x', () => state.root, target.x, 0.65),
            ...axisMoveDemo('y', () => state.root, target.y, 0.65),
            ...axisMoveDemo('z', () => state.root, THREE.MathUtils.lerp(start.z, target.z, 0.82), 0.8),
            { duration: 0.35, fn: t => { if (t === 0) { snapToPort(portWorldPoint()); placeMount(); syncUI(); } } },
            hold(0.4),
            { duration: 0.3, fn: t => { if (t === 0) { doAttach(); syncUI(); } } },
            { duration: 2.4, fn: t => { if (t === 0) turn(); } },
            hold(0.3),
        ];
    }),
};

/* ── gates ──
   Spans, not values. A confident drag in either direction is enough; hunting
   for a particular number teaches nothing. */
const SEEDS = {
    2: () => seedTransform(),
    4: () => ({ ins: insetTotal() }),
    5: () => ({ ext: extTotal() }),
    6: () => ({ bev: bevelNow() }),
    7: () => seedTransform(), 8: () => seedTransform(), 9: () => seedTransform(),
    12: () => seedTransform(),
};
function seedTransform() {
    const e = getEntry(activeId());
    if (!e?.mesh) return {};
    const p = e.mesh.position, s = e.mesh.scale;
    return { px: p.x, py: p.y, pz: p.z, sx: s.x, sy: s.y, sz: s.z };
}
const extTotal = () => {
    const e = getEntry(activeId());
    return e ? Object.values(e.extrusions).reduce((a, b) => a + b, 0) : 0;
};
const insetTotal = () => {
    const e = getEntry(activeId());
    return e ? Object.values(e.insets || {}).reduce((a, b) => a + b, 0) : 0;
};
const bevelNow = () => getEntry(activeId())?.bevel || 0;

const objectCount = () => state.entries.filter(e => e.kind !== 'group').length;
const hasPocketParts = () => state.entries.filter(e => e.kind === 'box').length >= 2;
const hasAerialParts = () => state.entries.some(e => e.kind === 'cylinder')
    && state.entries.some(e => e.kind === 'sphere');

/* Placed at all is enough. Where on the face it sits is the student's call,
   and the snap works from anywhere on it. */
const mountPlaced = () => !!state.mount;

const GATES = {
    1: () => objectCount() >= 1,
    /* Progress follows the visible action, never a hidden precision target.
       Learners can refine the amount or position, but one real use proves the
       interaction worked and must not leave them stranded. */
    2: key => key === 'scale',
    3: key => key === 'face',
    4: key => key === 'inset',
    5: key => key === 'extrude',
    6: key => key === 'bevel',
    /* Addition steps unlock as soon as their named objects exist. Sizing and
       placement are creative guidance, not invisible pass/fail tests. */
    7: () => hasPocketParts(),
    8: () => hasAerialParts(),
    9: () => state.entries.some(e => e.kind === 'group'),
    10: () => mountPlaced(),
    11: key => key === 'colour',
    12: () => state.attached,
    13: () => {
        const categories = {
            shape: done.has('extrude') || done.has('inset') || done.has('bevel') || done.has('transform'),
            detail: done.has('add') || done.has('duplicate'),
            colour: done.has('colour'),
        };
        return Object.values(categories).every(Boolean);
    },
    14: key => key === 'quiz',
    15: () => false,
};

/* ── attach ──
   attach() keeps the world transform, so the module does not move a
   millimetre - it just changes whose space it is expressed in. */
function doAttach() {
    const bot = gizmobot();
    if (!bot || state.attached) return;
    const ids = rootEntries().map(e => e.id);
    if (ids.length > 1) groupObjects(ids, 'Back Module');
    bot.attach(state.root);
    state.attached = true;
    setSnapArmed(false);
    const btn = document.getElementById('btn-attach');
    if (btn) { btn.textContent = 'Attached to Gizmobot'; btn.disabled = true; }
    setHint("It's part of him now - move it and he carries it.");
    setTimeout(clearHint, 4200);
}

/* ── DOM wiring ── */
function wireDock() {
    document.querySelectorAll('[data-add]').forEach(btn => btn.addEventListener('click', () => {
        if (blocked()) return;
        if (!canAdd(btn.dataset.add)) { addLockedMessage(); return; }
        const entry = addObject(btn.dataset.add);
        if (!entry) { setHint('That is as many pieces as this bench holds.'); setTimeout(clearHint, 2600); return; }
        entry.userMade = true;
        recordAddition(btn.dataset.add);
        select(entry.id);
        setTool('move');
        push();
        changed('add');
    }));

    document.querySelectorAll('#mode-seg button').forEach(btn => btn.addEventListener('click', () => {
        if (blocked()) return;
        setMode(btn.dataset.mode);
        changed('mode');
    }));

    document.getElementById('btn-group')?.addEventListener('click', () => {
        if (blocked() || session.selected.length < 2) return;
        const parts = session.selected.map(getEntry).filter(Boolean);
        const name = parts.every(p => p.kind === 'cylinder' || p.kind === 'sphere') ? 'Antenna' : 'Group';
        const group = groupObjects(session.selected, name);
        if (group) { select(group.id); push(); changed('group'); }
    });

    document.getElementById('btn-mount')?.addEventListener('click', () => {
        if (blocked()) return;
        const body = getEntry(activeId()) || state.entries.find(e => e.kind === 'box');
        if (!body || body.kind !== 'box') { setHint('Pick a cube first - the mount goes on a flat face.'); setTimeout(clearHint, 2600); return; }
        addMount(body.id, 0, 0, mountColour);
        push();
        changed('mount');
    });

    document.getElementById('btn-attach')?.addEventListener('click', () => {
        if (blocked()) return;
        snapToPort(portWorldPoint());
        placeMount();
        doAttach();
        push();
        changed('attach');
    });

    document.getElementById('btn-save')?.addEventListener('click', async () => {
        if (blocked()) return;
        const status = document.getElementById('save-status');
        try { await saveModule(); status.textContent = 'Saved as gizmo-back-module.glb'; }
        catch (err) { console.error(err); status.textContent = 'Could not save. Please try again.'; }
    });
}

function wireRail() {
    document.querySelectorAll('.rail-btn[data-tool], .transform-btn[data-tool]').forEach(btn => btn.addEventListener('click', () => {
        if (blocked()) return;
        const tool = btn.dataset.tool;
        if (tool === 'undo') { if (undo()) changed('undo'); return; }
        if (tool === 'redo') { if (redo()) changed('redo'); return; }
        if (tool === 'duplicate') {
            if (!canAdd('duplicate')) { addLockedMessage(); return; }
            const copy = duplicateObject(activeId());
            if (copy) { copy.userMade = true; recordAddition('duplicate'); select(copy.id); push(); changed('duplicate'); }
            return;
        }
        if (tool === 'extrude' || tool === 'bevel') setMode('edit');
        setTool(tool);
        changed('tool');
    }));
}

function wireKeys() {
    window.addEventListener('keydown', e => {
        if (blocked()) return;
        const tag = e.target?.tagName || '';
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;

        /* the modal operators get first refusal on every key */
        if (handleKey(e)) { e.preventDefault(); return; }

        const k = e.key.toLowerCase();
        if (e.ctrlKey || e.metaKey) {
            if (k === 'z') { e.preventDefault(); if (e.shiftKey ? redo() : undo()) changed(e.shiftKey ? 'redo' : 'undo'); return; }
            if (k === 'g') {
                e.preventDefault();
                if (session.selected.length >= 2) {
                    const group = groupObjects(session.selected, 'Group');
                    if (group) { select(group.id); push(); changed('group'); }
                }
                return;
            }
            return;
        }
        /* Tab is deliberately left to the browser so keyboard users can
           reach every visible control. Mode switching uses the segmented
           Object/Edit control. */
    });
}
