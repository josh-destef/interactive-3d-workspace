/* ═══════════════════════════════════════════════
   MAIN
   Wires up the DOM, starts the render loop, kicks off the lesson.
═══════════════════════════════════════════════ */
import { renderer, scene, camera, clock, tickCam, resetView, W, H } from './stage.js';
import { tickAnims } from './anim.js';
import { tickPlayback } from './animation.js';
import { onControlChange, resizeDock } from './controls.js';
import { runBeat, nextBeat, replayBeat, checkBeatComplete } from './beats.js';
import { dismissReadCard, readCardOpen } from './ui.js';

/* ── controls ── */
document.getElementById('btn-continue').addEventListener('click', nextBeat);
document.getElementById('btn-replay').addEventListener('click', replayBeat);
document.getElementById('btn-reset-view').addEventListener('click', resetView);

onControlChange(checkBeatComplete);

/* Space advances, matching the other labs. Only when Continue is showing, so it
   can never skip past a demo the student is meant to be watching.
   preventDefault also stops Space from re-firing whichever dock button happens
   to still hold focus - here that would be Set keyframe or Play. */
window.addEventListener('keydown', e => {
    if (e.code !== 'Space' && e.code !== 'Enter') return;
    if (readCardOpen()) {
        e.preventDefault();
        dismissReadCard();
        return;
    }
    if (e.code !== 'Space') return;
    if (!document.getElementById('btn-continue').classList.contains('on')) return;
    e.preventDefault();
    nextBeat();
});

/* ── render loop ── */
function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    tickCam(dt);
    tickAnims(dt);
    tickPlayback(dt);
    renderer.render(scene, camera);
}
animate();

/* ── resize ── */
window.addEventListener('resize', () => {
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
    renderer.setSize(W(), H());
    resizeDock();
});

/* Keep --panel-h in sync with the caption panel's real height. On phones the
   panel becomes a full-width bottom bar and the dock stacks above it using this. */
const panelEl = document.getElementById('panel');
new ResizeObserver(() =>
    document.documentElement.style.setProperty('--panel-h', panelEl.offsetHeight + 'px')
).observe(panelEl);

/* ── go ──
   The pause is not cosmetic: the demo cursor is driven to real pixel positions
   read off the dock, and the dock is still settling while the web fonts land.
   Starting the lesson under a half-laid-out dock puts the cursor beside the
   control it is supposed to be pressing. */
const loadEl = document.getElementById('loading');
setTimeout(() => {
    loadEl.classList.add('fade');
    setTimeout(() => { loadEl.style.display = 'none'; }, 800);
    runBeat(0);
}, 350);
