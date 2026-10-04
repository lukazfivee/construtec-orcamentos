import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import type { Request, Response } from 'express';
import type { AuthUser } from '../shared/contracts';
import { defaultSuiteMatrix, permissionsFor, suiteRoleFromLegacy } from '../shared/suitePermissions';
import { maskCosts, suiteGuard } from './suiteGuard';
import { resetSuiteMatrixCache, resolveSuiteAccess } from './services/suiteAccess';

const user = (suiteRole: Parameters<typeof permissionsFor>[0], apps = ['centro', 'orcamentos']): AuthUser => ({
  id: 'u', name: 'U', email: 'u@x.com', role: 'viewer', suiteRole, apps, permissions: permissionsFor(suiteRole),
});

// Roda o guarda com uma requisicao de mentira; devolve o status (200 se passou) e o corpo que sairia.
const run = (authUser: AuthUser, method: string, path: string, body?: unknown) => {
  let status = 200;
  let sent: unknown;
  const response = {
    locals: { authUser },
    status(code: number) { status = code; return this; },
    json(value: unknown) { sent = value; return this; },
  } as unknown as Response;
  let passed = false;
  suiteGuard({ method, path, body } as Request, response, () => { passed = true; });
  if (passed) response.json({ items: [{ unitCost: 10, unitSale: 20 }], totals: { cost: 5, sale: 9, marginPercent: 30 }, bdiMultiplier: 1.4 });
  return { status: passed ? 200 : status, sent: sent as { bdiMultiplier?: number } | undefined };
};

test('papeis da Suite: mapeamento do papel antigo e matriz padrao', () => {
  assert.equal(suiteRoleFromLegacy('supervisor'), 'tecnico');
  assert.equal(suiteRoleFromLegacy('gestor'), 'gestor');
  assert.deepEqual(permissionsFor('comercial').filter(p => ['p10', 'p11', 'p12'].includes(p)), ['p10', 'p11']);
  assert.ok(permissionsFor('tecnico').includes('p12') && !permissionsFor('tecnico').includes('p10'));
  assert.equal(permissionsFor('admin').length, 12);
  assert.equal(defaultSuiteMatrix().gestor.p4, true);
});

test('mascara custo, BDI e margem e deixa o preco de venda', () => {
  const masked = maskCosts({ items: [{ unitCost: 10, unitSale: 20, catalogCurrentCost: null, currentCost: 7 }], totals: { cost: 5, sale: 9, labor: 3, marginPercent: 30 }, bdiMultiplier: 1.4, totalEstimatedCost: 50, label: 'x' });
  assert.deepEqual(masked, { items: [{ unitCost: 0, unitSale: 20, catalogCurrentCost: null, currentCost: 0 }], totals: { cost: 0, sale: 9, labor: 0, marginPercent: 0 }, bdiMultiplier: 0, totalEstimatedCost: 0, label: 'x' });
});

test('guarda das propostas: p10 esconde custo, p11 barra envio e aprovacao, apps limita o acesso', () => {
  const semCusto = run(user('financeiro'), 'GET', '/api/proposals/abc');
  assert.equal(semCusto.status, 200);
  assert.deepEqual(semCusto.sent, { items: [{ unitCost: 0, unitSale: 20 }], totals: { cost: 0, sale: 9, marginPercent: 0 }, bdiMultiplier: 0 });
  assert.equal(run(user('comercial'), 'GET', '/api/proposals/abc').sent?.bdiMultiplier, 1.4);
  assert.equal(run(user('admin'), 'GET', '/api/proposals').status, 200);

  // p10: sem ele nao altera BDI, imposto nem mao de obra, e nao ve o acompanhamento.
  assert.equal(run(user('tecnico'), 'PATCH', '/api/proposals/abc/bdi', { bdiMultiplier: 2 }).status, 403);
  assert.equal(run(user('tecnico'), 'POST', '/api/proposals/abc/labor').status, 403);
  assert.equal(run(user('tecnico'), 'GET', '/api/proposals/abc/center-tracking').status, 403);
  assert.equal(run(user('engenharia'), 'PATCH', '/api/proposals/abc/bdi', { bdiMultiplier: 2 }).status, 200);

  // Documento do cliente no celular: aberto sem p10 (so preco de venda); marcar enviada segue exigindo p11.
  assert.equal(run(user('tecnico'), 'GET', '/api/proposals/abc/document').status, 200);
  assert.equal(run(user('tecnico'), 'PATCH', '/api/proposals/abc/status', { status: 'sent' }).status, 403);

  // p11: engenharia ve custo mas nao aprova nem envia; comercial pode.
  assert.equal(run(user('engenharia'), 'PATCH', '/api/proposals/abc/status', { status: 'approved' }).status, 403);
  assert.equal(run(user('engenharia'), 'PATCH', '/api/proposals/abc/status', { status: 'review' }).status, 403);
  assert.equal(run(user('engenharia'), 'PATCH', '/api/proposals/abc/status', { status: 'draft' }).status, 403);
  assert.equal(run(user('engenharia'), 'DELETE', '/api/proposals/abc').status, 403);
  assert.equal(run(user('engenharia'), 'POST', '/api/proposals/abc/revisions').status, 403);
  assert.equal(run(user('comercial'), 'DELETE', '/api/proposals/abc').status, 200);
  assert.equal(run(user('comercial'), 'POST', '/api/proposals/abc/revisions').status, 200);
  assert.equal(run(user('comercial'), 'PATCH', '/api/proposals/abc/status', { status: 'draft' }).status, 200);
  assert.equal(run(user('engenharia'), 'POST', '/api/proposals/abc/direct-sync').status, 403);
  assert.equal(run(user('engenharia'), 'POST', '/api/proposals/abc/client-link').status, 403);
  assert.equal(run(user('engenharia'), 'POST', '/api/proposals/abc/client-link/confirm').status, 403);
  assert.equal(run(user('engenharia'), 'GET', '/api/proposals/abc/client-link').status, 200);
  assert.equal(run(user('comercial'), 'POST', '/api/proposals/abc/client-link').status, 200);
  assert.equal(run(user('comercial'), 'PATCH', '/api/proposals/abc/status', { status: 'approved' }).status, 200);
  assert.equal(run(user('gestor'), 'POST', '/api/proposals/abc/integration-export').status, 200);

  // Catalogo e kits: sem p10 o custo do item sai zerado e nao se grava; aplicar um kit na proposta segue liberado.
  const catalogo = run(user('financeiro'), 'GET', '/api/catalog');
  assert.equal(catalogo.status, 200);
  assert.equal(run(user('financeiro'), 'PATCH', '/api/catalog/p1', { currentCost: 0 }).status, 403);
  assert.equal(run(user('financeiro'), 'POST', '/api/catalog/import/bulk').status, 403);
  // Importar pelo celular: previa e pagina do EXSAT tambem exigem p10 (a previa devolve o custo anterior).
  assert.equal(run(user('financeiro'), 'POST', '/api/catalog/import/preview').status, 403);
  assert.equal(run(user('tecnico'), 'POST', '/api/catalog/import/exsat').status, 403);
  assert.equal(run(user('comercial'), 'POST', '/api/catalog/import/preview').status, 200);
  // Aviso de preco novo: liberado sem p10 (o servidor so devolve o valor final); atualizar tambem.
  assert.equal(run(user('tecnico'), 'GET', '/api/proposals/price-drift').status, 200);
  assert.equal(run(user('tecnico'), 'POST', '/api/proposals/abc/price-drift/apply').status, 200);
  assert.equal(run(user('tecnico'), 'PUT', '/api/kits/k1').status, 403);
  assert.equal(run(user('tecnico'), 'POST', '/api/kits/k1/apply-to-proposal', { proposalId: 'p' }).status, 200);
  assert.equal(run(user('comercial'), 'PATCH', '/api/catalog/p1', { currentCost: 10 }).status, 200);
  assert.equal(run(user('engenharia'), 'PUT', '/api/kits/k1').status, 200);

  assert.equal((run(user('financeiro'), 'GET', '/api/settings').sent as { bdiMultiplier?: number }).bdiMultiplier, 0);
  assert.equal(run(user('gestor'), 'GET', '/api/settings').sent?.bdiMultiplier, 1.4);

  // Sem o app Orcamentos na conta, nada abre (avisos da conta continuam).
  const semApp = user('admin', ['centro']);
  assert.equal(run(semApp, 'GET', '/api/proposals').status, 403);
  assert.equal(run(semApp, 'GET', '/api/catalog').status, 403);
  assert.equal(run(semApp, 'GET', '/api/notifications').status, 200);

  // Sessao antiga, sem a lista de permissoes: so o admin local mantem tudo; nada quebra.
  assert.equal(run({ id: 'u', name: 'U', email: 'u@x.com', role: 'admin' }, 'POST', '/api/proposals/abc/direct-sync').status, 200);
});

test('permissoes vem da matriz do Centro, com cache, e falham fechado sem ela', async context => {
  let calls = 0;
  const custom = { ...defaultSuiteMatrix(), financeiro: { ...defaultSuiteMatrix().financeiro, p10: true } };
  let answer: { status: number; body: unknown } = { status: 200, body: { ok: true, matrix: custom } };
  const server = createServer((request, response) => {
    calls += 1;
    assert.equal(request.url, '/v1/permissions');
    response.writeHead(answer.status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(answer.body));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const saved = process.env.CENTRO_CUSTOS_IDENTITY_URL;
  process.env.CENTRO_CUSTOS_IDENTITY_URL = `http://127.0.0.1:${address.port}`;
  resetSuiteMatrixCache();
  context.after(async () => {
    if (saved === undefined) delete process.env.CENTRO_CUSTOS_IDENTITY_URL; else process.env.CENTRO_CUSTOS_IDENTITY_URL = saved;
    resetSuiteMatrixCache();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  const remote = { id: 'c1', name: 'F', email: 'f@x.com', role: 'supervisor' as const, suiteRole: 'financeiro', apps: ['orcamentos'], active: true };
  const first = await resolveSuiteAccess(remote, 'tok');
  assert.equal(first.suiteRole, 'financeiro');
  assert.deepEqual(first.apps, ['orcamentos']);
  assert.ok(first.permissions?.includes('p10'), 'o ajuste da matriz central vale aqui');
  await resolveSuiteAccess(remote, 'tok');
  assert.equal(calls, 1, 'matriz em cache');

  // Conta antiga (sem papel novo) vira tecnico e ganha os dois apps.
  const legacy = await resolveSuiteAccess({ ...remote, suiteRole: undefined, apps: undefined }, 'tok');
  assert.equal(legacy.suiteRole, 'tecnico');
  assert.deepEqual(legacy.apps, ['centro', 'orcamentos']);

  // Sem matriz valida e sem cache recente: falha fechado (sem p10 e p11), mesmo para quem teria pelo padrao.
  resetSuiteMatrixCache();
  answer = { status: 404, body: { ok: false, error: 'Rota nao encontrada.' } };
  const comercial = { ...remote, suiteRole: 'comercial' };
  const closed = await resolveSuiteAccess(comercial, 'tok');
  assert.ok(closed.permissions && !closed.permissions.includes('p10') && !closed.permissions.includes('p11'));

  // Cache velho vale ate 10 min com o Centro fora; depois falha fechado.
  answer = { status: 200, body: { ok: true, matrix: defaultSuiteMatrix() } };
  resetSuiteMatrixCache();
  const realNow = Date.now();
  let clock = realNow;
  context.mock.method(Date, 'now', () => clock);
  assert.ok((await resolveSuiteAccess(comercial, 'tok')).permissions?.includes('p11'));
  answer = { status: 503, body: {} };
  clock = realNow + 5 * 60 * 1000;
  assert.ok((await resolveSuiteAccess(comercial, 'tok')).permissions?.includes('p11'), 'cache de 5 min ainda vale');
  clock = realNow + 11 * 60 * 1000;
  assert.ok(!(await resolveSuiteAccess(comercial, 'tok')).permissions?.includes('p11'), 'cache de 11 min nao vale');
});
