# Gizmobot Mirror

A webcam toy, with no lesson sequence. Serve the repository and open
`/polished/labs/gizmobot-mirror/` on localhost or HTTPS. Click **Start camera**,
allow camera access, and move. A camera-free demo uses the same retargeter.

Reuses the assembly lab's Gizmobot GLB and joint manifest. MediaPipe Pose
Landmarker Lite (`@mediapipe/tasks-vision` pinned to `0.10.32`) runs in a classic
worker with a dynamically imported module; its WASM loader requires
`importScripts`. GPU initialization falls back to CPU. Frames are transferred
one at a time at up to 20 Hz while Three.js renders independently.

World landmark directions drive rigid hierarchical joints through quaternions.
Image coordinates drive mirrored lateral/vertical movement relative to the
first tracked position; Re-centre resets this origin. Confidence gates hide
missing limbs, smoothing reduces jitter, and sustained tracking loss restores
neutral. This is approximate body puppeteering: fingers, facial expressions,
foot contact and precise joint twist are not tracked.

No video, audio or landmarks are uploaded or saved. Third-party requests only
fetch the libraries, model and font. Stop, navigation or hiding the page stops
the camera and terminates the inference worker. Initial model loading needs an
internet connection; camera access requires localhost or HTTPS.

Validation: `node scripts/qa-gizmobot-mirror.mjs` from the repository root
(uses the existing Three.js QA installation under the OS temp directory).
Checks joint directions, hierarchy, fixed limb lengths, mirror translation,
recentring, leg toggle, invalid landmarks and reset.

Reference: [Google's Pose Landmarker web guide](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js).
