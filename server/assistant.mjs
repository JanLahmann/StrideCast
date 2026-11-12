#!/usr/bin/env node
// Voice commands with a local model: Jan dictates (VoiceInk pastes the text into the Chrome
// page, where extension/voice.js picks it up), the model in LM Studio picks a tool of the
// control MCP server (mcp/control.mjs), and the tool runs through the extension.
//
//   extension  POST /api/ask {text} → {ok, reply, actions: [{tool, args, ok}]}
//
// Fast path: a command (pause, show a tab, search YouTube) runs right after the model has
// picked its tools, without a second round for a confirmation sentence. Only questions
// (live values, open tabs) go back to the model for an answer in words.
//
// The model runs in LM Studio on this Mac (LMSTUDIO_URL, default http://127.0.0.1:1234,
// model STRIDECAST_MODEL, default "gemma"). LM Studio's API token, if authentication is on,
// is read from ~/.config/lmstudio/token and never printed.
//
// Command line: node server/assistant.mjs "pause the video" (the dev server must run).

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allowed } from './control.mjs';
import { callTool, tools } from '../mcp/control.mjs';

const LMSTUDIO = (process.env.LMSTUDIO_URL ?? 'http://127.0.0.1:1234').replace(/\/$/, '');
const MODEL = process.env.STRIDECAST_MODEL ?? 'gemma';
const TOKEN_FILE = join(homedir(), '.config', 'lmstudio', 'token');

// Tools whose result is the answer to a question; everything else is a command.
const ANSWER_TOOLS = new Set(['live', 'list_tabs']);

export const SYSTEM = [
  'Du steuerst per Sprachbefehl Chrome auf Jans Mac. Jan trainiert dabei auf dem Crosstrainer.',
  'Die Befehle kommen aus einer Spracherkennung, auf Deutsch oder Englisch; einzelne Wörter können falsch erkannt sein.',
  'Wähle das passende Werkzeug und rufe es sofort auf, ohne Rückfrage.',
  'Braucht ein Befehl mehrere Schritte (z. B. suchen und dann das zweite Video öffnen), rufe alle Werkzeuge in derselben Antwort nacheinander auf.',
  'Fragen nach Leistung, Puls, Trittfrequenz, Strecke oder Zeit beantwortest du mit dem Werkzeug live.',
  'Antworte immer auf Deutsch in einem kurzen Satz.',
].join(' ');

const chatTools = tools.map((t) => ({
  type: 'function',
  function: { name: t.name, description: t.description, parameters: t.inputSchema },
}));

// Gemma writes its (empty) thinking channel into the text: <|channel>thought<channel|>…
export function clean(text) {
  return (text ?? '')
    .replace(/<\|channel>[\s\S]*?<channel\|>/g, '')
    .replace(/<\|?\/?(channel|turn|start_of_turn|end_of_turn)\|?>/g, '')
    .trim();
}

function token() {
  try {
    return readFileSync(TOKEN_FILE, 'utf8').trim();
  } catch {
    return '';
  }
}

// One request to LM Studio's OpenAI-compatible API; resolves with the assistant message.
export async function chat(body, fetchImpl = fetch) {
  const key = token();
  const res = await fetchImpl(`${LMSTUDIO}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key && { Authorization: `Bearer ${key}` }) },
    body: JSON.stringify({ model: MODEL, max_tokens: 300, temperature: 0.2, ...body }),
    signal: AbortSignal.timeout(180000),
  });
  if (res.status === 401) throw new Error(`LM Studio wants an API token (${TOKEN_FILE})`);
  if (!res.ok) throw new Error(`LM Studio: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).choices[0].message;
}

// A short line for a command that ran, e.g. "media pause" → "✓ media: pause".
function done(action) {
  const values = Object.values(action.args ?? {}).join(', ');
  return `${action.ok ? '✓' : '✗'} ${action.tool}${values ? `: ${values}` : ''}`;
}

// Runs one spoken command. chatImpl(body) → assistant message; runTool(name, args) →
// {ok, result} or {ok: false, error}.
export async function ask(text, { chatImpl = chat, runTool } = {}) {
  const messages = [{ role: 'system', content: SYSTEM }, { role: 'user', content: text }];
  const first = await chatImpl({ messages, tools: chatTools });
  const calls = first.tool_calls ?? [];
  if (!calls.length) return { ok: true, reply: clean(first.content) || '?', actions: [] };

  messages.push({ ...first, content: clean(first.content) });
  const actions = [];
  for (const call of calls) {
    let args;
    try {
      args = JSON.parse(call.function.arguments || '{}');
    } catch {
      args = {};
    }
    const answer = await runTool(call.function.name, args);
    actions.push({ tool: call.function.name, args, ok: answer.ok });
    const content = answer.ok ? JSON.stringify(answer.result) : `Error: ${answer.error}`;
    messages.push({ role: 'tool', tool_call_id: call.id, content });
    if (!answer.ok) return { ok: false, reply: `${done(actions.at(-1))}: ${answer.error}`, actions };
  }

  if (!actions.some((a) => ANSWER_TOOLS.has(a.tool))) {
    return { ok: true, reply: actions.map(done).join(' · '), actions };
  }
  const second = await chatImpl({ messages, tools: chatTools });
  return { ok: true, reply: clean(second.content) || actions.map(done).join(' · '), actions };
}

// Loads the model and its prompt before the first command, so that one isn't slow.
export async function warmUp(chatImpl = chat) {
  const t0 = Date.now();
  await chatImpl({ messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: 'ok' }], tools: chatTools, max_tokens: 1 });
  return Date.now() - t0;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 8192) req.destroy();
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch (error) { reject(error); }
    });
    req.on('error', reject);
  });
}

// For the dev server: true when the request was /api/ask. base is the dev server's own
// address, where the tools go (/api/control, /api/now).
export function handleAssistant(pathname, req, res, base) {
  if (pathname !== '/api/ask') return false;
  if (!allowed(req.headers)) {
    res.writeHead(403).end();
    return true;
  }
  if (req.method !== 'POST') {
    res.writeHead(405).end();
    return true;
  }
  const reply = (body) => {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  readJson(req).then(async ({ text }) => {
    if (typeof text !== 'string' || !text.trim()) return reply({ ok: false, reply: 'kein Text' });
    const t0 = Date.now();
    try {
      const answer = await ask(text.trim().slice(0, 500), { runTool: (name, args) => callTool(name, args, fetch, base) });
      console.log(`voice: "${text.trim()}" → ${answer.reply} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
      reply(answer);
    } catch (error) {
      console.log(`voice: "${text.trim()}" failed: ${error.message}`);
      reply({ ok: false, reply: error.message, actions: [] });
    }
  }, () => res.writeHead(400).end());
  return true;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const base = process.env.STRIDECAST_DEV ?? 'http://127.0.0.1:3700';
  const res = await fetch(`${base}/api/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-StrideCast-Control': '1' },
    body: JSON.stringify({ text: process.argv.slice(2).join(' ') }),
  });
  console.log((await res.json()).reply);
}
