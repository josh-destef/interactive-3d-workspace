# Creation Studio Material Lab

The lesson now runs in the shared Creation Studio workspace at `../../creator/?lesson=material-lab`.
The lab entry redirects there. The local semantic Gizmobot asset remains the source
for the editable Shell_Paint surface, fixed accents, face glow, and logo decal.

Creation Studio owns project material state, selection, Appearance controls, capability
reveal, and material mutation. `creator/js/lessons/material.js` owns the learning
sequence and user-only practice gates; `materialChallenge.js` owns perceptual
assessment; `materialStudio.js` owns the fixed neutral lighting, automatic light-orbit
demonstration, emission preview, and reference scenario. Learners cannot move or
recolor the light; Room lighting on/off remains only to reveal emission. RGB is
optional, and both challenges use the same shared Appearance panel.

The main material match scores only when the learner chooses Check match. It
shows an overall percentage and separate Base Color, Roughness, and Metalness
closeness bars; forgiving perceptual bands reward a convincing match rather
than exact hidden values.

Run the journey and assessment checks with:
`node --test polished/creator/tests/material-lesson.test.mjs`.

The previous standalone lesson modules remain as migration reference; the entry
page no longer loads their renderer, controls, or lesson state. The GLB stays in
this directory so its semantic material roles and textures remain unchanged.
