export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * A number input. With `scrub`, it also works like a Blender field: drag
 * left or right across it to change the value continuously, with no range
 * limit; a click without dragging still places the cursor for typing.
 * `scrub.rate` is value change per pixel; values round to `scrub.precision`.
 * Hold Shift for fine control or Ctrl/Command to move in tenths.
 */
export function numericField({ label, value, step = 0.1, min, max, onInput, transaction, scrub = null }) {
  const field = el('label', 'field');
  const caption = el('span', 'field-label', label);
  const input = el('input', 'numeric-input');
  input.type = 'number'; input.step = String(step); input.value = format(value);
  let authoritativeValue = value;
  if (min != null) input.min = String(min);
  if (max != null) input.max = String(max);
  input.setAttribute('aria-label', label);
  input.addEventListener('focus', () => transaction?.begin());
  const apply = number => {
    if (min != null) number = Math.max(min, number);
    if (max != null) number = Math.min(max, number);
    try {
      onInput(number);
      input.removeAttribute('aria-invalid');
    } catch {
      input.setAttribute('aria-invalid', 'true');
    }
  };
  input.addEventListener('input', () => {
    const number = input.valueAsNumber;
    if (!Number.isFinite(number)) { input.setAttribute('aria-invalid', 'true'); return; }
    apply(number);
  });
  input.addEventListener('blur', () => {
    transaction?.commit();
    input.value = format(authoritativeValue);
    input.removeAttribute('aria-invalid');
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); transaction?.cancel(); input.blur(); }
  });
  field.append(caption, input);
  if (scrub) enableScrub({ field, input, ...scrub, current: () => authoritativeValue, apply, transaction });
  return { field, input, update(next) { authoritativeValue = next; if (document.activeElement !== input) input.value = format(next); } };
}

function enableScrub({ field, input, rate = 0.005, precision = 0.01, current, apply, transaction }) {
  field.classList.add('is-scrubbable');
  input.title = 'Drag left or right to change, or click to type';
  let drag = null;
  const round = (number, grid) => Number((Math.round(number / grid) * grid).toFixed(6));
  input.addEventListener('pointerdown', event => {
    if (input.disabled || document.activeElement === input || (event.button ?? 0) !== 0) return;
    event.preventDefault();
    drag = { id: event.pointerId, lastX: event.clientX, startX: event.clientX, value: current(), moved: false };
    try { input.setPointerCapture?.(event.pointerId); } catch {}
  });
  input.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.moved) {
      if (Math.abs(event.clientX - drag.startX) < 3) return;
      drag.moved = true;
      drag.lastX = event.clientX;
      transaction?.begin();
      field.classList.add('is-scrubbing');
      return;
    }
    drag.value += (event.clientX - drag.lastX) * rate * (event.shiftKey ? .1 : 1);
    drag.lastX = event.clientX;
    apply(round(drag.value, event.ctrlKey || event.metaKey ? .1 : precision));
  });
  const end = event => {
    if (!drag || (event.pointerId !== drag.id)) return;
    const moved = drag.moved;
    drag = null;
    field.classList.remove('is-scrubbing');
    if (moved) { transaction?.commit(); return; }
    if (event.type === 'pointerup') { input.focus(); input.select?.(); }
  };
  input.addEventListener('pointerup', end);
  input.addEventListener('pointercancel', end);
}

export function transactionFor(project, label) {
  let active = false;
  return {
    begin() { if (!active) { project.beginTransaction?.(label); active = true; } },
    commit() { if (active) { project.commitTransaction?.(); active = false; } },
    cancel() { if (active) { project.cancelTransaction?.(); active = false; } }
  };
}

function format(value) {
  if (!Number.isFinite(value)) return '0';
  const rounded = Number(value.toFixed(2));
  // Keep a minimum positive scale or geometry value visible when two decimal
  // places would make it look like zero. This is display-only; the model keeps
  // its original precision.
  return String(rounded === 0 && value !== 0 ? Number(value.toFixed(3)) : rounded);
}
