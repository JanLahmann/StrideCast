// Remote control relay: a command (switch tabs, pause the video, …) goes from a local client
// (the MCP server in mcp/control.mjs) to the Chrome extension and its answer comes back.
//
//   client     POST /api/control      {command, args}  → waits for the extension's answer
//   extension  GET  /__control/next   long poll, gets the next command (or 204)
//   extension  POST /__control/result {id, ok, result | error}
//
// The server listens on 127.0.0.1 only. A web page in the browser can still reach that
// address, so every request needs the X-StrideCast-Control header (a page can't set it
// without a CORS preflight, which this server never allows), and a browser Origin other than
// the extension's is refused.

export const CONTROL_HEADER = 'x-stridecast-control';

export function createControlRelay() {
  const queue = []; // commands no extension has taken yet
  const waitingPolls = []; // extension polls waiting for a command
  const pending = new Map(); // id → resolve, for commands sent and not yet answered
  let nextId = 1;
  let lastPoll = 0;

  function deliver() {
    while (queue.length && waitingPolls.length) waitingPolls.shift()(queue.shift());
  }

  return {
    // Resolves with the extension's answer: {ok, result} or {ok: false, error}.
    send(command, args = {}, timeoutMs = 10000) {
      const id = nextId++;
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          const i = queue.findIndex((c) => c.id === id);
          if (i >= 0) queue.splice(i, 1);
          const recent = Date.now() - lastPoll < 60000;
          resolve({ ok: false, error: recent ? 'the extension did not answer in time' : 'the extension is not connected (is Chrome open, with the StrideCast extension loaded?)' });
        }, timeoutMs);
        pending.set(id, (answer) => { clearTimeout(timer); pending.delete(id); resolve(answer); });
        queue.push({ id, command, args });
        deliver();
      });
    },
    // The extension's long poll: resolves with the next command, or null after timeoutMs or
    // when the signal aborts (the poll's connection closed).
    next(timeoutMs = 25000, signal) {
      lastPoll = Date.now();
      return new Promise((resolve) => {
        const stop = () => {
          clearTimeout(timer);
          const i = waitingPolls.indexOf(take);
          if (i >= 0) waitingPolls.splice(i, 1);
          resolve(null);
        };
        const take = (command) => { clearTimeout(timer); signal?.removeEventListener('abort', stop); resolve(command); };
        const timer = setTimeout(stop, timeoutMs);
        signal?.addEventListener('abort', stop);
        waitingPolls.push(take);
        deliver();
      });
    },
    // A command taken by a poll that closed before it could go out: first in line again.
    requeue(command) {
      if (!pending.has(command.id)) return;
      queue.unshift(command);
      deliver();
    },
    answer(id, answer) {
      const done = pending.get(id);
      if (!done) return false;
      done(answer);
      return true;
    },
  };
}

const relay = createControlRelay();

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 65536) req.destroy();
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch (error) { reject(error); }
    });
    req.on('error', reject);
  });
}

export function allowed(headers) {
  if (headers[CONTROL_HEADER] !== '1') return false;
  const origin = headers.origin;
  return !origin || origin.startsWith('chrome-extension://');
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

// Returns true when the request was a control request.
export function handleControl(pathname, req, res) {
  const routes = ['/api/control', '/__control/next', '/__control/result'];
  if (!routes.includes(pathname)) return false;
  if (!allowed(req.headers)) {
    res.writeHead(403).end();
    return true;
  }
  if (pathname === '/__control/next' && req.method === 'GET') {
    const closed = new AbortController();
    // res, not req: a GET's request side counts as closed as soon as it has been read.
    res.on('close', () => { if (!res.writableEnded) closed.abort(); });
    relay.next(25000, closed.signal).then((command) => {
      if (closed.signal.aborted) {
        // The poll was closed before the command could go out; the next poll gets it.
        if (command) relay.requeue(command);
        return;
      }
      if (command) json(res, 200, command);
      else res.writeHead(204).end();
    });
  } else if (pathname === '/__control/result' && req.method === 'POST') {
    readJson(req).then(({ id, ...answer }) => json(res, 200, { taken: relay.answer(id, answer) }),
      () => res.writeHead(400).end());
  } else if (pathname === '/api/control' && req.method === 'POST') {
    readJson(req).then(async ({ command, args }) => {
      if (typeof command !== 'string') return json(res, 400, { ok: false, error: 'no command' });
      json(res, 200, await relay.send(command, args));
    }, () => res.writeHead(400).end());
  } else {
    res.writeHead(405).end();
  }
  return true;
}
