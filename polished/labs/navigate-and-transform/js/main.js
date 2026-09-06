/* ═══════════════════════════════════════════════
   MAIN
   Entry point: wires up the DOM, starts the render loop,
   loads the character, and kicks off the lesson.
═══════════════════════════════════════════════ */
import { renderer, scene, camera, clock, W, H } from './stage.js';
import { tickCam } from './cameraRig.js';
import { tickAnims } from './anim.js';
import { loadCharacter } from './character.js';
import {
    updateArrowPositions, updateScaleHandlePos, updateRotateHandlePos,
    scaleHandle, rotateHandle,
} from './gizmos.js';
import { state } from './state.js';
import { runBeat, nextBeat, replayBeat } from './beats.js';
import { resetCamera, resetGizmobot } from './interaction.js';
import { setFreePlayMode } from './ui.js';

/* wire up controls (no inline onclick handlers) */
document.getElementById('btn-replay').addEventListener('click', replayBeat);
document.getElementById('btn-reset-view').addEventListener('click', resetCamera);
document.getElementById('btn-reset-gizmobot').addEventListener('click', resetGizmobot);
document.getElementById('btn-continue').addEventListener('click', nextBeat);
document.querySelectorAll('.fp-btn').forEach(btn => {
    btn.addEventListener('click', () => setFreePlayMode(btn.dataset.mode));
});

/* ── render loop ── */
function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    tickCam(dt);
    tickAnims(dt);

    // keep arrows and handles attached to character
    if (state.character) {
        updateArrowPositions();
        if (scaleHandle.visible) updateScaleHandlePos();
        if (rotateHandle.visible) updateRotateHandlePos();
    }

    renderer.render(scene, camera);
}
animate();

/* ── resize ── */
window.addEventListener('resize', () => {
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
    renderer.setSize(W(), H());
});

/* Keep --panel-h in sync with the info panel's real rendered height. On small
   screens the panel becomes a full-width bottom bar (see styles.css); the reset
   buttons and free-play widget then stack just above it using this value, so
   they never overlap no matter how long the current caption runs. */
const panelEl = document.getElementById('panel');
const syncPanelHeight = () =>
    document.documentElement.style.setProperty('--panel-h', panelEl.offsetHeight + 'px');
new ResizeObserver(syncPanelHeight).observe(panelEl);

/* ── load character, then start the lesson ── */
loadCharacter(() => {
    const loadEl = document.getElementById('loading');
    loadEl.classList.add('fade');
    setTimeout(() => { loadEl.style.display = 'none'; runBeat(0); }, 800);
});
