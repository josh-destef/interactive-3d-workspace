const QUESTIONS = [
    {
        q: 'The base rotates. Why does the wrist move even though its local position stays the same?',
        options: [
            { text: 'The wrist inherits the transforms above it', correct: true, why: 'Yes. Its fixed local offset is combined with the elbow, shoulder and base transforms to produce a new world position.' },
            { text: 'The wrist copies the base angle into its own value', why: 'Its own local value does not change. The parent transforms are applied on top when the world transform is calculated.' },
            { text: 'Every object in the scene always follows the base', why: 'Only descendants of the base follow it. Unrelated root objects do not.' },
        ],
    },
    {
        q: 'You rotate the elbow. Which part should stay still?',
        options: [
            { text: 'The wrist', why: 'The wrist is below the elbow, so it inherits the elbow’s motion.' },
            { text: 'The shoulder', correct: true, why: 'Correct. Motion travels from parent to child, not back up the hierarchy.' },
            { text: 'The claw', why: 'The claw is a descendant of the elbow, so it travels with it.' },
        ],
    },
    {
        q: 'What changed when the claw picked up the block?',
        options: [
            { text: 'The block became a child of the wrist', correct: true, why: 'Exactly. Reparenting stores the block under the wrist while preserving its world-space pose at the moment of pickup.' },
            { text: 'The block was permanently merged into the arm mesh', why: 'No geometry was merged. It remains a separate node with a new parent.' },
            { text: 'The arm became a child of the block', why: 'That would make the block drive the arm. Here the wrist drives the held block.' },
        ],
    },
];

const card = document.getElementById('quiz-card');
const list = document.getElementById('quiz-list');
const tally = document.getElementById('quiz-tally');
let solved = new Set();
let onDone = () => {};

export function startQuiz(onComplete) {
    onDone = onComplete || (() => {});
    solved = new Set();
    list.innerHTML = '';
    QUESTIONS.forEach((question, qi) => {
        const item = document.createElement('div'); item.className = 'quiz-q';
        const prompt = document.createElement('p'); prompt.className = 'quiz-prompt';
        prompt.innerHTML = `<span class="quiz-num">${qi + 1}</span>${question.q}`; item.appendChild(prompt);
        const opts = document.createElement('div'); opts.className = 'quiz-opts';
        question.options.forEach(option => {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'quiz-opt';
            button.textContent = option.text; button.addEventListener('click', () => pick(item, button, option, qi)); opts.appendChild(button);
        });
        item.appendChild(opts);
        const why = document.createElement('p'); why.className = 'quiz-why'; why.setAttribute('aria-live', 'polite'); item.appendChild(why);
        list.appendChild(item);
    });
    updateTally(); card.classList.add('on');
    setTimeout(() => list.querySelector('.quiz-opt')?.focus(), 180);
}

function pick(item, button, option, qi) {
    if (solved.has(qi)) return;
    const why = item.querySelector('.quiz-why'); why.textContent = option.why; why.classList.add('on');
    if (option.correct) {
        solved.add(qi); item.classList.add('solved'); button.classList.add('right'); why.classList.add('right');
        item.querySelectorAll('.quiz-opt').forEach(choice => { choice.disabled = choice !== button; });
    } else { button.classList.add('wrong'); why.classList.remove('right'); }
    updateTally(); if (solved.size === QUESTIONS.length) onDone();
}

function updateTally() {
    tally.textContent = `${solved.size} of ${QUESTIONS.length} answered`;
    tally.classList.toggle('complete', solved.size === QUESTIONS.length);
}

export function endQuiz() { card.classList.remove('on'); }
