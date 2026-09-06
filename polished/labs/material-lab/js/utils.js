/* ═══════════════════════════════════════════════
   UTILS
   Math helpers used throughout.
═══════════════════════════════════════════════ */
import * as THREE from 'three';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function hexToRgb(hex) {
    const value = String(hex).replace('#', '').padEnd(6, '0');
    return {
        r: parseInt(value.slice(0, 2), 16),
        g: parseInt(value.slice(2, 4), 16),
        b: parseInt(value.slice(4, 6), 16),
    };
}

export function rgbToHex(r, g, b) {
    const channel = value => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0');
    return '#' + channel(r) + channel(g) + channel(b);
}
