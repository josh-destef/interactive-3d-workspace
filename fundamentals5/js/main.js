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
import { resetCamera, resetGizmo } from './interaction.js';
import { setFreePlayMode } from './ui.js';

/* route the Home button back to the test lab when arriving from it */
if (new URLSearchParams(window.location.search).get('from') === 'test') {
    const homeButton = document.querySelector('.home-btn');
    if (homeButton) homeButton.href = '../test-labs.html';
}

/* wire up controls (no inline onclick handlers) */
document.getElementById('btn-replay').addEventListener('click', replayBeat);
document.getElementById('btn-reset-view').addEventListener('click', resetCamera);
document.getElementById('btn-reset-gizmo').addEventListener('click', resetGizmo);
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

/* ── load character, then start the lesson ── */
loadCharacter(() => {
    const loadEl = document.getElementById('loading');
    loadEl.classList.add('fade');
    setTimeout(() => { loadEl.style.display = 'none'; runBeat(0); }, 800);
});
