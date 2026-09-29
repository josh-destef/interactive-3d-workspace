import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

test('demo pointer centers swatches and color pickers while range pointers follow the thumb', async () => {
  const { JSDOM } = await import(pathToFileURL(path.join(os.tmpdir(), 'fundamentals-3d-qa/node_modules/jsdom/lib/api.js')));
  const dom = new JSDOM('<button id="swatch" type="button"></button><input id="color" type="color"><input id="range" type="range" min="0" max="1">');
  globalThis.document = dom.window.document;
  let cursor;
  try {
    const { createControlCursor } = await import('../js/lessons/controlCursor.js');
    for (const element of document.querySelectorAll('button,input')) {
      element.getClientRects = () => [{}];
      element.getBoundingClientRect = () => ({ left: 40, top: 100, width: 120, height: 40 });
    }
    cursor = createControlCursor();
    const pointer = document.querySelector('.material-demo-cursor');
    for (const selector of ['#swatch', '#color']) {
      cursor.point(selector, '#c0453a', true);
      assert.equal(pointer.style.left, '100px', 'non-numeric color values cannot produce invalid button coordinates');
      assert.equal(pointer.style.top, '120px');
      assert.equal(pointer.hidden, false);
      assert.equal(pointer.classList.contains('down'), true);
    }
    cursor.point('#range', 0);
    assert.equal(pointer.style.left, '48px');
    cursor.point('#range', 1);
    assert.equal(pointer.style.left, '152px');
    cursor.point('#missing', 0);
    assert.equal(pointer.hidden, true);
  } finally {
    cursor?.dispose(); dom.window.close(); delete globalThis.document;
  }
});
