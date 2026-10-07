import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import express from 'express';
import type { AuthUser } from '../../shared/contracts';
import { permissionsFor } from '../../shared/suitePermissions';
import { createApp } from '../createApp';
import { suiteGuard } from '../suiteGuard';
import { createCriticalTestDatabase } from '../services/criticalTestDatabase';
import { decryptSecret } from '../services/exsatCrypto';
import { createMockExsat } from '../services/exsatMockSite';
import { createExsatRuntime } from '../services/exsatRuntime';
import { createExsatRouter } from './exsat';

const person = (suiteRole: Parameters<typeof permissionsFor>[0], role: AuthUser['role']): AuthUser => ({
  id: '11111111-1111-4111-8111-111111111111', name: 'U', email: 'u@x.com', role, suiteRole, apps: ['orcamentos'], permissions: permissionsFor(suiteRole),
});
const USERS: Record<string, AuthUser> = {
  admin: person('admin', 'admin'), comercial: person('comercial', 'commercial'), financeiro: person('financeiro', 'commercial'),
};

const setup = async (context: { after: (fn: () => Promise<void>) => void }, withKey = true, guard = true) => {
  const { database, userId } = await createCriticalTestDatabase();
  USERS.admin.id = userId;
  const key = randomBytes(32);
  const site = createMockExsat();
  const runtime = createExsatRuntime({
    http: site.http, env: withKey ? { EXSAT_CREDENTIAL_KEY: key.toString('hex') } : {},
    sleep: async () => undefined, delayMs: () => 0,
  });
  const app = express();
  app.use(express.json());
  app.use((request, response, next) => { response.locals.authUser = USERS[request.header('x-test-user') ?? 'admin']; next(); });
  if (guard) app.use(suiteGuard);
  app.use('/api/exsat', createExsatRouter(database, runtime));
  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    void _next;
    response.status((error as { name?: string })?.name === 'ZodError' ? 400 : 500).json({ error: 'erro' });
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const call = async (method: string, path: string, body?: unknown, user = 'admin') => {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/exsat${path}`, {
      method, headers: { 'Content-Type': 'application/json', 'x-test-user': user }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    // Em nenhuma resposta da API a senha nem o e-mail inteiro aparecem.
    assert.ok(!text.includes(site.password) && !text.includes(site.email), `${method} ${path} devolveu dado da conta`);
    return { status: response.status, body: text ? JSON.parse(text) as Record<string, any> : {} }; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  return { database, userId, key, site, runtime, call };
};

const credential = (site: { email: string; password: string }) => ({ username: site.email, password: site.password });

test('conta Exsat: p10 para tudo e so administrador cadastra, troca e remove', async (context) => {
  const ctx = await setup(context);
  assert.equal((await ctx.call('GET', '/status', undefined, 'financeiro')).status, 403, 'sem p10 (guarda)');
  assert.equal((await ctx.call('POST', '/sync', {}, 'financeiro')).status, 403);
  const guardless = await setup(context, true, false);
  assert.equal((await guardless.call('GET', '/status', undefined, 'financeiro')).status, 403, 'sem p10 (o proprio roteador)');
  assert.equal((await guardless.call('PUT', '/credential', credential(guardless.site), 'comercial')).status, 403, 'p10 sem ser administrador (roteador)');

  const status = await ctx.call('GET', '/status', undefined, 'comercial');
  assert.equal(status.status, 200);
  assert.equal(status.body.status.canManage, false);
  assert.equal((await ctx.call('PUT', '/credential', credential(ctx.site), 'comercial')).status, 403);
  assert.equal((await ctx.call('DELETE', '/credential', undefined, 'comercial')).status, 403);
  assert.equal(ctx.site.log.length, 0, 'ninguem sem permissao faz a Exsat ser chamada');
  assert.equal((await ctx.call('GET', '/status', undefined, 'admin')).body.status.canManage, true);
});

test('conta Exsat: sem a chave EXSAT_CREDENTIAL_KEY nada e gravado nem a Exsat e chamada', async (context) => {
  const ctx = await setup(context, false);
  const status = await ctx.call('GET', '/status');
  assert.equal(status.body.status.keyConfigured, false);
  const saved = await ctx.call('PUT', '/credential', credential(ctx.site));
  assert.equal(saved.status, 503);
  assert.match(saved.body.error, /EXSAT_CREDENTIAL_KEY/);
  assert.equal(saved.body.code, 'EXSAT_KEY_MISSING');
  assert.equal((await ctx.database.query('SELECT 1 FROM exsat_credentials')).rows.length, 0);
  assert.equal(ctx.site.log.length, 0);
  assert.equal((await ctx.call('POST', '/sync', {})).status, 503);
});

test('conta Exsat: senha errada nao grava, uma tentativa por clique e pausa antes de tentar de novo', async (context) => {
  const ctx = await setup(context);
  const wrong = await ctx.call('PUT', '/credential', { username: ctx.site.email, password: 'errada-123' });
  assert.equal(wrong.status, 422);
  assert.match(wrong.body.error, /recusou o e-mail ou a senha/);
  assert.equal((await ctx.database.query('SELECT 1 FROM exsat_credentials')).rows.length, 0);
  const again = await ctx.call('PUT', '/credential', credential(ctx.site));
  assert.equal(again.status, 429, 'a pausa vale ate para a senha certa');
  assert.equal(again.body.retryAfterSeconds, 60);
  assert.equal(ctx.site.log.filter((entry) => entry.method === 'POST').length, 1, 'a segunda tentativa nem chegou na Exsat');
  const status = await ctx.call('GET', '/status');
  assert.equal(status.body.status.lastFailure.code, 'EXSAT_LOGIN_REJECTED');
  assert.ok(status.body.status.retryAfterSeconds > 0);
  assert.equal(status.body.status.configured, false);
});

test('conta Exsat: salva criptografada, a senha nunca volta e nem aparece no banco, na auditoria ou no log', async (context) => {
  const logged: string[] = [];
  const spies = (['log', 'warn', 'error', 'info'] as const).map((name) => {
    const original = console[name];
    console[name] = (...args: unknown[]) => { logged.push(args.map(String).join(' ')); };
    return () => { console[name] = original; };
  });
  context.after(async () => { spies.forEach((restore) => restore()); });
  const ctx = await setup(context);
  const saved = await ctx.call('PUT', '/credential', credential(ctx.site));
  assert.equal(saved.status, 200);
  assert.deepEqual({ ...saved.body.status, job: null, configuredAt: 'x', lastLoginAt: 'x' }, {
    keyConfigured: true, configured: true, usernameHint: 'c***@teste.invalid', configuredAt: 'x', lastLoginAt: 'x', connected: true,
    lastFailure: null, retryAfterSeconds: 0, canManage: true, job: null,
  });
  assert.ok(!JSON.stringify(saved.body).includes('senha'), 'nenhum campo de senha na resposta');
  assert.equal(ctx.site.log.filter((entry) => entry.method === 'POST').length, 1);

  const row = (await ctx.database.query<{ secret_payload: string; username_hint: string }>('SELECT secret_payload, username_hint FROM exsat_credentials')).rows[0];
  assert.ok(!row.secret_payload.includes(ctx.site.password) && !row.secret_payload.includes('teste.invalid'));
  assert.deepEqual(JSON.parse(decryptSecret(row.secret_payload, ctx.key)), { u: ctx.site.email, p: ctx.site.password });
  const everything = JSON.stringify((await ctx.database.query('SELECT * FROM audit_events WHERE entity_type = $1', ['exsat_credential'])).rows);
  assert.match(everything, /saved/);
  assert.ok(!everything.includes(ctx.site.password) && !everything.includes(ctx.site.email), 'auditoria sem a conta');
  assert.ok(!logged.join('\n').includes(ctx.site.password), 'senha em log');

  // Troca da conta: sobrescreve; remover apaga e derruba a sessao.
  assert.equal((await ctx.call('PUT', '/credential', credential(ctx.site))).status, 200);
  assert.equal((await ctx.database.query('SELECT 1 FROM exsat_credentials')).rows.length, 1);
  const removed = await ctx.call('DELETE', '/credential');
  assert.equal(removed.status, 200);
  assert.equal(removed.body.status.configured, false);
  assert.equal(removed.body.status.connected, false);
  assert.equal((await ctx.database.query('SELECT 1 FROM exsat_credentials')).rows.length, 0);
  assert.equal((await ctx.call('POST', '/sync', {})).status, 409, 'sem conta nao varre');
});

test('varredura pela API: inicia em segundo plano, informa o andamento e entrega so itens com preco', async (context) => {
  const ctx = await setup(context);
  await ctx.call('PUT', '/credential', credential(ctx.site));
  const started = await ctx.call('POST', '/sync', {}, 'comercial');
  assert.equal(started.status, 202);
  const id = started.body.job.id as string;
  let job = started.body.job as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  for (let attempt = 0; attempt < 100 && job.status === 'running'; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    job = (await ctx.call('GET', `/sync/${id}`)).body.job;
  }
  assert.equal(job.status, 'done');
  assert.equal(job.itemsWithoutPrice, 1);
  const items = await ctx.call('GET', `/sync/${id}/items?offset=0&limit=500`);
  assert.equal(items.status, 200);
  assert.equal(items.body.total, job.itemsWithPrice);
  assert.ok((items.body.items as Array<{ currentCost: number }>).every((item) => item.currentCost > 0));
  assert.equal((await ctx.call('GET', `/sync/${id}/items?limit=501`)).status, 400);
  assert.equal((await ctx.call('POST', `/sync/${id}/resume`, {})).status, 409, 'varredura terminada nao se retoma');
  const again = await ctx.call('POST', '/sync', {});
  assert.equal(again.status, 202, 'depois de terminar, uma nova varredura pode comecar');
  let next = again.body.job as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  for (let attempt = 0; attempt < 100 && next.status === 'running'; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    next = (await ctx.call('GET', `/sync/${next.id}`)).body.job;
  }
  assert.equal(next.status, 'done');
  assert.equal((await ctx.call('GET', '/status')).body.status.job.id, next.id);
});

test('corpo invalido em /api/exsat nao vai para o log nem para a tela (pode conter a senha)', async (context) => {
  const { database } = await createCriticalTestDatabase();
  const seen: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { seen.push(args.map((arg) => (arg instanceof Error ? `${arg.message} ${JSON.stringify(arg)}` : String(arg))).join(' ')); };
  context.after(async () => { console.error = original; });
  const server = createApp(database, 'local-token').listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const response = await fetch(`http://127.0.0.1:${address.port}/api/exsat/credential`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer local-token' },
    body: '{"username":"a@b.com","password":"SenhaSecreta!9"',
  });
  const text = await response.text();
  assert.equal(response.status, 400);
  assert.deepEqual(JSON.parse(text), { error: 'Corpo da requisição inválido.' });
  assert.ok(!text.includes('SenhaSecreta') && !seen.join('\n').includes('SenhaSecreta'));
});
