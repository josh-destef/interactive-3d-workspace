---
name: createaccess-lessons
description: Design or revise guided lessons in the existing CreateAccess 3D labs, using the repository's lesson kit, shell placement rules, and prompt-led teaching pattern. Applies only to this repository's polished labs and kit.
---

# CreateAccess 3D lessons

Use this skill when changing a guided lesson or its instructional interface in
the `polished/` CreateAccess 3D labs. Work from the repository checkout: locate
the repo root from the current workspace, then use the relative paths below.
Do not generalize these rules to unrelated web projects or introduce a new
lesson framework when the existing kit can express the change.

## Design the lesson as prompts

Treat each stage as a compact prompt led learning loop:

1. State one idea in plain language, tied to what the learner can see.
2. Ask for one concrete action.
3. Ask what to notice, compare, predict, or explain.
4. Reveal feedback or unlock the next action when the observable goal is met.

Keep one primary action and one observation in the step's instruction. Follow
the reference caption style: **action first**, then a short explanation of what
to notice. Prefer plain verbs and the exact visible control names over slogans.
Keep that caption steady during a demonstration and the student's attempt. Put
definitions, edge cases, and misconception repair in feedback or retrieval
questions. A worked example or `Watch` demonstration is optional: include it
when the control or visual relationship is hard to discover, and omit it when a
short prompt and direct manipulation are clearer. Do not impose a Read/Watch
sequence on every step. A welcome/orientation prompt may be still and direct;
control rich steps may begin with the learner acting; demonstrations should
never satisfy the learner's own practice gate.

Use the curriculum contract in `polished/LEARNING-DESIGN.md` as evidence for
the learning purpose: orient, build a mental model, create a visible contrast,
author a bounded result, then retrieve and remix. Preserve its technical
boundaries and misconceptions rather than inventing new engine rules.

## Place interface elements by job

Use this matrix before adding or moving UI:

| Job | Home | Rule |
| --- | --- | --- |
| CreateAccess identity | Fixed top-right chrome (`.logo-top-right`) | Reuse the existing wordmark asset and sizing; keep menus clear of it at narrow widths and do not create a second brand treatment in the lesson body. |
| Direct viewport tools | A compact left rail beside the viewport | Keep Select, Move, Rotate, Scale, and related direct-manipulation tools beside the instructions. Use icon plus visible text for primary tools, and give each action one home. |
| View utilities | In the left rail or its existing fixed utility landmark | Keep Home and Reset view stable and visually separate from editing tools. |
| Persistent sliders, swatches, toggles, values, or examples | The right inspector (`#dock`) | Reveal a control with the stage that teaches it. Keep related controls together, keyboard reachable, and label slider ends in words. |
| Object or shape hierarchy | The right inspector, above or beside its related controls | Use an outliner when selection or parent/child structure matters. Keep selection synchronized with viewport selection. |
| Practice buttons (Fire, Clear, Pause, Check, Apply) | Beside the controls they operate in `#dock` | Group them separately from lesson navigation. Use the existing `.dock-btn` styles; keep primary emphasis for the current meaningful action. |
| Action plus observation prompt | One compact card on the left (`#panel`, caption fields) | Write one short action and one thing to notice. Match Navigate and Transform's card treatment; never use a full-width bottom strip. |
| Progression | The existing footer action (`#btn-continue`) | Keep Continue hidden until the stage's observable goal is met; reserve the footer for advancing or finishing. |
| Optional help/demo | Existing replay/watch affordance or feedback area | Use only when it reduces search or clarifies a relationship. It must leave practice for the learner. |

Keep transient feedback brief and in a stable status region. Revealing controls
must not resize the viewport or reframe the camera while the learner is holding
an object. On narrow screens, stack viewport, instruction card, and inspector in
that order; keep both cards bounded and scrollable where height is limited.

The CreateAccess wordmark is already referenced by polished lessons at
`assets/brand/logo-wordmark.png` (for example, from
`polished/labs/material-lab/index.html` via `../../../assets/brand/logo-wordmark.png`).
Resolve that path from the repository root rather than copying assets into a
lesson or depending on a machine specific absolute path.

## Use the workbench shell

The standard desktop lab is a three-region workbench:

1. The 3D viewport occupies all space not reserved for the right inspector.
2. A compact instruction card overlays the lower-left of the viewport, beside
   a narrow rail for relevant direct-manipulation and view tools, using
   the caption, footer, Watch/Your Turn, replay, and Continue behavior established
   by Navigate and Transform.
3. A Blender-like inspector sits on the right. Put the scene outliner first,
   then contextual settings, sliders,
   swatches, numeric values, and buttons that manipulate non-viewport state here.

Moving, rotating, scaling, orbiting, or selecting an object remains a viewport
interaction. Do not duplicate those actions as right-panel sliders unless a
lesson explicitly teaches numeric transforms. The inspector is contextual: it
keeps the outliner visible for orientation, while each property group arrives
only when the lesson teaches it. When a hierarchy-focused lesson already uses
the full right sidebar for parent/child controls, that control hierarchy may
stand in for a separate scene outliner until the lab is deliberately migrated.

Load `polished/kit/css/workbench.css` after the lab's existing styles and add
`lab-workbench` to `#app`. Use `accessory-workbench` when the separate modelling
outliner also needs the shared upper/lower inspector treatment. Keep `#console`
only as a state/accessibility wrapper for labs already wired to it; the workbench
stylesheet makes it non-visual and gives its `#panel` and `#dock` their proper
left/right homes. Do not create a lab-specific fourth placement model.

## Work from the existing kit and assets

Read the relevant source before editing:

- `polished/LEARNING-DESIGN.md` — curriculum and review contract.
- `polished/kit/README.md` — kit structure, console/panel choice, and invariants.
- `polished/kit/css/workbench.css`, `controls.css`, `panel.css`, and `shell.css` — standard placement and responsive behavior.
- `polished/kit/js/beats.js`, `ui.js`, `controls.js`, and `gate.js` — stage state, prompts, controls, and practice gates.
- `polished/labs/navigate-and-transform/` — viewport led floating panel precedent.
- `polished/labs/model-an-accessory/` — left instructions plus outliner and modelling actions in the right inspector.
- `polished/labs/material-lab/` — left instructions plus contextual material controls in the right inspector.
- `polished/labs/hierarchy-gizmobot/` — left instructions plus hierarchy picker and joint values in the right inspector.

Use the existing IDs and kit modules where possible. Put lesson specific rules
in the lab stylesheet only when the kit cannot express the actual lesson. Keep
state in native controls or ARIA attributes, preserve keyboard reachability,
and test narrow and short viewports because the workbench intentionally stacks.

## Review before delivery

Check that every stage has one understandable prompt, one action, and one
observable learning signal; any optional demo uses the real control and cannot
complete the gate; controls appear when taught; instructions have one home;
Continue appears only after progress; utilities and CreateAccess branding stay
at their established landmarks; the instruction card stays on the left; and
non-viewport controls stay in the right inspector. Validate the skill itself with the skill creator's
`quick_validate.py` against this folder.
