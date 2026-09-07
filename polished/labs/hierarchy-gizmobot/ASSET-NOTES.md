# Gizmobot hierarchy variant

The original `../hierarchy/` lab is preserved. This variant uses only Gizmobot’s left arm from the same source as the robot deconstruction lab.

Run `python scripts/build-hierarchy-gizmobot.py` from the repository root to rebuild the asset. It reuses the assembly builder’s lossless component reading and writing stages without writing any assembly assets. The generated report verifies that every arm triangle belongs to exactly one part and that original attributes and embedded textures are retained.

The hierarchy is Arm root → Shoulder → Elbow → Wrist, with **Mitt**, **Pointer**, and **Thumb** as three sibling children of the wrist. Each finger contains its original shell, inset and both visible segments, rotating together around its knuckle. The large mitt is intentionally one finger. This is a rigid articulation, with no skin deformation or additional finger joints.

The lab presents the source arm upright at a uniform display scale. The independent finger controls rotate at fixed pivots; Hand grip coordinates all three controls. Opening any finger releases a held block. The Reach preset is calculated from the actual grip point, and pickup initially preserves the block’s world transform, then eases it into the palm pocket and aligns it with the glove.

Run `node scripts/qa-hierarchy-gizmobot.mjs` with the shared `fundamentals-3d-qa` Three.js dependency in the system temp directory to verify the hierarchy, pivots, isolation, inheritance, grip, pickup and release.


Every joint supports rotation around all three local axes at a fixed connection to its parent. Translation controls and translation state are not supported. The UI uses named rotation sliders without angle readouts. Grip coordinates the primary finger curl axes; independent finger rotation remains available.

Five short activities follow the shoulder, elbow, wrist, three fingers and then the pickup challenge. Each new joint demonstrates parent-to-child inheritance. All rotation controls remain available during the challenge and free play; pose presets are available in free play. The cube settles into the glove's palm pocket when caught.


Learning aids: selection warms only the selected part and its descendants, restoring original materials on all other parts. The connection strip tracks the current lesson and selection. Shoulder and elbow activities start with bending only; three-axis rotation appears at the wrist. The target halo and live status share the pickup distance check, turning green when the palm can catch the cube.


The button grid is replaced by an interactive rest-pose replica made from the original arm meshes. Leader labels and raycast mesh clicks select the same main-arm joint. All parts are selectable, with the full rotation set available for shoulder, elbow, wrist and whole-arm controls. Fingers are restricted in both the UI and model state to a single open/close axis: mitt and pointer 0-85 degrees, thumb 0-70 degrees. Finger twist and turn state does not exist. The side replica stays upright while the main arm is posed so that part selection remains stable.
