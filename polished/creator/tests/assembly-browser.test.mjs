import assert from 'node:assert/strict';
import { connect } from './browser-session.mjs';

// Plays Build Gizmobot to its finale in a real browser. The Head is moved with
// real pointer drags on the Move handles, since that snapped drag is the
// lesson's one viewport gate. Rotation and the Hand's numbers go through the
// project, which the Node playthrough already covers field by field.
const browser = await connect();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  await browser.send('Network.enable');
  await browser.send('Network.setCacheDisabled', { cacheDisabled: true });
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await browser.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await browser.send('Page.navigate', { url: 'http://localhost:8000/polished/creator/?lesson=build-gizmobot' });
  await browser.wait('Boolean(window.creator?.lesson && document.getElementById("loading").hidden && document.querySelector(".lesson-welcome"))', 20000);

  const card = () => browser.evaluate(`(() => {
    const root = document.querySelector('.lesson-guidance');
    const shown = selector => { const node = root.querySelector(selector); return Boolean(node && !node.hidden && node.offsetParent); };
    return {
      step: root.querySelector('.lesson-guidance-step').textContent, title: root.querySelector('h2').textContent,
      okay: shown('.lesson-guidance-got-it'), canContinue: shown('.lesson-guidance-continue'),
      tools: [...document.querySelectorAll('[data-tool]')].filter(node => !node.hidden && node.offsetParent).map(node => node.dataset.tool),
      active: creator.tools.getActive(), state: creator.lesson.state,
    };
  })()`);
  const okay = async () => { if ((await card()).okay) { await browser.click('.lesson-guidance-got-it'); await pause(120); } };
  const next = async () => {
    await browser.wait('!document.querySelector(".lesson-guidance-continue").hidden');
    await browser.click('.lesson-guidance-continue'); await pause(200);
  };
  const transform = id => browser.evaluate(`structuredClone(creator.project.get(${JSON.stringify(id)}).components.transform)`);
  const target = id => browser.evaluate(`import('/polished/creator/js/assemblyData.js').then(data => structuredClone(data.ASSEMBLY_PARTS.find(part => part.id === ${JSON.stringify(id)}).targetTransform))`);
  const setTransform = (id, patch) => browser.evaluate(`creator.project.updateTransform(${JSON.stringify(id)}, ${JSON.stringify(patch)})`);

  assert.equal(await browser.evaluate('document.querySelector(".lesson-welcome h2").textContent'), 'Get Gizmobot back online');
  await browser.click('.lesson-welcome button'); await pause(200);

  assert.equal((await card()).step, 'STEP 1 OF 12');
  assert.deepEqual((await card()).tools, ['select'], 'no tool appears before it is taught');
  await next();
  await okay(); await browser.click('.scene-row[data-entity-id="part-head"]'); await next();
  await next();
  await okay();
  assert.equal(await browser.evaluate('creator.tools.getSnapping()'), false, 'the learner turns Snap on');
  await browser.click('.snap-toggle'); await next();
  await okay(); await browser.click('[data-tool="move"]');
  await browser.wait('creator.lesson.state.step === 5');
  assert.equal((await card()).title, 'Move the Head into place');

  // A screen point on the Move handle for one axis, and how far one unit along
  // that axis travels on screen.
  const handle = axis => browser.evaluate(`(async () => {
    const THREE = await import('three'); const stage = creator.viewport.stage, layer = stage.scene.getObjectByName('TransformGizmos');
    stage.scene.updateMatrixWorld(true); stage.camera.updateMatrixWorld(true);
    let found = null; layer.traverse(node => { if (!found && node._kind === 'move' && node._axKey === ${JSON.stringify(axis)}) found = node; });
    if (!found) throw Error('Missing Move handle ${axis}');
    const grip = found.children.find(node => node._isHit).getWorldPosition(new THREE.Vector3());
    const pivot = found.getWorldPosition(new THREE.Vector3());
    const unit = new THREE.Vector3(${axis === 'x' ? 1 : 0}, ${axis === 'y' ? 1 : 0}, ${axis === 'z' ? 1 : 0});
    const rect = document.querySelector('#cv').getBoundingClientRect();
    const screen = v => { v = v.clone().project(stage.camera); return { x: rect.x + (v.x + 1) * rect.width / 2, y: rect.y + (1 - v.y) * rect.height / 2 }; };
    const p = screen(grip), c = screen(pivot), a = screen(pivot.clone().add(unit));
    return { x: p.x, y: p.y, dx: a.x - c.x, dy: a.y - c.y };
  })()`);
  const head = await target('part-head');
  for (const [axis, index] of [['y', 1], ['x', 0]]) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const remaining = head.position[index] - (await transform('part-head')).position[index];
      if (Math.abs(remaining) < 1e-6) break;
      const grip = await handle(axis);
      const end = { x: grip.x + grip.dx * remaining, y: grip.y + grip.dy * remaining };
      await browser.mouse('mouseMoved', grip.x, grip.y, { button: 'none', buttons: 0 });
      await browser.mouse('mousePressed', grip.x, grip.y, { button: 'left', buttons: 1, clickCount: 1 });
      for (let i = 1; i <= 10; i++) await browser.mouse('mouseMoved', grip.x + (end.x - grip.x) * i / 10, grip.y + (end.y - grip.y) * i / 10, { button: 'left', buttons: 1 });
      await browser.mouse('mouseReleased', end.x, end.y, { button: 'left', buttons: 0, clickCount: 1 });
      await pause(150);
      const moved = (await transform('part-head')).position[index] - head.position[index];
      assert.ok(Math.abs(moved / .25 - Math.round(moved / .25)) < 1e-6, `a snapped ${axis.toUpperCase()} drag lands on the 0.25 grid`);
    }
  }
  assert.deepEqual((await transform('part-head')).position, head.position, 'real snapped drags put the Head on its joint');
  await next();

  await okay(); await browser.click('[data-tool="rotate"]');
  await setTransform('part-head', { rotation: head.rotation }); await next();

  const hand = await target('part-right-hand');
  let now = await card();
  assert.equal(now.title, 'Resize the Hand');
  assert.deepEqual(now.tools, ['select'], 'the Hand is repaired with Inspector numbers only');
  await okay(); await setTransform('part-right-hand', { scale: hand.scale }); await next();
  now = await card();
  assert.equal(now.title, 'Straighten the Hand');
  assert.deepEqual(now.tools, ['select']);
  await setTransform('part-right-hand', { rotation: hand.rotation }); await next();
  for (const index of [2, 1, 0]) {
    await okay();
    assert.deepEqual((await card()).tools, ['select'], 'tool handles step aside while the camera is locked');
    const position = (await transform('part-right-hand')).position; position[index] = hand.position[index];
    await setTransform('part-right-hand', { position }); await next();
  }

  now = await card();
  assert.equal(now.step, '', 'the finale is not numbered');
  assert.equal(now.title, 'You can build in Creation Studio!');
  assert.equal(now.state.assembled, 14);
  assert.deepEqual(now.tools, ['select', 'move', 'rotate', 'scale']);
  assert.equal(await browser.evaluate('creator.viewport.stage.scene.getObjectByName("AssemblyTargetGuide").visible'), false, 'no outline covers the repaired Hand');
  assert.equal(browser.errors.length, 0, JSON.stringify(browser.errors));
  console.log('PASS Build Gizmobot plays from welcome to finale in a real browser');
} finally {
  await browser.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
  browser.close();
}
