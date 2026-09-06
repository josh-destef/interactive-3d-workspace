/* ═══════════════════════════════════════════════
   CHECK WHAT YOU LEARNED
   A few short questions closing the lab on its own terms.

   THE DESIGN, which is not negotiable per lab:

   - Nothing is scored. The tally counts questions answered, not questions
     got right first time. A student who reasons their way to the answer
     after one wrong pick has done the better piece of learning, and the card
     should not tell them otherwise.
   - Every option carries a `why`, including the wrong ones - especially the
     wrong ones. The explanation is the only part of a card like this that
     teaches anything; the buttons are just how it gets asked for.
   - A wrong pick stays marked and struck through rather than disappearing,
     so what was ruled out stays visible.
   - Questions are about what the student just did, in the words the lesson
     used. A quiz is not the place to introduce vocabulary.

   Write questions in the lab's own quizQuestions.js and pass them in:

       startQuiz(QUESTIONS, () => showContinue());
═══════════════════════════════════════════════ */

const card = document.getElementById('quiz-card');
const list = document.getElementById('quiz-list');
const tally = document.getElementById('quiz-tally');

let solved = new Set();
let questions = [];
let onDone = () => { };

/**
 * questions: [{ q, options: [{ text, correct?, why }] }]
 * onComplete: called once every question has been answered correctly.
 */
export function startQuiz(items, onComplete) {
    if (!card || !list) return;
    questions = items || [];
    onDone = onComplete || (() => { });
    solved = new Set();
    list.innerHTML = '';

    questions.forEach((question, qi) => {
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
    why.innerHTML = option.why || '';
    why.classList.add('on');

    if (option.correct) {
        solved.add(qi);
        item.classList.add('solved');
        button.classList.add('right');
        why.classList.add('right');
        // Wrong picks stay marked but stop being clickable once the question is
        // settled, so the card cannot be scrubbed back into an unclear state.
        item.querySelectorAll('.quiz-opt').forEach(b => { b.disabled = b !== button; });
    } else {
        button.classList.add('wrong');
        why.classList.remove('right');
    }

    updateTally();
    if (solved.size === questions.length) onDone();
}

function updateTally() {
    if (!tally) return;
    tally.textContent = solved.size + ' of ' + questions.length + ' answered';
    tally.classList.toggle('complete', solved.size === questions.length);
}

export function endQuiz() {
    card?.classList.remove('on');
}

export function quizComplete() {
    return questions.length > 0 && solved.size === questions.length;
}
