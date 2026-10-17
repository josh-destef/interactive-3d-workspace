const GAP = 18;
const PADDING = 12;
const HOME_INSET = 24;

const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Keep lesson copy text-safe while giving newly introduced interface terms a
// consistent CreateAccess-green treatment.
function renderTerms(element, value, terms = [], references = []) {
  const text = value || '';
  const referenceNames = new Set(references.filter(Boolean).map(value => String(value).toLowerCase()));
  const names = [...new Set([...terms, ...references].filter(Boolean).map(String))].sort((a, b) => b.length - a.length);
  if (!names.length) { element.textContent = text; return; }
  const pattern = new RegExp(`(${names.map(escapeRegExp).join('|')})`, 'gi');
  element.replaceChildren();
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) element.append(document.createTextNode(text.slice(cursor, match.index)));
    const term = document.createElement('span');
    term.className = referenceNames.has(match[0].toLowerCase()) ? 'lesson-reference' : 'lesson-term';
    term.textContent = match[0];
    element.append(term);
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) element.append(document.createTextNode(text.slice(cursor)));
}

const isElement = value => value instanceof Element;
const resolveTarget = target => isElement(target) ? target : typeof target === 'string' ? document.querySelector(target) : null;
const visible = element => !!element && element.getClientRects().length > 0;
// Spotlight only the visible portion of a control inside a scrolling Inspector.
function visibleRect(element) {
  if (!visible(element)) return null;
  const bounds = element.getBoundingClientRect();
  const rect = { left: Math.max(0, bounds.left), top: Math.max(0, bounds.top), right: Math.min(innerWidth, bounds.right), bottom: Math.min(innerHeight, bounds.bottom) };
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const style = element.ownerDocument.defaultView.getComputedStyle(parent);
    if (!/(auto|scroll|hidden|clip)/.test(`${style.overflow} ${style.overflowX} ${style.overflowY}`)) continue;
    const clip = parent.getBoundingClientRect();
    if (!clip.width || !clip.height) continue;
    rect.left = Math.max(rect.left, clip.left); rect.right = Math.min(rect.right, clip.right);
    rect.top = Math.max(rect.top, clip.top); rect.bottom = Math.min(rect.bottom, clip.bottom);
  }
  return rect.right > rect.left && rect.bottom > rect.top ? rect : null;
}

export function createGuidance({ mount = document.body } = {}) {
  const root = document.createElement('section');
  root.className = 'lesson-guidance';
  // The layer has no meaningful content or calculated position until show().
  // Keep it out of the first paint so async lesson setup cannot flash the card
  // at its default fixed-position origin before a welcome dialog opens.
  root.hidden = true;
  root.setAttribute('aria-label', 'Lesson guidance');
  root.innerHTML = `
    <svg class="lesson-guidance-shade" aria-hidden="true" focusable="false" preserveAspectRatio="none">
      <path class="lesson-guidance-shade-path" fill-rule="evenodd"></path>
    </svg>
    <div class="lesson-guidance-target" aria-hidden="true"></div>
    <div class="lesson-guidance-card" role="region" aria-live="polite">
      <p class="lesson-guidance-step"></p>
      <div class="lesson-guidance-copy"><h2></h2><p></p></div>
      <div class="lesson-guidance-controls" hidden></div>
      <div class="lesson-guidance-actions">
        <button type="button" class="lesson-guidance-secondary" hidden></button>
        <button type="button" class="lesson-guidance-action" hidden></button>
        <button type="button" class="lesson-guidance-got-it">Okay</button>
        <button type="button" class="lesson-guidance-continue">Continue <span aria-hidden="true">→</span></button>
      </div>
    </div>`;
  mount.append(root);

  const card = root.querySelector('.lesson-guidance-card');
  card.tabIndex = -1;
  const shade = root.querySelector('.lesson-guidance-shade');
  const shadePath = root.querySelector('.lesson-guidance-shade-path');
  const targetRing = root.querySelector('.lesson-guidance-target');
  const stepLabel = root.querySelector('.lesson-guidance-step');
  const title = root.querySelector('h2');
  const body = root.querySelector('.lesson-guidance-copy > p');
  const actionButton = root.querySelector('.lesson-guidance-action');
  const secondaryButton = root.querySelector('.lesson-guidance-secondary');
  const controls = root.querySelector('.lesson-guidance-controls');
  const gotIt = root.querySelector('.lesson-guidance-got-it');
  const continueButton = root.querySelector('.lesson-guidance-continue');
  let state = null;
  let complete = false;
  let acknowledged = false;
  let reading = false;
  const inertElements = new Map();
  let frame = 0;
  let observedTarget = null;
  let welcomeDialog = null;
  let welcomeTimer = null;
  let actionFlash = null;
  let flashTimer = null;
  const resizeObserver = new ResizeObserver(() => requestPosition());
  resizeObserver.observe(document.documentElement);

  const mutations = new MutationObserver(records => {
    if (records.some(record => !root.contains(record.target))) requestPosition();
  });
  mutations.observe(document.body, { subtree: true, childList: true, attributes: true });

  function requestPosition() {
    if (!state || frame) return;
    frame = requestAnimationFrame(() => { frame = 0; position(); });
  }

  function setCardPosition(left, top, side = '') {
    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(top)}px`;
    card.dataset.pointer = side;
  }

  function homePosition() {
    if (matchMedia('(max-width: 900px)').matches) {
      setCardPosition(HOME_INSET, Math.max(PADDING, innerHeight - card.offsetHeight - HOME_INSET));
      return;
    }
    const viewport = document.querySelector('#canvas-wrap');
    const bottom = visible(viewport) ? viewport.getBoundingClientRect().bottom : innerHeight - 34;
    setCardPosition(HOME_INSET, Math.max(PADDING, bottom - card.offsetHeight - HOME_INSET));
  }

  function syncProgressActions() {
    continueButton.disabled = !complete;
    // Keep one clear action visible: Okay before the goal is met, then Continue.
    continueButton.hidden = !complete || !gotIt.hidden;
    // Optional: the action (e.g. a demo) is replaced by Continue, never shown beside it.
    if (state?.hideActionWhenComplete) actionButton.hidden = !state.actionLabel || complete;
    // A follow-up choice (e.g. another attempt) sits beside Continue once the goal is met.
    if (state?.secondaryWhenComplete && !reading) secondaryButton.hidden = !state.secondaryLabel || !complete;
  }

  function setReading(next) {
    if (reading === next) return;
    reading = next;
    root.classList.toggle('is-reading', reading);
    if (reading) {
      // Preserve existing inert state, including a narrow-screen dock's modal state.
      const makeInert = element => {
        if (inertElements.has(element)) return;
        inertElements.set(element, element.hasAttribute('inert'));
        element.setAttribute('inert', '');
      };
      // An interactive target stays usable: only the branches around it go inert.
      const keep = interactiveTarget();
      for (let branch = root; branch.parentElement; branch = branch.parentElement) {
        for (const sibling of branch.parentElement.children) {
          if (sibling === branch) continue;
          if (keep && sibling.contains(keep)) {
            for (let node = keep; node !== sibling; node = node.parentElement) {
              for (const cousin of node.parentElement.children) if (cousin !== node) makeInert(cousin);
            }
          } else makeInert(sibling);
        }
        if (branch.parentElement === document.body) break;
      }
      root.classList.toggle('is-target-interactive', Boolean(keep));
      card.setAttribute('role', 'dialog');
      card.setAttribute('aria-modal', 'true');
      card.setAttribute('aria-label', keep ? 'Read this step, then choose Okay or use the highlighted control' : 'Read this step, then choose Okay');
      controls.setAttribute('inert', '');
      actionButton.hidden = secondaryButton.hidden = continueButton.hidden = true;
      gotIt.focus({ preventScroll: true });
    } else {
      for (const [element, wasInert] of inertElements) if (!wasInert) element.removeAttribute('inert');
      inertElements.clear();
      root.classList.remove('is-target-interactive');
      card.setAttribute('role', 'region');
      card.removeAttribute('aria-modal');
      card.removeAttribute('aria-label');
      controls.removeAttribute('inert');
      actionButton.hidden = !state?.actionLabel;
      secondaryButton.hidden = !state?.secondaryLabel;
    }
  }

  // A step may let the learner use its highlighted control straight away
  // instead of choosing Okay first.
  function interactiveTarget() {
    if (!state?.targetInteractive) return null;
    const target = resolveTarget(state.target);
    return visible(target) && !root.contains(target) ? target : null;
  }

  // Inert handles focus and pointer input; stop editor keyboard shortcuts too.
  function guardReading(event) {
    if (!reading) return;
    const keep = event.type !== 'keydown' && interactiveTarget();
    if (keep?.contains(event.target)) {
      if (event.type === 'pointerdown') acknowledge();
      return;
    }
    if (event.type === 'keydown') {
      if (event.target === gotIt && ['Enter', ' '].includes(event.key)) {
        event.stopPropagation();
        return;
      }
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.key === 'Tab') gotIt.focus();
      const scrollAmount = { ArrowDown: 40, ArrowUp: -40, PageDown: card.clientHeight * .8, PageUp: -card.clientHeight * .8, Home: -card.scrollHeight, End: card.scrollHeight }[event.key];
      if (scrollAmount != null) card.scrollTop += scrollAmount;
    } else if (card.contains(event.target) && ['wheel', 'pointerdown'].includes(event.type)) {
      // Reading can scroll; the surrounding editor still receives no gesture.
      if (event.target !== gotIt) event.stopPropagation();
    } else if (event.target !== gotIt) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }
  const guardedEvents = ['keydown', 'pointerdown', 'click', 'dblclick', 'wheel'];
  guardedEvents.forEach(type => addEventListener(type, guardReading, { capture: true, passive: false }));

  function choosePosition(box, desired) {
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    if (matchMedia('(max-width: 900px)').matches) return [PADDING, Math.max(PADDING, innerHeight - height - PADDING), ''];
    const candidates = {
      right: [box.right + GAP, box.top + (box.height - height) / 2, 'left'],
      left: [box.left - width - GAP, box.top + (box.height - height) / 2, 'right'],
      bottom: [box.left + (box.width - width) / 2, box.bottom + GAP, 'top'],
      top: [box.left + (box.width - width) / 2, box.top - height - GAP, 'bottom'],
    };
    const order = desired && desired !== 'auto' ? [desired, ...Object.keys(candidates).filter(side => side !== desired)] : ['right', 'left', 'bottom', 'top'];
    for (const side of order) {
      const [left, top, pointer] = candidates[side];
      if (left >= PADDING && top >= PADDING && left + width <= innerWidth - PADDING && top + height <= innerHeight - PADDING) return [left, top, pointer];
    }
    const [left, top, pointer] = candidates[order[0]];
    return [Math.max(PADDING, Math.min(left, innerWidth - width - PADDING)), Math.max(PADDING, Math.min(top, innerHeight - height - PADDING)), pointer];
  }

  function position() {
    if (!state) return;
    const target = resolveTarget(state.target);
    if (target !== observedTarget) {
      if (observedTarget) resizeObserver.unobserve(observedTarget);
      observedTarget = target;
      if (observedTarget) resizeObserver.observe(observedTarget);
    }
    const targetRect = visibleRect(target);
    const showSpotlight = Boolean(state.spotlight && !acknowledged && targetRect);
    // A missing or rebuilt target must never change acknowledgment/progression.
    gotIt.hidden = !state.spotlight || acknowledged;
    setReading(!gotIt.hidden);
    syncProgressActions();
    root.classList.toggle('is-spotlighting', showSpotlight);
    const anchored = Boolean(showSpotlight && (!state.fixedHome || (state.callout && state.anchorCallout !== false)) && innerWidth > 900);
    root.classList.toggle('is-anchored', anchored);
    root.classList.toggle('is-undimmed', state.dim === false);
    if (!showSpotlight) {
      shadePath.setAttribute('d', '');
      targetRing.style.cssText = '';
      homePosition();
      return;
    }
    const rect = targetRect;
    const ring = { left: Math.max(4, rect.left - 5), top: Math.max(4, rect.top - 5), right: Math.min(innerWidth - 4, rect.right + 5), bottom: Math.min(innerHeight - 4, rect.bottom + 5) };
    ring.width = Math.max(0, ring.right - ring.left);
    ring.height = Math.max(0, ring.bottom - ring.top);
    const width = Math.max(0, ring.right - ring.left), height = Math.max(0, ring.bottom - ring.top);
    shade.setAttribute('viewBox', `0 0 ${innerWidth} ${innerHeight}`);
    shadePath.setAttribute('d', `M0 0H${innerWidth}V${innerHeight}H0Z M${ring.left} ${ring.top}H${ring.right}V${ring.bottom}H${ring.left}Z`);
    targetRing.style.left = `${ring.left}px`;
    targetRing.style.top = `${ring.top}px`;
    targetRing.style.width = `${width}px`;
    targetRing.style.height = `${height}px`;
    if (!anchored) homePosition();
    else {
      const [left, top, pointer] = choosePosition(ring, state.placement);
      setCardPosition(left, top, pointer);
    }
  }

  function show(next) {
    setReading(false);
    state = { placement: 'auto', spotlight: false, continueLabel: 'Continue', canContinue: false, ...next };
    complete = Boolean(state.canContinue);
    acknowledged = false;
    root.hidden = false;
    root.classList.toggle('has-fixed-home', Boolean(state.fixedHome));
    root.classList.toggle('is-celebrating', Boolean(state.celebrate));
    actionButton.classList.toggle('is-secondary', state.actionTone === 'secondary');
    clearTimeout(flashTimer); actionFlash = null;
    stepLabel.hidden = !state.step && state.step !== 0;
    stepLabel.textContent = typeof state.step === 'string' ? state.step : state.total ? `STEP ${state.step} OF ${state.total}` : `STEP ${state.step}`;
    renderTerms(title, state.title, state.terms, state.references);
    renderTerms(body, state.body, state.terms, state.references);
    controls.replaceChildren();
    controls.hidden = true;
    continueButton.innerHTML = `${state.continueLabel || 'Continue'} <span aria-hidden="true">→</span>`;
    actionButton.textContent = state.actionLabel || '';
    actionButton.hidden = !state.actionLabel;
    actionButton.disabled = false;
    secondaryButton.textContent = state.secondaryLabel || '';
    secondaryButton.hidden = !state.secondaryLabel || Boolean(state.callout && state.spotlight);
    secondaryButton.disabled = false;
    secondaryButton.classList.toggle('is-button', Boolean(state.secondaryWhenComplete));
    status(state.status || '');
    gotIt.hidden = !state.spotlight || acknowledged;
    setReading(!gotIt.hidden);
    syncProgressActions();
    document.getElementById('creator-app')?.classList.add('lesson-mode');
    requestPosition();
  }

  function setComplete(next) {
    complete = Boolean(next);
    syncProgressActions();
    requestPosition();
  }

  actionButton.addEventListener('click', async () => {
    const current = state;
    actionButton.disabled = true;
    actionButton.textContent = current.actionBusyLabel || 'Watch the pieces...';
    try {
      const done = await current?.onAction?.();
      if (state !== current) return;
      actionButton.hidden = Boolean(done);
      if (done && complete) continueButton.focus();
    } finally {
      if (state === current) {
        actionButton.disabled = false;
        // A brief confirmation on the button itself keeps the instruction unchanged.
        const flash = actionFlash;
        actionFlash = null;
        actionButton.textContent = flash || current.actionLabel;
        if (flash) flashTimer = setTimeout(() => { if (state === current) actionButton.textContent = current.actionLabel; }, 1800);
        requestPosition();
      }
    }
  });
  secondaryButton.addEventListener('click', () => state?.onSecondary?.());
  function status(text) {
    // Explanations belong in the main instruction, not an extra notification box.
    renderTerms(body, text || state?.body, state?.terms, state?.references);
    requestPosition();
  }
  function acknowledge() {
    const moveFocus = document.activeElement === gotIt;
    acknowledged = true; gotIt.hidden = true;
    setReading(false);
    secondaryButton.hidden = !state?.secondaryLabel;
    syncProgressActions();
    if (moveFocus) {
      const target = resolveTarget(state?.target);
      const focusable = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]';
      const destination = complete ? continueButton : target?.matches(focusable) ? target : target?.querySelector(focusable);
      (destination || card).focus({ preventScroll: true });
    }
    requestPosition();
  }
  gotIt.addEventListener('click', acknowledge);
  continueButton.addEventListener('click', () => { if (complete) state?.onContinue?.(); });
  const reposition = () => requestPosition();
  addEventListener('resize', reposition, { passive: true });
  addEventListener('scroll', reposition, { passive: true, capture: true });

  return {
    show,
    setComplete,
    mountControl(control) {
      controls.replaceChildren(control);
      controls.hidden = false;
      requestPosition();
    },
    status,
    /** Show `text` on the action button once the running action finishes. */
    flashAction(text) { actionFlash = text; },
    acknowledge,
    showTarget() {
      if (!state?.spotlight) return;
      acknowledged = false; gotIt.hidden = false;
      setReading(true);
      if (state.callout) { secondaryButton.hidden = true; status(''); }
      syncProgressActions();
      requestPosition();
    },
    welcome({ title: heading, body: description, terms = [], references = [], eyebrow = 'MATERIAL LAB', startLabel = 'Start exploring', autoStart = 0, onStart }) {
      setReading(false);
      if (welcomeTimer) clearTimeout(welcomeTimer);
      welcomeDialog?.remove();
      welcomeDialog = document.createElement('dialog');
      welcomeDialog.className = 'lesson-welcome';
      welcomeDialog.setAttribute('aria-labelledby', 'lesson-welcome-title');
      welcomeDialog.setAttribute('aria-describedby', 'lesson-welcome-body');
      welcomeDialog.innerHTML = '<p class="lesson-guidance-step"></p><h2 id="lesson-welcome-title"></h2><p id="lesson-welcome-body"></p><button type="button" class="lesson-guidance-continue"></button>';
      welcomeDialog.querySelector('.lesson-guidance-step').textContent = eyebrow;
      welcomeDialog.querySelector('button').textContent = `${startLabel} →`;
      renderTerms(welcomeDialog.querySelector('h2'), heading, terms, references);
      renderTerms(welcomeDialog.querySelector('#lesson-welcome-body'), description, terms, references);
      const start = () => { if (!welcomeDialog) return; welcomeDialog.close(); welcomeDialog.remove(); welcomeDialog = null; onStart(); };
      welcomeDialog.querySelector('button').addEventListener('click', start);
      welcomeDialog.addEventListener('cancel', event => { event.preventDefault(); start(); });
      mount.append(welcomeDialog); root.hidden = true;
      welcomeDialog.showModal();
      if (autoStart > 0) welcomeTimer = setTimeout(start, autoStart);
    },
    destroy() {
      setReading(false);
      guardedEvents.forEach(type => removeEventListener(type, guardReading, true));
      if (welcomeTimer) clearTimeout(welcomeTimer);
      clearTimeout(flashTimer);
      welcomeDialog?.remove();
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutations.disconnect();
      removeEventListener('resize', reposition);
      removeEventListener('scroll', reposition, true);
      document.getElementById('creator-app')?.classList.remove('lesson-mode');
      root.remove();
      state = null;
    },
  };
}
