# The lab kit

Everything the guided labs share, in one place, so a new lab starts where the
last one finished.

It was pulled out of **Material Lab** and **Navigate + Transform** after those
two converged on the same shell — the same badge, the same Read card, the same
progress bar, the same demo cursor, and the same Read → Watch → Do rhythm
underneath. Hierarchy, Keyframes and Particles each carry a fourth and fifth
copy of most of it. This folder is the copy that gets maintained.

- **[index.html](index.html)** — every element, live, in one page. Open it first.
- **[template/](template/)** — a runnable three-beat lab. Copy this to start.
- **[../LEARNING-DESIGN.md](../LEARNING-DESIGN.md)** — what a step owes the student.

---

## Starting a new lab

```
cp -r polished/kit/template polished/labs/<your-lab>
```

The template sits one level shallower than a real lab, so fix the kit paths
first — `../` becomes `../../kit/` in exactly three places:

| File | From | To |
| --- | --- | --- |
| `index.html` | `href="../css/kit.css"` | `href="../../kit/css/kit.css"` |
| `js/main.js`, `js/lesson.js` | `'../../js/…'` | `'../../kit/js/…'` |
| `js/config.js` | `'../../js/utils.js'` | `'../../kit/js/utils.js'` |

Then, in order:

1. **`js/config.js`** — write the beat map and the copy first. If the lesson
   reads well here, the rest is plumbing; if it does not, no amount of interface
   will save it.
2. **`js/subject.js`** — load the GLB, expose `values` / `setValue` /
   `applyValues` / `reset`. Every mutation goes through those, so the demo, the
   student's controls and a reset cannot disagree.
3. **`index.html`** — add the `.ctl` blocks this lesson needs, each with a
   `data-group`. Delete the layers it does not (`#choice-layer`, `#quiz-card`).
4. **`js/lesson.js`** — the demo per beat, the gate per beat, the camera per beat.
5. **`css/lab.css`** — only what is genuinely particular to this lesson.

Nothing needs a build step. The labs are plain ES modules over an import map,
served from the repo as-is.

---

## What is in here

### CSS

| File | What it holds |
| --- | --- |
| `tokens.css` | Colors, the fluid type scale, the reset, `riseIn`, reduced-motion. |
| `shell.css` | Canvas window, progress bar, Watch/Your-turn badge, Replay, hint, loading, corner chrome, demo cursor, mouse diagram, model labels. |
| `console.css` | **Default step surface** — the full-width bottom bar, caption, footer, celebration. |
| `panel.css` | **Alternate step surface** — a floating card bottom-left, plus the free-play widget. Load *after* `console.css`. |
| `controls.css` | The dock: sliders, swatches, segmented toggles, example chips, buttons, RGB rows. |
| `cards.css` | The Read card, the choice layer, the modal layer. |
| `assess.css` | The scoreboard and the closing quiz. |
| `kit.css` | All of the above except `panel.css`, via `@import`. |

```html
<link rel="stylesheet" href="../../kit/css/kit.css" />
<link rel="stylesheet" href="css/lab.css" />
```

Kit first, lab second, so anything the lab overrides wins on source order alone.

### JS

| Module | What it does | Needs three.js |
| --- | --- | --- |
| `beats.js` | The lesson machine: Read → Watch → Do, gates, Continue, Replay. | via `anim.js` |
| `ui.js` | Caption, badge, Read card, choice, progress, footer, keyboard. | no |
| `controls.js` | Reveal / lock / flash controls; build swatches, chips, segments; paint sliders. | no |
| `demoCursor.js` | The demo pointer, in viewport space *or* projected from the scene. | no |
| `gate.js` | Span tracking — how a step decides the student has done the thing. | no |
| `quiz.js` | The closing questions, from data. | no |
| `mouseDiagram.js` | The labelled mouse SVG, as an HTML string for a caption. | no |
| `anim.js` | `animate01` / `runSequence` / `tickAnims` — the whole demo engine. | no |
| `utils.js` | `clamp`, `lerp`, `easeInOut`, `remap`, hex↔rgb. | no |
| `stage.js` | Renderer, scene, camera, orbit, two light rigs, camera flights, `V3`. | yes |

Only `beats.js` and `stage.js` touch three.js, so a page with no 3D scene can
use the whole shell — including running a real scripted demo. (`V3` lives in
`stage.js` rather than `utils.js` for exactly this reason: `utils` sits under
`anim`, which sits under every demo.)

---

## Console or panel?

Both style the same inner markup (`#panel`, `#cap-step`, `#cap-title`,
`#cap-body`, `.panel-footer`), and every kit module works unchanged either way —
`ui.js` detects which one is present. Load exactly one.

**Console** (default) — one bar across the whole bottom: words left, controls
right. Use it whenever the lesson has DOM controls.

The earlier design floated a small caption card bottom-left and a control card
bottom-center. On a laptop that reads fine; on a 27" display they are two
islands in an ocean of gray and the student's eye never goes near them. One bar
with a shared edge fixed that without making anything bigger.

**Panel** — a floating card bottom-left, canvas edge to edge. Use it when the
lesson happens *in* the viewport and there are no controls to dock, which is the
case Navigate + Transform was built for.

---

## The rules the kit encodes

These are not style preferences. Each one is here because breaking it made a
lesson measurably worse to sit through.

**One caption per beat, written once.** The Read card introduces the idea; the
caption gives the action and the thing to notice; the caption then stays put
through Watch *and* Do. Swapping it when the demo ends means a student who
looked away and back is reading something different from what they started, and
cannot tell whether they missed a step or the app changed its mind. Write a
`panel` string that is true before, during and after the demo.

**A demo never satisfies its own gate.** `beats.js` clears the gates again after
a demo finishes. Without that, the step is already complete before the student
touches anything, and the "your turn" is a lie.

**Gate on a span, not a value.** A step about noticing a change unlocks on how
far the student drove a control, not on them hitting particular numbers. Gating
on exact values turns a step about noticing something into a scavenger hunt for
the ends of a slider. A student who drags roughness from 50 to 90 has already
seen the thing the step is about. See `gate.js`.

**A control arrives with the step that teaches it.** A dock full of controls on
step one is a dock the student has to ignore, and ignoring a control is a habit
that outlasts the step.

**Name both ends of every slider in words.** "0.94" means nothing to a beginner;
"chalky" does. That is the difference between a control they can guess at and
one they have to be told about.

**Nothing is scored.** The quiz tally counts questions answered, not questions
got right first time. Every option carries a reason, especially the wrong ones —
the reason is the only part that teaches anything.

**The demo cursor's press glow says which mouse button is down.** Orange is the
left button, green is the right. That is the whole rule. The glow is the only
signal that the cursor acted rather than passed over, and which button to hold
is the one thing about a mouse a beginner cannot guess — so the colour is spent
on saying that and nothing else. Don't recruit green for "a click rather than a
drag": a left-click and a left-drag are the same button, so they read as the
same colour.

**Space carries the whole lesson.** It dismisses the Read card while that is up
and advances the beat otherwise, so the student never has to find a different
target between stages. `bindKeyboard` does this; do not add a second handler.

---

## Changing the kit

The point of a shared folder is that a fix lands once. So:

- **Change a token in `tokens.css`**, never in a lab. If one lab needs a
  different value, that is a new token or a lab-level class — not a redeclared
  one.
- **A second copy of a kit component with one value changed** means either the
  kit is wrong (fix it there) or the difference belongs to the lab (put it in a
  class of its own, on top of the kit's).
- **Open `index.html` after any CSS change.** It renders every element on one
  page, so drift shows up immediately rather than three labs later.

### The existing labs

Material Lab and Navigate + Transform still carry their own copies and are
**not** wired to the kit — they are finished, working lessons, and rewiring them
buys nothing on its own. The kit was extracted from them faithfully, ids
included, so either can be migrated later by deleting the duplicated blocks and
adding the `<link>`. Do that as its own change, one lab at a time, with the
lesson open in a browser.

Until then, if you fix something in a lab that the kit also has, fix it in both.
