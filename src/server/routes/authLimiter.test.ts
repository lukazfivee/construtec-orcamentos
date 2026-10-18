import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAuthLimiter } from './auth';

test('limite local do login: 20 por IP a cada 10 minutos, baldes separados e janela que reabre', () => {
  let now = 1_000_000;
  const limited = createAuthLimiter(() => now);
  for (let i = 0; i < 20; i += 1) assert.equal(limited('203.0.113.1'), false);
  assert.equal(limited('203.0.113.1'), true);
  assert.equal(limited('203.0.113.2'), false);
  now += 10 * 60_000 + 1;
  assert.equal(limited('203.0.113.1'), false);
});

test('limite local do login: sem IP confiavel todos dividem um balde maior (120)', () => {
  const limited = createAuthLimiter(() => 5_000_000);
  for (let i = 0; i < 120; i += 1) assert.equal(limited(undefined), false);
  assert.equal(limited(undefined), true);
});
