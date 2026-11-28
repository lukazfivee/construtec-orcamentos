import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startCloudNoticeRefresh } from './cloudNoticeRefresh';

const fixture = (hidden = false) => {
  const page = Object.assign(new EventTarget(), { hidden });
  const windowEvents = new EventTarget();
  let elapsed = 0;
  const requests: number[] = [];
  const stop = startCloudNoticeRefresh(page, windowEvents, () => { requests.push(elapsed); }, () => elapsed);
  const event = (at: number, name: string, target = page as EventTarget) => {
    elapsed = at;
    target.dispatchEvent(new Event(name));
  };
  return { page, windowEvents, requests, stop, event };
};

test('lê o sino ao abrir, não recorrendo ao servidor depois que a aba fica ociosa', () => {
  const f = fixture();
  assert.deepEqual(f.requests, [0]);
  f.event(119_999, 'keydown');
  assert.deepEqual(f.requests, [0]);
  f.event(900_000, 'pointerdown');
  assert.deepEqual(f.requests, [0, 900_000]);
  f.event(900_001, 'keydown');
  assert.deepEqual(f.requests, [0, 900_000]);
  f.stop();
});

test('não consulta em aba oculta e agrupa foco e visibilidade ao voltar', () => {
  const f = fixture(true);
  f.event(150_000, 'pointerdown');
  f.event(150_001, 'focus', f.windowEvents);
  assert.deepEqual(f.requests, []);
  f.page.hidden = false;
  f.event(150_002, 'visibilitychange');
  f.event(150_003, 'focus', f.windowEvents);
  f.event(150_004, 'keydown');
  assert.deepEqual(f.requests, [150_002]);
  f.event(153_000, 'focus', f.windowEvents);
  assert.deepEqual(f.requests, [150_002, 153_000]);
  f.stop();
  f.event(400_000, 'visibilitychange');
  f.event(400_001, 'focus', f.windowEvents);
  f.event(400_002, 'keydown');
  f.event(400_003, 'pointerdown');
  assert.deepEqual(f.requests, [150_002, 153_000]);
});
