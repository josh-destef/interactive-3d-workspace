import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '../../..');
const deps = path.join(os.tmpdir(), 'fundamentals-3d-qa/node_modules');
const { JSDOM } = await import(pathToFileURL(path.join(deps, 'jsdom/lib/api.js')).href);
const dom = new JSDOM('<div id="actions"></div>', { url: 'https://creator.test/', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

const projectURL = pathToFileURL(path.join(root, 'polished/creator/js/project.js')).href;
const filesURL = pathToFileURL(path.join(root, 'polished/creator/js/projectFiles.js')).href;
const [{ createProject }, { createProjectFiles, STORAGE_KEY, MAX_BYTES, parseProjectText }] = await Promise.all([
  import(projectURL), import(filesURL),
]);
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const mount = () => {
  const node = document.createElement('div'); document.body.append(node); return node;
};

localStorage.clear();
const autosaved = createProject();
const autosaveFiles = createProjectFiles({ project: autosaved, root: mount(), onStatus() {} });
const changed = autosaved.addPrimitive('cube');
autosaved.rename(changed.id, 'Autosaved cube');
await wait(850);
assert.equal(JSON.parse(localStorage.getItem(STORAGE_KEY)).entities.find(entity => entity.id === changed.id).name, 'Autosaved cube', 'project changes are autosaved locally');
autosaveFiles.dispose();

const source = createProject();
const shape = source.addPrimitive('cube');
source.setMesh(shape.id, {
  vertices: [[-.5, -.5, -.5], [.5, -.5, -.5], [.5, .5, -.5], [-.5, .5, -.5]],
  faces: [[0, 1, 2, 3]],
});
source.updateAnimation(shape.id, { keys: [
  { frame: 0, transform: structuredClone(source.get(shape.id).components.transform), interpolation: 'smooth' },
  { frame: 24, transform: { position: [2, 1, 0], rotation: [0, .5, 0], scale: [1, 1, 1] }, interpolation: 'linear' },
] });
const openedData = JSON.stringify(source.serialize());
localStorage.setItem(STORAGE_KEY, JSON.stringify(autosaved.serialize()));
const opened = createProject();
const statuses = [];
const openedFiles = createProjectFiles({ project: opened, root: mount(), onStatus: message => statuses.push(message) });
openedFiles.openText(openedData);
assert.deepEqual(opened.get(shape.id).components.mesh, source.get(shape.id).components.mesh, 'open restores editable mesh data into a fresh project');
assert.deepEqual(opened.get(shape.id).components.animation, source.get(shape.id).components.animation, 'open restores animation keys into a fresh project');
assert.deepEqual(JSON.parse(localStorage.getItem(STORAGE_KEY)), opened.serialize(), 'opened scene immediately replaces stale autosave');

const beforeInvalid = opened.serialize();
assert.throws(() => openedFiles.openText('{"version":1,"entities":[]}'), /Creation|project/i);
assert.deepEqual(opened.serialize(), beforeInvalid, 'invalid import preserves the current project');
assert.throws(() => parseProjectText(' '.repeat(MAX_BYTES + 1)), /smaller than 8 MB/);
assert.deepEqual(opened.serialize(), beforeInvalid, 'oversized import preserves the current project');
openedFiles.dispose();

dom.window.close();
delete globalThis.localStorage;
delete globalThis.document;
delete globalThis.window;
console.log('PASS project files autosave changes, safely open meshes and keys, reject invalid and oversized imports');
