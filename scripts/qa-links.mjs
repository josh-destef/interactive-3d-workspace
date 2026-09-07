/* Static reference checker.
 *
 * Walks every HTML/CSS/JS file that ships as part of the site and verifies that
 * each *local* reference it makes resolves on disk. This is the net that catches
 * a stale relative path after files move around.
 *
 *   node scripts/qa-links.mjs
 *
 * Two resolution bases matter, because a lab's JS uses both:
 *   - ES imports are relative to the *module* ("./stage.js").
 *   - Assets fetched at runtime are relative to the *page* that loaded the
 *     module ("assets/gizmobot.glb" from js/config.js means <lab>/assets/...).
 * So asset references are accepted if they resolve against either the module's
 * own directory or the nearest ancestor directory holding an index.html.
 *
 * Exits non-zero and lists every broken reference it found.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
// scripts/ is Node tooling, not shipped web content; its paths are built with
// path.join() against the repo root and cannot be checked lexically.
const SKIP_DIRS = new Set([
  '.git', 'node_modules', '.screenshots', '.playwright-mcp', '.claude', 'scripts',
]);
const CODE = new Set(['.html', '.css', '.js', '.mjs']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), out);
    } else if (CODE.has(path.extname(entry.name).toLowerCase())) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function pageRoot(file) {
  let dir = path.dirname(file);
  while (dir.startsWith(root)) {
    if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.dirname(file);
}

function isExternal(ref) {
  return !ref || /^(https?:|data:|blob:|mailto:|javascript:|#|\/\/)/i.test(ref);
}

function resolves(base, ref) {
  const clean = ref.split(/[?#]/)[0];
  if (!clean) return true;
  const target = path.resolve(base, clean);
  if (!fs.existsSync(target)) return false;
  // A directory reference is satisfied by its index.html.
  if (clean.endsWith('/')) return fs.existsSync(path.join(target, 'index.html'));
  return true;
}

// [regex, kind] — "strict" resolves against the file's own directory only;
// "asset" also allows the page root, since the browser resolves it that way.
const PATTERNS = [
  [/(?:src|href)\s*=\s*"([^"]+)"/g, 'strict'],
  [/(?:src|href)\s*=\s*'([^']+)'/g, 'strict'],
  [/url\(\s*['"]?([^'")]+)['"]?\s*\)/g, 'strict'],
  [/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]/g, 'module'],
  [/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g, 'module'],
  [/\bnew\s+URL\(\s*['"]([^'"]+)['"]/g, 'asset'],
  [/\b(?:fetch|loadAsync|load)\(\s*['"]([^'"]+)['"]/g, 'asset'],
  [/['"]([^'"\s]+\/[^'"\s]+\.(?:glb|gltf|png|jpg|jpeg|svg|css|woff2?))['"]/g, 'asset'],
];

const broken = [];
let checked = 0;

for (const file of walk(root)) {
  const rel = path.relative(root, file).split(path.sep).join('/');
  const text = fs.readFileSync(file, 'utf8');
  // Redirect stubs deliberately point at paths relative to their *old* location.
  if (/<meta http-equiv="refresh"/i.test(text)) continue;
  const here = path.dirname(file);
  const page = pageRoot(file);
  const seen = new Set();
  // Comments often *document* markup (the kit's CSS header shows the <link> tags
  // a lab should copy). Nothing in a comment is loaded, so don't check it.
  const body = text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  // In a script, `el.href = '...'` is resolved by the browser against the page,
  // not against the module file, so treat those like any other runtime asset.
  const isScript = /\.m?js$/i.test(file);

  for (const [pattern, rawKind] of PATTERNS) {
    const kind = isScript && rawKind === 'strict' ? 'asset' : rawKind;
    for (const match of body.matchAll(pattern)) {
      const ref = match[1].trim();
      if (isExternal(ref)) continue;
      // Bare module specifiers ("three", "three/addons/...") come from the import map.
      if (kind === 'module' && !ref.startsWith('.')) continue;
      // A name with no slash is ambiguous (often a download filename, not a path).
      if (kind === 'asset' && !ref.includes('/')) continue;
      const key = kind + '|' + ref;
      if (seen.has(key)) continue;
      seen.add(key);

      checked++;
      const ok = kind === 'asset'
        ? resolves(here, ref) || resolves(page, ref)
        : resolves(here, ref);
      if (!ok) broken.push(`${rel} -> ${ref}`);
    }
  }
}

if (broken.length) {
  console.error(`FAIL ${broken.length} broken local reference(s) of ${checked} checked:\n`);
  for (const b of broken) console.error('  ' + b);
  process.exit(1);
}
console.log(`PASS all ${checked} local references resolve`);
