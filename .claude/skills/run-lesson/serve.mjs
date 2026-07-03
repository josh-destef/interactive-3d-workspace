/* Tiny static file server for the 3D lessons.
 * Serve the PROJECT ROOT (fundamentals_of_3d) so both /fundamentals5/... and
 * the shared /gizmo.glb resolve (GLTFLoader resolves ../gizmo.glb against the
 * page base /fundamentals5/, i.e. /gizmo.glb at the root). ES modules require a
 * correct JS MIME type or they fail to load, hence the explicit map below.
 *
 *   node .claude/skills/run-lesson/serve.mjs [root] [port]
 * Defaults: root = cwd, port = 8123.
 */
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join, normalize } from 'path';

const ROOT = process.argv[2] || process.cwd();
const PORT = Number(process.argv[3]) || 8123;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    let url = decodeURIComponent(req.url.split('?')[0]);
    if (url.endsWith('/')) url += 'index.html';
    const path = join(ROOT, normalize(url));
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': MIME[extname(path).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    res.writeHead(404); res.end('not found: ' + e.message);
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`port ${PORT} already in use — a server is likely already running; reuse it or pass a different port.`);
    process.exit(1);
  }
  throw e;
});

server.listen(PORT, () => console.log(`READY serving ${ROOT} at http://localhost:${PORT}/`));
