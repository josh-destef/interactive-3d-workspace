/* ═══════════════════════════════════════════════
   ANIMATION SYSTEM
   animate01: run fn(t) for t in [0,1] over duration seconds.
   runSequence: chain multiple animate01 calls.
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
        // First tick delivers exactly t = 0. Without this, elapsed += dt before
        // the first call meant fn never saw 0, so every `if (t === 0) …` setup
        // gate in the beat demos (show cursor, press "mouse" down) never ran.
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

/* clear any in-flight animations (used when switching beats) */
export function clearAnims() {
    runningAnims.length = 0;
}
