/* ═══════════════════════════════════════════════
   ANIMATION MODEL
   The keyframe list, the playhead, the interpolation rule, and playback.

   Nothing in here touches the DOM. The dock subscribes with onModelChange and
   redraws itself; the beats read the same numbers to decide whether a step is
   done. Keeping the model on its own side of that line is what stops a Watch
   demo, a playing animation and a student's drag from writing over each other.
═══════════════════════════════════════════════ */
import { LAST_FRAME, PLAY_FPS, START_POSE, RECIPES } from './config.js';
import { clamp, lerp } from './utils.js';
import { setActorPose, setGhostPoses, setActorType } from './actor.js';

/* the stored poses, always sorted by frame */
export const keys = [];

let frame = 0;
let easing = 'ease';
let playing = false;
let playhead = 0;

/* The pose the object is wearing right now. It is not a keyframe until the
   student says so, which is the entire distinction this lab is teaching. */
let pose = { ...START_POSE };

const listeners = [];
export function onModelChange(fn) { listeners.push(fn); }
function emit() { listeners.forEach(fn => fn()); }

export const getFrame = () => frame;
export const getEasing = () => easing;
export const getPose = () => ({ ...pose });
export const isPlaying = () => playing;

/* ── interpolation ──
   The rule that invents every frame that is not a keyframe. Stepped returns 0
   for the whole gap rather than a rounded blend, so the earlier pose is held
   exactly until the next key rather than drifting toward it. */
function interpAmount(t) {
    if (easing === 'step') return 0;
    if (easing === 'linear') return t;
    return t * t * (3 - 2 * t);
}

export function poseAt(f) {
    if (!keys.length) return { ...pose };
    if (f <= keys[0].frame) return { ...keys[0].pose };
    const last = keys[keys.length - 1];
    if (f >= last.frame) return { ...last.pose };
    const i = keys.findIndex(k => k.frame >= f);
    const a = keys[i - 1], b = keys[i];
    const t = interpAmount((f - a.frame) / (b.frame - a.frame));
    return {
        y: lerp(a.pose.y, b.pose.y, t),
        turn: lerp(a.pose.turn, b.pose.turn, t),
        size: lerp(a.pose.size, b.pose.size, t),
    };
}

export function keyAt(f) {
    return keys.find(k => k.frame === f) || null;
}

/* Push the model at the scene and tell the dock to redraw. Every mutation below
   ends here, so there is exactly one place the two can fall out of step. */
function refresh() {
    pose = poseAt(frame);
    setActorPose(pose);
    setGhostPoses(
        [...keys].reverse().find(k => k.frame < frame)?.pose,
        keys.find(k => k.frame > frame)?.pose
    );
    emit();
}

/* ── the playhead ── */

export function setFrame(f) {
    const next = clamp(Math.round(f), 0, LAST_FRAME);
    // Playback calls this sixty times a second with a fractional frame. Bailing
    // out when the whole frame has not changed keeps the graph off the render
    // loop, which is the difference between smooth and not on a school laptop.
    if (next === frame) return;
    frame = next;
    refresh();
}

/* ── the pose ──
   Moving a slider moves the object and nothing else. It is deliberately possible
   to leave the object in a pose that is stored nowhere: that is what makes
   pressing Set keyframe feel like it did something. */
export function setPose(patch) {
    Object.assign(pose, patch);
    setActorPose(pose);
    emit();
}

/* ── the keys ── */

export function setKeyframe() {
    const existing = keyAt(frame);
    if (existing) existing.pose = { ...pose };
    else keys.push({ frame, pose: { ...pose } });
    keys.sort((a, b) => a.frame - b.frame);
    refresh();
}

export function deleteKeyframe(f) {
    const i = keys.findIndex(k => k.frame === f);
    if (i < 0) return;
    keys.splice(i, 1);
    refresh();
}

function setKeys(list) {
    keys.length = 0;
    list.forEach(k => keys.push({ frame: k.frame, pose: { ...k.pose } }));
    keys.sort((a, b) => a.frame - b.frame);
    refresh();
}

export function loadRecipe(name) {
    setPlaying(false);
    frame = 0;
    setKeys(RECIPES[name].keys);
}

export function setEasing(e) {
    easing = e;
    refresh();
}

export function setActor(type) {
    setActorType(type);
    refresh();
}

/* ── playback ── */

export function setPlaying(on) {
    if (playing === on) return;
    playing = on;
    // Restarting from the end rather than sitting on the last frame, so a second
    // press of play always plays something.
    if (playing) playhead = frame >= LAST_FRAME ? 0 : frame;
    emit();
}

export function tickPlayback(dt) {
    if (!playing) return;
    playhead += dt * PLAY_FPS;
    if (playhead > LAST_FRAME) playhead = 0;
    setFrame(playhead);
}

/* ── seeding ──
   Beats use this to park the whole model where their demo begins. Replay demo
   re-runs the beat, so without one call that sets everything the second viewing
   would start from wherever the student left off and show something else. */
export function seed({ keys: list = [], pose: p = START_POSE, frame: f = 0, easing: e = 'ease' } = {}) {
    setPlaying(false);
    keys.length = 0;
    list.forEach(k => keys.push({ frame: k.frame, pose: { ...k.pose } }));
    keys.sort((a, b) => a.frame - b.frame);
    frame = clamp(Math.round(f), 0, LAST_FRAME);
    easing = e;
    pose = { ...p };
    refresh();
}
