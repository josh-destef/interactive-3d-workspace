/* ═══════════════════════════════════════════════
   DOCK
   Revealing, locking and painting the controls in the console's right half.

   The organising rule: a control arrives with the step that teaches it and
   never before. A dock full of controls on step one is a dock the student has
   to ignore, and ignoring a control is a habit that outlasts the step.

   Each control block in the markup carries a data-group; a beat names the
   groups it wants and everything else stays hidden:

       revealControls(['color', 'roughness']);
═══════════════════════════════════════════════ */

const dock = document.getElementById('dock');
const consoleEl = document.getElementById('console');

/** Show exactly these data-groups; hide every other control. */
export function revealControls(keys = []) {
    if (!dock) return;
    dock.querySelectorAll('.ctl').forEach(el => {
        el.classList.toggle('on', keys.includes(el.dataset.group));
    });
    dock.classList.toggle('on', keys.length > 0);
    consoleEl?.classList.toggle('has-dock', keys.length > 0);
}

export function hideDock() { revealControls([]); }

/** Controls stay visible but stop responding while a demo drives them. */
export function lockDock(on) { dock?.classList.toggle('locked', !!on); }

/** Draw the eye to a control the caption named but did not demo. */
export function flashControl(key) {
    const el = dock?.querySelector('.ctl[data-group="' + key + '"]');
    if (!el) return;
    el.classList.remove('flash');
    void el.offsetWidth;                 // restart the CSS animation
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 2400);
}

/* ── sliders ──
   The filled part of the track has to say how far along the value is, and
   `input[type=range]` cannot express that on its own, so --fill is written
   here on every change and read by the track gradient in controls.css. */
export function paintSlider(input) {
    if (!input) return;
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const pct = ((Number(input.value) - min) / (max - min || 1)) * 100;
    input.style.setProperty('--fill', pct + '%');
}

export function paintAllSliders(root = document) {
    root.querySelectorAll('input[type="range"]').forEach(paintSlider);
}

/** Set a slider's value from code (a demo, a reset) and repaint it. */
export function setSlider(input, value) {
    if (!input) return;
    input.value = value;
    paintSlider(input);
}

/** Write the small mono readout beside a control's label. */
export function setReadout(key, text) {
    const out = document.querySelector('.ctl-val[data-for="' + key + '"]');
    if (out) out.textContent = text;
}

/* ── segmented toggles ──
   State lives in aria-pressed, not a class, so the control is correct to a
   screen reader as well as to the eye. */
export function setSegment(container, attr, value) {
    const box = typeof container === 'string' ? document.getElementById(container) : container;
    if (!box) return;
    box.querySelectorAll('button').forEach(b => {
        b.setAttribute('aria-pressed', String(b.dataset[attr] === String(value)));
    });
}

/** Wire a segmented toggle; `onPick` gets the chosen data-<attr> value. */
export function bindSegment(container, attr, onPick) {
    const box = typeof container === 'string' ? document.getElementById(container) : container;
    if (!box) return;
    box.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        setSegment(box, attr, b.dataset[attr]);
        onPick(b.dataset[attr]);
    });
}

/* ── swatch row ──
   Built from data rather than markup so the palette lives in config.js with
   the rest of the lesson's decisions. */
export function buildSwatches(container, colors, onPick) {
    const box = typeof container === 'string' ? document.getElementById(container) : container;
    if (!box) return;
    box.innerHTML = '';
    colors.forEach(hex => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'swatch';
        b.style.background = hex;
        b.dataset.color = hex;
        b.setAttribute('aria-label', 'color ' + hex);
        b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', () => onPick(hex));
        box.appendChild(b);
    });
}

export function markActiveSwatch(container, hex) {
    const box = typeof container === 'string' ? document.getElementById(container) : container;
    if (!box) return;
    box.querySelectorAll('.swatch').forEach(el => {
        const active = el.dataset.color.toLowerCase() === String(hex).toLowerCase();
        el.classList.toggle('active', active);
        el.setAttribute('aria-pressed', String(active));
    });
}

/* ── example chips ──
   `examples` is { key: { label, color, ...whatever the lab applies } }. */
export function buildExamples(container, examples, onPick) {
    const box = typeof container === 'string' ? document.getElementById(container) : container;
    if (!box) return;
    box.innerHTML = '';
    Object.entries(examples).forEach(([key, example]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'example';
        b.dataset.example = key;
        b.setAttribute('aria-label', example.label + ' example');
        b.setAttribute('aria-pressed', 'false');
        b.innerHTML = '<span class="example-ball" style="background:' +
            (example.color || '#ccc') + '"></span>' + example.label;
        b.addEventListener('click', () => onPick(key, example));
        box.appendChild(b);
    });
}

export function markActiveExample(container, key) {
    const box = typeof container === 'string' ? document.getElementById(container) : container;
    if (!box) return;
    box.querySelectorAll('.example').forEach(el => {
        const active = el.dataset.example === key;
        el.classList.toggle('active', active);
        el.setAttribute('aria-pressed', String(active));
    });
}
