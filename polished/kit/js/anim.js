/* ═══════════════════════════════════════════════
   ANIMATION SYSTEM
   The whole scripted-demo engine, in forty lines.

   animate01(duration, fn)  - run fn(t) for t in [0,1] over `duration` seconds
   runSequence([...])       - chain those end to end
   tickAnims(dt)            - call once per frame from the render loop
   clearAnims()             - drop everything in flight (switching beats)

   A demo is written as a list of {duration, fn} steps, so it reads top to
   bottom as the thing the student is about to watch.
═══════════════════════════════════════════════ */
import { clamp, easeInOut } from './utils.js';

const runningAnims = [];

export function animate01(duration, fn, onDone) {
    const entry = { elapsed: 0, duration, fn, onDone, done: false };
    runningAnims.push(entry);
    return entry;
}

export function tickAnims(dt) {
    for (let i = runningAnims.length - 1; i >= 0; i--) {
        const a = runningAnims[i];
        if (a.done) { runningAnims.splice(i, 1); continue; }

        /* The first tick delivers exactly t = 0. Without this, `elapsed += dt`
           runs before the first call and fn never sees 0, so every
           `if (t === 0) …` setup gate inside a demo - show the cursor, press
           the button down, snap to a start pose - silently never runs. */
        if (!a.started) {
            a.started = true;
            a.fn(0);
            continue;
        }

        a.elapsed += dt;
        const t = clamp(a.elapsed / a.duration, 0, 1);
        a.fn(easeInOut(t));
        if (t >= 1) {
            a.done = true;
            runningAnims.splice(i, 1);
            if (a.onDone) a.onDone();
        }
    }
}

export function runSequence(steps, onDone) {
    if (!steps.length) { if (onDone) onDone(); return; }
    const [first, ...rest] = steps;
    animate01(first.duration, first.fn, () => runSequence(rest, onDone));
}

/* A pause between steps, so a sequence can hold on something worth looking at
   without the caller inventing an empty function each time. */
export const hold = seconds => ({ duration: seconds, fn: () => { } });

/* ── ease a value to a target ──
   A runSequence step that moves whatever `read` returns to `target`, writing
   each frame through `write`.

   It captures the start value on the FIRST tick rather than reading it every
   tick, and that is the whole reason this exists. Written by hand the obvious
   way -

       fn: t => { const from = read(); write(from + (target - from) * t); }

   - the start value chases the value being written, so each frame moves a
   fraction of the REMAINING distance. That is an exponential approach, not an
   eased lerp: it lands on the target only because the final tick has t = 1,
   and it runs visibly faster on a 120Hz screen than on a 60Hz one. Demos are
   the one place a lab must look identical on every machine. */
export function tweenTo(duration, read, write, target) {
    let from = null;
    return {
        duration,
        fn: t => {
            if (t === 0) from = read();
            write(from + (target - from) * t);
        },
    };
}

export function clearAnims() {
    runningAnims.length = 0;
}
