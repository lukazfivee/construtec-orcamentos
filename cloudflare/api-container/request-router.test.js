import assert from 'node:assert/strict';
import { test } from 'node:test';
import { routeRequest } from './request-router.js';

const request = (path, method = 'GET') => new Request(`https://orcamentos.example.test${path}`, { method });
const config = {
  DATABASE_URL: 'placeholder',
  SESSION_SECRET: 'placeholder',
  CONSTRUTEC_SETUP_TOKEN: 'placeholder',
  CONSTRUTEC_ALLOWED_ORIGINS: 'https://orcamentos.example.test',
};

test('/health verifica o Worker sem iniciar Container, inclusive em HEAD ou falta de configuração', async () => {
  const bindings = { ...config, get API() { assert.fail('Container não pode ser acessado'); } };
  const response = await routeRequest(request('/health'), bindings);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { ok: true, scope: 'worker' });

  const head = await routeRequest(request('/health', 'HEAD'), bindings);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal((await routeRequest(request('/health'), {})).status, 503);
  assert.equal((await routeRequest(request('/health', 'POST'), bindings)).status, 405);
});

test('sonda profunda e outras chamadas de API continuam no Container; páginas continuam nos assets', async () => {
  const calls = [];
  const bindings = {
    ...config,
    API: { getByName(name) { calls.push(name); return { fetch(req) { return new Response(req.url); } }; } },
    ASSETS: { fetch(req) { calls.push('assets'); return new Response(req.url); } },
  };
  for (const path of ['/api/health', '/api/proposals', '/']) {
    assert.equal(await (await routeRequest(request(path), bindings)).text(), request(path).url);
  }
  assert.deepEqual(calls, ['production', 'production', 'assets']);
  assert.equal((await routeRequest(request('/api/proposals'), {})).status, 503);
});
