import fs from 'node:fs/promises';
import { connect } from './browser-session.mjs';

const browser = await connect();
const output = new URL('../qa/', import.meta.url);
await fs.mkdir(output, { recursive: true });

const evaluate = expression => browser.evaluate(expression);
const frame = () => evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
const capture = async name => {
  await frame();
  await browser.screenshot(new URL(`${name}.png`, output));
};

async function setViewport(width, height) {
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await frame();
}

async function reloadFresh(width = 1440, height = 900) {
  await setViewport(width, height);
  await evaluate('delete window.creator');
  await browser.send('Page.reload', { ignoreCache: true });
  await browser.wait('!!window.creator && document.getElementById("loading").hidden', 25000);
  await evaluate('document.fonts.ready');
  await browser.send('Page.bringToFront');
  await frame();
}

async function addPrimitive(type) {
  return evaluate(`creator.project.addPrimitive(${JSON.stringify(type)}).id`);
}

async function expandTreeItem(id) {
  const selector = `.scene-row[data-entity-id="${id}"]`;
  const isCollapsed = await evaluate(`document.querySelector(${JSON.stringify(selector)})?.getAttribute('aria-expanded') === 'false'`);
  if (isCollapsed) await browser.click(`${selector} .scene-expander`);
}

try {
  await browser.send('Page.bringToFront');

  // A clean first impression with untouched project state and empty history.
  await reloadFresh();
  await capture('default');

  // Use the real toolbar interaction so focus and active-tool styling are shown.
  await browser.click('#add-toggle');
  await capture('add-menu');

  // One edited primitive beside Gizmobot, with Move and Transform visibly active.
  await reloadFresh();
  const cubeId = await addPrimitive('cube');
  await evaluate(`
    creator.project.updateTransform(${JSON.stringify(cubeId)}, {
      position: [0.15, 0.575, 0.15],
      rotation: [0, 0.28, 0],
      scale: [1.15, 1.15, 1.15]
    });
    creator.project.updateMaterial(${JSON.stringify(cubeId)}, { color: '#2f9c95' });
    creator.project.selection.set(${JSON.stringify(cubeId)});
  `);
  await browser.click('[data-tool="move"]');
  await evaluate(`
    (() => {
      const transform = document.querySelector('[data-section="transform"]');
      const toggle = transform?.querySelector('.inspector-section-toggle');
      if (toggle?.getAttribute('aria-expanded') !== 'true') toggle.click();
      const appearance = document.querySelector('[data-section="appearance"]');
      const appearanceToggle = appearance?.querySelector('.inspector-section-toggle');
      if (appearanceToggle?.getAttribute('aria-expanded') === 'true') appearanceToggle.click();
      document.querySelector('.inspector')?.scrollTo({ top: 0, behavior: 'instant' });
    })()
  `);
  await capture('selected-primitive');

  // A small, legible composition with explicit hierarchy and complementary hues.
  await reloadFresh();
  const cube = await addPrimitive('cube');
  const sphere = await addPrimitive('sphere');
  const cone = await addPrimitive('cone');
  await evaluate(`
    creator.project.updateTransform(${JSON.stringify(cube)}, {
      position: [0.1, 0.45, 0.25], rotation: [0, 0.25, 0], scale: [0.9, 0.9, 0.9]
    });
    creator.project.updateMaterial(${JSON.stringify(cube)}, { color: '#f28c28' });
    creator.project.updateTransform(${JSON.stringify(sphere)}, {
      position: [1.45, 0.58, 0.05], scale: [0.95, 0.95, 0.95]
    });
    creator.project.updateMaterial(${JSON.stringify(sphere)}, { color: '#2f9c95' });
    creator.project.updateTransform(${JSON.stringify(cone)}, {
      position: [0.8, 0.55, 1.25], rotation: [0, -0.35, 0], scale: [1, 1.1, 1]
    });
    creator.project.updateMaterial(${JSON.stringify(cone)}, { color: '#62a96b' });
    creator.project.selection.set([${JSON.stringify(cube)}, ${JSON.stringify(sphere)}, ${JSON.stringify(cone)}]);
  `);
  const groupId = await evaluate(`creator.project.group().id`);
  await evaluate(`creator.project.rename(${JSON.stringify(groupId)}, 'My first creation')`);
  await expandTreeItem('creation');
  await expandTreeItem(groupId);
  await evaluate(`(()=>{const tree=document.querySelector('.scene-tree'); const row=tree.querySelector('[data-entity-id="${groupId}"]');tree.scrollTop += row.getBoundingClientRect().top-tree.getBoundingClientRect().top;})()`);
  await capture('grouped-scene');

  // Keep the composition for responsive captures, showing the real modal drawer.
  await setViewport(820, 850);
  await browser.wait('creator.dock.getState() === "closed" && document.getElementById("guide").hidden');
  await browser.click('#dock-toggle');
  await browser.wait('creator.dock.getState() === "open" && document.getElementById("editor-dock").getAttribute("aria-modal") === "true"');
  await capture('narrow-drawer');

  await evaluate(`
    if (creator.dock.getState() !== 'closed') document.getElementById('dock-toggle').click();
  `);
  await setViewport(390, 844);
  await browser.wait('creator.dock.getState() === "closed" && document.getElementById("editor-dock").hidden');
  await capture('phone');

  console.log('Saved Creation Studio showcase screenshots in polished/creator/qa/.');
} finally {
  browser.close();
}
