/** Find the shortest axis offset that makes one box face touch another. */
export function nearestSurfaceOffset(moving, targets, axis, reach) {
  if (!moving || !Array.isArray(targets) || ![0, 1, 2].includes(axis) || !Number.isFinite(reach) || reach <= 0) return null;
  const otherAxes = [0, 1, 2].filter(index => index !== axis);
  let best = null;
  for (const target of targets) {
    const overlaps = otherAxes.every(index => moving.max[index] >= target.min[index] - reach
      && moving.min[index] <= target.max[index] + reach);
    if (!overlaps) continue;
    for (const offset of [target.min[axis] - moving.max[axis], target.max[axis] - moving.min[axis]]) {
      if (Math.abs(offset) <= reach && (best === null || Math.abs(offset) < Math.abs(best))) best = offset;
    }
  }
  return best;
}
