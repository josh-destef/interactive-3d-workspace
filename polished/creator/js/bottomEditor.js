/** A mountable bottom editor, used by the animation timeline. */
export function createBottomEditor(root, toggle) {
  let allowed = true;
  function close() { root.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.textContent = 'Show timeline'; }
  function open() { if (!allowed) return; root.hidden = false; toggle.setAttribute('aria-expanded', 'true'); toggle.textContent = 'Hide timeline'; }
  toggle.addEventListener('click', () => root.hidden ? open() : close());
  close();
  return { open, close, mount(node) { root.replaceChildren(node); }, setAllowed(value) { allowed = value; toggle.hidden = !value; if (!value) close(); }, get isOpen() { return !root.hidden; } };
}
