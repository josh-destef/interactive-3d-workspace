/* ═══════════════════════════════════════════════
   MAIN
   Wires up the DOM, starts the render loop, kicks off the lesson.
═══════════════════════════════════════════════ */
import { renderer, scene, camera, clock, tickCam, resetView, W, H } from './stage.js';
import { tickAnims } from './anim.js';
import { onControlChange, updateReadout } from './controls.js';
import { tickArm } from './arm.js';
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
   to still hold focus. */
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
    tickArm(dt);
    // Read per frame rather than per control change: the world row's highlight
    // has to fade back out after the arm has stopped moving, and nothing fires
    // an event at that moment.
    updateReadout();
    renderer.render(scene, camera);
}
animate();

/* ── resize ── */
window.addEventListener('resize', () => {
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
    renderer.setSize(W(), H());
});

/* Keep --panel-h in sync with the caption panel's real height. On phones the
   panel becomes a full-width bottom bar and the dock stacks above it using this. */
const panelEl = document.getElementById('panel');
new ResizeObserver(() =>
    document.documentElement.style.setProperty('--panel-h', panelEl.offsetHeight + 'px')
).observe(panelEl);

/* ── go ──
   The pause covers the first frames, where the shadow map has not been rendered
   yet and the arm sits on a floor with no contact shadow under it. */
const loadEl = document.getElementById('loading');
setTimeout(() => {
    loadEl.classList.add('fade');
    setTimeout(() => { loadEl.style.display = 'none'; }, 800);
    runBeat(0);
}, 350);
