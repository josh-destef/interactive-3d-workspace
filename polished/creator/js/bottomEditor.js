/** A content host, independent of any future timeline or workspace implementation. */
export function createBottomEditor(root, toggle) {
  let allowed = true;
  const content = document.createElement('div');
  const heading = document.createElement('strong');
  heading.textContent = 'Room for what comes next';
  const description = document.createElement('p');
  description.textContent = 'This area will hold editors such as a timeline. For now, keep creating in the 3D workspace above.';
  content.append(heading, description);
  root.append(content);
  function close() { root.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.textContent = 'Open editor area'; }
  function open() { if (!allowed) return; root.hidden = false; toggle.setAttribute('aria-expanded', 'true'); toggle.textContent = 'Close editor area'; }
  toggle.addEventListener('click', () => root.hidden ? open() : close());
  return { open, close, mount(node) { root.replaceChildren(node); }, setAllowed(value) { allowed = value; toggle.hidden = !value; if (!value) close(); }, get isOpen() { return !root.hidden; } };
}
