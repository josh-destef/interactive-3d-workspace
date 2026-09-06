import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const labsRoot = path.join(root, 'polished', 'labs');
const labs = [
    { name: 'material-lab', beats: 10, questions: 4 },
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

const materialConfig = read(path.join(labsRoot, 'material-lab', 'js', 'config.js'));
const materialHtml = read(path.join(labsRoot, 'material-lab', 'index.html'));
const materialBeats = read(path.join(labsRoot, 'material-lab', 'js', 'beats.js'));
const materialMatch = read(path.join(labsRoot, 'material-lab', 'js', 'match.js'));
for (const restoredBeat of ['RGB:', 'LIGHT:', 'EMISSIVE:']) {
    assert(materialConfig.includes(restoredBeat), `material: missing restored ${restoredBeat.slice(0, -1).toLowerCase()} step`);
}
assert(!materialConfig.includes('TEXTURE:') && !materialConfig.includes('NORMAL:'), 'material: texture and normal-map expansion should stay removed');
assert(materialConfig.indexOf('LIGHT:') < materialConfig.indexOf('CHALLENGE:'), 'material: lighting should be taught before application');
for (const id of ['in-r', 'in-g', 'in-b', 'room-seg']) {
    assert(materialHtml.includes(`id="${id}"`), `material: missing restored #${id} control`);
}
for (const group of ['rgb', 'light', 'emissive', 'room']) {
    assert(materialHtml.includes(`data-group="${group}"`), `material: missing restored ${group} control`);
}
assert(!materialHtml.includes('id="in-color"'), 'material: native colour picker belongs to the removed expansion');
for (const group of ['texture', 'normal']) {
    assert(!materialHtml.includes(`data-group="${group}"`), `material: removed ${group} control has returned`);
}
assert(materialBeats.includes('Every surface reflects'), 'material: metalness lesson must state that non-metals also reflect');
assert(materialBeats.includes("[BEAT.CHALLENGE]: ['rgb', 'roughness', 'metalness', 'examples', 'check']"), 'material: challenge controls differ from the restored lesson');
const obsoleteMaterialTerm = ['rec', 'ipe'].join('');
assert(!new RegExp(`\\b${obsoleteMaterialTerm}s?\\b`, 'i').test(materialConfig + materialHtml + materialBeats + materialMatch), 'material: old example terminology remains');
assert(materialMatch.includes('makeRandomTarget(state.matchTarget)'), 'material: challenge reference is not generated randomly');
assert(!materialMatch.includes('const s2l'), 'material: challenge colour must not be converted from sRGB twice');

const keyframeHtml = read(path.join(labsRoot, 'keyframes', 'index.html'));
for (const goal of ['start', 'apex', 'land', 'played']) {
    assert(keyframeHtml.includes(`data-goal="${goal}"`), `keyframes: missing ${goal} challenge goal`);
}

const particleHtml = read(path.join(labsRoot, 'particles', 'index.html'));
assert(particleHtml.includes('data-cond="shape"'), 'particles: challenge must require an intentional emitter shape');

const hubHtml = read(path.join(root, 'index.html'));
function hubTier(startClass, endClass) {
    const start = hubHtml.indexOf(`section-heading ${startClass}`);
    const end = endClass
        ? hubHtml.indexOf(`section-heading ${endClass}`, start + 1)
        : hubHtml.indexOf('<div class="section-heading">', start + 1);
    assert(start >= 0 && end > start, `hub: missing ${startClass} status tier`);
    return hubHtml.slice(start, end);
}
const readyHub = hubTier('tier-done', 'tier-review');
const reviewHub = hubTier('tier-review', 'tier-wip');
const wipHub = hubTier('tier-wip', '');
assert(readyHub.includes('labs/navigate-and-transform/'), 'hub: Navigate + Transform is not Ready');
assert(reviewHub.includes('labs/material-lab/'), 'hub: Material Lab is not Needs review');
for (const lab of ['hierarchy', 'keyframes', 'particles']) {
    assert(wipHub.includes(`labs/${lab}/`), `hub: ${lab} is not Work in progress`);
}
const polishedHub = read(path.join(root, 'polished', 'index.html'));
assert(polishedHub.includes('window.location.replace(\'../\')'), 'hub: secondary polished landing page does not return to the main landing page');
for (const lab of ['navigate-and-transform', 'material-lab', 'hierarchy', 'keyframes', 'particles']) {
    const labHtml = read(path.join(labsRoot, lab, 'index.html'));
    assert(labHtml.includes('href="../../../" class="home-btn"'), `${lab}: Back does not return to the main landing page`);
    assert(labHtml.includes('id="btn-finish" href="../../../"'), `${lab}: Finish does not return to the main landing page`);
}

console.log('PASS polished curriculum: concise Read/Watch/Do, challenges, exit checks, references');
