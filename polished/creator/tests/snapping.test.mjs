import test from 'node:test';
import assert from 'node:assert/strict';
import { nearestSurfaceOffset } from '../js/snapping.js';

test('nearest-surface snapping aligns the closest pair of faces on the dragged axis', () => {
  const moving = { min: [-1.22, 1.5, -.2], max: [-.92, 1.8, .2] };
  const body = { min: [-2.75, 1.2, -.5], max: [-1.25, 2, .5] };
  assert.ok(Math.abs(nearestSurfaceOffset(moving, [body], 0, .5) - -.03) < 1e-9);
});

test('nearest-surface snapping ignores distant and non-overlapping surfaces', () => {
  const moving = { min: [0, 0, 0], max: [1, 1, 1] };
  assert.equal(nearestSurfaceOffset(moving, [{ min: [2, 0, 0], max: [3, 1, 1] }], 0, .5), null);
  assert.equal(nearestSurfaceOffset(moving, [{ min: [1.1, 4, 0], max: [2.1, 5, 1] }], 0, .5), null);
});
