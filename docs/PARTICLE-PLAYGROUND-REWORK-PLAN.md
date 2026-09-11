# Particle Playground rework plan

## Outcome
Keep the curated shared lesson identity from Navigate & Transform, Model an
Accessory and Materials. Make learning primarily hands-on, with demonstrations
available when seeing the effect is helpful. Preserve the existing Gizmobot,
canonical cannon asset, original elbow connection and particle simulation.

## Lesson approach
1. Attachment: guided drag interaction. Grab the forearm or hand and pull the
   assembly away; drag the cannon to the elbow and release for a forgiving snap.
   Offer an optional swap demonstration and keyboard/button alternative.
2. Emitter: Fire One and Fire Burst teach particle, emitter and system through
   action and concise explanatory copy. Optional short emitter demonstration.
3. Aim: prompt-led rotation and firing; explain position and direction.
4. Count: compare visibly different bursts, with no required exact values.
5. Speed/spread: test speed and compare narrower/wider effects freely.
6. Gravity/lifetime: change both and observe; optional comparison demonstration.
7. Appearance: choose palette/size/shape and fire. Explain appearance vs motion.
8. Explore: predict and compare after changing one rule.
9. Final blast: all learned controls available; natural particle playback is the
   celebration, with replay and continued experimentation.

No mandatory Read/Watch sequence on every step. Put the explanation and action
in the bottom console so skipping a demonstration does not skip the teaching.
Only offer demonstrations on steps where they add value. Preserve demonstration
isolation from student completion and restore settings after a demonstration.

## Work assignments
- Sol: lesson integration, interaction callbacks, state coordination, final
  review and browser checks. Own js/main.js and final integration fixes.
- Interaction work: finish js/attachmentInteraction.js, with raycast picking,
  camera-facing dragging, visual arm removal, generous elbow snap, pointer
  capture, orbit suppression, cancellation and reset. Add independent QA.
- Interface work: adjust index.html and css/lab.css within the shared kit. Show
  concise teaching copy and action together, move attachment button fallback
  into an accessible disclosure, and remove mandatory Read-card presentation.
- QA work: update scripts/qa-particle-cannon-ui.mjs for prompt-led entry,
  selective optional demonstrations, original nine learning gates, reset,
  prediction comparison and final completion. Coordinate on module imports.
- Luna: update the particle-cannon README to document the shipped prompt-led
  lesson, attachment paths, shared-kit identity, implementation boundaries,
  validation commands, and review limitations.

## Acceptance checks
- Shoulder, upper arm and original elbow ball remain intact.
- Dragging arm/cannon works with mouse and touch; empty-stage drag still orbits.
- Cancelling, missing the snap target or resetting leaves a recoverable scene.
- Near-target feedback precedes an actual snap at the existing elbow.
- Muzzle emission follows the attached cannon; flying particles stay independent.
- Most steps are immediately actionable; demonstrations are optional.
- Explanation remains available without watching a demonstration.
- Familiar shared typography, stage, bottom console and progress treatment stay.
- Simulation and UI checks are required before sign-off; desktop and mobile
  receive visual review when the browser review path is available.

## Current state
Sol has integrated the prompt-led lesson, selective optional demonstrations,
and attachment interaction into the running lesson. The shared-kit shell and
nine-step particle simulation remain in place, with direct forearm/hand drag,
cannon elbow snapping, keyboard fallback, and preserved shoulder, upper arm,
and original elbow nodes. Luna has updated the lab README to match the shipped
behavior and validation surface.

Automated validation passes: the attachment raycast/drag suite, nine-step UI
suite, particle simulation suite, canonical asset/hierarchy suite, and syntax
checks for the lesson and interaction modules. The attachment suite covers
rejected drops, snap tolerance, synchronous lost capture, pointer isolation,
cancel/blur/reset/dispose recovery, orbit restoration, and retention of the
original shoulder, upper arm and elbow nodes.

Browser review completed at desktop and 390px mobile widths. Desktop checks
confirmed direct forearm removal and cannon snapping, keyboard attachment,
and emitter progression. Mobile checks confirmed readable branding and
console placement, no horizontal overflow, and Aim/Fire progression. No browser
console errors were observed. Physical touch-device review remains separate
from the automated pointer tests.
