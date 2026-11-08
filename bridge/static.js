// Serves the pages in web/ (dashboard, ride, start page) read-only, so a browser on the TV
// works with the Pi alone. Clean URLs like the dev server: /dashboard serves dashboard.html.

const { readFile, stat } = require('node:fs/promises');
const { extname, join, normalize, resolve, sep } = require('node:path');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

// Maps a URL path to a file under root, or null when it would leave root.
function resolvePath(root, pathname) {
  let path;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (path.endsWith('/')) path += 'index.html';
  else if (!extname(path)) path += '.html';
  const file = resolve(join(root, normalize(path)));
  return file.startsWith(root + sep) ? file : null;
}

async function serveStatic(root, pathname, res) {
  const file = resolvePath(root, pathname);
  if (!file) {
    res.writeHead(403).end();
    return;
  }
  try {
    if ((await stat(file)).isDirectory()) {
      res.writeHead(302, { Location: `${pathname}/` }).end();
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
}

module.exports = { serveStatic, resolvePath };
