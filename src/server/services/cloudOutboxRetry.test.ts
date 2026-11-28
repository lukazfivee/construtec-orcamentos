import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOnDemandOutboxRetry } from './cloudOutboxRetry';

const INTERVAL = 30_000;
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

test('fila rápida na nuvem não consulta o banco ocioso, nem depois de confirmar fila vazia', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let passes = 0;
  const worker = createOnDemandOutboxRetry(async () => { passes += 1; return 0; });
  context.after(worker.stop);
  context.mock.timers.tick(6 * INTERVAL);
  assert.equal(passes, 0);

  worker.notify();
  worker.notify();
  context.mock.timers.tick(INTERVAL);
  await flush();
  assert.equal(passes, 1);
  context.mock.timers.tick(6 * INTERVAL);
  assert.equal(passes, 1);

  worker.notify();
  context.mock.timers.tick(INTERVAL);
  await flush();
  assert.equal(passes, 2);
});

test('fila rápida preserva novo sinal durante consulta e não roda passadas concorrentes', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let passes = 0;
  let complete: (value: number) => void = () => assert.fail('passada ainda não começou');
  const worker = createOnDemandOutboxRetry(() => {
    passes += 1;
    return new Promise<number>(resolve => { complete = resolve; });
  });
  context.after(worker.stop);

  worker.notify();
  context.mock.timers.tick(INTERVAL);
  assert.equal(passes, 1);
  worker.notify();
  context.mock.timers.tick(2 * INTERVAL);
  assert.equal(passes, 1);

  complete(0);
  await flush();
  context.mock.timers.tick(INTERVAL);
  assert.equal(passes, 2);
  worker.stop();
  complete(1);
  await flush();
  context.mock.timers.tick(INTERVAL);
  assert.equal(passes, 2);
});

test('fila rápida limita a sequência de reenvios e para em indisponibilidade', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let unavailable = false;
  let passes = 0;
  const worker = createOnDemandOutboxRetry(async () => {
    passes += 1;
    if (unavailable) throw new Error('database unavailable');
    return 1;
  });
  context.after(worker.stop);

  worker.notify();
  for (let i = 0; i < 8; i += 1) {
    context.mock.timers.tick(INTERVAL);
    await flush();
  }
  assert.equal(passes, 5);
  unavailable = true;
  worker.notify();
  for (let i = 0; i < 3; i += 1) {
    context.mock.timers.tick(INTERVAL);
    await flush();
  }
  assert.equal(passes, 6);
});
