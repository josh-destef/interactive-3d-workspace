# Asset conventions

`assets/` is the repository-wide source of truth. New lessons should use the
canonical Gizmobot at `assets/models/gizmobot.glb` and the brand files under
`assets/brand/`. Landing-page previews belong in `assets/lab-previews/`.

Lesson-local assets are allowed only when they are purpose-built variants:

| Asset | Purpose |
| --- | --- |
| `assets/models/gizmobot.glb` | Canonical full Gizmobot used by Navigate + Transform and Model an Accessory. |
| `polished/labs/robot-assembly/assets/gizmobot-assembly.glb` | Fourteen snap-together pieces. |
| `polished/labs/robot-assembly/assets/gizmobot-rigged.glb` | Rigid joint hierarchy for posing. |
| `polished/labs/material-lab/assets/gizmobot-material-lab.glb` | Material-learning export and its semantic textures. |
| `polished/labs/hierarchy-gizmobot/assets/gizmobot-arm.glb` | Isolated articulated arm. |
| `polished/labs/topology-gizmobot/assets/gizmobot-topology.glb` | Topology/LOD inspection export. |
| `assets/models/gizmobot-accessory-rig.glb` | Reusable lossless rig with forearm surfaces split for rigid accessories. |
| `assets/models/particle-cannon.glb` | Reusable cannon attachment with `MuzzleEmission` for world-space particle lessons. |

`assets/models/archive/gizmobot-trimesh-decimated.gltf` is an older, different
glTF export retained for inspection; it is not a lesson dependency. The former
`gizmo2.glb` was SHA-256-identical to the canonical GLB and was removed.

Before adding a model or image, search references and compare SHA-256 hashes.
Put a reusable asset here; keep a local asset beside a lab only when that lab's
code or teaching objective genuinely depends on its variant. Update the build
or QA script whenever a generated variant's source path changes.

The particle cannon lesson uses `polished/kit/js/particleCannon.js` to attach
these shared assets. New simulations should call `emissionWorld()` at spawn
time and retain each particle's world position and velocity after birth.
