import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const labsRoot = path.join(root, 'polished', 'labs');
const labs = [
    { name: 'hierarchy', beats: 9, questions: 3 },
    { name: 'keyframes', beats: 9, questions: 3 },
    { name: 'particles', beats: 9, questions: 3 },
];

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function read(file) { return fs.readFileSync(file, 'utf8'); }

function checkLocalReferences(html, labDir) {
    const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
    for (const ref of refs) {
        if (/^(?:https?:|data:|#)/.test(ref)) continue;
        const clean = ref.split(/[?#]/)[0];
        if (!clean || clean.endsWith('/')) continue;
        assert(fs.existsSync(path.resolve(labDir, clean)), `missing local asset: ${path.basename(labDir)}/${clean}`);
    }
}

function checkImports(jsDir) {
    for (const name of fs.readdirSync(jsDir).filter(file => file.endsWith('.js'))) {
        const file = path.join(jsDir, name);
        for (const match of read(file).matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
            assert(fs.existsSync(path.resolve(jsDir, match[1])), `missing import: ${name} -> ${match[1]}`);
        }
    }
}

for (const lab of labs) {
    const labDir = path.join(labsRoot, lab.name);
    const html = read(path.join(labDir, 'index.html'));
    const beats = read(path.join(labDir, 'js', 'beats.js'));
    const config = read(path.join(labDir, 'js', 'config.js'));
    const quiz = read(path.join(labDir, 'js', 'quiz.js'));
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);

    assert(ids.length === new Set(ids).size, `${lab.name}: duplicate HTML id`);
    for (const id of ['read-layer', 'quiz-card', 'quiz-list']) {
        assert(ids.includes(id), `${lab.name}: missing #${id}`);
    }
    for (const id of ['concept-rail', 'task-status', 'read-goal']) {
        assert(!ids.includes(id), `${lab.name}: obsolete #${id} adds a duplicate instruction layer`);
    }
    assert(!/try after the demo/i.test(html + beats), `${lab.name}: obsolete Try-after-demo copy remains`);
    assert(!beats.includes('setLearning('), `${lab.name}: obsolete pipeline UI remains in the beat flow`);
    assert(!beats.includes('cap-tip'), `${lab.name}: secondary tip styling has returned to a primary caption`);
    assert(!beats.includes('Nothing new to learn here'), `${lab.name}: challenge copy talks about the lesson instead of the task`);
    assert(beats.includes('showReadCard('), `${lab.name}: beat flow does not use learner-paced Read cards`);
    assert(beats.includes('startQuiz('), `${lab.name}: beat flow does not start an exit check`);
    assert((quiz.match(/\bq:\s*['"]/g) || []).length === lab.questions, `${lab.name}: unexpected question count`);
    assert(config.includes(`TOTAL_BEATS = ${lab.beats}`), `${lab.name}: unexpected beat count`);
    checkLocalReferences(html, labDir);
    checkImports(path.join(labDir, 'js'));
}

 // Material Lab is migrated into Creation Studio; validate the live route and
 // lesson modules rather than requiring the redirect stub to contain old UI.
 const materialRoute = read(path.join(labsRoot, 'material-lab', 'index.html'));
 assert(materialRoute.includes('url=../../creator/?lesson=material-lab'), 'material: old route does not redirect to the Creator lesson');
 assert(materialRoute.includes('location.replace(new URL'), 'material: JavaScript redirect is missing');
 assert(materialRoute.includes('href="../../creator/?lesson=material-lab"'), 'material: fallback link is missing');
 assert(fs.existsSync(path.join(root, 'polished', 'creator', 'index.html')), 'material: Creation Studio route is missing');
 const materialLesson = read(path.join(root, 'polished', 'creator', 'js', 'lessons', 'material.js'));
 const materialChallenge = read(path.join(root, 'polished', 'creator', 'js', 'lessons', 'materialChallenge.js'));
 const materialTest = read(path.join(root, 'polished', 'creator', 'tests', 'material-lesson.test.mjs'));
 assert(materialLesson.includes("'roughness', 'metalness', 'emission', 'glow'"), 'material: ordered surface/lights-off/emission teaching is missing');
 assert(materialLesson.includes('Check match'), 'material: learner-submitted matching feedback is missing');
 assert(materialLesson.includes('does not illuminate nearby objects') && materialLesson.includes('while the floor stays dark'), 'material: emission boundary is not taught');
 assert(materialChallenge.includes('assessMaterial'), 'material: perceptual match assessment is missing');
 assert(materialTest.includes('required journey uses selected shared material'), 'material: active lesson regression test is missing');
 assert(materialTest.includes('perceptual feedback corrects roughness direction'), 'material: feedback regression test is missing');
 const keyframeHtml = read(path.join(labsRoot, 'keyframes', 'index.html'));
for (const goal of ['start', 'apex', 'land', 'played']) {
    assert(keyframeHtml.includes(`data-goal="${goal}"`), `keyframes: missing ${goal} challenge goal`);
}

const particleHtml = read(path.join(labsRoot, 'particles', 'index.html'));
assert(particleHtml.includes('data-cond="shape"'), 'particles: challenge must require an intentional emitter shape');

const rootHtml = read(path.join(root, 'index.html'));
assert(rootHtml.includes('url=polished/'), 'hub: root landing page does not redirect to the polished hub');
const hubHtml = read(path.join(root, 'polished', 'index.html'));
function hubTier(status) {
    const start = hubHtml.indexOf(`data-status="${status}"`);
    const end = hubHtml.indexOf('<section class="lab-section"', start + 1);
    assert(start >= 0, `hub: missing ${status} status tier`);
    return hubHtml.slice(start, end > start ? end : undefined);
}
const readyHub = hubTier('ready');
const reviewHub = hubTier('review');
const wipHub = hubTier('wip');
assert(readyHub.includes('labs/navigate-and-transform/'), 'hub: Navigate + Transform is not Ready');
assert(reviewHub.includes('labs/material-lab/'), 'hub: Material Lab is not Needs review');
for (const lab of ['hierarchy', 'keyframes', 'particles']) {
    assert(wipHub.includes(`labs/${lab}/`), `hub: ${lab} is not Work in progress`);
}
for (const lab of ['navigate-and-transform', 'hierarchy', 'keyframes', 'particles']) {
    const labHtml = read(path.join(labsRoot, lab, 'index.html'));
    assert(labHtml.includes('href="../../../" class="home-btn"'), `${lab}: Back does not return to the main landing page`);
    assert(labHtml.includes('id="btn-finish" href="../../../"'), `${lab}: Finish does not return to the main landing page`);
}

console.log('PASS polished curriculum: concise Read/Watch/Do, challenges, exit checks, references');
