/* ═══════════════════════════════════════════════
   MOUSE DIAGRAM
   Returns an HTML string containing a labelled SVG mouse showing which button to
   use and what motion to make. Injected directly into setCaption's body.

   Same module as the navigate lab, trimmed to the one gesture this lab teaches:
   orbit. The camera is not the subject here, but it is still the first thing a
   student has to do, and "drag to orbit" as words alone assumes they already know
   which button and which motion.
═══════════════════════════════════════════════ */

const BG = '#f4f3f1';
const BD = '#c5c4bc';
const WHL = '#dddcd4';

/* Pull shared colors from the CSS custom properties so the diagram and the
   caption text never drift apart. Read lazily and cached - the stylesheet is
   parsed by the first buildMouseDiagram. */
let _palette = null;
function palette() {
    if (_palette) return _palette;
    const cs = getComputedStyle(document.documentElement);
    const v = name => cs.getPropertyValue(name).trim();
    _palette = { dark: v('--dark'), orange: v('--orange') };
    return _palette;
}

function p(d, color, sw = 2, op = 1) {
    return `<path d="${d}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="${op}"/>`;
}

function mouseSVG({ left, right, scroll, color, motion }) {
    const a = color;

    const leftFill = left ? `
        <path d="M8,28 Q8,4.5 26,4.5 L26,35.5 L8,35.5 Z" fill="${a}" opacity="0.18"/>
        ${p('M8,28 Q8,4.5 26,4.5 L26,35.5 L8,35.5 Z', a, 1, 0.5)}` : '';

    const rightFill = right ? `
        <path d="M26,4.5 Q44,4.5 44,28 L44,35.5 L26,35.5 Z" fill="${a}" opacity="0.18"/>
        ${p('M26,4.5 Q44,4.5 44,28 L44,35.5 L26,35.5 Z', a, 1, 0.5)}` : '';

    const scrollFill = scroll ? `
        <rect x="19" y="10" width="14" height="20" rx="7" fill="${a}" opacity="0.42"/>
        <rect x="19" y="10" width="14" height="20" rx="7" fill="none" stroke="${a}" stroke-width="1" opacity="0.55"/>` : '';

    /* motion arrow groups - CSS classes drive the bobbing animation */
    const aUp = `<g class="arr-up">${p('M26,-4 L26,-16 M21,-12 L26,-17 L31,-12', a)}</g>`;
    const aDown = `<g class="arr-down">${p('M26,84 L26,96 M21,91 L26,97 L31,91', a)}</g>`;
    const aArcL = `<g class="arr-arc-l">${p('M4,22 Q-16,38 4,54', a)}${p('M0,50 L4,55 L8,50', a)}</g>`;
    const aArcR = `<g class="arr-arc-r">${p('M48,22 Q68,38 48,54', a)}${p('M44,50 L48,55 L52,50', a)}</g>`;

    const arrows = {
        updown: aUp + aDown,
        arc: aArcL + aArcR,
    }[motion] || '';

    return `<svg viewBox="-26 -26 104 128" width="65" height="80" xmlns="http://www.w3.org/2000/svg">
        <path d="M8,28 L8,62 Q8,76 26,76 Q44,76 44,62 L44,28 Q44,4 26,4 Q8,4 8,28 Z" fill="${BG}" stroke="${BD}" stroke-width="1.5"/>
        <line x1="8" y1="36" x2="44" y2="36" stroke="${BD}" stroke-width="1"/>
        <line x1="26" y1="4" x2="26" y2="36" stroke="${BD}" stroke-width="1"/>
        <rect x="19" y="10" width="14" height="20" rx="7" fill="${WHL}"/>
        ${leftFill}${rightFill}${scrollFill}
        ${arrows}
    </svg>`;
}

export function buildMouseDiagram(type) {
    const c = palette();
    const defs = {
        orbit: { left: true, right: false, scroll: false, color: c.dark, motion: 'arc', label: 'Click + drag to orbit' },
        zoom: { left: false, right: false, scroll: true, color: c.dark, motion: 'updown', label: 'Scroll to zoom' },
    };

    const cfg = defs[type];
    if (!cfg) return '';
    return `<div class="mouse-rig">${mouseSVG(cfg)}<div class="mouse-label">${cfg.label.toUpperCase()}</div></div>`;
}
