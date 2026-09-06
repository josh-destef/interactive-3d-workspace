/* ═══════════════════════════════════════════════
   UTILS
   Math helpers used throughout.
═══════════════════════════════════════════════ */
import * as THREE from 'three';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
