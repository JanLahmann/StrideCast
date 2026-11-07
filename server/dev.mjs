// Development server: serves web/, streams example data on /api/live and reloads open
// pages when a file under web/ changes. Listens on this computer only (127.0.0.1).

import { createServer } from 'node:http';
import { watch } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSimulator } from './simulator.mjs';

const root = resolve(fileURLToPath(new URL('../web', import.meta.url)));
const host = '127.0.0.1';
const port = Number(process.env.PORT ?? 3700);

const types = {
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

const liveClients = new Set();
const reloadClients = new Set();
const reloadSnippet = '<script>new EventSource("/__reload").onmessage = () => location.reload();</script>';

const sim = createSimulator();
setInterval(() => {
  const message = `data: ${JSON.stringify(sim.tick(1))}\n\n`;
  for (const res of liveClients) res.write(message);
}, 1000);

let reloadTimer;
watch(root, { recursive: true }, () => {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    for (const res of reloadClients) res.write('data: reload\n\n');
  }, 100);
});

function openStream(req, res, clients) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(': connected\n\n');
  clients.add(res);
  req.on('close', () => clients.delete(res));
}

async function serveFile(url, res) {
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = resolve(join(root, normalize(path)));
  if (!file.startsWith(root + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    if ((await stat(file)).isDirectory()) {
      res.writeHead(302, { Location: `${url.pathname}/` }).end();
      return;
    }
    const type = types[extname(file)] ?? 'application/octet-stream';
    let body = await readFile(file);
    if (type.startsWith('text/html')) body = body.toString().replace('</body>', `${reloadSnippet}</body>`);
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
}

createServer((req, res) => {
  const url = new URL(req.url, `http://${host}:${port}`);
  if (url.pathname === '/api/live') {
    openStream(req, res, liveClients);
    res.write(`data: ${JSON.stringify(sim.current())}\n\n`);
  } else if (url.pathname === '/__reload') {
    openStream(req, res, reloadClients);
  } else {
    serveFile(url, res);
  }
}).listen(port, host, () => {
  console.log(`StrideCast dev server with example data: http://${host}:${port}/`);
});
