/* ═══════════════════════════════════════════════
   MAIN
   Build the stage, build the subject, run the loop, start the lesson.

   Keep this file boring. Anything that reads like a teaching decision belongs
   in config.js or lesson.js.
═══════════════════════════════════════════════ */
import { createStage, hideLoading } from '../../js/stage.js';
import { tickAnims } from '../../js/anim.js';
import { trackSurfaceHeight } from '../../js/ui.js';
import { buildSubject } from './subject.js';
import { startLesson } from './lesson.js';

const stage = createStage({
    rig: 'viewport',
    position: [2.6, 2.4, 6.4],
    target: [0, 1, 0],
});

buildSubject(stage.scene);

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
hideLoading().then(() => startLesson(stage));
