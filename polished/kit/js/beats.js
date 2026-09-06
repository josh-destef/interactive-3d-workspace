/* ═══════════════════════════════════════════════
   BEAT RUNNER
   The lesson machine: Read -> Watch -> Do, once per idea.

   A beat is one idea. Every beat runs the same way, and this file is what
   makes that true across labs rather than four times by hand:

     1. RESET   chrome cleared, animations dropped, gates emptied, progress set
     2. READ    the idea, centered and still, waiting on the student
     3. WATCH   a demo drives the real control, with the dock locked
     4. DO      the same words stay put, the control unlocks, a gate watches
     5. CONTINUE appears the moment the gate passes - never before

   The two rules the machine enforces on your behalf, both from
   LEARNING-DESIGN.md:

     - A demo never satisfies its own gate. Gates are cleared again after the
       demo finishes, so what the student watched does not count as what the
       student did.
     - The caption does not change between Watch and Do. There is one `panel`
       string per beat and nothing swaps it.

   USE

       const beats = createBeats({
           total: 8,
           copy:     COPY,          // idx -> { step, title, body, panel, cta }
           controls: CONTROLS,      // idx -> ['roughness']        (optional)
           stage:    stageFor,      // (idx) => pose the scene     (optional)
           demos:    DEMOS,         // idx -> (done) => …          (optional)
           gates:    GATES,         // idx -> (key) => boolean     (optional)
           seeds:    SEEDS,         // idx -> () => ({ key: value })  (optional)
           onEnter:  …,             // (idx) => …                  (optional)
       });
       beats.run(0);

   Then, from wherever a control changes:  beats.notify('roughness')

   A beat with no entry in `demos` skips Watch and goes straight to the
   student's turn. A beat with no entry in `gates` shows Continue as soon as
   it starts - which is right for an intro, a summary or a celebration, and
   wrong for anything the student is meant to try.

   Any beat whose gate measures a span needs an entry in `seeds` saying where
   its controls start, or the span is measured from the student's first change
   instead of from the value the step opened on. See gate.js.
═══════════════════════════════════════════════ */

import { clearAnims } from './anim.js';
import { resetGates, seedSpan } from './gate.js';
import { toggleDemoCursor } from './demoCursor.js';
import { revealControls, hideDock, lockDock } from './controls.js';
import {
    setCaption, setMode, showWatch, hideWatch, showContinue, hideContinue,
    continueShowing, setProgress, setContinueLabel, showReadCard, bindKeyboard,
} from './ui.js';

export function createBeats(config) {
    const {
        total = 0,
        copy = {},
        controls = null,
        stage = null,
        demos = {},
        gates = {},
        seeds = {},
        onEnter = null,
        onLeave = null,
    } = config;

    /* Where each gated control started this beat. Applied every time the gates
       are cleared - at the top of the beat, and again after a demo - so a span
       is always measured from the value the student was looking at, not from
       whatever they happened to touch first. */
    function clearGates(idx) {
        resetGates();
        const seed = seeds[idx];
        if (!seed) return;
        Object.entries(seed()).forEach(([key, value]) => seedSpan(key, value));
    }

    /* Beat-flow state. A lab reads these but should not write them. */
    const state = {
        idx: 0,
        locked: false,     // true while a demo is playing
        reading: false,    // true while the Read card is up
    };

    function run(idx, { skipRead = false } = {}) {
        if (onLeave) onLeave(state.idx, idx);

        state.idx = idx;
        state.locked = false;
        state.reading = false;

        /* ── 1. reset ── */
        clearAnims();
        hideContinue();
        setContinueLabel();
        setMode(null);
        toggleDemoCursor(false);
        lockDock(false);
        document.getElementById('app')?.classList.remove('demo-running');
        setProgress(idx);

        /* ── the step's words, written once ── */
        const beat = copy[idx] || {};
        setCaption(beat.step, beat.title, beat.panel || beat.body);

        if (controls) {
            const keys = controls[idx] || [];
            if (keys.length) revealControls(keys); else hideDock();
        }

        /* Staging often resets the very controls the gate watches, so the
           gates are cleared and seeded after it, never before. */
        if (stage) stage(idx);
        clearGates(idx);

        /* ── 2. read ──
           A beat opens with the Read card when, and only when, it declares a
           `cta` - the words on the button say what the student is agreeing to
           happen next, so a beat with nothing to agree to (a celebration, a
           summary) should not have one, and gets no card.

           Skipped on a replay too: the student has already read it, and making
           them dismiss the same card again to re-watch a demo is friction with
           nothing on the other side of it. */
        if (!skipRead && beat.cta) {
            state.reading = true;
            showReadCard(beat, () => {
                state.reading = false;
                enter(idx);
            });
        } else {
            enter(idx);
        }
    }

    function enter(idx) {
        if (onEnter) onEnter(idx);

        const demo = demos[idx];
        if (!demo) { begin(idx); return; }

        /* ── 3. watch ── */
        state.locked = true;
        lockDock(true);
        showWatch();
        demo(() => finishDemo(idx));
    }

    function finishDemo(idx) {
        if (idx !== state.idx) return;          // beat changed mid-demo
        state.locked = false;
        lockDock(false);
        toggleDemoCursor(false);
        /* The demo just drove the real control, which means it just filled in
           the gate the student is supposed to fill in. Clear it, and re-seed
           from wherever the demo left the control. */
        clearGates(idx);
        hideWatch();
        begin(idx, { keepMode: true });
    }

    /* ── 4. do ── */
    function begin(idx, { keepMode = false } = {}) {
        if (!keepMode) setMode('interact');
        // A beat with no gate has nothing to wait for.
        if (!gates[idx]) showContinue();
    }

    /* ── 5. the gate ──
       Called by the lab whenever anything the student can touch changes. */
    function notify(key) {
        if (state.locked || state.reading) return;
        if (continueShowing()) return;
        const gate = gates[state.idx];
        if (gate && gate(key, state)) showContinue();
    }

    function next() {
        if (state.locked || state.reading) return;
        if (state.idx < total - 1) run(state.idx + 1);
    }

    function replay() {
        if (state.locked || state.reading) return;
        run(state.idx, { skipRead: true });
    }

    /* Wire the three things that always drive a lesson, if they exist. */
    document.getElementById('btn-continue')?.addEventListener('click', next);
    document.getElementById('btn-replay')?.addEventListener('click', replay);
    bindKeyboard(next);

    return { run, next, replay, notify, state };
}
