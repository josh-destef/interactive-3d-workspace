import { V3 } from '../../../kit/js/stage.js';
export const GIZMOBOT_URL = '../../../assets/models/gizmobot.glb';
export const BEAT = { INTRO: 0, ADD: 1, BODY: 2, DETAIL: 3, ANTENNA: 4, GROUP: 5, COLOUR: 6, ATTACH: 7, CHALLENGE: 8, QUIZ: 9, DONE: 10 };
export const TOTAL_BEATS = 11;
export const NUMBERED_STEPS = 8;
export const GIZMO = { height: 3.317, torsoHeight: 1.156, portLocal: V3(0, 1.74, 0.44), portRadius: 0.17 };
export const SPAWN = V3(0, 1.80, -1.00);
export const CAMS = { bench: { pos: V3(2.9, 2.7, -4.4), look: V3(0, 1.75, -0.55) }, back: { pos: V3(0.2, 2.0, -4.3), look: V3(0, 1.80, -0.95) }, full: { pos: V3(3.4, 2.5, -6.2), look: V3(0, 1.60, -0.30) } };
export const LIMITS = { maxObjects: 24, scaleMin: 0.03, scaleMax: 3, snap: 0.05, snapDistance: 0.42 };
export const COLORS = ['#f2f0eb', '#ff9022', '#67bd45', '#3a91b8', '#8b5cf6', '#25303c'];
export const COPY = {
  0: { step: '', title: 'Four shapes. One accessory.', body: 'An accessory is a custom add-on for Gizmobot. Watch its four pieces separate: two cubes, a cylinder and a sphere. Simple shapes can become something new!', panel: '<b>Watch the four pieces pull apart, then come together.</b> Two cubes, a cylinder and a sphere make this accessory. Yours could be a scanner, a power unit or something nobody has invented yet.', cta: 'See the four pieces' },
  1: { step: 1, title: 'Start with a cube', body: 'Every invention starts with a simple shape.', panel: '<b>Press + Cube.</b> This will become the main body of your Back Unit.', cta: 'Add your cube' },
  2: { step: 2, title: 'Shape the main body', body: 'Scaling changes the proportions of a shape. There is no single right design.', panel: '<b>Choose Scale and drag a coloured handle to flatten the cube.</b> Make a chunky body that could fit on Gizmobot’s back.', cta: 'Shape the body' },
  3: { step: 3, title: 'Invent the details', body: 'Mix shapes to make buttons, screens, sensors or your own invention. You can add more than one!', panel: '<b>Add a Cube, Cylinder or Sphere.</b> Use Scale to shrink it and Move to place it on the body. Add more buttons or details if you like; up to 24 pieces can make your rig.', cta: 'Create your details' },
  4: { step: 4, title: 'Mix more shapes', body: 'A cylinder and a sphere could make an antenna, a beacon or something unexpected.', panel: '<b>Add a Cylinder and a Sphere.</b> Scale them smaller and move them onto your rig. Try an antenna, a sensor or your own combination.', cta: 'Combine more shapes' },
  5: { step: 5, title: 'Group the Back Unit', body: 'A group lets separate shapes move together while keeping each piece editable.', panel: '<b>Press Group pieces.</b> Select Back Unit in the Pieces list to move everything together. Select a shape beneath it to edit just that piece.', cta: 'Group the pieces' },
  6: { step: 6, title: 'Give each piece a colour', body: 'Choose colours that make your invention feel like yours.', panel: '<b>Select a shape in the Pieces list, then choose a colour.</b> Each piece keeps its own colour, even after grouping. Try contrasting buttons or a bright beacon.', cta: 'Choose colours' },
  7: { step: 7, title: 'Clip onto the back plate', body: 'Your Back Unit is ready to join Gizmobot.', panel: '<b>Choose Move. Drag the unit or its arrows toward the round connector on Gizmobot’s back plate.</b> When the rings light up, release to snap it on. Move along another arrow if needed.', cta: 'Attach the Back Unit' },
  8: { step: 8, title: 'Make it yours', body: 'Your imagination decides what these shapes become.', panel: '<b>Try another colour, reshape a piece, or add more shapes.</b> Select a piece and use Duplicate for matching buttons. Group pieces again to gather any new details.', cta: 'Keep inventing' },
  9: { step: 'Check', title: 'What did you learn?', body: 'Three quick questions about combining simple shapes.', panel: '<b>Answer all three.</b>', cta: 'Show the questions' },
  10: { step: '', title: 'Your invention is ready', panel: 'You combined <b>simple shapes</b> into your own Back Unit, then grouped, coloured and attached it to Gizmobot. Keep creating or save your module.' },
};
export const CONTROLS = { 0: [], 1: ['add'], 2: ['add'], 3: ['add'], 4: ['add'], 5: ['add', 'group'], 6: ['add', 'group', 'colour'], 7: ['add', 'group', 'colour'], 8: ['add', 'group', 'colour'], 9: [], 10: ['add', 'group', 'colour', 'save'] };
export const RAIL = {};
for (let i = 0; i < TOTAL_BEATS; i++) RAIL[i] = i ? ['select', 'move', 'rotate', 'scale', 'undo', 'redo'] : [];
RAIL[8] = ['select', 'move', 'rotate', 'scale', 'duplicate', 'undo', 'redo']; RAIL[9] = [];
export const PRIMITIVES = { box: { from: BEAT.ADD, label: 'Cube' }, cylinder: { from: BEAT.DETAIL, label: 'Cylinder' }, sphere: { from: BEAT.DETAIL, label: 'Sphere' } };
export const AXIS_COLORS = { x: 0xc0453a, y: 0x2e8b2e, z: 0x3a6fa8 };
