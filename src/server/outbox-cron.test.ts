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
  const server = createApp(database, 'local-token').listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/internal/outbox/retry`;

  assert.equal((await fetch(url, { method: 'POST' })).status, 404);
  assert.equal((await fetch(url, { method: 'POST', headers: { 'X-Construtec-Integration-Key': 'x'.repeat(40) } })).status, 404);
  const ok = await fetch(url, { method: 'POST', headers: { 'X-Construtec-Integration-Key': cloudEnv.CONSTRUTEC_INTEGRATION_KEY } });
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { attempted: 0, refreshed: 0 });
});

test('passada do Cron considera pendencias que o laco de 30s esgotou', async () => {
  const { runOutboxRetryPass, CRON_MAX_ATTEMPTS } = await import('./services/outboxRetryWorker');
  const seen: unknown[][] = [];
  const database = { query: async (_sql: string, params: unknown[]) => { seen.push(params); return { rows: [] }; }, exec: async () => undefined } as unknown as LocalDatabase;
  await runOutboxRetryPass(database);
  await runOutboxRetryPass(database, CRON_MAX_ATTEMPTS);
  assert.deepEqual(seen.map(params => params[0]), [5, 72]);
});

test('reserva da outbox e atomica: duas passadas nao pegam a mesma linha; esgotadas viram failed', async context => {
  const { createCriticalTestDatabase } = await import('./services/criticalTestDatabase');
  const { updateProposalStatus } = await import('./services/proposals');
  const { claimOutboxBatch, failExhaustedOutbox, CRON_MAX_ATTEMPTS } = await import('./services/outboxRetryWorker');
  const { database, userId, makeProposal, addMaterial } = await createCriticalTestDatabase();
  context.after(() => database.close());
  const ids: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    const id = await makeProposal();
    await addMaterial(id);
    await updateProposalStatus(database, id, 'approved', userId);
    ids.push(id);
  }
  const first = await claimOutboxBatch(database, 5, 2);
  const second = await claimOutboxBatch(database, 5, 5);
  assert.equal(first.length, 2);
  assert.equal(second.length, 1);
  const all = [...first, ...second].map(row => row.outbox_id);
  assert.equal(new Set(all).size, 3);
  assert.equal((await claimOutboxBatch(database, 5)).length, 0);

  // Reserva vencida (processo caiu) volta a ser elegivel.
  await database.query("UPDATE integration_outbox SET claimed_at = now() - interval '10 minutes' WHERE id = $1", [all[0]]);
  assert.deepEqual((await claimOutboxBatch(database, 5)).map(row => row.outbox_id), [all[0]]);

  // Esgotadas: 72 tentativas -> failed; abaixo disso continua pending.
  await database.query('UPDATE integration_outbox SET attempts = $2 WHERE id = $1', [all[1], CRON_MAX_ATTEMPTS]);
  await database.query('UPDATE integration_outbox SET attempts = $2 WHERE id = $1', [all[2], CRON_MAX_ATTEMPTS - 1]);
  assert.equal(await failExhaustedOutbox(database), 1);
  const status = async (id: string) => (await database.query<{ status: string }>('SELECT status FROM integration_outbox WHERE id = $1', [id])).rows[0].status;
  assert.equal(await status(all[1]), 'failed');
  assert.equal(await status(all[2]), 'pending');
  assert.equal(await status(all[0]), 'pending');
});
