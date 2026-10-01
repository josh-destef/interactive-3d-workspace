# Making Creation Studio lessons

How to design, build and check a guided lesson that runs inside Creation Studio
(`/polished/creator/?lesson=<id>`). This is the current standard. It replaces the
lesson guidance in `kit/README.md` and `docs/skills/createaccess-lessons/` for
anything built in Creation Studio; those still describe the older standalone kit
labs.

Reference lessons:

| Lesson | Where | Use it as the reference for |
| --- | --- | --- |
| **Navigate & Transform** | `labs/navigate-and-transform/` (standalone kit lab) | Tone, pacing, the finale. The first lesson every learner meets. |
| **Material Lab** | `creator/js/lessons/material.js` | Inspector-led lessons, optional Watch demos, the instruction card's look. |
| **Build Gizmobot** | `creator/js/lessons/assembly.js` | Viewport-led lessons, introducing tools one at a time, gates with tolerances. |

New lessons go in Creation Studio, not the standalone kit.

---

## 1. Shape of a lesson

```
Welcome card  →  8–14 numbered steps  →  unnumbered finale  →  Back to Home
```

- **Welcome:** a centred card with an eyebrow (lesson name in capitals), an
  outcome-first title, two or three sentences, and one start button. It names
  what the learner will make, not the tools they will meet.
- **Numbered steps:** each card says one short thing. Most end in a visible
  result; pure setup cards move on by themselves (see 2.1). Aim for 8–14. If
  you pass 15, the lesson is doing too much.
- **Finale:** not counted in "Step N of M". It congratulates the learner
  ("You can …!"), recaps what they can now do, leaves the scene interactive, and
  offers **Back to Home**.

## 2. Teaching rules

Each rule comes from a real review of these lessons. The reason matters more
than the rule.

### 2.1 One idea per card, and no clicking through

Each card says one short thing. A step whose real work is a single click can
have its own card.

- **Turning on a setting** the lesson is teaching (Snap) ends with
  **Continue**, so the learner sees it lit and moves on when ready.
- **Just choosing a tool** can move on by itself once the click is done
  (`autoAdvance: true`), with no Continue.
- **Steps that produce a visible result** end with Continue as usual.

Build Gizmobot's Head repair runs as three cards:
1. **Turn on Snap** (Continue).
2. **Choose Move** (moves on by itself).
3. **Move the Head into place** (Continue once it's in).

Each card is one sentence or two.

Keep the total around 8–14 numbered steps. Self-advancing setup cards are
quick, but they still count.

*Why:* every version of this was rejected until it was split this way. An
auto-advance after turning on Snap was also rejected: "make sure the user has
to click continue after turning on snap, dont just jump to next thing". Setup
steps that needed Continue felt like clicking through ("you think it's time
to move, then Snap, then you have to click through"). Folding everything into
one card, even as numbered lines, was "just too wordy". Model an Accessory's
31 steps, each ending in Continue, felt tedious.

### 2.2 Introduce a tool or setting when it's first used

Don't preview a toolset in one step and then hide it. A tool appears on the
rail on the step that first uses it, with its one-sentence explanation in that
step's card. After that it stays available.

If a lesson has to hide something it already introduced, the card says why in
one clause. For example, Build Gizmobot's locked-camera steps say "the tool
handles step aside: a drag could shift an axis you cannot see".

*Why:* Build Gizmobot used to show Move, Rotate and Scale together in a "meet
the tools" step, then take them away. Learners read that as the tools
disappearing.

### 2.3 Learners turn things on themselves

If a setting is part of what's being taught (Snap, a material slider, a view
mode), the learner clicks it, and the card explains what it does at that
moment. Don't pre-enable it to save a click.

*Why:* a setting that's already on is never noticed, so it's never learned.

### 2.4 One static caption per step

Write the whole instruction once: **the action first**, then what to notice and
why. Never rewrite the caption when a demo ends or the gate passes. Feedback
(scores, hints) goes beside the control that produced it, not into the
instruction.

*Why:* swapping text mid-step was described as "really disorienting". It also
splits the instruction into two places.

### 2.5 Show the problem before the vocabulary

Start from something visibly wrong or different: a frowning, disconnected Head;
an oversized Hand; a shell that disappears when the lights go off. Name the
concept once the learner can see why it matters.

This is about the scene, not about helper tools. A helper like Snap gets a
short card where it's first needed (2.1). Don't make the learner fail without
it first. Build Gizmobot tried a "drag by eye, then click it into place with
Snap" step, and it was rejected.

Rejected ways of bringing Snap into Build Gizmobot, so they aren't tried
again:
- a "meet the tools" overview;
- Snap pre-enabled;
- one paragraph covering Snap and Move;
- numbered lines in one card;
- one card whose pointer moved from Snap to Move;
- the "fail first" step.

The card text can still contain line breaks (`\n`, shown by `white-space:
pre-line` in `lesson.css`) if a step truly needs a short list.

### 2.6 Mark vocabulary the first time only

`terms: [...]` turns a word green, and `references: ['Navigate & Transform']`
turns a prior-lesson name navy. List a term on the step that introduces it,
not on every later step that mentions it. Green should mean "this is new".

### 2.7 Use the Okay callout only for new controls

A step with `spotlight: true` dims the screen, points the card at its
`target`, and blocks input until the learner chooses **Okay**. Use it when the
step introduces a control or interface region the learner hasn't seen. Steps
that reuse familiar controls set no spotlight: the card stays in its home and
the learner can act at once.

Never spotlight a read-only step (one whose only action is Continue). Its
card would show **Okay** and then **Continue**: two clicks for nothing.
"Show me where" only reopens a spotlight, so offer it only on spotlit steps.

Build Gizmobot spotlights steps 2, 4, 5, 7, 8 and 10: the Outliner, Snap,
Move, Rotate, the Inspector, and Position fields. Steps 1 and 3 (read-only),
6 (the drag; Move was just introduced), 9 (same Inspector) and 11–12 (same
Position fields) don't.

*Why:* every spotlight is a forced click. When Build Gizmobot spotlit all ten
steps, step 3 asked for Okay and then Continue, which felt like clicking
through.

### 2.8 Gates detect outcomes, with room for error

- Check the outcome (the Head is within 0.15 of its joint), not one exact
  value or one specific route.
- Accept close values, then snap them to the exact target so things line up
  visibly.
- Enforce the order when it matters. Build Gizmobot hides Move until Snap is
  on, so the Head can't be dragged off the snap grid first. Pass the needed
  state into the step's capabilities (here `tools.getSnapping()`), and
  include it in the capability cache key.
- Still design for the wrong order wherever you can't enforce it. A Head
  moved later with Snap off is off the 0.25 grid, so snapped drags can only
  bring it within half a step. The catch
  radius (0.15) is set just wider than that, so the learner can always
  finish. If any path leads to a dead end, widen the tolerance
  or reset the state.
- A Watch demo or "Show me where" must never satisfy the gate.
- Completing the gate reveals **Continue**. Only a tool-choice step
  (`autoAdvance`) moves on by itself, after a short pause (about 0.5 s) so the
  learner sees the click work.

### 2.9 Demos are optional

A Watch demo (Material Lab's "Watch comparison") drives the real control with
the shared demo cursor, then restores the learner's state. Add one only when a
control or relationship is hard to discover. Most viewport steps don't need
one.

### 2.10 Keep the learner's work

The finale and free play keep what the learner built or designed. Material
Lab restores the learner's own design after the matching challenge.

---

## 3. Screen and style rules

Creation Studio already supplies the look. A lesson adds as little styling as
possible.

| Element | Rule |
| --- | --- |
| Instruction card | One home: lower-left of the viewport, 420px wide, steady height between steps. During a spotlight it points at its target, then returns home after Okay. |
| Step label | `STEP N OF M` in CreateAccess green (`lesson.css`). Never override its colour. |
| "Show me where" | The quiet underlined link on the left of the card's actions. Continue is the only orange button. |
| Header | Logo and "Creation Studio" only. No lesson badge. |
| Footer status bar | Hidden in lessons. |
| Tool rail | Left of the viewport. Shows only the tools introduced so far. Hide the whole rail if the lesson never uses viewport tools (Material Lab). |
| Snap / View | Top-right of the viewport. Hidden until taught. |
| Transform fields | Position, Rotation and Scale all use the same field: drag left or right across the number (‹ ›), or click to type. Don't mix in spinner boxes or range sliders. |
| Outliner / Inspector | Right-hand dock. Outliner first; Inspector sections appear only when taught. |
| Dimming | `dim: true` for Inspector-led lessons. `dim: false` when the learner works in the 3D view, so dimming doesn't hide the object being dragged. |
| Placement guides | Orange outline or label in the scene ("PLACE HEAD HERE"). Never part of the project, history, snapping or saved files. |

**Loading.** Creation Studio starts as the full playground. Lock a lesson down
in `main.js` *before* the lesson module loads, or the Add menu, all tools and
the Outliner eye icons flash in while the page loads (see section 4).

**Lesson CSS.** `css/<name>-lesson.css` holds only what this lesson genuinely
needs: dock heights, scene labels, phone layout. Shared card styling lives in
`lesson.css`. If you find yourself copying a rule from another lesson's
stylesheet, move it to `lesson.css` instead.

---

## 4. Wiring a new lesson

| Step | File | What to do |
| --- | --- | --- |
| 1 | `js/lessons/<name>.js` | Export `create<Name>Lesson(creator, { guidance, guide, onFinish })`. Await `creator.viewport?.ready`. Expose `creator.lesson = { state, next(), destroy() }`. |
| 2 | `js/main.js` | One `lessonId === '<id>'` block: seed the project (`project.restore(...)`), add a body class, hide `#guide` and `#help-toggle`, load the lesson CSS. |
| 3 | `js/main.js` | Add the lesson to the initial `setCapabilities(...)` call so nothing flashes while loading. Lock tools, Add, actions and features. |
| 4 | `js/main.js` | Import the lesson after the viewport is ready, and set `window.creator.lesson`. |
| 5 | `css/<name>-lesson.css` | Only lesson-specific rules. Hide `.statusbar`. |
| 6 | `labs/<folder>/index.html` | A redirect stub to `../../creator/?lesson=<id>`, plus a short README. |
| 7 | `polished/index.html` | Hub card in the right status section. Art in `assets/lab-previews/` at 800×520. |
| 8 | `tests/<name>.test.mjs` | A full playthrough with a fake guidance object (section 7). |

### Recommended step format

Keep the whole script in one array, so copy, terms, targets and gates sit
together and can be read top to bottom:

```js
export const STEPS = Object.freeze([
  { kind: 'scene', title: 'Find the Head in the Outliner', target: '.scene-panel', spotlight: true,
    terms: ['Outliner'],
    body: 'Choose Head in the Outliner on the right. Notice it selects the same piece in the Viewport.' },
  { kind: 'headSnap', part: HEAD, title: 'Turn on Snap', target: '.snap-toggle', spotlight: true,
    terms: ['Snap'],
    body: 'Choose Snap at the top right. It makes each drag jump in even steps, so parts line up exactly.' },
  { kind: 'headMoveTool', part: HEAD, title: 'Choose Move', target: '[data-tool="move"]', spotlight: true, autoAdvance: true,
    terms: ['Move'], references: ['Navigate & Transform'],
    body: 'Choose Move, which you used in Navigate & Transform.' },
  { kind: 'headMove', part: HEAD, title: 'Move the Head into place',
    body: 'Drag the Head’s arrows into the orange guide.', continueLabel: 'Straighten the Head' },
  // …
  { kind: 'done', title: 'You can build in Creation Studio!', body: '…', continueLabel: 'Back to Home' },
]);
const NUMBERED_STEPS = STEPS.length - 1;   // the finale is not numbered
```

Material Lab and Model an Accessory use other formats (keyed `COPY`/`TERMS`
maps and a `step()` helper). Prefer the array for new lessons.

### Capabilities per step

Derive each step's capabilities from where it sits in the lesson, rather than
listing them by hand. That way tools accumulate and nothing reappears by
accident:

```js
const introducedAt = kind => STEPS.findIndex(step => step.kind === kind);
const TOOL_INTRODUCTIONS = { move: introducedAt('headMove'), rotate: introducedAt('headRotate'), scale: introducedAt('handScale') };
const tool = name => targetSelected && index >= TOOL_INTRODUCTIONS[name];
```

Re-apply capabilities when the selection changes if tools should only work on
the step's target part. Restore free-play capabilities in `destroy()`.

### Showing a step

```js
guidance.show({
  step: isFinale ? '' : index + 1, total: NUMBERED_STEPS,
  title, body, terms, references,
  target, spotlight, callout: Boolean(target), fixedHome: true, dim,
  celebrate: isFinale,
  canContinue,                 // true for read-only steps; otherwise call setComplete() from the gate
  continueLabel: isFinale ? 'Back to Home' : 'Continue',
  secondaryLabel: target ? 'Show me where' : null,
  onSecondary: () => guidance.showTarget(),
  onContinue: isFinale ? goHome : next,
});
```

where `goHome` runs `destroy()`, then `onFinish ? onFinish() : location.assign(new URL('../', location.href))`.
Tests pass `onFinish` so they never navigate.

---

## 5. Guidance API (`js/lessons/guidance.js`)

`createGuidance()` returns:

| Method | Use |
| --- | --- |
| `welcome({ eyebrow, title, body, terms, references, startLabel, onStart })` | The opening card. `body` may contain `\n\n` for a second paragraph. |
| `show(options)` | Render a step (options below). Resets acknowledgement and completion. |
| `setComplete(bool)` | Show or hide Continue as the gate passes or fails. |
| `acknowledge()` | Dismiss a spotlight from code (e.g. once the learner has done the thing). |
| `showTarget()` | Reopen the spotlight, for "Show me where". |
| `mountControl(node)` | Put lesson controls (e.g. Check match) inside the card. |
| `status(text)`, `flashAction(text)` | Short status or action-button feedback. |
| `destroy()` | Remove the card and its listeners. |

`show()` options:

| Option | Meaning |
| --- | --- |
| `step`, `total` | `STEP {step} OF {total}`. Pass `''` for the unnumbered finale. |
| `title`, `body` | Plain text. Never HTML. |
| `terms`, `references` | Words to colour green (new vocabulary) or navy (prior lessons). |
| `target` | CSS selector or element the step is about. |
| `spotlight` | Dim around `target` and require Okay. New controls only (2.7). |
| `callout`, `anchorCallout`, `placement` | Point the card at the target during the spotlight. `anchorCallout: false` keeps it home (use for big regions like the whole Viewport). |
| `fixedHome` | Card rests lower-left. Always `true` in Creation Studio. |
| `dim` | `false` to keep the scene bright during a spotlight (3). |
| `celebrate` | Finale styling: orange title and glow. |
| `canContinue`, `continueLabel`, `onContinue` | The progression button. |
| `secondaryLabel`, `onSecondary` | Usually "Show me where". |
| `actionLabel`, `onAction`, `actionTone`, `actionBusyLabel`, `hideActionWhenComplete` | An optional in-card action, such as Watch comparison, Turn off the lights or Save picture. |

---

## 6. Capabilities (`creator.setCapabilities`)

Calls merge partial records. Hidden tools and actions also lose their keyboard
shortcuts. These are teaching controls, not security.

| Group | Keys |
| --- | --- |
| `tools` | `select`, `move`, `rotate`, `scale`, `add` |
| `panels` | `scene`, `inspector`, `bottomEditor` |
| `inspectorSections` | `transform`, `geometry`, `appearance`, `hierarchy` |
| `transformFields` | `position`, `rotation`, `scale`, plus `axes` and `currentAxis` for one axis at a time. Every field drags by default; `scrub: { scale: false }` opts a group out. |
| `appearance` | `baseColor`, `rgb`, `roughness`, `metalness`, `emissive`, `exploreRgb`, `readOnly` |
| `actions` | `duplicate`, `delete`, `visibility`, `rename`, `group`, `ungroup`, `reparent` |
| `shapes`, `shapeNames` | Which Add-menu shapes exist, and their names |
| `scene` | `excludeIds`: hide entities from the Outliner |
| `features` | `studio` (workspaces), `snap`, `snapSettings`, `view` |

Other hooks lessons use: `tools.setSnapSettings`, `tools.getActive`,
`viewport.moveCamera(view, { orthographic, duration })`,
`viewport.setCameraLocked`, `dock.inspector.revealSection(section, field)`,
`project.history.clear()` (start a fresh undo baseline for a challenge).

---

## 7. Testing and checking

1. **Node playthrough** (`tests/<name>.test.mjs`). Build Creation Studio's real
   project and tools, with a fake guidance object that records `show()` and
   `setComplete()` calls (see `assembly.test.mjs`'s `harness()`). Walk every
   step and check:
   - each gate fails before the action and passes after it;
   - each tool appears on its introduction step and stays after;
   - demos never complete a gate;
   - the finale is unnumbered, celebratory, and calls `onFinish`.
2. **Real browser playthrough.** Use the `run-lesson` skill: serve the repo,
   open `/polished/creator/?lesson=<id>`, click Okay on spotlit steps, and drive
   the lesson to the finale. Check the console has no errors.
3. **Screenshots** go in `.screenshots/` (gitignored). Check 1440×900 and a
   phone width (390–400px), plus the loading state.
4. Run the shared suites when you touch shared code: `guidance.test.mjs`,
   `lesson-capabilities.test.mjs`, `viewport.test.mjs`.

---

## 8. Review checklist

Before asking for feedback:

- [ ] About 8–14 numbered steps. Each card says one short thing. Turning on a taught setting ends with Continue. Only a tool-choice card may move on by itself (`autoAdvance`).
- [ ] No overview steps. Every tool is introduced on the card where it's first used.
- [ ] Nothing introduced earlier disappears without the card saying why.
- [ ] Settings being taught start off, and the learner turns them on.
- [ ] Each caption is action-first, one or two sentences, set once, and never rewritten.
- [ ] Green terms appear on their first step only.
- [ ] Spotlight/Okay only on steps that introduce a new control or region. Never on read-only steps. "Show me where" only on spotlit steps.
- [ ] Every gate tolerates near misses and wrong orders. No dead ends.
- [ ] The welcome title names the outcome. The finale is unnumbered, says "You can …!", and offers Back to Home.
- [ ] No lesson badge, no status bar, green step label, underlined "Show me where".
- [ ] Nothing flashes while loading.
- [ ] Lesson CSS contains nothing that belongs in `lesson.css`.
- [ ] Node playthrough passes; real browser run reaches the finale with no console errors; desktop and phone screenshots checked.
