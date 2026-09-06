/* ═══════════════════════════════════════════════
   MAIN
   Wires up the DOM, starts the render loop, kicks off the lesson.
═══════════════════════════════════════════════ */
import {
    renderer, scene, camera, clock, tickCam, tickRoom, resetView,
    setKeyAzimuth, setKeyColor, setRoomLights, onLightOrbChange,
    setBandOffset, applyFraming, W, H,
} from './stage.js';
import { tickAnims } from './anim.js';
import {
    onControlChange, onLightChange, onLightColorChange, onRoomChange, setLightFromOrb,
} from './controls.js';
import { updateMatchLabels } from './match.js';
import { state } from './state.js';
import { BEAT } from './config.js';
import { subjectReady } from './subject.js';
import { dismissReadCard, readCardOpen } from './ui.js';
import './capture.js';
import {
    runBeat, nextBeat, replayBeat, checkBeatComplete, onCheckMatch, onNewTarget, onHint, onUseRgbColor, onCheckRgbMatch,
} from './beats.js';

/* ── controls ── */
document.getElementById('btn-continue').addEventListener('click', nextBeat);
document.getElementById('btn-replay').addEventListener('click', replayBeat);
document.getElementById('btn-reset-view').addEventListener('click', resetView);
document.getElementById('btn-check').addEventListener('click', onCheckMatch);
document.getElementById('btn-new-target').addEventListener('click', onNewTarget);
document.getElementById('btn-hint').addEventListener('click', onHint);
document.getElementById('btn-use-rgb').addEventListener('click', onUseRgbColor);
document.getElementById('btn-check-rgb').addEventListener('click', onCheckRgbMatch);

onControlChange(checkBeatComplete);
onLightChange(setKeyAzimuth);
onLightColorChange(setKeyColor);
onLightOrbChange(setLightFromOrb);
onRoomChange(on => setRoomLights(on));

/* Space advances. While the Read card is up it dismisses that instead, so the
   same key carries the student through Read -> Watch -> Do without them having
   to find a different target each time. preventDefault also stops Space from
   re-firing whichever dock button happens to still hold focus. */
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
    tickRoom(dt);
    tickAnims(dt);
    if (state.beatIdx === BEAT.CHALLENGE || state.beatIdx === BEAT.RGB_CHALLENGE) updateMatchLabels();
    renderer.render(scene, camera);
}
animate();

/* ── resize ── */
window.addEventListener('resize', () => {
    renderer.setSize(W(), H());
    applyFraming();
});

/* Keep the framing and --console-h in sync with the console's real height. The
   console spans the full width of the screen and grows a row as controls are
   revealed, so neither the CSS nor the camera can assume a fixed number. */
const consoleEl = document.getElementById('console');
new ResizeObserver(() => {
    const h = consoleEl.offsetHeight;
    document.documentElement.style.setProperty('--console-h', h + 'px');
    setBandOffset(h);
}).observe(consoleEl);

/* ── go ──
   The pause is not cosmetic: the PMREM environment map is generated on the
   first frames, and starting the lesson under it half-built shows the student a
   material that then changes on its own. */
const loadEl = document.getElementById('loading');
subjectReady.then(() => {
    setTimeout(() => {
        loadEl.classList.add('fade');
        setTimeout(() => { loadEl.style.display = 'none'; }, 800);
        runBeat(BEAT.INTRO);
    }, 180);
}).catch(error => {
    console.error(error);
    loadEl.textContent = 'Gizmobot could not be loaded';
    loadEl.classList.add('error');
});
