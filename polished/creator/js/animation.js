const clone = value => structuredClone(value);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function interpolateTransform(a, b, amount, interpolation = 'linear') {
  let t = clamp(Number(amount) || 0, 0, 1);
  if (interpolation === 'step') t = 0;
  if (interpolation === 'smooth') t = t * t * (3 - 2 * t);
  const mix = (left, right) => left.map((value, index) => value + (right[index] - value) * t);
  return {
    position: mix(a.position, b.position),
    rotation: mix(a.rotation, b.rotation),
    scale: mix(a.scale, b.scale),
  };
}

export function evaluateKeys(keys, frame, fallback) {
  const ordered = [...(keys ?? [])].sort((a, b) => a.frame - b.frame);
  if (!ordered.length) return clone(fallback);
  if (frame <= ordered[0].frame) return clone(ordered[0].transform);
  if (frame >= ordered.at(-1).frame) return clone(ordered.at(-1).transform);
  const rightIndex = ordered.findIndex(key => key.frame >= frame);
  const left = ordered[rightIndex - 1];
  const right = ordered[rightIndex];
  if (right.frame === frame) return clone(right.transform);
  return interpolateTransform(left.transform, right.transform,
    (frame - left.frame) / (right.frame - left.frame), left.interpolation);
}

export function createAnimation({ project, viewport, onStatus = () => {} }) {
  const listeners = new Set();
  let frame = 0;
  let playing = false;
  let allowed = true;
  let editingEnabled = false;
  let timer = null;
  let lastTime = 0;

  const settings = () => project.animationSettings ?? { fps: 24, duration: 120, loop: true };
  const entity = id => project.get?.(id) ?? project.entities.find(item => item.id === id);
  const activeId = () => project.selection?.activeId ?? null;
  const notify = kind => listeners.forEach(listener => listener({ kind, frame, playing }));
  const animationFor = item => item?.components?.animation ?? null;
  const baseTransform = item => item?.components?.transform;

  const getTransform = id => {
    const item = entity(id);
    if (!item) return null;
    const animation = animationFor(item);
    return animation?.keys?.length
      ? evaluateKeys(animation.keys, frame, baseTransform(item))
      : clone(baseTransform(item));
  };

  const preview = () => {
    if (!allowed || (!editingEnabled && !playing)) return viewport.setPreviewTransforms?.(null);
    const transforms = new Map();
    project.entities.forEach(item => {
      if (animationFor(item)?.keys?.length) transforms.set(item.id, getTransform(item.id));
    });
    viewport.setPreviewTransforms?.(transforms.size ? transforms : null);
  };

  const setFrame = value => {
    const duration = Math.max(1, Math.round(settings().duration));
    const next = clamp(Math.round(Number(value) || 0), 0, duration);
    frame = next;
    preview();
    notify('frame');
    return frame;
  };

  const tick = time => {
    if (!playing) return;
    const fps = Math.max(1, settings().fps || 24);
    const elapsedFrames = Math.floor((time - lastTime) / (1000 / fps));
    if (elapsedFrames > 0) {
      lastTime += elapsedFrames * (1000 / fps);
      let next = frame + elapsedFrames;
      if (next > settings().duration) {
        if (settings().loop) next %= settings().duration + 1;
        else { setFrame(settings().duration); api.pause(); return; }
      }
      setFrame(next);
    }
    timer = requestAnimationFrame(tick);
  };

  const api = {
    get frame() { return frame; },
    get isPlaying() { return playing; },
    get isEditingEnabled() { return editingEnabled; },
    get isEditingPose() { return allowed && editingEnabled && !playing; },
    getTransform,
    updateTransform(id, partial) {
      const current = getTransform(id);
      if (!current) throw new Error(`Unknown entity: ${id}`);
      const next = { ...current, ...clone(partial) };
      for (const field of ['position', 'rotation', 'scale'])
        if (!Array.isArray(next[field]) || next[field].length !== 3 || next[field].some(value => !Number.isFinite(value)))
          throw new TypeError('Invalid transform');
      if (next.scale.some(value => value <= 0)) throw new RangeError('Scale must be positive');
      if (!api.isEditingPose) throw new Error('Turn on Animate mode before editing a keyed pose');
      const item = entity(id);
      const keys = (animationFor(item)?.keys ?? []).filter(key => key.frame !== frame).map(clone);
      const existing = animationFor(item)?.keys?.find(key => key.frame === frame);
      keys.push({ frame, transform: next, interpolation: existing?.interpolation ?? 'smooth' });
      keys.sort((a, b) => a.frame - b.frame);
      project.updateAnimation(id, { keys });
      preview();
      notify('keys');
      onStatus(`Pose keyed at frame ${frame}.`);
      return clone(next);
    },
    addKey(id = activeId(), interpolation = 'smooth') {
      const item = entity(id);
      if (!item) { onStatus('Select an object, then add a key.'); return false; }
      const existing = animationFor(item)?.keys ?? [];
      const pose = getTransform(id);
      const keys = existing.filter(key => key.frame !== frame).map(clone);
      keys.push({ frame, transform: pose, interpolation });
      keys.sort((a, b) => a.frame - b.frame);
      project.updateAnimation(id, { keys });
      preview();
      notify('keys');
      onStatus(`Key added at frame ${frame}.`);
      return true;
    },
    removeKey(id = activeId(), keyFrame = frame) {
      const item = entity(id);
      if (!item) return false;
      const keys = (animationFor(item)?.keys ?? []).filter(key => key.frame !== keyFrame).map(clone);
      if (keys.length === (animationFor(item)?.keys ?? []).length) return false;
      project.updateAnimation(id, keys.length ? { keys } : null);
      preview(); notify('keys');
      onStatus(`Key removed from frame ${keyFrame}.`);
      return true;
    },
    moveKey(id = activeId(), fromFrame, toFrame) {
      const item = entity(id);
      if (!item) return false;
      const duration = Math.max(1, settings().duration);
      const destination = clamp(Math.round(Number(toFrame) || 0), 0, duration);
      const source = (animationFor(item)?.keys ?? []).find(key => key.frame === Number(fromFrame));
      if (!source) return false;
      if (destination !== Number(fromFrame) && animationFor(item).keys.some(key => key.frame === destination))
        throw new Error(`Frame ${destination} already has a key`);
      const keys = animationFor(item).keys.filter(key => key !== source).map(clone);
      keys.push({ ...clone(source), frame: destination });
      keys.sort((a, b) => a.frame - b.frame);
      project.updateAnimation(id, { keys });
      setFrame(destination);
      notify('keys');
      return true;
    },
    setInterpolation(id = activeId(), keyFrame = frame, interpolation = 'smooth') {
      if (!['linear', 'smooth', 'step'].includes(interpolation)) throw new TypeError('Invalid interpolation');
      const item = entity(id);
      const keys = animationFor(item)?.keys?.map(key => key.frame === Number(keyFrame) ? { ...clone(key), interpolation } : clone(key));
      if (!keys?.some(key => key.frame === Number(keyFrame))) return false;
      project.updateAnimation(id, { keys }); preview(); notify('keys'); return true;
    },
    setFrame,
    play() {
      if (!allowed || playing) return;
      if (frame >= settings().duration) setFrame(0);
      playing = true; lastTime = performance.now(); notify('play');
      preview();
      timer = requestAnimationFrame(tick);
    },
    pause() { if (!playing) return; playing = false; cancelAnimationFrame(timer); timer = null; preview(); notify('pause'); },
    stop() { api.pause(); setFrame(0); },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    setEditingEnabled(value) { editingEnabled = Boolean(value); if (!editingEnabled) api.pause(); preview(); notify('mode'); },
    setAllowed(value) { allowed = Boolean(value); if (!allowed) { api.pause(); editingEnabled = false; viewport.setPreviewTransforms?.(null); } else preview(); notify('allowed'); },
    dispose() { api.pause(); offProject?.(); listeners.clear(); viewport.setPreviewTransforms?.(null); },
  };
  const offProject = project.subscribe?.(event => {
    if (event.kind !== 'change') return;
    if (frame > settings().duration) frame = settings().duration;
    preview();
    notify('project');
  });
  return api;
}
