/* ═══════════════════════════════════════════════
   UTILS
   Math and color helpers used throughout.

   Deliberately free of three.js. This module sits underneath anim.js, which
   sits underneath every scripted demo, so importing it used to drag three
   into pages that have no 3D scene at all - the kit's own gallery among them.
   `V3` lives in stage.js instead, next to the code that needs a Vector3.
═══════════════════════════════════════════════ */

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/* The system's one easing curve. Every scripted move uses it, which is why
   demos across different labs feel like the same hand is driving. */
export const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/* map a value from one range to another, clamped */
export const remap = (v, inMin, inMax, outMin, outMax) =>
    outMin + (clamp(v, inMin, inMax) - inMin) / (inMax - inMin) * (outMax - outMin);

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
