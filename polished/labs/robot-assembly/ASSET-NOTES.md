# Gizmobot assembly preparation

Source: `../navigate-and-transform/assets/gizmobot.glb`, the original navigation lesson asset. The Material Lab variant changes its materials and is not used here.

## Proposed grouping, before export

The source inspection reports 184 connected components, 9,942 vertices and 14,840 triangles in one textured mesh. Front, side and rear inspection views are available in the Material Lab QA folder. Blender inspection confirms the authored nonuniform scale and offset.

Use 14 units: Torso (including pelvis and neck), Head (including side discs and rear panel), LeftUpperArm, RightUpperArm, LeftForearm, RightForearm, LeftHand, RightHand, LeftUpperLeg, RightUpperLeg, LeftLowerLeg, RightLowerLeg, LeftFoot and RightFoot. Keep fingers with each hand; keep cuffs, joint rings, boot trim and decorative surfaces with their surrounding unit. The face is part of the head's texture, so it is not a separate puzzle piece.

Component bounds identify natural breaks at shoulder, elbow, wrist, hip, knee and ankle. Classification uses complete connected components, never cuts triangles, and records every assignment. Left/right are Gizmobot's own sides. The torso is the fixed starting part.

## Reproduction and preservation

Run `python scripts/build-assembly-gizmobot.py` from the repository root. The builder copies original vertex attributes, textures and materials without conversion. A named parent provides each part's pivot; its mesh child cancels that pivot, preserving the exact assembled geometry under the original Gizmobot parent transform. All manifest transforms and distances are in Gizmobot-local glTF coordinates (Y up). The flat assembly asset is accompanied by `gizmobot-rigged.glb`, a rigid joint hierarchy with torso, neck, shoulders, elbows, wrists, hips, knees and ankles. Hip joint components follow the thighs; shoulder rings follow the upper arms. The knee pivot is at local Y 0.73. Child joint positions are relative to their parent pivot. This is an action-figure rig: rigid surfaces rotate at joints without skin deformation.

The generated report verifies complete triangle coverage, byte-identical attributes and textures, matching names and an unchanged source SHA-256. Inspection images and browser interaction QA are stored in `qa/`.
