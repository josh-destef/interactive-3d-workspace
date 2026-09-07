/* ═══════════════════════════════════════════════
   MAIN
   Build the stage, build the model, run the loop, start the lesson.

   Kept boring on purpose: anything that reads like a teaching decision lives
   in config.js or lesson.js.
═══════════════════════════════════════════════ */
import { createStage, hideLoading } from '../../../kit/js/stage.js';
import { tickAnims } from '../../../kit/js/anim.js';
import { trackSurfaceHeight } from '../../../kit/js/ui.js';
import { initModel } from './model.js';
import { startLesson, tickLesson } from './lesson.js';
import { CAMS } from './config.js';

const stage = createStage({
    rig: 'viewport',
    position: CAMS.full.pos.toArray(),
    target: CAMS.full.look.toArray(),
    capture: false,
});

/* he is 3.3 units tall and the module sits behind him, so the default orbit
   limits from the kit are a touch tight at both ends */
stage.orbitCtrl.minDistance = 2.2;
stage.orbitCtrl.maxDistance = 16;

initModel(stage.scene);

function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(stage.clock.getDelta(), 0.05);
    stage.tickCam(dt);
    tickAnims(dt);
    tickLesson();
    stage.renderer.render(stage.scene, stage.camera);
}
frame();

/* Keep the canvas in sync with the reserved console height on viewport resize. */
trackSurfaceHeight(() => stage.resize());

startLesson(stage)
    .then(() => hideLoading())
    .catch(err => {
        console.error(err);
        const el = document.getElementById('loading');
        if (el) el.textContent = 'Could not load Gizmobot. Please reload the page.';
    });
