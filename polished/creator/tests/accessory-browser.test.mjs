import assert from 'node:assert/strict';
import { connect } from './browser-session.mjs';

const browser = await connect();
try {
  await browser.send('Network.enable');
  await browser.send('Network.setCacheDisabled', { cacheDisabled: true });
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await browser.send('Page.navigate', { url: 'http://localhost:8000/polished/creator/?lesson=model-an-accessory' });
  await browser.wait('Boolean(window.creator?.lesson && document.getElementById("loading").hidden)');
  await browser.click('.lesson-guidance-action');
  await browser.wait('window.creator.lesson.state.complete');
  await browser.evaluate('window.creator.lesson.next()');
  const result = await browser.evaluate(`(() => {
    const project = window.creator.project, lesson = window.creator.lesson;
    const advance = () => lesson.next();
    document.querySelector('[data-shape="cube"]').click();
    const body = project.get(project.selection.activeId); advance();
    project.updateTransform(body.id, { position: [-2, 1.75, -1] }); advance();
    project.updateTransform(body.id, { scale: [1.5, .8, .7] }); advance();
    document.querySelector('[data-shape="cube"]').click();
    const detail = project.get(project.selection.activeId);
    project.updateTransform(detail.id, { scale: [.3, .3, .2] }); advance();
    return {
      step: lesson.state.step,
      snapVisible: !document.querySelector('.snap-control').hidden,
      snapSettingsVisible: !document.querySelector('.snap-settings').hidden,
      snapButtons: document.querySelectorAll('.snap-control > button').length,
      modes: [...document.querySelectorAll('.snap-settings option')].map(option => option.textContent),
      transformGroups: [...document.querySelectorAll('.transform-group legend')].map(legend => legend.textContent),
      names: [body.name, detail.name],
    };
  })()`);
  assert.equal(result.step, 5);
  assert.equal(result.snapVisible, true);
  assert.equal(result.snapSettingsVisible, true, 'Accessory reveals the settings side of Snap');
  assert.equal(result.snapButtons, 1, 'Snap and its settings share one split control');
  assert.deepEqual(result.modes, ['Regular increments', 'Nearest surface']);
  assert.deepEqual(result.transformGroups, ['Position']);
  assert.deepEqual(result.names, ['Backpack Body', 'Backpack Detail']);
  assert.equal(browser.errors.length, 0, JSON.stringify(browser.errors));
  await browser.screenshot('polished/creator/qa/accessory-surface-snap.png');
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 820, height: 850, deviceScaleFactor: 1, mobile: false });
  await browser.wait('innerWidth === 820');
  const narrow = await browser.evaluate(`(() => {
    const card = document.querySelector('.lesson-guidance').getBoundingClientRect();
    const dock = document.getElementById('editor-dock').getBoundingClientRect();
    return { cardRight: card.right, dockLeft: dock.left, snapVisible: !document.querySelector('.snap-control').hidden };
  })()`);
  assert.equal(narrow.snapVisible, true);
  assert.ok(narrow.cardRight <= narrow.dockLeft || narrow.dockLeft === 0, 'guidance and responsive dock should not collide');
  await browser.screenshot('polished/creator/qa/accessory-surface-snap-narrow.png');
  await browser.send('Emulation.clearDeviceMetricsOverride');
  console.log('PASS accessory reaches surface-snap practice with focused controls in a real browser');
} finally {
  browser.close();
}
