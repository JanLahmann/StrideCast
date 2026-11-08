import assert from 'node:assert/strict';
import { test } from 'node:test';
import bridgeParse from '../bridge/parse.js';

const { parseStatus } = bridgeParse;

test('parseStatus reads an ELYX 5 ST answer', () => {
  // Lines logged from the ELYX 5 on 2026-10-29.
  assert.deepEqual(parseStatus('105\t063\t099\t000\t090\t0015\t00:29\t090'), {
    hr: 105, rpm: 63, speed: 9.9, distance: 0, targetPower: 90, energy: 15, elapsed: 29, power: 90,
  });
  assert.deepEqual(parseStatus('000\t062\t098\t001\t090\t0027\t00:51\t090\r'), {
    hr: 0, rpm: 62, speed: 9.8, distance: 0.1, targetPower: 90, energy: 27, elapsed: 51, power: 90,
  });
  assert.equal(parseStatus('000\t000\t000\t000\t025\t0000\t62:05\t025').elapsed, 3725);
});

test('parseStatus ignores other lines', () => {
  assert.equal(parseStatus('ACK'), null);
  assert.equal(parseStatus('130'), null);
  assert.equal(parseStatus('SDHX\tELYX 5'), null);
  assert.equal(parseStatus('00\t0\t0\t175'), null);
  // a fragment of two answers, as QZ used to read them
  assert.equal(parseStatus('0\t000\t001\t090\t0026\t00:49\t000\r\n000\t00'), null);
  assert.equal(parseStatus('105\t063\t099\t000\t090\t0015\t0029\t090'), null);
});

test('CrankCounter turns rpm into crank revolutions and event times', async () => {
  const { CrankCounter, encodePowerMeasurement } = (await import('../bridge/cycling-power.js')).default;
  const crank = new CrankCounter();
  assert.deepEqual(crank.update(60, 0), { revs: 0, eventTime: 0 });
  // 60 rpm for 1 s: one revolution, which happened exactly now
  assert.deepEqual(crank.update(60, 1000), { revs: 1, eventTime: 1024 });
  // 90 rpm for 1 s: 1.5 more revolutions, 2.5 in all; the last whole one was 1/3 s ago
  assert.deepEqual(crank.update(90, 2000), { revs: 2, eventTime: Math.round((2000 - 1000 / 3) * 1.024) });
  // standing still: nothing moves
  assert.deepEqual(crank.update(0, 3000), { revs: 2, eventTime: Math.round((2000 - 1000 / 3) * 1.024) });

  const buf = encodePowerMeasurement(150, { revs: 2, eventTime: 1707 });
  assert.deepEqual([...buf], [0x20, 0, 150, 0, 2, 0, 0xab, 0x06]);
});
