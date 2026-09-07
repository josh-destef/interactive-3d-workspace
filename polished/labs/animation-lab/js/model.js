export const DOWN = Object.freeze({ arm: -75, wrist: 0 });
export const RAISED = Object.freeze({ arm: 65, wrist: 20 });
export const DURATION = 4;

const LIMITS = Object.freeze({ arm: [-85, 75], wrist: [-45, 45] });
const EPSILON = 1e-7;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const quantizeTime = (time) => Math.round(clamp(Number(time) || 0, 0, DURATION) * 10) / 10;

function cleanPose(pose = {}) {
  const arm = Number.isFinite(Number(pose.arm)) ? Number(pose.arm) : DOWN.arm;
  const wrist = Number.isFinite(Number(pose.wrist)) ? Number(pose.wrist) : DOWN.wrist;
  return {
    arm: clamp(arm, ...LIMITS.arm),
    wrist: clamp(wrist, ...LIMITS.wrist),
  };
}

function cleanKeys(input) {
  const byTime = new Map();
  for (const key of Array.isArray(input) ? input : []) {
    if (!key || !Number.isFinite(Number(key.time))) continue;
    const time = quantizeTime(key.time);
    byTime.set(time, { time, pose: cleanPose(key.pose) });
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

function sample(keys, inputTime) {
  const time = clamp(Number(inputTime) || 0, 0, DURATION);
  if (!keys.length) return { ...DOWN };
  if (time <= keys[0].time) return { ...keys[0].pose };
  const last = keys[keys.length - 1];
  if (time >= last.time) return { ...last.pose };

  for (let index = 1; index < keys.length; index += 1) {
    const right = keys[index];
    if (time > right.time) continue;
    const left = keys[index - 1];
    const linear = (time - left.time) / (right.time - left.time);
    const t = linear * linear * (3 - 2 * linear);
    return {
      arm: left.pose.arm + (right.pose.arm - left.pose.arm) * t,
      wrist: left.pose.wrist + (right.pose.wrist - left.pose.wrist) * t,
    };
  }
  return { ...last.pose };
}

function frozenSnapshot(keys, time, pose, playing, dirty, canUndo, revision) {
  const snapshotKeys = keys.map((key) => Object.freeze({
    time: key.time,
    pose: Object.freeze({ ...key.pose }),
  }));
  return Object.freeze({
    keys: Object.freeze(snapshotKeys),
    time,
    pose: Object.freeze({ ...pose }),
    playing,
    dirty,
    canUndo,
    revision,
  });
}

export function createAnimation() {
  let keys = [];
  let time = 0;
  let pose = sample(keys, time);
  let playing = false;
  let dirty = false;
  let revision = 0;
  const undoStack = [];
  const listeners = new Set();

  const state = () => frozenSnapshot(keys, time, pose, playing, dirty, undoStack.length > 0, revision);
  const notify = () => {
    revision += 1;
    const snapshot = state();
    for (const listener of [...listeners]) listener(snapshot);
    return snapshot;
  };
  const remember = () => undoStack.push({
    keys: cleanKeys(keys), time, pose: { ...pose }, playing, dirty,
  });

  const api = {
    getState: state,
    subscribe(fn) {
      if (typeof fn !== "function") throw new TypeError("subscribe expects a function");
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    poseAt(atTime) {
      return Object.freeze(sample(keys, atTime));
    },
    seek(atTime) {
      time = clamp(Number(atTime) || 0, 0, DURATION);
      playing = false;
      pose = sample(keys, time);
      dirty = false;
      return notify();
    },
    setPose(patch = {}) {
      playing = false;
      pose = cleanPose({ ...pose, ...patch });
      dirty = Math.abs(pose.arm - sample(keys, time).arm) > EPSILON
        || Math.abs(pose.wrist - sample(keys, time).wrist) > EPSILON;
      return notify();
    },
    saveKey() {
      remember();
      const keyTime = quantizeTime(time);
      const next = keys.filter((key) => Math.abs(key.time - keyTime) > EPSILON);
      next.push({ time: keyTime, pose: cleanPose(pose) });
      keys = cleanKeys(next);
      time = keyTime;
      pose = sample(keys, time);
      playing = false;
      dirty = false;
      return notify();
    },
    removeKey() {
      const keyTime = quantizeTime(time);
      if (!keys.some((key) => Math.abs(key.time - keyTime) <= EPSILON)) return state();
      remember();
      keys = keys.filter((key) => Math.abs(key.time - keyTime) > EPSILON);
      time = keyTime;
      pose = sample(keys, time);
      playing = false;
      dirty = false;
      return notify();
    },
    undo() {
      const previous = undoStack.pop();
      if (!previous) return state();
      keys = cleanKeys(previous.keys);
      time = previous.time;
      pose = { ...previous.pose };
      playing = previous.playing;
      dirty = previous.dirty;
      return notify();
    },
    reset() {
      remember();
      keys = [];
      time = 0;
      pose = { ...DOWN };
      playing = false;
      dirty = false;
      return notify();
    },
    load(inputKeys) {
      remember();
      keys = cleanKeys(inputKeys);
      time = 0;
      pose = sample(keys, time);
      playing = false;
      dirty = false;
      return notify();
    },
    play() {
      if (time >= DURATION) time = 0;
      pose = sample(keys, time);
      dirty = false;
      playing = true;
      return notify();
    },
    pause() {
      if (!playing) return state();
      playing = false;
      return notify();
    },
    tick(dt) {
      if (!playing) return state();
      time = clamp(time + Math.max(0, Number(dt) || 0), 0, DURATION);
      pose = sample(keys, time);
      dirty = false;
      if (time >= DURATION) playing = false;
      return notify();
    },
  };
  return Object.freeze(api);
}

export function hasRaise(inputKeys) {
  const keys = cleanKeys(inputKeys);
  return keys.some((key) => key.time <= 0.3 && key.pose.arm < -40)
    && keys.some((key) => key.time > 0.3 && key.pose.arm > 35);
}

export function hasWave(inputKeys) {
  const keys = cleanKeys(inputKeys);
  if (!hasRaise(keys)) return false;
  const raised = keys.filter((key) => key.pose.arm > 30);
  if (raised.length < 3) return false;
  for (let index = 2; index < raised.length; index += 1) {
    const firstLeg = raised[index - 1].pose.wrist - raised[index - 2].pose.wrist;
    const secondLeg = raised[index].pose.wrist - raised[index - 1].pose.wrist;
    if (Math.abs(firstLeg) >= 20 && Math.abs(secondLeg) >= 20 && firstLeg * secondLeg < 0) return true;
  }
  return false;
}
