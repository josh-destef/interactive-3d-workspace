const QUESTIONS = [
    {
        q: 'At steady state, which change roughly doubles the number of live particles?',
        options: [
            { text: 'Double rate or double average lifetime', correct: true, why: 'Yes. Live count is approximately rate multiplied by average lifetime, until the particle pool becomes the limit.' },
            { text: 'Double launch speed', why: 'Speed changes where particles travel, not how frequently they are born or when they die.' },
            { text: 'Turn gravity off', why: 'Gravity changes trajectories. It does not change the birth or death schedule.' },
        ],
    },
    {
        q: 'What determines a particle’s path after it is emitted?',
        options: [
            { text: 'Its starting velocity, then forces and drag each frame', correct: true, why: 'Correct. The simulation updates velocity from forces, then updates position from velocity.' },
            { text: 'A hidden keyframe on every particle', why: 'These particles have no authored paths. Their paths emerge from simulation rules.' },
            { text: 'Its colour-over-life gradient', why: 'That gradient changes appearance from age, not motion.' },
        ],
    },
    {
        q: 'Why can additive particles disappear against a pale background?',
        options: [
            { text: 'Adding more light has little contrast against something already bright', correct: true, why: 'Exactly. Additive blending is luminous on dark backgrounds but can wash out on light ones.' },
            { text: 'Additive blending stops the emitter', why: 'The particles still exist and move; only their blend with the background changed.' },
            { text: 'Their lifetime becomes zero', why: 'Blend mode does not change age or lifetime.' },
        ],
    },
];

const card = document.getElementById('quiz-card'); const list = document.getElementById('quiz-list'); const tally = document.getElementById('quiz-tally');
let solved = new Set(); let onDone = () => {};
export function startQuiz(onComplete) {
    onDone = onComplete || (() => {}); solved = new Set(); list.innerHTML = '';
    QUESTIONS.forEach((question, qi) => {
        const item = document.createElement('div'); item.className = 'quiz-q';
        const prompt = document.createElement('p'); prompt.className = 'quiz-prompt'; prompt.innerHTML = `<span class="quiz-num">${qi + 1}</span>${question.q}`; item.appendChild(prompt);
        const opts = document.createElement('div'); opts.className = 'quiz-opts';
        question.options.forEach(option => { const button = document.createElement('button'); button.type = 'button'; button.className = 'quiz-opt'; button.textContent = option.text; button.addEventListener('click', () => pick(item, button, option, qi)); opts.appendChild(button); });
        item.appendChild(opts); const why = document.createElement('p'); why.className = 'quiz-why'; why.setAttribute('aria-live', 'polite'); item.appendChild(why); list.appendChild(item);
    });
    updateTally(); card.classList.add('on');
    setTimeout(() => list.querySelector('.quiz-opt')?.focus(), 180);
}
function pick(item, button, option, qi) {
    if (solved.has(qi)) return;
    const why = item.querySelector('.quiz-why'); why.textContent = option.why; why.classList.add('on');
    if (option.correct) { solved.add(qi); item.classList.add('solved'); button.classList.add('right'); why.classList.add('right'); item.querySelectorAll('.quiz-opt').forEach(choice => { choice.disabled = choice !== button; }); }
    else { button.classList.add('wrong'); why.classList.remove('right'); }
    updateTally(); if (solved.size === QUESTIONS.length) onDone();
}
function updateTally() { tally.textContent = `${solved.size} of ${QUESTIONS.length} answered`; tally.classList.toggle('complete', solved.size === QUESTIONS.length); }
export function endQuiz() { card.classList.remove('on'); }
