# Gizmobot Particle Playground

A prompt-led, beginner particle-systems lesson that reworks the existing
Particle Cannon lab in place. Open `polished/labs/particle-cannon/` from a
repository HTTP server.

## Lesson outline

1. Swap only the forearm and hand for the prebuilt cannon at the existing elbow.
2. Discover particle, emitter, and system with Fire One and Fire Burst.
3. Aim the elbow and see the muzzle position and direction follow.
4. Compare two visibly different burst counts.
5. Try speed and compare narrow and wide spread.
6. Explore gravity and lifetime.
7. Choose a multicolor palette, size, and optional square/circle/star shape.
8. Predict, capture a baseline, change one rule, and compare.
9. Create Gizmo's own confetti blast. Completion follows natural particle expiry.

The full-width viewport and bottom lesson console use the shared identity from
Navigate & Transform, Model an Accessory, and Materials. Each prompt puts the
teaching copy beside the action, so demonstrations are optional rather than a
mandatory Read/Watch sequence. Optional demonstrations are offered only on
lesson indices 0/1/5 (the human-facing steps 1/2/6: attachment, emitter, and
gravity/lifetime); they use the real model and simulation, restore settings,
and never earn student progress. Your Turn can end a demonstration early.

On the attachment step, drag the forearm or hand away, then drag the cannon's
connection end to the original elbow and release for a forgiving snap. Empty
stage dragging still orbits the view. The keyboard controls disclosure provides
the button alternative. The shoulder, upper arm, and original elbow ball stay
in place; the shared cannon helper uses the canonical rig nodes and connection.
Step navigation unlocks as students explore, and controls remain available after
their teaching step. Fire One and Fire Burst introduce particle, emitter, and
system. Clear removes particles, Pause/Play freezes or resumes simulation, and
Reset settings resets the current experiment while retaining other lesson
progress. Final completion offers replay or continued experimentation.

## Reuse and implementation

- `../../../kit/js/particleCannon.js`: reversible elbow attachment, canonical
  cannon GLB, and lossless Gizmobot accessory rig. Shoulder, upper arm, and the
  original elbow ball remain intact.
- `../../kit/css/kit.css`: shared tokens, shell, console, controls, and lesson
  identity. `css/lab.css` contains particle-specific layout.
- `../../../kit/js/ui.js`: shared mode, progress, and live console height
  tracking.
- `../../../kit/js/controls.js`: shared slider painting.
- `js/main.js`: scene, prompt-led lesson gates, selective frame-driven
  demonstrations, attachment actions, and UI. Existing Three.js
  stage/environment preserved.
- `js/attachmentInteraction.js`: raycast forearm/hand removal, camera-facing
  cannon dragging, near-target elbow feedback, snap, pointer capture, cancel,
  reset, and orbit suppression.
- `js/particles.js`: DOM-independent world-space burst simulation, palette and
  silhouette textures generated locally. Each particle copies the real muzzle
  transform once, then owns its trajectory independently of later aiming.

Count is limited to 1–300 per burst, lifetime to 0.5–6 seconds, with a fixed
pool of 480. The engine supports continuous emission for reuse; this lesson
uses bursts. The bundled cannon is always available without previous lab
completion.

## Validation

Run with Node and the existing Three.js/JSDOM QA dependencies in
`%TEMP%/fundamentals-3d-qa/node_modules`:

```
node scripts/qa-particle-cannon-lab.mjs
node scripts/qa-particle-cannon-ui.mjs
node scripts/qa-particle-cannon.mjs
node scripts/qa-particle-attachment.mjs
```

Simulation checks cover immediate bursts, live counts, palette/shape/size,
world-space trajectories, gravity at different frame rates, expiry, parameter
bounds and pool reuse. UI checks exercise all nine student gates, selective
demonstration isolation, progressive disclosure, comparison validation, reset,
and final expiry. Asset checks verify source geometry preservation and
reversible elbow attachment. The attachment check covers raycast dragging,
visual arm removal, original rig preservation, rejection, snap, cancellation,
and pointer/orbit handling.

Browser verification covered desktop forearm removal and cannon snap, keyboard
attachment and emitter progression, and the 390px mobile layout through Aim
and Fire progression. No browser console errors occurred.

Models are local assets. Three.js and fonts retain the project's existing CDN
loading, so a network connection is required on first load.
