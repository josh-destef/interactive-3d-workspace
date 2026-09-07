# Animation Lab implementation and handoff

Status: initial implementation exists; integration and browser verification are unfinished. Do not treat this lesson as release-ready yet.

## Goal and lesson journey

Teach a complete beginner to make Gizmobot wave by saving poses at different times. Keep the viewport prominent and use the established Watch → Your Turn approach.

1. Hello: learner starts a preview of the intended wave.
2. Keyframes: scrub between a saved down pose and a raised pose.
3. Watch: select arm, choose starting time, lower arm, save, move forward, raise, save, play. Demonstration advances one action per click and highlights the actual controls.
4. Your Turn: author the two poses and play the complete movement.
5. Watch: add later wrist poses pointing in opposite directions while the arm stays raised.
6. Your Turn: add a recognizable back-and-forth wave and play it through.
7. Finish: reinforce the takeaway and preserve the animation for replay and experimentation.

## Inspection findings and architecture

- This is a static HTML/CSS/JavaScript project using Three.js; there is no build step or React.
- `polished/LEARNING-DESIGN.md` specifies learner-paced examples, Watch/practice isolation, forgiving gates, and keyboard access.
- `polished/labs/robot-assembly/js/posing.js` already builds rigid joint hierarchies from the assembly manifest. Shoulder rotation carries the forearm and hand. No geometry changes are needed.
- Reuse the assembly GLB and manifest by relative URL. Animate LeftUpperArm local Z and LeftHand local Z, with the forearm and opposite arm held in suitable poses. Show human-readable Arm and Wrist labels only.
- Existing `polished/labs/keyframes/js/animation.js` demonstrates saved keys versus an unsaved pose and a separate playback clock. The new small model follows that pattern without the older lesson's advanced controls.
- Keep learner and demonstration models separate. Demos must neither overwrite learner keys nor satisfy practice gates.
- No publishing or git commit has been performed.

## Delegation and file ownership

The parent inspected and planned architecture before implementation and delegated these independent tasks to the available faster worker model, `gpt-5.6-sol`:

1. **animation_model** owns `js/model.js` and `scripts/qa-animation-lab.mjs` (script relative to repository root). Implement immutable snapshots, saved keys, pose sampling, playback, edit/update/delete, undo/reset, and forgiving raise/wave gates. Worker delivered and reported passing focused Node tests. Follow-up needed: initial/reset keys must be empty so the learner authors the first key.
2. **gizmobot_scene** owns `js/scene.js`. Reuse the assembly asset and poser; provide responsive camera, lighting, selection highlight, restricted picking, and actual joint transforms. Worker delivered and reported syntax/whitespace checks. Follow-up needed: match scene arm bounds to model/UI bounds (-85 to 75 degrees).
3. **Parent** owns `index.html`, `css/styles.css`, `js/main.js`, this plan, final integration, catalog links, and browser verification. Initial interface and lesson controller are written.

Avoid overlapping ownership when continuing. Workers can be followed up while the current task is live; in a fresh task, simply reassign these bounded files if useful.

## Implemented files and API

- `index.html`: viewport, timeline, accessible native controls, lesson panel.
- `css/styles.css`: reuses Robot Assembly visual language; responsive workspace and timeline.
- `js/main.js`: seven lesson stages, learner-paced demos, contextual guidance, separate learner/demo models, playback completion checks.
- `js/model.js`: exports `createAnimation`, `DOWN`, `RAISED`, `DURATION`, `hasRaise`, `hasWave`. Model methods: `getState`, `subscribe`, `seek`, `setPose`, `saveKey`, `removeKey`, `undo`, `reset`, `load`, `play`, `pause`, `tick`, `poseAt`.
- `js/scene.js`: exports async `createScene({canvas, viewport, onSelect})`, returning `setPose`, `selectJoint`, `resetView`, `render`, `dispose`, `getJointPositions`.
- Repository `scripts/qa-animation-lab.mjs`: focused model tests.

## Remaining implementation plan, in order

1. Fix initial/reset empty key list and align scene/model slider bounds. Rerun model tests.
2. Review main/model integration: ensure playback reaches exactly 4 seconds and completion requires playing the current saved keys from the beginning; edits invalidate previous playback evidence. Check undo/reset and unsaved-pose feedback.
3. Start a static server from repository root (`python -m http.server 8080`) and open `/polished/labs/animation-lab/`.
4. Use the Browser skill for actual browser checks. The skill was read in the current task; browser runtime has not yet been connected. Available tool discovery found `mcp__node_repl__js`. Browser skill path: `C:/Users/joshu/.codex/plugins/cache/openai-bundled/browser/26.901.51231/skills/control-in-app-browser/SKILL.md`. Follow its setup and full documentation read before browser actions.
5. Verify rendering: asset loads, whole robot and raised hand fit, wrist visibly tilts, selection markers match joints, unrelated parts cannot move. Inspect desktop and narrow/mobile layouts. Fix any visual or camera issues.
6. Complete all seven stages through actual UI. Test two-key scrubbing, a three-raised-pose wrist reversal, key update/delete, undo/reset, pause/replay, replaying Watch without altering learner work, and synchronized feedback. Verify keyboard access and load error behavior. Save scratch screenshots under repository `.screenshots/` only.
7. Add Animation Lab cards to both repository `index.html` and `polished/index.html` using existing card markup. Both files already had unrelated user edits before this task; preserve them. Do not replace the existing Keyframes lesson.
8. Add a concise README documenting launch path, reused asset/rig, model boundaries, tests, and verified limitations. Run syntax checks, focused model QA, and `git diff --check` for changed files.
9. Report what was built, learner progression, files changed, verified checks, and any real limitations. Do not claim browser verification before it actually happens.

## Acceptance checklist

- [ ] Learner sees complete robot and a recognizable preview wave.
- [ ] Playhead is visually distinct from saved diamonds; all times and keys are accessible.
- [ ] Learner saves their own first key; demos never satisfy practice.
- [ ] Draft rotation does not silently overwrite a key; Save/Update is explicit.
- [ ] Playback uses learner-authored real joint poses and correctly fills in between them.
- [ ] Arm and wrist controls match actual transforms and documented limits.
- [ ] Undo/reset recover mistakes; demo replay preserves work.
- [ ] Completion detects a saved, played back-and-forth wave with forgiving thresholds.
- [ ] Desktop and mobile layouts are usable; keyboard controls and feedback work.
- [ ] Both catalogs link to the lesson; existing unrelated edits are preserved.

## Existing unrelated work to preserve

At the start, git already showed modified root and polished catalogs, plus untracked Model an Accessory files/thumbnail, Gizmobot Mirror README, and Hierarchy Gizmobot asset notes. These belong to other work and must not be removed or reverted.
