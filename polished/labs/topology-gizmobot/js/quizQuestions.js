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
        q: 'You switched Gizmobot from smooth shading to flat. What happened to his triangle count?',
        options: [
            {
                text: 'Nothing — it stayed exactly the same',
                correct: true,
                why: 'Right. Smooth shading blends light across the joins between triangles. It changes how the surface catches the light, not how many triangles are underneath it — the number in the corner never moved.',
            },
            {
                text: 'It went up, because flat shading needs a triangle for each flat face',
                why: 'It is tempting, because the faces suddenly appear. But they were always there; smooth shading was hiding the joins. The count is identical either way.',
            },
            {
                text: 'It went down, because smooth shading adds triangles to round off the curve',
                why: 'Smooth shading adds nothing. If it did, you could get a rounder model for free just by switching it on — and the head would have gained triangles when you turned it back.',
            },
        ],
    },
    {
        q: 'At full detail Gizmobot has 14,840 triangles but 9,942 corners stored. Why are some corners stored more than once?',
        options: [
            {
                text: 'The surface is cut apart there, so each side needs its own copy',
                correct: true,
                why: 'Exactly. A texture has to be flattened out to be painted, and the cuts that let it lie flat are seams. A corner on a seam belongs to two separate pieces of the flattened texture, so it is stored once for each.',
            },
            {
                text: 'They are mistakes left in the model by whoever built it',
                why: 'They look like duplicates, but they are deliberate and necessary. Without them the texture would have to wrap around the model without ever being cut, which is not possible for most shapes.',
            },
            {
                text: 'Extra copies make the surface stronger where triangles meet',
                why: 'Nothing about a mesh is stronger or weaker — it is only a list of corners and how they join up. The duplicates exist so that two pieces of the texture can meet at the same place in space.',
            },
        ],
    },
    {
        q: 'Twelve Gizmobots had to fit inside 24,000 triangles. Level 4 fits with room to spare. Why was it still the wrong answer?',
        options: [
            {
                text: 'It fits the budget but no longer looks like Gizmobot',
                correct: true,
                why: 'Right. Fitting the budget is the easy half. By level 4 he had started coming apart at the joints, and across twelve figures it shows. The level you want is the cheapest one that still holds up, which was level 3.',
            },
            {
                text: 'Level 4 is too cheap, and leftover budget is always wasted',
                why: 'Spare budget is not a problem in itself — you can spend it elsewhere in the scene. The problem with level 4 was what it did to the model, not the number it left over.',
            },
            {
                text: 'Lower levels take longer to load',
                why: 'They do not. Every level shipped inside the same file, and a smaller one is less data, not more. The cost of level 4 was in how it looked.',
            },
        ],
    },
];
