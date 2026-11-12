import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ask, clean } from '../server/assistant.mjs';

const call = (name, args = {}) => ({ id: `call-${name}`, type: 'function', function: { name, arguments: JSON.stringify(args) } });

// A fake model: answers each request with the next message from the list.
function model(...answers) {
  const requests = [];
  return { requests, chatImpl: async (body) => { requests.push(body); return answers.shift(); } };
}

test('a command runs without a second round', async () => {
  const { requests, chatImpl } = model({ role: 'assistant', content: '', tool_calls: [call('media', { action: 'pause' })] });
  const ran = [];
  const answer = await ask('Pause bitte', { chatImpl, runTool: async (name, args) => { ran.push([name, args]); return { ok: true, result: { media: 'pause' } }; } });
  assert.deepEqual(ran, [['media', { action: 'pause' }]]);
  assert.equal(requests.length, 1);
  assert.deepEqual(answer, { ok: true, reply: '✓ media: pause', actions: [{ tool: 'media', args: { action: 'pause' }, ok: true }] });
});

test('several tools in one answer run in order', async () => {
  const { chatImpl } = model({ role: 'assistant', tool_calls: [call('youtube_search', { query: 'wingfoil' }), call('youtube_open', { n: 2 })] });
  const ran = [];
  await ask('Such Wingfoil und spiel das zweite', { chatImpl, runTool: async (name) => { ran.push(name); return { ok: true, result: {} }; } });
  assert.deepEqual(ran, ['youtube_search', 'youtube_open']);
});

test('a question goes back to the model for an answer in words', async () => {
  const { requests, chatImpl } = model(
    { role: 'assistant', content: '', tool_calls: [call('live')] },
    { role: 'assistant', content: '<|channel>thought\n<channel|>Du trittst 142 W.' },
  );
  const answer = await ask('Wie viel Watt?', { chatImpl, runTool: async () => ({ ok: true, result: { power: 142 } }) });
  assert.equal(requests.length, 2);
  assert.equal(requests[1].messages.at(-1).content, '{"power":142}');
  assert.equal(answer.reply, 'Du trittst 142 W.');
});

test('a failed tool stops and says why', async () => {
  const { chatImpl } = model({ role: 'assistant', tool_calls: [call('tv', { action: 'start' }), call('media', { action: 'play' })] });
  const ran = [];
  const answer = await ask('Fernseher an', { chatImpl, runTool: async (name) => { ran.push(name); return { ok: false, error: 'the extension is not connected' }; } });
  assert.deepEqual(ran, ['tv']);
  assert.equal(answer.ok, false);
  assert.equal(answer.reply, '✗ tv: start: the extension is not connected');
});

test('an answer without tools is passed on, cleaned', async () => {
  const { chatImpl } = model({ role: 'assistant', content: '<|channel>thought\n<channel|>Das kann ich nicht.' });
  assert.equal((await ask('Koch Kaffee', { chatImpl, runTool: async () => assert.fail() })).reply, 'Das kann ich nicht.');
});

test('clean removes the thinking channel', () => {
  assert.equal(clean('<|channel>thought\nlet me see<channel|>Erledigt.'), 'Erledigt.');
  assert.equal(clean(null), '');
});
