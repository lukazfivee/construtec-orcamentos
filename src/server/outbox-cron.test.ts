import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from './createApp';
import type { LocalDatabase } from './services/database';

const cloudEnv = {
  DATABASE_URL: 'postgresql://test.invalid/database',
  SESSION_SECRET: 'test-session-secret-with-at-least-32-characters',
  CONSTRUTEC_SETUP_TOKEN: 'test-setup-token-with-at-least-32-characters',
  CONSTRUTEC_ALLOWED_ORIGINS: 'https://orcamentos.example.com',
  CONSTRUTEC_INTEGRATION_KEY: 'i'.repeat(40),
};

test('reenvio da outbox pelo Cron exige a chave de integracao', async context => {
  const saved = Object.fromEntries(Object.keys(cloudEnv).map(key => [key, process.env[key]]));
  Object.assign(process.env, cloudEnv);
  context.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const database = { query: async () => ({ rows: [] }), exec: async () => undefined } as unknown as LocalDatabase;
  const server = createApp(database, 'local-token', 'ignored-secret').listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/internal/outbox/retry`;

  assert.equal((await fetch(url, { method: 'POST' })).status, 404);
  assert.equal((await fetch(url, { method: 'POST', headers: { 'X-Construtec-Integration-Key': 'x'.repeat(40) } })).status, 404);
  const ok = await fetch(url, { method: 'POST', headers: { 'X-Construtec-Integration-Key': cloudEnv.CONSTRUTEC_INTEGRATION_KEY } });
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { attempted: 0 });
});

test('passada do Cron considera pendencias que o laco de 30s esgotou', async () => {
  const { runOutboxRetryPass, CRON_MAX_ATTEMPTS } = await import('./services/outboxRetryWorker');
  const seen: unknown[][] = [];
  const database = { query: async (_sql: string, params: unknown[]) => { seen.push(params); return { rows: [] }; }, exec: async () => undefined } as unknown as LocalDatabase;
  await runOutboxRetryPass(database);
  await runOutboxRetryPass(database, CRON_MAX_ATTEMPTS);
  assert.deepEqual(seen.map(params => params[0]), [5, 72]);
});
