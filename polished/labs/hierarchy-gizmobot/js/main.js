import { initArmSelector, tickArmSelector } from './arm-selector.js?v=selector5';
/* ═══════════════════════════════════════════════
   MAIN
   Wires up the DOM, starts the render loop, kicks off the lesson.
═══════════════════════════════════════════════ */
import { renderer, scene, camera, clock, tickCam, resetView, W, H } from './stage.js?v=selector5';
import { tickAnims } from './anim.js?v=selector5';
import { onControlChange } from './controls.js?v=selector5';
import { tickArm, armReady, getCatchState } from './arm.js?v=selector5';
import { runBeat, nextBeat, replayBeat, checkBeatComplete } from './beats.js?v=selector5';


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
    if (e.target.closest('input, button, a')) return;
    if (e.code !== 'Space') return;
    if (!document.getElementById('btn-continue').classList.contains('on')) return;
    e.preventDefault();
    nextBeat();
});

/* ── render loop ── */
let lastCatchState = '';
const catchFeedback = document.getElementById('catch-feedback');
function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    tickCam(dt);
    tickAnims(dt);
    tickArm(dt);
    const catchState = getCatchState();
    if (catchState !== lastCatchState) {
        lastCatchState = catchState;
        catchFeedback.hidden = catchState === 'hidden';
        catchFeedback.dataset.state = catchState;
        catchFeedback.textContent = { hidden:'', far:'Bring your palm to the block', ready:'Ready - close the hand to catch', held:'Caught - open the hand to release' }[catchState];
    }
    renderer.render(scene, camera);
    tickArmSelector();
}
animate();

/* ── resize ── */
new ResizeObserver(() => {
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
    renderer.setSize(W(), H());
}).observe(document.getElementById('canvas-wrap'));

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
armReady.then(() => {
    loadEl.classList.add('fade');
    setTimeout(() => { loadEl.style.display = 'none'; }, 800);
    runBeat(0);
    initArmSelector();
}).catch(error => {
    loadEl.textContent = 'The arm could not load. Please reload to try again.';
    console.error(error);
});
