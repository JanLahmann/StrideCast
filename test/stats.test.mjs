import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSimulator } from '../server/simulator.mjs';
import { formatTime, formatValue, playbackRate, snapRate, youtubeId } from '../web/assets/stats.js';

test('formatTime', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(1477), '24:37');
  assert.equal(formatTime(3725), '1:02:05');
  assert.equal(formatTime(-3), '0:00');
});

test('formatValue', () => {
  const d = { power: 90.4, speed: 9.94, distance: 4.0618, hr: 0, elapsed: 1477 };
  assert.equal(formatValue('power', d), '90');
  assert.equal(formatValue('speed', d), '9.9');
  assert.equal(formatValue('distance', d), '4.06');
  assert.equal(formatValue('hr', d), '–');
  assert.equal(formatValue('elapsed', d), '24:37');
  assert.equal(formatValue('rpm', d), '–');
  assert.equal(formatValue('power', null), '–');
});

test('playbackRate', () => {
  assert.equal(playbackRate(9.9, 10.5), 0.94);
  assert.equal(playbackRate(0, 10), 0);
  assert.equal(playbackRate(0.5, 10), 0);
  assert.equal(playbackRate(40, 10), 2);
  assert.equal(playbackRate(1, 10), 0.25);
  assert.equal(playbackRate(9.9, 0), 0);
});

test('snapRate', () => {
  const youtube = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  assert.equal(snapRate(0.94, youtube), 1);
  assert.equal(snapRate(0.6, youtube), 0.5);
  assert.equal(snapRate(0, youtube), 0);
  assert.equal(snapRate(0.94, []), 0.94);
});

test('youtubeId', () => {
  const id = 'dQw4w9WgXcQ';
  assert.equal(youtubeId(`https://www.youtube.com/watch?v=${id}&t=30s`), id);
  assert.equal(youtubeId(`https://youtu.be/${id}?si=abc`), id);
  assert.equal(youtubeId(`https://www.youtube.com/embed/${id}`), id);
  assert.equal(youtubeId(`https://m.youtube.com/shorts/${id}`), id);
  assert.equal(youtubeId(id), id);
  assert.equal(youtubeId('https://example.com/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(youtubeId('https://www.youtube.com/playlist?list=PL123'), null);
  assert.equal(youtubeId('not a link'), null);
});

test('simulator integrates distance and energy', () => {
  const sim = createSimulator();
  let d;
  for (let i = 0; i < 600; i++) d = sim.tick(1);
  assert.equal(d.elapsed, 600);
  assert.equal(d.source, 'example');
  assert.ok(d.rpm >= 57 && d.rpm <= 69, `rpm ${d.rpm}`);
  // About 10 km/h for 10 minutes is about 1.6 km; about 90 W for 600 s is about 54 kJ.
  assert.ok(d.distance > 1.4 && d.distance < 1.8, `distance ${d.distance}`);
  assert.ok(d.energy > 45 && d.energy < 63, `energy ${d.energy}`);
});
