import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sourceUrl = new URL("../polished/labs/animation-lab/js/model.js", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const model = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const { createAnimation, DOWN, RAISED, DURATION, hasRaise, hasWave } = model;

assert.deepEqual(DOWN, { arm: -75, wrist: 0 });
assert.deepEqual(RAISED, { arm: 65, wrist: 20 });
assert.equal(DURATION, 4);

const animation = createAnimation();
assert.deepEqual(animation.getState().keys, []);
assert.deepEqual(animation.getState().pose, DOWN, "empty animation begins with a down draft");
assert.equal(animation.getState().revision, 0);
assert.ok(Object.isFrozen(animation.getState()));
animation.saveKey();
assert.equal(animation.getState().revision, 1, "published changes advance revision");
assert.ok(Object.isFrozen(animation.getState().keys[0].pose));

animation.seek(4);
animation.setPose({ arm: 100, wrist: -90 });
assert.deepEqual(animation.getState().pose, { arm: 75, wrist: -45 }, "pose controls clamp");
assert.equal(animation.getState().dirty, true);
animation.saveKey();
assert.deepEqual(animation.getState().keys[1], { time: 4, pose: { arm: 75, wrist: -45 } });
assert.deepEqual(animation.poseAt(2), { arm: 0, wrist: -22.5 }, "smooth interpolation reaches midpoint");
assert.ok(animation.poseAt(1).arm < -45, "interpolation eases rather than moving linearly");

animation.seek(3.96);
animation.setPose({ wrist: 30 });
animation.saveKey();
assert.equal(animation.getState().keys.length, 2, "save updates a quantized key");
assert.equal(animation.getState().keys[1].pose.wrist, 30);
animation.undo();
assert.equal(animation.getState().keys[1].pose.wrist, -45, "undo restores updated key");

animation.setPose({ arm: -10 });
animation.play();
assert.equal(animation.getState().dirty, false, "playback discards unsaved edits");
assert.deepEqual(animation.getState().pose, animation.poseAt(3.96), "playback samples saved keys immediately");
animation.seek(0);
animation.play();
animation.tick(10);
assert.equal(animation.getState().time, 4);
assert.equal(animation.getState().playing, false, "playback stops at duration");

animation.reset();
assert.deepEqual(animation.getState().keys, []);
assert.deepEqual(animation.getState().pose, DOWN, "reset leaves a down draft without auto-keying");
animation.undo();
assert.equal(animation.getState().keys.length, 2, "reset is undoable");

let notifications = 0;
const unsubscribe = animation.subscribe((snapshot) => {
  notifications += 1;
  assert.ok(Object.isFrozen(snapshot));
});
animation.pause();
animation.seek(1);
unsubscribe();
animation.seek(2);
assert.equal(notifications, 1, "unsubscribe stops notifications");

const raise = [
  { time: 0.2, pose: { arm: -50, wrist: 0 } },
  { time: 1, pose: { arm: 40, wrist: 0 } },
];
assert.equal(hasRaise(raise), true);
assert.equal(hasRaise([{ time: 0.4, pose: DOWN }, { time: 1, pose: RAISED }]), false, "late start is rejected");
assert.equal(hasRaise([{ time: 0, pose: { arm: -40, wrist: 0 } }, { time: 1, pose: RAISED }]), false, "threshold is strict");

const wave = [
  { time: 0, pose: DOWN },
  { time: 1, pose: { arm: 50, wrist: -25 } },
  { time: 2, pose: { arm: 50, wrist: 10 } },
  { time: 3, pose: { arm: 50, wrist: -20 } },
];
assert.equal(hasWave(wave), true);
assert.equal(hasWave(wave.slice(1)), false, "wave requires a raise");
assert.equal(hasWave([raise[0], ...wave.slice(1, 3)]), false, "wave requires three raised keys");
assert.equal(hasWave([
  { time: 0, pose: DOWN },
  { time: 1, pose: { arm: 50, wrist: -30 } },
  { time: 2, pose: { arm: 50, wrist: 0 } },
  { time: 3, pose: { arm: 50, wrist: 25 } },
]), false, "same-direction wrist travel is not a wave");
assert.equal(hasWave([
  { time: 0, pose: DOWN },
  { time: 1, pose: { arm: 50, wrist: -10 } },
  { time: 2, pose: { arm: 50, wrist: 9 } },
  { time: 3, pose: { arm: 50, wrist: -12 } },
]), false, "each reversal leg must reach 20 degrees");

console.log("Animation lab model QA passed.");
