/* ═══════════════════════════════════════════════
   THE CLOSING QUESTIONS

   Rules, from LEARNING-DESIGN.md and kit/js/quiz.js:
     - ask about what the student just did, in the words the lesson used
     - every option gets a `why`, especially the wrong ones
     - a wrong option is a real misconception someone would actually hold,
       not an obviously silly answer that makes the right one findable
       without thinking
     - never introduce vocabulary here that the lesson did not use
═══════════════════════════════════════════════ */

export const QUESTIONS = [
    {
        q: 'You made the shape twice as big. What changed?',
        options: [
            {
                text: 'How large it is, but not what it is',
                correct: true,
                why: 'Right. Scale changes size only - the same shape, larger. Every curve and corner stayed exactly where it was in relation to the others.',
            },
            {
                text: 'The camera moved closer',
                why: 'The camera stayed put. You can tell them apart by the shadow: moving the camera does not change the shadow on the floor, and scaling does.',
            },
            {
                text: 'The shape became a different shape',
                why: 'A bigger version of a shape is still that shape. Changing what it is would mean editing the model itself, not its size.',
            },
        ],
    },
    {
        q: 'You changed the color. What happened to the shape?',
        options: [
            {
                text: 'Nothing - color and shape are separate',
                correct: true,
                why: 'Exactly. The shape comes from the model; color comes from its material. The same shape can be any color, and the same color can be on any shape.',
            },
            {
                text: 'It got slightly bigger',
                why: 'A bright color can look larger against a dark background, but nothing about the object changed. Size is a separate control, and you did not touch it.',
            },
            {
                text: 'It became smoother',
                why: 'Nothing about the surface changed except its color. Smoothness is a different material property with its own control.',
            },
        ],
    },
];
