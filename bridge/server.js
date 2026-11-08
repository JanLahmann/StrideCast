// StrideCast bridge: reads the Kettler console over USB, advertises it over Bluetooth LE
// as "StrideCast" (FTMS and Cycling Power) and serves the live values over HTTP:
//   GET /api/now   the latest values as JSON (connected: false while the console is silent)
//   GET /api/live  the same once per second as server-sent events
//   GET /          the pages from web/ (dashboard, ride), deployed next to bridge/
// Set STRIDECAST_NO_BLE=1 to run without Bluetooth.

const http = require('node:http');
const path = require('node:path');
const { KettlerConsole } = require('./console');
const { serveStatic } = require('./static');

const WEB_ROOT = path.resolve(process.env.STRIDECAST_WEB ?? path.join(__dirname, '..', 'web'));

const PORT = Number(process.env.PORT ?? 3000);
const STALE_MS = 5000;

const kettler = new KettlerConsole();
const liveClients = new Set();
let latest = null;
let latestAt = 0;

function now() {
  if (latest && Date.now() - latestAt < STALE_MS) return { ...latest, connected: true, source: 'elyx' };
  return { connected: false, source: 'elyx' };
}

let ble = null;
if (process.env.STRIDECAST_NO_BLE !== '1') {
  const KettlerBLE = require('./ble/kettlerBLE');
  ble = new KettlerBLE((message, ...args) => {
    if (message === 'reset') {
      kettler.reset();
      return true;
    }
    if (message === 'control') return true;
    if (message === 'power' && args.length > 0) {
      kettler.setPower(args[0]);
      return true;
    }
    return false;
  });
}

kettler.on('open', (path) => console.log(`Kettler console on ${path}`));
kettler.on('close', () => console.log('Kettler console disconnected'));
kettler.on('error', (error) => console.log(`Kettler: ${error?.message ?? error}`));
kettler.on('data', (data) => {
  latest = data;
  latestAt = Date.now();
  ble?.notifyFTMS(data);
});

setInterval(() => {
  const message = `data: ${JSON.stringify(now())}\n\n`;
  for (const res of liveClients) res.write(message);
}, 1000);

http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://bridge');
  if (pathname === '/api/now') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(now()));
  } else if (pathname === '/api/live') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify(now())}\n\n`);
    liveClients.add(res);
    req.on('close', () => liveClients.delete(res));
  } else if (req.method === 'GET' || req.method === 'HEAD') {
    serveStatic(WEB_ROOT, pathname, res);
  } else {
    res.writeHead(405).end();
  }
}).listen(PORT, () => console.log(`StrideCast bridge on port ${PORT}`));

kettler.start();
