const QUESTIONS = [
    {
        q: 'What information does one keyframe store?',
        options: [
            { text: 'A pose and the time it belongs to', correct: true, why: 'Yes. A key says which property values should exist at one specific moment.' },
            { text: 'Every frame of the finished motion', why: 'Only selected moments are stored. The frames between keys are calculated.' },
            { text: 'Only the speed of the object', why: 'Speed emerges from values, timing and interpolation; it is not the definition of a keyframe.' },
        ],
    },
    {
        q: 'The keys stay fixed but the motion changes from a snap to a smooth start. What changed?',
        options: [
            { text: 'The interpolation rule', correct: true, why: 'Correct. Interpolation controls how values travel between the same stored keys.' },
            { text: 'The number of frames in each key', why: 'A key is one moment, not a packet of frames.' },
            { text: 'The object hierarchy', why: 'Hierarchy affects inherited transforms, not the curve between animation keys.' },
        ],
    },
    {
        q: 'Why can the height graph look smooth while the rocket also turns?',
        options: [
            { text: 'Height and turn are separate channels', correct: true, why: 'Exactly. Each animated property has its own values and curve, even when several channels are keyed at the same moment.' },
            { text: 'Rotation never uses keyframes', why: 'Rotation can be keyed just like position or scale.' },
            { text: 'The graph secretly shows every property at once', why: 'This graph shows height only. A full graph editor stacks or overlays one curve per channel.' },
        ],
    },
];

const card = document.getElementById('quiz-card');
const list = document.getElementById('quiz-list');
const tally = document.getElementById('quiz-tally');
let solved = new Set(); let onDone = () => {};
export function startQuiz(onComplete) {
    onDone = onComplete || (() => {}); solved = new Set(); list.innerHTML = '';
    QUESTIONS.forEach((question, qi) => {
        const item = document.createElement('div'); item.className = 'quiz-q';
        const prompt = document.createElement('p'); prompt.className = 'quiz-prompt';
        prompt.innerHTML = `<span class="quiz-num">${qi + 1}</span>${question.q}`; item.appendChild(prompt);
        const opts = document.createElement('div'); opts.className = 'quiz-opts';
        question.options.forEach(option => {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'quiz-opt'; button.textContent = option.text;
            button.addEventListener('click', () => pick(item, button, option, qi)); opts.appendChild(button);
        });
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
