// Development server: serves web/, streams example data on /api/live (the latest values
// on /api/now) and reloads open pages when a file under web/ changes. Listens on this
// computer only (127.0.0.1).

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

// STRIDECAST_SOURCE=http://StrideCast-Pi2w.local:3000 takes the values from the bridge on
// the Pi instead of the simulator.
const source = process.env.STRIDECAST_SOURCE?.replace(/\/$/, '');
const sim = createSimulator();
let current = source ? { connected: false, source: 'elyx' } : sim.current();
let fetching = false;

async function fetchFromBridge() {
  if (fetching) return;
  fetching = true;
  try {
    const res = await fetch(`${source}/api/now`, { signal: AbortSignal.timeout(3000) });
    current = await res.json();
  } catch {
    current = { connected: false, source: 'elyx', error: 'bridge unreachable' };
  } finally {
    fetching = false;
  }
}

setInterval(async () => {
  if (source) await fetchFromBridge();
  else current = sim.tick(1);
  const message = `data: ${JSON.stringify(current)}\n\n`;
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
  else if (!extname(path)) path += '.html'; // /ride serves ride.html
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
    // An HTML page with the reload script, so a tab stuck on it recovers by itself.
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><title>Not found</title><p>Not found: ${url.pathname.replace(/[<>&"]/g, '')}</p>${reloadSnippet}`);
  }
}

createServer((req, res) => {
  const url = new URL(req.url, `http://${host}:${port}`);
  if (url.pathname === '/api/live') {
    openStream(req, res, liveClients);
    res.write(`data: ${JSON.stringify(current)}\n\n`);
  } else if (url.pathname === '/api/now') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(current));
  } else if (url.pathname === '/__reload') {
    openStream(req, res, reloadClients);
  } else {
    serveFile(url, res);
  }
}).listen(port, host, () => {
  console.log(`StrideCast dev server: http://${host}:${port}/ (${source ? `values from ${source}` : 'example data'})`);
});
