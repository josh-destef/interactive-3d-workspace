const el = (tag, cls, text = '') => { const n = document.createElement(tag); if (cls) n.className = cls; n.textContent = text; return n; };
const btn = (text, label) => { const n = el('button', '', text); n.type = 'button'; n.setAttribute('aria-label', label); n.title = label; return n; };

export function createTimeline({ root, animation, project, onStatus = () => {} }) {
  root.classList.add('animation-timeline'); root.setAttribute('aria-label', 'Animation timeline');
  const transport = el('div', 'timeline-transport');
  const stop = btn('■', 'Stop animation'), play = btn('▶', 'Play animation'), add = btn('◆ Add key', 'Add transform key at current frame');
  const frameLabel = el('label', 'timeline-field', 'Frame '), frame = document.createElement('input'); frame.type = 'number'; frame.min = '0'; frame.setAttribute('aria-label', 'Current frame'); frameLabel.append(frame);
  const time = el('output', 'timeline-time'), hint = el('span', 'timeline-hint', 'Transform edits create keys at this frame.');
  const settings = el('div', 'timeline-settings');
  const fpsLabel = el('label', 'timeline-field', 'FPS '), fps = document.createElement('input'); fps.type = 'number'; fps.min = '1'; fps.max = '60'; fpsLabel.append(fps);
  const endLabel = el('label', 'timeline-field', 'End '), duration = document.createElement('input'); duration.type = 'number'; duration.min = '1'; endLabel.append(duration);
  const loopLabel = el('label', 'timeline-loop', 'Loop '), loop = document.createElement('input'); loop.type = 'checkbox'; loopLabel.append(loop);
  settings.append(fpsLabel, endLabel, loopLabel); transport.append(stop, play, frameLabel, time, add, hint, settings);
  const scrubArea = el('div', 'timeline-scrub-area'), ruler = el('div', 'timeline-ruler'), scrub = document.createElement('input');
  scrub.type = 'range'; scrub.min = '0'; scrub.step = '1'; scrub.className = 'timeline-scrubber'; scrub.setAttribute('aria-label', 'Animation playhead'); scrubArea.append(ruler, scrub);
  const selectedEditor = el('div', 'timeline-selected-editor'); selectedEditor.hidden = true;
  const body = el('div', 'timeline-body'); root.replaceChildren(transport, scrubArea, selectedEditor, body);
  let selectedKey = null;
  let trackSignature = '';
  const values = () => project.animationSettings ?? { fps: 24, duration: 120, loop: true };
  const report = (action, restore) => { try { action(); } catch (error) { onStatus(error.message); restore?.(); } };
  const syncSettings = () => { const value = values(); if (document.activeElement !== fps) fps.value = value.fps; if (document.activeElement !== duration) duration.value = value.duration; loop.checked = value.loop; frame.max = scrub.max = value.duration; };
  const drawRuler = () => { const end = values().duration; ruler.replaceChildren(...[0,.25,.5,.75,1].map(part => { const mark = el('span', '', String(Math.round(end * part))); mark.style.left = `${part * 100}%`; return mark; })); };
  const updateFrame = () => {
    if (document.activeElement !== frame) frame.value = animation.frame;
    scrub.value = animation.frame; time.value = `${(animation.frame / values().fps).toFixed(2)}s`;
    play.textContent = animation.isPlaying ? '❚❚' : '▶'; play.setAttribute('aria-label', animation.isPlaying ? 'Pause animation' : 'Play animation'); play.title = play.getAttribute('aria-label');
    body.querySelectorAll('.timeline-playhead').forEach(node => node.style.left = `${animation.frame / values().duration * 100}%`);
    body.querySelectorAll('.timeline-key').forEach(node => node.classList.toggle('is-current', Number(node.dataset.frame) === animation.frame));
    const selected = project.selection?.activeId && project.get(project.selection.activeId); add.disabled = !selected || selected.locked;
  };
  const renderSelected = () => {
    const item = selectedKey && project.get(selectedKey.id), key = item?.components.animation?.keys?.find(k => k.frame === selectedKey.frame);
    if (!key) { selectedKey = null; selectedEditor.hidden = true; selectedEditor.replaceChildren(); return; }
    selectedEditor.hidden = false;
    const title = el('strong', '', `${item.name} key`), moveLabel = el('label', 'timeline-field', 'Frame '), move = document.createElement('input');
    move.type = 'number'; move.min = '0'; move.max = values().duration; move.value = key.frame; moveLabel.append(move);
    const interpolationLabel = el('label', 'timeline-field', 'Interpolation '), interpolation = document.createElement('select');
    ['smooth','linear','step'].forEach(value => interpolation.add(new Option(value[0].toUpperCase() + value.slice(1), value))); interpolation.value = key.interpolation; interpolationLabel.append(interpolation);
    const remove = btn('Delete key', 'Delete selected key');
    move.onchange = () => { const old = selectedKey.frame, destination = Number(move.value); selectedKey = { id:item.id, frame:destination }; report(() => animation.moveKey(item.id, old, destination), () => { selectedKey = { id:item.id, frame:old }; move.value = old; }); };
    interpolation.onchange = () => report(() => animation.setInterpolation(item.id, key.frame, interpolation.value), () => { interpolation.value = key.interpolation; });
    remove.onclick = () => report(() => { animation.removeKey(item.id, key.frame); selectedKey = null; });
    selectedEditor.replaceChildren(title, moveLabel, interpolationLabel, remove);
  };
  const renderTracks = () => {
    const animated = project.entities.filter(item => item.components.animation?.keys?.length);
    trackSignature = JSON.stringify([values().duration, animated.map(item => [item.id, item.name, item.components.animation.keys.map(key => key.frame)])]);
    if (!animated.length) body.replaceChildren(el('p', 'timeline-empty', 'Select an object and choose Add key to begin.'));
    else body.replaceChildren(...animated.map(item => {
      const row = el('div', 'timeline-track'), label = btn(`${item.name} · Transform`, `Select ${item.name}`); label.className = 'timeline-track-label'; label.onclick = () => project.selection.set(item.id);
      const lane = el('div', 'timeline-lane'), playhead = el('i', 'timeline-playhead'); lane.append(playhead);
      item.components.animation.keys.forEach(key => { const diamond = btn('◆', `${item.name} key at frame ${key.frame}`); diamond.className = 'timeline-key'; diamond.dataset.frame = key.frame; diamond.style.left = `${key.frame / values().duration * 100}%`; diamond.onclick = () => { project.selection.set(item.id); selectedKey = { id:item.id, frame:key.frame }; animation.setFrame(key.frame); renderSelected(); }; lane.append(diamond); });
      row.append(label, lane); return row;
    }));
    renderSelected(); updateFrame();
  };
  const currentTrackSignature = () => JSON.stringify([values().duration, project.entities.filter(item => item.components.animation?.keys?.length).map(item => [item.id, item.name, item.components.animation.keys.map(key => key.frame)])]);
  const renderAll = () => { syncSettings(); drawRuler(); renderTracks(); };
  stop.onclick = () => animation.stop(); play.onclick = () => animation.isPlaying ? animation.pause() : animation.play(); add.onclick = () => report(() => animation.addKey());
  frame.oninput = () => { if (Number.isFinite(frame.valueAsNumber)) animation.setFrame(frame.valueAsNumber); };
  frame.onblur = () => { frame.value = animation.frame; };
  scrub.oninput = () => animation.setFrame(Number(scrub.value));
  fps.onchange = () => report(() => project.setAnimationSettings({ fps:Number(fps.value) }), () => { fps.value = values().fps; });
  duration.onchange = () => report(() => project.setAnimationSettings({ duration:Number(duration.value) }), () => { duration.value = values().duration; });
  loop.onchange = () => report(() => project.setAnimationSettings({ loop:loop.checked }), syncSettings);
  const offAnimation = animation.subscribe(event => {
    if (event.kind !== 'project') return updateFrame();
    syncSettings(); drawRuler();
    if (currentTrackSignature() !== trackSignature) renderTracks();
    else { if (!selectedEditor.contains(document.activeElement)) renderSelected(); updateFrame(); }
  });
  const offProject = project.subscribe(event => { if (event.kind === 'selection') updateFrame(); });
  renderAll();
  return { render:renderAll, setAllowed(value) { root.hidden = !value; animation.setAllowed(value); }, dispose() { offAnimation(); offProject(); animation.dispose(); root.replaceChildren(); } };
}
