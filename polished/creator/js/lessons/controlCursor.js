import { CURSOR_SVG, sliderPoint } from '../../../kit/js/demoCursor.js';

/** The kit's Navigate/Transform pointer, positioned on live Creation Studio controls. */
export function createControlCursor() {
  const pointer = document.createElement('div');
  pointer.className = 'material-demo-cursor'; pointer.hidden = true;
  pointer.setAttribute('aria-hidden', 'true'); pointer.innerHTML = CURSOR_SVG;
  document.body.append(pointer);
  return {
    point(selector, value, pressed = false, button = 'left') {
      const input = document.querySelector(selector);
      if (!input?.getClientRects().length) { pointer.hidden = true; return; }
      const point = input.type === 'color'
        ? (() => { const rect = input.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; })()
        : sliderPoint(input, value);
      pointer.style.left = `${point.x}px`; pointer.style.top = `${point.y}px`;
      pointer.classList.toggle('down', !!pressed);
      pointer.classList.toggle('right', !!pressed && button === 'right');
      pointer.hidden = false;
    },
    hide() { pointer.hidden = true; pointer.classList.remove('down', 'right'); },
    dispose() { pointer.remove(); },
  };
}
