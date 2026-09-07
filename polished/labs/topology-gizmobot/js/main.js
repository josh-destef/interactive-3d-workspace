/* ═══════════════════════════════════════════════
   MAIN
   Build the stage, load the subject, run the loop, start the lesson.

   Keep this file boring. Anything that reads like a teaching decision belongs
   in config.js or lesson.js.
═══════════════════════════════════════════════ */
import { createStage, hideLoading, failLoading } from '../../../kit/js/stage.js';
import { tickAnims } from '../../../kit/js/anim.js';
import { trackSurfaceHeight } from '../../../kit/js/ui.js';
import { loadSubject } from './subject.js';
import { startLesson } from './lesson.js';

const stage = createStage({
    rig: 'viewport',
    /* Gizmobot stands 3.32 units tall, so the whole rig sits higher and further
       back than the kit default. */
    position: [2.9, 2.7, 6.4],
    target: [0, 1.7, 0],
});

/* ── render loop ── */
function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(stage.clock.getDelta(), 0.05);
    stage.tickCam(dt);
    tickAnims(dt);
    stage.renderer.render(stage.scene, stage.camera);
}
frame();

/* The console grows a row every time a step reveals a control, so nothing can
   assume a fixed height for it - not the CSS, and not the camera. */
trackSurfaceHeight();

/* ── go ── */
loadSubject(stage.scene)
    .then(() => hideLoading())
    .then(() => startLesson(stage))
    .catch(err => {
        console.error(err);
        failLoading('Could not load Gizmobot');
    });
