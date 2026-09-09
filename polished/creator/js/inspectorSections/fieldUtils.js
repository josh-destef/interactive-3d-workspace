export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function numericField({ label, value, step = 0.1, min, max, onInput, transaction }) {
  const field = el('label', 'field');
  const caption = el('span', 'field-label', label);
  const input = el('input', 'numeric-input');
  input.type = 'number'; input.step = String(step); input.value = format(value);
  let authoritativeValue = value;
  if (min != null) input.min = String(min);
  if (max != null) input.max = String(max);
  input.setAttribute('aria-label', label);
  input.addEventListener('focus', () => transaction?.begin());
  input.addEventListener('input', () => {
    let number = input.valueAsNumber;
    if (!Number.isFinite(number)) { input.setAttribute('aria-invalid', 'true'); return; }
    if (min != null) number = Math.max(min, number);
    if (max != null) number = Math.min(max, number);
    try {
      onInput(number);
      input.removeAttribute('aria-invalid');
    } catch {
      input.setAttribute('aria-invalid', 'true');
    }
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
  return { field, input, update(next) { authoritativeValue = next; if (document.activeElement !== input) input.value = format(next); } };
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
  return Number.isFinite(value) ? String(Number(value.toFixed(3))) : '0';
}
