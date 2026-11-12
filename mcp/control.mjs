#!/usr/bin/env node
// StrideCast remote control as an MCP server (stdio), for Claude Code and for a local model in
// LM Studio. Each tool goes to the dev server (server/control.mjs, `npm run dev` or
// `npm run dev:pi` must run), which hands it to the Chrome extension.
//
// Control only: the answers say what happened, never what a page shows (no mail, chat or
// tab titles). Reading content is a separate server, for a local model only.
//
// No dependencies: MCP over stdio is JSON-RPC 2.0, one message per line.

import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const BASE = process.env.STRIDECAST_DEV ?? 'http://127.0.0.1:3700';
const TABS = ['youtube', 'music', 'tv', 'whatsapp', 'teams', 'outlook', 'printer', 'prusa'];

export const tools = [
  {
    name: 'show_tab',
    description: 'Bring a Chrome tab to the front (opens it if none is open). youtube, music (YouTube Music), tv (Fire TV through the capture card with live values), whatsapp, teams, outlook, printer (PrusaLink on the Core One), prusa (Prusa Connect).',
    inputSchema: { type: 'object', properties: { tab: { type: 'string', enum: TABS } }, required: ['tab'] },
  },
  {
    name: 'list_tabs',
    description: 'Which of the known tabs are open in Chrome (names and counts only).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'media',
    description: 'Control the video in the front tab, or in the named tab: play, pause, toggle, forward/back (value = seconds, default 10), restart, volume (value = 0-100), mute, unmute, next (next YouTube video), fullscreen (toggles the Chrome window full screen).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['play', 'pause', 'toggle', 'forward', 'back', 'restart', 'volume', 'mute', 'unmute', 'next', 'fullscreen'] },
        value: { type: 'number' },
        tab: { type: 'string', enum: TABS },
      },
      required: ['action'],
    },
  },
  {
    name: 'youtube_search',
    description: 'Search YouTube in the YouTube tab and show the results.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'youtube_open',
    description: 'Open the n-th video of the list on the YouTube page (search results or home), counting from 1.',
    inputSchema: { type: 'object', properties: { n: { type: 'integer', minimum: 1 } } },
  },
  {
    name: 'tv',
    description: 'StrideCast TV page (Fire TV through the capture card): start, stop, camera (cycles off → printer → rig), values (show or hide the live values).',
    inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['start', 'stop', 'camera', 'values'] } }, required: ['action'] },
  },
  {
    name: 'overlay',
    description: 'The StrideCast overlay in the front tab: bar, panel (with a 10-minute chart) or hidden.',
    inputSchema: { type: 'object', properties: { mode: { type: 'string', enum: ['bar', 'panel', 'hidden'] } }, required: ['mode'] },
  },
  {
    name: 'live',
    description: 'The current cross-trainer values: power (W), rpm, speed (km/h), heart rate (bpm), distance (km), energy (kJ), elapsed time (s).',
    inputSchema: { type: 'object', properties: {} },
  },
];

async function callTool(name, args, fetchImpl) {
  if (name === 'live') {
    const res = await fetchImpl(`${BASE}/api/now`, { signal: AbortSignal.timeout(3000) });
    return { ok: true, result: await res.json() };
  }
  if (!tools.some((t) => t.name === name)) return { ok: false, error: `unknown tool "${name}"` };
  const res = await fetchImpl(`${BASE}/api/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-StrideCast-Control': '1' },
    body: JSON.stringify({ command: name, args }),
    signal: AbortSignal.timeout(15000),
  });
  return res.json();
}

// Answers one JSON-RPC message; null for notifications.
export async function handle(message, fetchImpl = fetch) {
  const { id, method, params } = message;
  const reply = (result) => ({ jsonrpc: '2.0', id, result });
  switch (method) {
    case 'initialize':
      return reply({
        protocolVersion: params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'stridecast-control', version: '0.1.0' },
      });
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools });
    case 'tools/call': {
      let answer;
      try {
        answer = await callTool(params?.name, params?.arguments ?? {}, fetchImpl);
      } catch (error) {
        answer = { ok: false, error: `StrideCast dev server not reachable at ${BASE} (npm run dev:pi): ${error.message}` };
      }
      const text = answer.ok ? JSON.stringify(answer.result) : `Error: ${answer.error}`;
      return reply({ content: [{ type: 'text', text }], isError: !answer.ok });
    }
    default:
      if (id === undefined) return null; // a notification, e.g. notifications/initialized
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } };
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const lines = createInterface({ input: process.stdin });
  lines.on('line', async (line) => {
    if (!line.trim()) return;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } })}\n`);
      return;
    }
    const answer = await handle(message);
    if (answer) process.stdout.write(`${JSON.stringify(answer)}\n`);
  });
}
