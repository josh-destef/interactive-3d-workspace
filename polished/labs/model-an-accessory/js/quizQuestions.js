// Closing quiz questions for the Model an Accessory lab
export const QUESTIONS = [
    { q: 'You just finished building a module and want the whole thing to sit higher on the robot\'s back. Which mode do you use to move it?', options: [
        { text: 'Edit Mode, because that is the mode where you change things', why: 'Edit Mode changes the geometry inside one object, like its faces and edges - it does not move where the object sits. To move the whole module you stay in Object Mode.' },
        { text: 'Select every face and drag them all by hand, one at a time', why: 'That would only work if you moved every single face by the exact same amount - one slip and the shape distorts. Object Mode moves the whole object at once with no risk of stretching it.' },
        { text: 'Object Mode, because moving the whole object is a transform of the object, not an edit of its geometry', correct: true, why: 'Right. Object Mode moves, rotates, or scales the whole thing as one piece. Edit Mode is for reshaping the geometry inside it.' },
    ] },
    { q: 'You selected one face of a cube and dragged it outward. What actually happened?', options: [
        { text: 'It pushed that face out and built new walls to connect it back to the rest of the cube', correct: true, why: 'Exactly. Extrude pushes the face out and fills in new side walls to reconnect it to the shape. The object gained geometry, but it is still one single object.' },
        { text: 'It stretched the whole cube taller in that direction', why: 'That is what Scale would do to the entire object. Extrude only affects the face you selected - the rest of the cube stays exactly where it was.' },
        { text: 'It created a brand new, separate object floating next to the cube', why: 'The new geometry is still joined to the cube, with no gap and no second object. Extrude adds on to the shape you already had.' },
    ] },
    { q: 'Your complete module is attached to the robot. Now the robot turns to face the other way. What happens to the antenna?', options: [
        { text: 'Only the body follows the turn - the antenna and details stay facing the old way', why: 'Attaching the complete module makes all of its pieces follow the robot together, including the antenna and details.' },
        { text: 'The whole module, antenna included, turns with him', correct: true, why: 'Exactly. A child inherits its parent\'s transform, so attaching the group makes every piece inside it follow whatever the robot does, turning included.' },
        { text: 'Attaching locked the module in place, so it stays put while the robot turns', why: 'Attaching does the opposite of locking something in place - it links the module to the robot so it keeps following along. If you wanted it to stay independent, you would not attach it.' },
    ] },
];
