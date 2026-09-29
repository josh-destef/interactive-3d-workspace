const D = Math.PI / 180;

// Preserve the source GLB root's authored proportions, normalized uniformly
// to this lesson's existing height. Both joint positions and part geometry
// must use this scale; scaling only the meshes would leave gaps at the joints.
export const ASSEMBLY_MODEL_SCALE = Object.freeze([0.9786857962608337 / 1.1829975843429565, 1, 1]);

// The Hand's joint in Gizmobot's local space. The parts' parent group is
// offset (ASSEMBLY_ROOT_POSITION) so this reads as round numbers in the
// Inspector while the robot stays exactly where the model puts it, feet on the
// ground. Every other part keeps its authored joint relative to the Hand.
export const HAND_TARGET = Object.freeze([-1, 1.6, .2]);
const RAW_HAND_JOINT = [-1.24, 1.574, .148].map((value, axis) => value * ASSEMBLY_MODEL_SCALE[axis]);
export const ASSEMBLY_ROOT_POSITION = Object.freeze(RAW_HAND_JOINT.map((value, axis) => value - HAND_TARGET[axis]));

// The Hand starts outward, high, and in front of its wrist, in whole tenths so
// its starting values stay round.
export const HAND_START_OFFSET = Object.freeze([-.6, .4, -.6]);

/**
 * The assembly asset keeps every mesh around a useful joint pivot. Creation Studio owns
 * the pivot transform while the cloned asset node supplies the render geometry.
 */
export const ASSEMBLY_PARTS = [
  { id: 'part-torso', node: 'Torso', name: 'Body', target: [0, 1.09, .13], note: 'The body is the centre of the build.' },
  { id: 'part-head', node: 'Head', name: 'Head', target: [0, 1.85, .13], note: 'Bring the head to the neck.' },
  { id: 'part-left-upper-arm', node: 'LeftUpperArm', name: 'Left upper arm', target: [.49, 1.574, .148], note: 'Join the arm to the left shoulder.' },
  { id: 'part-right-upper-arm', node: 'RightUpperArm', name: 'Right upper arm', target: [-.49, 1.574, .148], note: 'Use the other shoulder.' },
  { id: 'part-left-forearm', node: 'LeftForearm', name: 'Left forearm', target: [.88, 1.574, .148], note: 'Connect the forearm at the elbow.' },
  { id: 'part-right-forearm', node: 'RightForearm', name: 'Right forearm', target: [-.88, 1.574, .148], note: 'Connect the other elbow.' },
  { id: 'part-left-hand', node: 'LeftHand', name: 'Left hand', target: [1.24, 1.574, .148], note: 'The fingers travel together as one named object.' },
  { id: 'part-right-hand', node: 'RightHand', name: 'Right hand', target: [-1.24, 1.574, .148], note: 'Bring the hand to the wrist.' },
  { id: 'part-left-upper-leg', node: 'LeftUpperLeg', name: 'Left upper leg', target: [.25, 1.09, .13], note: 'Connect the thigh at the left hip.' },
  { id: 'part-right-upper-leg', node: 'RightUpperLeg', name: 'Right upper leg', target: [-.25, 1.09, .13], note: 'Connect the other thigh.' },
  { id: 'part-left-lower-leg', node: 'LeftLowerLeg', name: 'Left lower leg', target: [.25, .73, .135], note: 'Join the shin at the knee.' },
  { id: 'part-right-lower-leg', node: 'RightLowerLeg', name: 'Right lower leg', target: [-.25, .73, .135], note: 'Add the other shin.' },
  { id: 'part-left-foot', node: 'LeftFoot', name: 'Left foot', target: [.26, .29, .13], note: 'Connect the foot at the ankle.' },
  { id: 'part-right-foot', node: 'RightFoot', name: 'Right foot', target: [-.26, .29, .13], note: 'Make the final ankle connection.' },
].map((sourcePart, order) => {
  const part = { ...sourcePart, target: sourcePart.id === 'part-right-hand' ? [...HAND_TARGET]
    : sourcePart.target.map((value, axis) => value * ASSEMBLY_MODEL_SCALE[axis] - ASSEMBLY_ROOT_POSITION[axis]) };
  const targetTransform = Object.freeze({
    position: Object.freeze([...part.target]),
    rotation: Object.freeze([0, 0, 0]),
    scale: Object.freeze([1, 1, 1]),
  });
  const challengeTransform = part.id === 'part-head' ? Object.freeze({
    // Keep the face visible and the repair reachable with 0.25-unit moves and
    // 15-degree rotations. The slight tilt makes the disconnected state clear.
    // Place it in the open side of the viewport, clear of the instruction card.
    position: Object.freeze(part.target.map((value, axis) => value + [1.5, -1.75, 0][axis])),
    rotation: Object.freeze([0, 0, 30 * D]),
    scale: targetTransform.scale,
  }) : part.id === 'part-right-hand' ? Object.freeze({
    // The second repair teaches precise numeric editing: the hand begins
    // oversized, turned, and away from its wrist. Its offset is chosen so the
    // lesson's locked camera views each hide the axes not yet fixed.
    position: Object.freeze(part.target.map((value, axis) => Number((value + HAND_START_OFFSET[axis]).toFixed(6)))),
    rotation: Object.freeze([0, 0, -30 * D]),
    scale: Object.freeze([1.6, 1.6, 1.6]),
  }) : targetTransform;
  return Object.freeze({
    ...part,
    order,
    targetTransform,
    challengeTransform,
    // The problem is visible from the first frame: the Head and oversized Hand
    // wait nearby while the other twelve parts remain assembled.
    startTransform: challengeTransform,
  });
});

export const ASSEMBLY_PART_IDS = Object.freeze(ASSEMBLY_PARTS.map(part => part.id));

export function createAssemblyProjectData() {
  return {
    version: 1,
    entities: [
      {
        id: 'creation', name: 'Gizmobot parts', type: 'group', parentId: null,
        visible: true, locked: true,
        components: { transform: { position: [...ASSEMBLY_ROOT_POSITION], rotation: [0, 0, 0], scale: [1, 1, 1] } },
      },
      ...ASSEMBLY_PARTS.map(part => ({
        id: part.id, name: part.name, type: 'assemblyPart', parentId: 'creation',
        visible: true, locked: false,
        components: {
          transform: {
            position: [...part.startTransform.position],
            rotation: [...part.startTransform.rotation],
            scale: [...part.startTransform.scale],
          },
          assemblyPart: { node: part.node },
        },
      })),
    ],
  };
}
