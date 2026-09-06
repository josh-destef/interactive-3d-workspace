/* ═══════════════════════════════════════════════
   MAIN
   Wires up the DOM, starts the render loop, kicks off the lesson.
═══════════════════════════════════════════════ */
import { renderer, scene, camera, clock, tickCam, resetView, W, H } from './stage.js';
import { tickAnims } from './anim.js';
import { onControlChange } from './controls.js';
import { updateParticles, getSoloTelemetry } from './particles.js';
import { tickReadout, tickChallenge } from './readout.js';
import { state } from './state.js';
import { runBeat, nextBeat, replayBeat, checkBeatComplete } from './beats.js';
import { dismissReadCard, readCardOpen } from './ui.js';

/* ── controls ── */
document.getElementById('btn-continue').addEventListener('click', nextBeat);
document.getElementById('btn-replay').addEventListener('click', replayBeat);
document.getElementById('btn-reset-view').addEventListener('click', resetView);

onControlChange(checkBeatComplete);

const soloReadout = document.getElementById('solo-readout');
const soloAge = document.getElementById('solo-age');
const soloAgeFill = document.getElementById('solo-age-fill');
const soloProjected = camera.position.clone();

function updateSoloReadout() {
    const telemetry = state.soloMode ? getSoloTelemetry() : null;
    if (!telemetry) {
        soloReadout.classList.remove('on');
        return;
    }

    soloProjected.copy(telemetry.position).project(camera);
    const visible = soloProjected.z > -1 && soloProjected.z < 1;
    soloReadout.classList.toggle('on', visible);
    if (!visible) return;

    const x = (soloProjected.x * 0.5 + 0.5) * W();
    const y = (-soloProjected.y * 0.5 + 0.5) * H();
    soloReadout.style.left = `${x}px`;
    soloReadout.style.top = `${y}px`;
    soloAge.textContent = `age ${telemetry.age.toFixed(1)} / ${telemetry.life.toFixed(1)} s`;
    soloAgeFill.style.width = `${Math.min(100, telemetry.age / telemetry.life * 100)}%`;
}

/* Space advances, matching the other labs. Only when Continue is showing, so
   it can never skip past a demo the student is meant to be watching.
   preventDefault also stops Space from re-firing whichever dock button
   happens to still hold focus. */
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
    updateParticles(dt);
    updateSoloReadout();
    tickReadout(dt);
    if (state.beatIdx === 6) tickChallenge(dt);
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
   The short pause lets the renderer's first frame land before the lesson
   starts, so beat 0 opens on a settled scene instead of the compile stutter
   most GPUs show on the very first draw call. */
const loadEl = document.getElementById('loading');
setTimeout(() => {
    loadEl.classList.add('fade');
    setTimeout(() => { loadEl.style.display = 'none'; }, 800);
    runBeat(0);
}, 350);
