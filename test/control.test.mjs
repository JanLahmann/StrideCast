import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allowed, createControlRelay } from '../server/control.mjs';
import { handle, tools } from '../mcp/control.mjs';

test('a command goes to the next poll and its answer comes back', async () => {
  const relay = createControlRelay();
  const sent = relay.send('show_tab', { tab: 'youtube' });
  const command = await relay.next(1000);
  assert.deepEqual({ command: command.command, args: command.args }, { command: 'show_tab', args: { tab: 'youtube' } });
  assert.equal(relay.answer(command.id, { ok: true, result: { shown: 'youtube' } }), true);
  assert.deepEqual(await sent, { ok: true, result: { shown: 'youtube' } });
});

test('a poll waiting before the command gets it', async () => {
  const relay = createControlRelay();
  const poll = relay.next(1000);
  relay.send('media', { action: 'pause' }, 1000);
  assert.equal((await poll).command, 'media');
});

test('a command taken by a poll that went away goes to the next poll', async () => {
  const relay = createControlRelay();
  const sent = relay.send('media', { action: 'pause' }, 1000);
  relay.requeue(await relay.next(1000));
  const again = await relay.next(1000);
  relay.answer(again.id, { ok: true, result: {} });
  assert.deepEqual(await sent, { ok: true, result: {} });
});

test('a poll that closed gets no command', async () => {
  const relay = createControlRelay();
  const closed = new AbortController();
  const gone = relay.next(1000, closed.signal);
  closed.abort();
  assert.equal(await gone, null);
  const sent = relay.send('media', { action: 'pause' }, 1000);
  const command = await relay.next(1000);
  relay.answer(command.id, { ok: true, result: 'second poll' });
  assert.equal((await sent).result, 'second poll');
});

test('without an extension the sender gets an error, and the poll times out empty', async () => {
  const relay = createControlRelay();
  const answer = await relay.send('media', { action: 'pause' }, 20);
  assert.equal(answer.ok, false);
  assert.match(answer.error, /not connected/);
  assert.equal(await relay.next(20), null);
});

test('only requests with the header and without a web page origin are allowed', () => {
  assert.equal(allowed({ 'x-stridecast-control': '1' }), true);
  assert.equal(allowed({ 'x-stridecast-control': '1', origin: 'chrome-extension://abc' }), true);
  assert.equal(allowed({ 'x-stridecast-control': '1', origin: 'https://evil.example' }), false);
  assert.equal(allowed({}), false);
});

test('the MCP server lists its tools and forwards a call', async () => {
  const init = await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  assert.equal(init.result.serverInfo.name, 'stridecast-control');
  const list = await handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.deepEqual(list.result.tools.map((t) => t.name), tools.map((t) => t.name));
  assert.equal(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);

  let request;
  const fakeFetch = async (url, options) => {
    request = { url, body: JSON.parse(options.body), header: options.headers['X-StrideCast-Control'] };
    return { json: async () => ({ ok: true, result: { shown: 'tv', opened: false } }) };
  };
  const call = await handle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'show_tab', arguments: { tab: 'tv' } } }, fakeFetch);
  assert.match(request.url, /\/api\/control$/);
  assert.deepEqual(request.body, { command: 'show_tab', args: { tab: 'tv' } });
  assert.equal(request.header, '1');
  assert.equal(call.result.isError, false);
  assert.deepEqual(JSON.parse(call.result.content[0].text), { shown: 'tv', opened: false });
});

test('an unreachable dev server becomes a tool error, not a crash', async () => {
  const call = await handle({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'media', arguments: { action: 'pause' } } },
    async () => { throw new Error('connect ECONNREFUSED'); });
  assert.equal(call.result.isError, true);
  assert.match(call.result.content[0].text, /not reachable/);
});

test('the extension knows every tab name the MCP server offers', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../extension/control.js', import.meta.url), 'utf8');
  for (const name of tools.find((t) => t.name === 'show_tab').inputSchema.properties.tab.enum) {
    assert.match(source, new RegExp(`\\b${name}: \\{\\s+match:`), `extension/control.js has no tab "${name}"`);
  }
  for (const tool of tools.filter((t) => t.name !== 'live')) {
    assert.match(source, new RegExp(`async ${tool.name}\\(`), `extension/control.js has no command "${tool.name}"`);
  }
});
