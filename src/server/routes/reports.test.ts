import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import type { AuthUser } from '../../shared/contracts';
import { createReportsRouter } from './reports';

const USER: AuthUser = { id: '11111111-1111-4111-8111-111111111111', name: 'Maria Souza', email: 'maria@rcconstrutec.com.br', role: 'viewer', apps: ['orcamentos'] };

const listen = async (app: express.Express, context: { after: (fn: () => Promise<void>) => void }) => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
};

// Worker de reports de mentira: guarda o que recebeu e responde como o de verdade.
const fakeWorker = async (context: { after: (fn: () => Promise<void>) => void }, reply: (body: unknown) => { status: number; json: unknown }) => {
  const received: unknown[] = [];
  const app = express();
  app.use(express.json());
  app.post('/v1/reports', (request, response) => {
    received.push(request.body);
    const { status, json } = reply(request.body);
    response.status(status).json(json);
  });
  return { url: await listen(app, context), received };
};

const reportsApp = async (context: { after: (fn: () => Promise<void>) => void }) => {
  const app = express();
  app.use(express.json());
  app.use((_request, response, next) => { response.locals.authUser = USER; next(); });
  app.use('/api/reports', createReportsRouter());
  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    void _next;
    response.status((error as { name?: string })?.name === 'ZodError' ? 400 : 500).json({ error: 'erro' });
  });
  return listen(app, context);
};

const send = (base: string, body: unknown) => fetch(`${base}/api/reports`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const VALID = { type: 'bug', severity: 'alta', title: 'Botão não responde', description: 'Cliquei em salvar e nada aconteceu.', platform: 'celular' };

const withEnv = async (value: string | undefined, work: () => Promise<void>) => {
  const before = process.env.REPORT_API_URL;
  if (value === undefined) delete process.env.REPORT_API_URL; else process.env.REPORT_API_URL = value;
  try { await work(); } finally { if (before === undefined) delete process.env.REPORT_API_URL; else process.env.REPORT_API_URL = before; }
};

test('report entregue ao Worker com nome e e-mail da sessao, mesmo que o corpo traga outros', async (context) => {
  const worker = await fakeWorker(context, () => ({ status: 200, json: { ok: true, reportId: 'RPT-20261013-ABCD1234' } }));
  const base = await reportsApp(context);
  await withEnv(worker.url, async () => {
    const response = await send(base, { ...VALID, user: { name: 'Outro', email: 'outro@x.com' } });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { reportId: 'RPT-20261013-ABCD1234' });
  });
  const sent = worker.received[0] as { title: string; user: { name: string; email: string }; app: { platform: string }; installation: { id: string }; clientReportId: string };
  assert.equal(sent.title, '[Orçamentos] Botão não responde');
  assert.deepEqual(sent.user, { name: 'Maria Souza', email: 'maria@rcconstrutec.com.br' });
  assert.equal(sent.app.platform, 'orcamentos-celular');
  assert.equal(sent.installation.id, 'orcamentos-local');
  assert.ok(sent.clientReportId.length >= 8);
});

test('corpo invalido volta 400 e nada vai ao Worker', async (context) => {
  const worker = await fakeWorker(context, () => ({ status: 200, json: { ok: true } }));
  const base = await reportsApp(context);
  await withEnv(worker.url, async () => {
    assert.equal((await send(base, { ...VALID, title: 'ab' })).status, 400);
    assert.equal((await send(base, { ...VALID, type: 'xyz' })).status, 400);
  });
  assert.equal(worker.received.length, 0);
});

test('falha ou limite do Worker vira 502 com o contato do suporte', async (context) => {
  const base = await reportsApp(context);
  const down = await fakeWorker(context, () => ({ status: 502, json: { ok: false, error: 'Resend falhou' } }));
  await withEnv(down.url, async () => {
    const response = await send(base, VALID);
    assert.equal(response.status, 502);
    assert.match(((await response.json()) as { error: string }).error, /pcm@rcconstrutec\.com\.br/);
  });
  const limited = await fakeWorker(context, () => ({ status: 429, json: { ok: false, error: 'rate_limited' } }));
  await withEnv(limited.url, async () => {
    const response = await send(base, VALID);
    assert.equal(response.status, 502);
    assert.match(((await response.json()) as { error: string }).error, /Muitos reports/);
  });
});

test('REPORT_API_URL vazio desliga o envio com 503', async (context) => {
  const base = await reportsApp(context);
  await withEnv('', async () => {
    const response = await send(base, VALID);
    assert.equal(response.status, 503);
  });
});
