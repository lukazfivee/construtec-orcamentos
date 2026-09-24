import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp, getCloudSecurity } from './createApp';
import type { LocalDatabase } from './services/database';

const cloudEnv = {
  DATABASE_URL: 'postgresql://test.invalid/database',
  SESSION_SECRET: 'test-session-secret-with-at-least-32-characters',
  CONSTRUTEC_SETUP_TOKEN: 'test-setup-token-with-at-least-32-characters',
  CONSTRUTEC_ALLOWED_ORIGINS: 'https://orcamentos.example.com',
};

test('cloud requires persistent secrets and exact HTTPS origins', () => {
  assert.equal(getCloudSecurity({}), undefined);
  assert.throws(() => getCloudSecurity({ DATABASE_URL: cloudEnv.DATABASE_URL }), /SESSION_SECRET/);
  assert.throws(() => getCloudSecurity({ ...cloudEnv, CONSTRUTEC_SETUP_TOKEN: '' }), /SETUP_TOKEN/);
  for (const origin of ['', '*', 'http://example.com', 'https://example.com/path', 'https://user:password@example.com']) {
    assert.throws(() => getCloudSecurity({ ...cloudEnv, CONSTRUTEC_ALLOWED_ORIGINS: origin }), /ALLOWED_ORIGINS/);
  }
  assert.equal(getCloudSecurity(cloudEnv)?.sessionSecret, cloudEnv.SESSION_SECRET);
});

test('cloud HTTP protects bootstrap, checks database and hides internal errors', async context => {
  const saved = Object.fromEntries(Object.keys(cloudEnv).map(key => [key, process.env[key]]));
  Object.assign(process.env, cloudEnv);
  context.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  let unavailable = false;
  let calls = 0;
  const database = {
    query: async () => {
      calls++;
      if (unavailable) throw new Error('postgresql://user:private-password@secret-host/database');
      return { rows: [{ now: 'test', count: '0' }] };
    },
  } as unknown as LocalDatabase;
  const app = createApp(database, 'local-token');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const origin = cloudEnv.CONSTRUTEC_ALLOWED_ORIGINS;
  const health = await fetch(`${base}/health`, { headers: { Origin: origin } });
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal((await health.json()).storage, 'postgresql');
  assert.equal(calls, 1);
  for (const denied of ['null', 'http://localhost:5173', 'https://orcamentos.example.com.evil.test']) {
    assert.equal((await fetch(`${base}/health`, { headers: { Origin: denied } })).status, 403);
  }
  for (const path of ['/api/auth/setup', '/API/AUTH/SETUP/']) {
    assert.equal((await fetch(`${base}${path}`, { method: 'POST', headers: { Authorization: 'Bearer web-session' } })).status, 403);
  }
  const authorizedSetup = await fetch(`${base}/api/auth/setup`, {
    method: 'POST', headers: { Authorization: `Bearer ${cloudEnv.CONSTRUTEC_SETUP_TOKEN}`, 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal(authorizedSetup.status, 410); // Primeiro acesso agora e uma conta do Centro de Custos.
  unavailable = true;
  const unhealthy = await fetch(`${base}/health`);
  assert.equal(unhealthy.status, 503);
  assert.doesNotMatch(await unhealthy.text(), /private-password|secret-host/);
  const authFailure = await fetch(`${base}/api/health`, { headers: { Authorization: 'Bearer local-token' } });
  assert.equal(authFailure.status, 500);
  assert.doesNotMatch(await authFailure.text(), /private-password|secret-host/);
});
