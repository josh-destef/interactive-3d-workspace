# Prototype verification

Verified locally on 6 September 2026.

- `python scripts/qa-assembly-gizmobot.py`: all 14,840 triangles have identical source positions, normals and UVs. Materials and embedded textures are unchanged. The 12 manifest nodes have independent pivots and valid prerequisite order. Source SHA-256 is unchanged.
- Blender 4.1 import and four-view render: assembled appearance matches the source inspection views. Run `blender -b --python scripts/render-gizmobot.py -- --source polished/labs/robot-assembly/assets/gizmobot-assembly.glb --output polished/labs/robot-assembly/qa --prefix assembled` from the repository root.
- Browser: dragged the head into its target, observed animated snap, locked head and progress advancing to 2/12.
- Completed the remaining connections using the position slider's End key. Observed 12/12 and completion feedback. Checked incorrect and correct quiz answers, rotation control and Build again returning to 1/12.
- Phone viewport, 390 × 844: all exploded pieces remain visible, no horizontal overflow, and dragging the head advances to 2/12.
- Browser console: no warnings or errors during the tested flow. JavaScript syntax and Git whitespace checks pass.

This is a WIP prototype. It uses the same Three.js CDN and font delivery approach as the other labs, so the first load needs an internet connection. Progress is session-only; Start over and reload begin a fresh build.

## Articulated posing update

The current asset has 14 parts: each former leg is now a thigh and shin, with a separate foot. `python scripts/qa-assembly-gizmobot.py` also checks the hierarchical rig GLB preserves the assembled coordinates. `node scripts/qa-gizmobot-posing.mjs` tests rest-pose preservation, knee-to-foot propagation, isolated limbs, joint limits, presets, animation restoration and repeat assembly.

Browser verification: completed all 14 parts, used Wave and Crouch, changed a knee individually, started/stopped animation, and inspected the connected joints from the angled view. Posing unlocks immediately on assembly completion.
