# Lesson and documentation review: 1 October 2026

Scope: Navigate & Transform, Material Lab and Build Gizmobot, and the docs a
person would read before building the next lesson. The new standard that came
out of this review is [`polished/creator/LESSONS.md`](../polished/creator/LESSONS.md).

## Summary

The lessons themselves are in good shape and increasingly consistent. The
documentation is not. The guidance for making a lesson is spread across six
files written for an earlier architecture. The most authoritative-sounding one,
the `createaccess-lessons` skill, describes a layout that no Creation Studio
lesson uses. Everything learned in review since lessons moved into Creation
Studio is recorded only as change-log paragraphs and personal notes. None of it
existed as rules anyone could follow.

---

## Part A: the existing documentation

| Doc | Verdict | Problem | Action taken / recommended |
| --- | --- | --- | --- |
| `docs/skills/createaccess-lessons/SKILL.md` | **Misleading** | Written for standalone kit labs. Instructs `workbench.css`, `#panel`/`#dock`, `.logo-top-right` and `#btn-continue`; none of these exist in Creation Studio. Names `labs/material-lab/` and `labs/model-an-accessory/` as references, but those are now redirect stubs beside migration leftovers. | Scoped to legacy kit labs, with a pointer to `LESSONS.md` at the top (done). |
| `polished/README.md` | **Out of date** | "Adding a module" says to copy `kit/template/`. Describes Material Lab as a standalone workbench lab. Claims every lab ends with an exit-check quiz. Says nothing about Creation Studio lessons. | Pointer to `LESSONS.md` added in "Adding a module" (done). The lab list and "four guided labs" paragraph still need a rewrite. |
| `polished/LEARNING-DESIGN.md` | **Sound principles, stale specifics** | The review rules hold up well: demos never satisfy gates, gates accept many values, one card per step. But the six-part journey ends in a retrieval quiz, and the Material row's evidence column says "then explain…". Material Lab dropped its quiz, and Build Gizmobot never had one. | Keep as the "why". `LESSONS.md` links to it. Its Material row should drop the quiz evidence. |
| `polished/kit/README.md` | **Fine, for the kit** | Accurate for standalone labs. It opens by saying the kit was "pulled out of Material Lab", which reads as if Material Lab still uses it. | Leave. Optionally add one line saying new lessons belong in Creation Studio. |
| `polished/creator/README.md` | **Hard to use** | Mixes product features, per-lesson implementation stories, test logs and machine-specific notes ("the desktop browser tool could not start because of a Windows sandbox ACL error"). The lesson sections are change-logs written one fix at a time. The Build Gizmobot paragraph is now one 30-line sentence chain. "Original editor boundaries (updated by the studio extension below)" contradicts itself. | Pointer to `LESSONS.md` added above its Lesson API section (done). Recommend cutting each lesson section to 3–5 lines on what's unique to it. |
| `polished/creator/ARCHITECTURE.md` | **Partly scaffolding** | The data contracts are useful. The "Model agent owns…, Viewport agent owns…" file-ownership rules were instructions for the original multi-agent build and no longer apply. | Recommend deleting the ownership paragraph. |
| `docs/CURRICULUM_ARCHITECTURE.md` (uncommitted) | **Broken links** | Links to `LESSON_METADATA_SPEC.md` and `CONCEPT_LAB_DESIGN_SYSTEM.md`, which don't exist. | Fix or remove the links before committing. |
| `docs/LAB_REVIEW_CLEANUP.md` | **History, fine** | A dated log. Its Assembly notes ("tool/Snap setup") describe a flow that has since been replaced. | Leave as history. |
| `labs/material-lab/` | **Confusing on disk** | The redirect sits beside the whole previous standalone lesson (`js/`, `css/`, `qa/`), kept "as migration reference". A new author can easily open the wrong Material Lab. | Recommend moving the old code under `labs/material-lab/legacy/`, or deleting it now that the migration is reviewed. |

The unwritten rules (step granularity, static captions, introducing tools at
point of use, learners enabling settings themselves, the finale pattern) lived
only in review comments and assistant memory. They are now sections 2–3 of
`LESSONS.md`.

---

## Part B: the three lessons compared

| | Navigate & Transform | Material Lab | Build Gizmobot |
| --- | --- | --- | --- |
| Runs in | Standalone kit lab | Creation Studio | Creation Studio |
| Numbered steps | 11 | 8 | 12 (Choose Move advances by itself) |
| Opening | "Meet Gizmobot!" card in the lesson panel | Welcome: "Create your own Gizmobot look" (outcome) | Welcome: "Welcome to Creation Studio" (names the tool) |
| Steps with an Okay gate | None | 6 of 8 (new controls) | 6 of 12 (new controls; fixed this session) |
| Dimming | n/a | On | Off (viewport work) |
| Demos | Watch demo on most beats | Optional Watch comparison | None |
| Tools introduced | One per beat, used immediately | Inspector controls, one per step | One per step, at point of use (fixed this session) |
| Green terms | n/a | First use only | **Repeated** (Viewport, Snap, Rotate, Inspector, Position appear on several steps) |
| Finale | "You can navigate 3D space!", free play, Back to Home | "You can design materials!", Save picture, Back to Home | "You can build in Creation Studio!", orbit check, Back to Home (fixed this session) |
| Keyboard progress | Space to continue | Focus returns to Continue | Focus returns to Continue |
| Tests | Curriculum script | 7 Node tests + cursor/studio tests | 6 Node tests (full playthrough) |

### Fixed during this session (Build Gizmobot)

- Move, Rotate and Scale were previewed together, then hidden. Each now appears
  on the step that first uses it and stays.
- The Head repair is now three short cards: **Turn on Snap** (Continue),
  **Choose Move** (moves on by itself), then **Move the Head into place**. Move stays hidden until Snap is on, so the Head can't be dragged
  off the snap grid. Rejected along the way: a tools overview, Snap
  pre-enabled, one long paragraph, numbered lines in one card, a pointer that
  moved within one card, and a "drag by eye first" step.
- Rotation and Scale in the Inspector now use the same drag-left/right field
  as Position, everywhere in Creation Studio.
- The catch radius (0.15) is wider than half a snap step, so a Head dragged
  before Snap was turned on can always be snapped home. Checked with real
  pointer drags in the browser.
- The finale is now unnumbered, celebratory, and ends with Back to Home.
- Style drift from Material Lab removed: grey step label, the green "Build
  Gizmobot" header badge, the footer status text, the boxed "Show me where",
  slightly larger card, and the playground tools flashing in while loading.

### Still open, in priority order

1. *(Fixed this session.)* Build Gizmobot spotlit every step, so read-only
   steps asked for Okay and then Continue. It now spotlights only steps 2, 4,
   5, 7, 8 and 10.
2. **Shared card styling is copied between lessons (medium).** The card
   density, underlined "Show me where" and hidden status bar are now identical
   in `material-lesson.css` and `assembly-lesson.css`. That's how the
   step-label colour drifted in the first place. Move these into `lesson.css`
   as the default for every guided lesson. Model an Accessory would pick them
   up too, so check it after.
3. **Build Gizmobot repeats green terms (medium).** Keep each term on its
   first step only. For the finale, either drop the terms or keep them
   deliberately as a recap.
4. **Build Gizmobot's welcome names the tool, not the outcome (low).**
   Something like "Put Gizmobot back together" would match Material Lab's
   "Create your own Gizmobot look". The eyebrow and start button would then
   follow ("Start building").
5. **Three different step formats (low, for future work).** Material Lab
   (`COPY`/`TERMS`/`TARGETS` maps), Model an Accessory (`step()` helper) and
   Build Gizmobot (`STEPS` array) each describe steps differently. New lessons
   should use the array (`LESSONS.md` section 4). Converting the existing ones
   is optional.
6. **Lesson wiring is scattered through `main.js` (low).** Each lesson adds
   `if (lessonId === …)` blocks in four places: seed, initial capabilities,
   status text and import. A small lesson registry would make adding the next
   lesson a one-place change.
7. **Model an Accessory ends with "Finish lesson" (outside this review's
   three).** It doesn't use the celebration finale or Back to Home. Align it
   when that lesson's in-progress rework settles.
