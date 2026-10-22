import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { noticeGroup, noticeHour } from './notificationsFeed';

test('avisos com data inválida não exibem Invalid Date', () => {
  assert.equal(noticeGroup('data inválida', new Date('2026-10-22T12:00:00Z')), 'Anteriores');
  assert.equal(noticeHour('data inválida'), '');
});

test('celular usa a mesma proteção para data inválida', () => {
  const mobile = readFileSync('public/m/screen-avisos.js', 'utf8');
  assert.match(mobile, /Number\.isNaN\(date\.getTime\(\)\) \? null/);
  assert.match(mobile, /Number\.isNaN\(date\.getTime\(\)\) \? '' : date\.toLocaleString/);
});
