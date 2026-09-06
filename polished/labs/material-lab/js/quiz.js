/* ═══════════════════════════════════════════════
   CHECK WHAT YOU LEARNED
   Four short questions about the ideas in this lab. It closes the lab
   on its own terms rather than introducing new vocabulary at the finish.

   Wrong answers are not punished and nothing is scored out of four. A wrong
   pick is marked, the right answer stays available, and the sentence that
   appears underneath says why - which is the only part of a quiz like this
   that teaches anything.
═══════════════════════════════════════════════ */

const QUESTIONS = [
    {
        q: 'What does a material control?',
        options: [
            { text: 'How a surface looks under light', correct: true, why: 'Exactly. The mesh supplies the shape; the material controls the surface’s color and light response.' },
            { text: 'The object’s shape', why: 'Shape comes from the mesh. A material can make the same mesh look like rubber, ceramic or metal.' },
            { text: 'Where the object sits', why: 'Position belongs to the object’s transform, not its material.' },
        ],
    },
    {
        q: 'What does the Glow control demonstrate?',
        options: [
            { text: 'The surface can stay visible without room light', correct: true, why: 'Right. Emissive color appears to come from the surface itself, so it remains visible when the room light is off.' },
            { text: 'Gizmobot becomes a lamp that lights the room', why: 'An emissive material looks self-lit, but it does not automatically cast light onto nearby objects.' },
            { text: 'The shell becomes smoother', why: 'Smoothness is controlled by roughness. Glow changes the face material’s emissive appearance.' },
        ],
    },
    {
        q: 'You want a chalky, dull surface with a soft, spread-out highlight. Which slider do you turn up?',
        options: [
            { text: 'Roughness', correct: true, why: 'Yes. High roughness spreads the reflection, so the highlight becomes broader and softer.' },
            { text: 'Metalness', why: 'Metalness changes where the surface color appears. Both metals and non-metals can have sharp or soft reflections.' },
            { text: 'Base color', why: 'Base color changes the surface color. Roughness controls whether its reflections look sharp or soft.' },
        ],
    },
    {
        q: 'Which statement about metal and non-metal surfaces is true?',
        options: [
            { text: 'Only metal reflects the room', why: 'Non-metals reflect too. Plastic and ceramic still show highlights and reflections.' },
            { text: 'Metal puts most of its color into the reflection', correct: true, why: 'Right. Non-metals keep diffuse surface color beneath a mostly neutral reflection; metals tint the reflection itself.' },
            { text: 'Metal always has a sharp reflection', why: 'A metal can be polished or rough. Roughness controls reflection clarity for both material types.' },
        ],
    },
];

const card = document.getElementById('quiz-card');
const list = document.getElementById('quiz-list');
const tally = document.getElementById('quiz-tally');

let solved = new Set();
let onDone = () => { };

export function startQuiz(onComplete) {
    onDone = onComplete || (() => { });
    solved = new Set();
    list.innerHTML = '';

    QUESTIONS.forEach((question, qi) => {
        const item = document.createElement('div');
        item.className = 'quiz-q';

        const prompt = document.createElement('p');
        prompt.className = 'quiz-prompt';
        prompt.innerHTML = '<span class="quiz-num">' + (qi + 1) + '</span>' + question.q;
        item.appendChild(prompt);

        const opts = document.createElement('div');
        opts.className = 'quiz-opts';
        question.options.forEach(option => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'quiz-opt';
            b.textContent = option.text;
            b.addEventListener('click', () => pick(item, b, option, qi));
            opts.appendChild(b);
        });
        item.appendChild(opts);

        const why = document.createElement('p');
        why.className = 'quiz-why';
        item.appendChild(why);

        list.appendChild(item);
    });

    updateTally();
    card.classList.add('on');
    setTimeout(() => list.querySelector('.quiz-opt')?.focus(), 180);
}

function pick(item, button, option, qi) {
    if (solved.has(qi)) return;              // already answered correctly

    const why = item.querySelector('.quiz-why');
    why.innerHTML = option.why;
    why.classList.add('on');

    if (option.correct) {
        solved.add(qi);
        item.classList.add('solved');
        button.classList.add('right');
        why.classList.add('right');
        // Wrong picks stay marked, but stop being clickable once the question
        // is settled, so the card cannot be scrubbed back into an unclear state.
        item.querySelectorAll('.quiz-opt').forEach(b => { b.disabled = b !== button; });
    } else {
        button.classList.add('wrong');
        why.classList.remove('right');
    }

    updateTally();
    if (solved.size === QUESTIONS.length) onDone();
}

function updateTally() {
    tally.textContent = solved.size + ' of ' + QUESTIONS.length + ' answered';
    tally.classList.toggle('complete', solved.size === QUESTIONS.length);
}

export function endQuiz() {
    card.classList.remove('on');
}
