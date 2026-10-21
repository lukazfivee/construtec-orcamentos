import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import express from 'express';
import type { AuthUser } from '../shared/contracts';
import { permissionsFor } from '../shared/suitePermissions';
import { clientsApi, proposalApi, setAuthSessionToken } from '../renderer/api';
import { liveAssistantApi, liveCommitApi, liveEditApi } from '../renderer/assistant/assistantApi';
import { commitDraft } from '../renderer/assistant/assistantCommit';
import { createAssistantTools } from '../renderer/assistant/assistantTools';
import type { AssistantNav } from '../renderer/assistant/assistantTools';
import { applyPlan } from '../renderer/assistant/proposalEdit';
import { createCatalogRouter } from './routes/catalog';
import { createClientsRouter } from './routes/clients';
import { createProposalCustomItemsRouter } from './routes/proposalCustomItems';
import { createProposalsRouter } from './routes/proposals';
import { suiteGuard } from './suiteGuard';
import { createCriticalTestDatabase } from './services/criticalTestDatabase';

// Ponta a ponta do assistente de IA contra o SERVIDOR REAL (rotas, zod, suiteGuard e servicos de verdade, banco PGlite em
// memoria com usuarios de teste): o codigo do assistente usa os mesmos adaptadores do app (`proposalApi`, `liveCommitApi`,
// `liveEditApi`). So o modelo (Gemini) fica de fora: as ferramentas sao chamadas como ele as chamaria.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Out = Record<string, any>;

const person = (id: string, suiteRole: Parameters<typeof permissionsFor>[0], role: AuthUser['role']): AuthUser => ({
  id, name: 'Teste', email: `${suiteRole}@teste.invalid`, role, suiteRole, apps: ['orcamentos'], permissions: permissionsFor(suiteRole),
});

// Um servidor para o arquivo todo: o `request` do app guarda a URL da primeira chamada.
let booted: ReturnType<typeof boot> | undefined;
const getBoot = () => { booted ??= boot(); return booted; };
after(async () => { if (booted) await new Promise<void>((resolve) => { void booted?.then(({ server }) => server.close(() => resolve())); }); });

async function boot() {
  const fixture = await createCriticalTestDatabase();
  const { database, userId } = fixture;
  for (const [code, description, cost] of [['CAM-1', 'Câmera IP 2MP', 300], ['DVR-8', 'DVR 8 canais', 900]] as const) {
    await database.query("INSERT INTO products (id, code, description, category, unit, current_cost) VALUES ($1, $2, $3, 'CFTV', 'un', $4)", [randomUUID(), code, description, cost]);
  }
  const users: Record<string, AuthUser> = {
    admin: person(userId, 'admin', 'admin'), semcusto: person(userId, 'tecnico', 'commercial'), consulta: person(userId, 'engenharia', 'viewer'),
  };
  const app = express();
  app.use(express.json());
  // Mesmas regras do createApp: sessao -> usuario; consulta nao grava; depois o suiteGuard.
  app.use((request, response, next) => {
    const user = users[request.header('x-construtec-session') ?? ''];
    if (!user) { response.status(401).json({ error: 'Sessão inválida.' }); return; }
    response.locals.authUser = user;
    if (user.role === 'viewer' && request.method !== 'GET') { response.status(403).json({ error: 'Seu perfil possui acesso somente para consulta.' }); return; }
    suiteGuard(request, response, next);
  });
  app.use('/api/catalog', createCatalogRouter(database));
  app.use('/api/clients', createClientsRouter(database));
  app.use('/api/proposals', createProposalCustomItemsRouter(database));
  app.use('/api/proposals', createProposalsRouter(database));
  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    void _next;
    const e = error as { issues?: unknown[]; message?: string };
    if (Array.isArray(e?.issues)) { response.status(400).json({ error: `Dados inválidos: ${JSON.stringify(e.issues)}` }); return; }
    if (e?.message === 'PROPOSAL_LOCKED') { response.status(409).json({ error: 'Esta proposta não pode ser alterada.' }); return; }
    if (e?.message?.endsWith('_NOT_FOUND')) { response.status(404).json({ error: 'Não encontrado.' }); return; }
    response.status(500).json({ error: e?.message ?? 'erro' });
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  // O `request` do app le a URL do `window`: aponta para este servidor (nada de dado real).
  (globalThis as unknown as { window: unknown }).window = { __CONSTRUTEC_API_URL__: `http://127.0.0.1:${address.port}`, location: { protocol: 'http:', host: `127.0.0.1:${address.port}` } };
  return { server, fixture };
}

const nav = { openProposal: () => undefined, navigate: () => undefined, newProposal: () => undefined, openCentroCustos: () => undefined } as AssistantNav;
const makeTools = (sees: boolean, edit = true) => {
  const tools = createAssistantTools({ api: liveAssistantApi, seesCost: () => sees, canEdit: () => edit, nav: () => nav });
  const run = async (name: string, args: Record<string, unknown> = {}) => JSON.parse(JSON.stringify(await tools.run({ name, args }))) as Out;
  return { tools, run };
};

test('assistente ponta a ponta: cria proposta com valor, BDI, imposto, catalogo e mao de obra; depois edita e confere o que o servidor gravou', async (context) => {
  void context;
  await getBoot();
  setAuthSessionToken('admin');
  const { tools, run } = makeTools(true);

  // ---- criar (como o modelo chamaria as ferramentas)
  const atualizar = await run('rascunho_atualizar', {
    cliente: 'Cliente fictício', obra: 'Obra do teste ponta a ponta', escopo: 'Correção de 2 eletroímãs e instalação de câmeras',
    pagamento: '50% na entrada', prazo_execucao: '20 dias', validade_dias: 30, bdi: 1.25, imposto_pct: 8,
  });
  assert.equal(atualizar.rascunho.cliente.situacao, 'já cadastrado', 'o cliente veio da busca real do servidor');
  assert.equal(atualizar.rascunho.obra.situacao, 'nova obra');
  const itens = await run('rascunho_itens', { adicionar: [
    { descricao: 'Correção de eletroímã', unidade: 'un', quantidade: 2, custo_unitario: 1500 },
    { codigo: 'cam-1', quantidade: 4 },
    { descricao: 'Item sem preço', quantidade: 1 },
  ] });
  assert.equal(itens.erros, undefined, JSON.stringify(itens.erros));
  const mao = await run('rascunho_mao_de_obra', { adicionar: [{ descricao: 'Eletricista', profissionais: 2, salario_mensal: 3000, horas_por_profissional: 40 }] });
  assert.equal(mao.erros, undefined, JSON.stringify(mao.erros));
  await run('finalizar_rascunho');
  const draft = tools.takeConfirm();
  assert.ok(draft);

  const created = await commitDraft(liveCommitApi, draft);
  assert.equal(created.erro, undefined);
  assert.ok(!created.aviso, created.aviso ?? '');
  assert.ok(created.proposalId);
  const proposal = (await proposalApi.byId(created.proposalId as string)).proposal;
  assert.equal(proposal.status, 'draft');
  assert.equal(proposal.bdiMultiplier, 1.25);
  assert.equal(proposal.taxPercentage, 8);
  assert.ok(proposal.validUntil && /^\d{4}-\d{2}-\d{2}$/.test(proposal.validUntil));
  const conditions = JSON.parse(proposal.scope);
  assert.equal(conditions.scope, 'Correção de 2 eletroímãs e instalação de câmeras');
  assert.equal(conditions.paymentTerms, '50% na entrada');
  assert.equal(conditions.executionTerm, '20 dias');
  assert.equal(proposal.items.length, 3);
  const eletroima = proposal.items.find((i) => i.description === 'Correção de eletroímã');
  assert.equal(eletroima?.unitCost, 1500, 'o valor dito entrou como custo');
  assert.equal(eletroima?.quantity, 2);
  assert.ok((eletroima?.unitSale ?? 0) >= 1500 * 1.25, `venda saiu do BDI: ${eletroima?.unitSale}`);
  const camera = proposal.items.find((i) => i.code === 'CAM-1');
  assert.equal(camera?.unitCost, 300, 'item do catalogo usa o custo do catalogo');
  assert.equal(camera?.quantity, 4);
  const semPreco = proposal.items.find((i) => i.description === 'Item sem preço');
  assert.equal(semPreco?.unitCost, 0);
  assert.equal(semPreco?.unitSale, 0);
  assert.equal(proposal.laborItems?.length, 1);
  assert.equal(proposal.laborItems?.[0].professionalCount, 2);
  assert.equal(proposal.laborItems?.[0].plannedHours, 40);
  assert.ok((proposal.laborItems?.[0].totalCost ?? 0) > 0, 'o servidor calculou o custo da mao de obra');
  const cadastro = (await clientsApi.list('Obra do teste')).clients[0];
  assert.ok(cadastro?.works.some((w) => w.name === 'Obra do teste ponta a ponta'), 'a obra nova foi cadastrada junto');

  // ---- editar a proposta que acabou de nascer
  const aberta = await run('editar_abrir', { proposta_id: proposal.id });
  assert.equal(aberta.ok, true);
  assert.equal(aberta.itens.length, 3);
  const numeroEletroima = aberta.itens.find((i: Out) => i.descricao === 'Correção de eletroímã').numero;
  const numeroSemPreco = aberta.itens.find((i: Out) => i.descricao === 'Item sem preço').numero;
  await run('editar_campos', { pagamento: '30 dias após a entrega', bdi: 1.4, validade_dias: 45 });
  const edicao = await run('editar_itens', { alterar: [{ item: String(numeroEletroima), quantidade: 3 }], remover: [numeroSemPreco], adicionar: [{ descricao: 'Fonte 12V', unidade: 'un', quantidade: 2, custo_unitario: 85 }, { codigo: 'DVR-8', quantidade: 1 }] });
  assert.equal(edicao.erros, undefined, JSON.stringify(edicao.erros));
  const maoEdicao = await run('editar_mao_de_obra', { alterar: [{ item: 1, profissionais: 3 }], adicionar: [{ descricao: 'Ajudante', profissionais: 1, salario_mensal: 2000, horas_por_profissional: 40 }] });
  assert.equal(maoEdicao.erros, undefined, JSON.stringify(maoEdicao.erros));
  await run('finalizar_edicao');
  const plan = tools.takeEditConfirm();
  assert.ok(plan);
  const nothingYet = (await proposalApi.byId(proposal.id)).proposal;
  assert.equal(nothingYet.items.length, 3, 'conversar nao altera nada: so o botao grava');

  const applied = await applyPlan(liveEditApi, plan);
  assert.equal(applied.erro, undefined);
  const edited = (await proposalApi.byId(proposal.id)).proposal;
  assert.equal(edited.bdiMultiplier, 1.4);
  const editedConditions = JSON.parse(edited.scope);
  assert.equal(editedConditions.paymentTerms, '30 dias após a entrega');
  assert.equal(editedConditions.executionTerm, '20 dias', 'o prazo que nao foi tocado continua');
  assert.equal(editedConditions.scope, 'Correção de 2 eletroímãs e instalação de câmeras');
  assert.notEqual(edited.validUntil, proposal.validUntil, 'a validade mudou');
  assert.equal(edited.items.find((i) => i.description === 'Correção de eletroímã')?.quantity, 3);
  assert.equal(edited.items.some((i) => i.description === 'Item sem preço'), false, 'item removido');
  const fonte = edited.items.find((i) => i.description === 'Fonte 12V');
  assert.equal(fonte?.unitCost, 85);
  assert.ok((fonte?.unitSale ?? 0) >= 85 * 1.4, 'item novo nasce com o BDI novo (BDI aplicado antes dos itens)');
  assert.equal(edited.items.find((i) => i.code === 'DVR-8')?.unitCost, 900);
  assert.equal(edited.laborItems?.length, 2);
  assert.equal(edited.laborItems?.find((l) => l.description === 'Eletricista')?.professionalCount, 3);

  // ---- depois de enviada a proposta e travada: a IA recusa abrir e o servidor recusa aplicar
  await run('editar_itens', { alterar: [{ item: 1, quantidade: 9 }] });
  await run('finalizar_edicao');
  const stale = tools.takeEditConfirm();
  assert.ok(stale);
  await proposalApi.updateStatus(proposal.id, 'sent');
  const recusada = await makeTools(true).run('editar_abrir', { proposta_id: proposal.id });
  assert.match(recusada.erro, /está enviada/);
  const lockedResult = await applyPlan(liveEditApi, stale);
  assert.ok(lockedResult.erro, 'o servidor recusa gravar numa proposta enviada');
  assert.deepEqual(lockedResult.aplicado, []);
  assert.equal((await proposalApi.byId(proposal.id)).proposal.items.find((i) => i.description === 'Correção de eletroímã')?.quantity, 3, 'nada foi gravado');
});

test('assistente ponta a ponta: sem permissao de custo o servidor tambem recusa, e criar com catalogo continua funcionando', async (context) => {
  void context;
  await getBoot();
  setAuthSessionToken('semcusto');
  const { tools, run } = makeTools(false);

  // a IA recusa do lado do app...
  assert.match((await run('rascunho_atualizar', { bdi: 1.5 })).erro, /não vê nem define custo/);
  assert.match((await run('rascunho_mao_de_obra', { adicionar: [{ descricao: 'X', profissionais: 1, salario_mensal: 1, horas_por_profissional: 1 }] })).erro, /mão de obra é custo/);

  // ...e o servidor recusa mesmo que alguem chame as rotas direto (defesa em profundidade)
  await run('rascunho_atualizar', { cliente: 'Cliente fictício', obra: 'Obra sem custo', escopo: 'Serviço de teste sem custo' });
  await run('rascunho_itens', { adicionar: [{ codigo: 'CAM-1', quantidade: 2 }, { descricao: 'Item avulso', quantidade: 1 }] });
  await run('finalizar_rascunho');
  const draft = tools.takeConfirm();
  assert.ok(draft);
  const created = await commitDraft(liveCommitApi, draft);
  assert.equal(created.erro, undefined);
  assert.ok(!created.aviso, created.aviso ?? '');
  const proposal = (await proposalApi.byId(created.proposalId as string)).proposal;
  assert.equal(proposal.items.length, 2);
  assert.equal(proposal.items.find((i) => i.code === 'CAM-1')?.unitCost, 0, 'sem p10 o custo sai zerado nas respostas');
  await assert.rejects(() => proposalApi.updateBdi(proposal.id, 1.9), /custo|BDI/i, 'o servidor recusa BDI sem p10');
  await assert.rejects(() => proposalApi.addLabor(proposal.id, { description: 'X', professionalCount: 1, monthlySalary: 1, monthlyFood: 0, monthlyTransport: 0, monthlyOtherCosts: 0, standardMonthlyHours: 176, plannedHours: 1 }), /custo|BDI/i);

  // editar quantidade continua liberado sem p10
  const edit = makeTools(false);
  await edit.run('editar_abrir', { proposta_id: proposal.id });
  await edit.run('editar_itens', { alterar: [{ item: 1, quantidade: 5 }] });
  await edit.run('finalizar_edicao');
  const plan = edit.tools.takeEditConfirm();
  assert.ok(plan);
  assert.equal((await applyPlan(liveEditApi, plan)).erro, undefined);
  assert.equal((await proposalApi.byId(proposal.id)).proposal.items.find((i) => i.code === 'CAM-1')?.quantity, 5);
});

test('assistente ponta a ponta: perfil de consulta nao cria nem edita (servidor recusa)', async (context) => {
  void context;
  await getBoot();
  setAuthSessionToken('consulta');
  const { tools, run } = makeTools(true, false);
  assert.ok((await run('rascunho_atualizar', { cliente: 'Cliente fictício' })).erro, 'a IA recusa para consulta');
  assert.ok((await run('editar_abrir', { proposta_id: randomUUID() })).erro);
  // mesmo se o rascunho fosse montado por outro caminho, o servidor nao deixa gravar
  const draft = { clientName: 'Cliente fictício', workName: 'Obra', scope: 'Escopo qualquer', items: [] };
  const result = await commitDraft(liveCommitApi, draft);
  assert.ok(result.erro, 'o servidor recusa');
  assert.equal(result.proposalId, undefined);
  void tools;
});

// O celular (public/m) tem os proprios arquivos e envios: o mesmo roteiro, agora com o codigo do /m/ contra o mesmo servidor.
function mobile(session: string, p10: boolean) {
  const base = (globalThis as unknown as { window: { __CONSTRUTEC_API_URL__: string } }).window.__CONSTRUTEC_API_URL__;
  const OC: Record<string, unknown> = {
    cents: (v: number) => Math.round(v * 100) / 100, can: () => p10, canEdit: () => true,
    api: async (route: string, init?: { method?: string; body?: unknown }) => {
      const response = await fetch(`${base}/api${route}`, { method: init?.method ?? 'GET', headers: { 'Content-Type': 'application/json', 'X-Construtec-Session': session }, body: init?.body === undefined ? undefined : JSON.stringify(init.body) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${response.status}`);
      return body;
    },
  };
  const sandbox = { window: { OC }, JSON, Number, String, Object, Math, Array, Set, Date, encodeURIComponent, decodeURIComponent };
  for (const file of ['ia-draft.js', 'ia-edit.js', 'ia-tools.js']) runInNewContext(readFileSync(path.join(process.cwd(), 'public', 'm', file), 'utf8'), sandbox);
  const ia = (OC as { ia: Out }).ia;
  const run = async (name: string, args: Record<string, unknown> = {}) => JSON.parse(JSON.stringify(await ia.run({ name, args }))) as Out;
  return { ia, run };
}

test('assistente ponta a ponta no celular: cria com valor, BDI, imposto e mao de obra, edita e confere no servidor', async () => {
  await getBoot();
  const { ia, run } = mobile('admin', true);
  await run('rascunho_atualizar', { cliente: 'Cliente fictício', obra: 'Obra do celular', escopo: 'Correção de 2 eletroímãs pelo celular', pagamento: '50% na entrada', validade_dias: 15, bdi: 1.25, imposto_pct: 8 });
  const itens = await run('rascunho_itens', { adicionar: [{ descricao: 'Correção de eletroímã', unidade: 'un', quantidade: 2, custo_unitario: 1500 }, { codigo: 'DVR-8', quantidade: 1 }, { descricao: 'Item sem preço', quantidade: 1 }] });
  assert.equal(itens.erros, undefined, JSON.stringify(itens.erros));
  const mao = await run('rascunho_mao_de_obra', { adicionar: [{ descricao: 'Eletricista', profissionais: 2, salario_mensal: 3000, horas_por_profissional: 40 }] });
  assert.equal(mao.erros, undefined, JSON.stringify(mao.erros));
  await run('finalizar_rascunho');
  const draft = ia.takeConfirm();
  assert.ok(draft);
  const created = await ia.draft.commit(draft);
  assert.equal(created.erro, undefined);
  assert.ok(!created.aviso, created.aviso ?? '');
  const proposal = (await proposalApi.byId(created.proposalId)).proposal;
  assert.equal(proposal.bdiMultiplier, 1.25);
  assert.equal(proposal.taxPercentage, 8);
  assert.equal(proposal.items.length, 3);
  assert.equal(proposal.items.find((i) => i.description === 'Correção de eletroímã')?.unitCost, 1500);
  assert.equal(proposal.items.find((i) => i.code === 'DVR-8')?.unitCost, 900);
  assert.equal(proposal.items.find((i) => i.description === 'Item sem preço')?.unitSale, 0);
  assert.equal(proposal.laborItems?.length, 1);
  assert.ok((proposal.laborItems?.[0].totalCost ?? 0) > 0);

  const aberta = await run('editar_abrir', { proposta_id: proposal.id });
  assert.equal(aberta.itens.length, 3);
  await run('editar_campos', { pagamento: '30 dias após a entrega', bdi: 1.4 });
  const numeroEletroima = aberta.itens.find((i: Out) => i.descricao === 'Correção de eletroímã').numero;
  const numeroSemPreco = aberta.itens.find((i: Out) => i.descricao === 'Item sem preço').numero;
  const edicao = await run('editar_itens', { alterar: [{ item: String(numeroEletroima), quantidade: 3 }], remover: [numeroSemPreco], adicionar: [{ descricao: 'Fonte 12V', unidade: 'un', quantidade: 2, custo_unitario: 85 }] });
  assert.equal(edicao.erros, undefined, JSON.stringify(edicao.erros));
  await run('editar_mao_de_obra', { alterar: [{ item: 1, profissionais: 3 }], adicionar: [{ descricao: 'Ajudante', profissionais: 1, salario_mensal: 2000, horas_por_profissional: 40 }] });
  await run('finalizar_edicao');
  const plan = ia.takeEditConfirm();
  assert.ok(plan);
  assert.equal((await proposalApi.byId(proposal.id)).proposal.items.length, 3, 'conversar nao altera nada');
  const applied = await ia.edit.applyPlan(plan);
  assert.equal(applied.erro, undefined);
  const edited = (await proposalApi.byId(proposal.id)).proposal;
  assert.equal(edited.bdiMultiplier, 1.4);
  assert.equal(JSON.parse(edited.scope).paymentTerms, '30 dias após a entrega');
  assert.equal(edited.items.find((i) => i.description === 'Correção de eletroímã')?.quantity, 3);
  assert.equal(edited.items.some((i) => i.description === 'Item sem preço'), false);
  assert.ok((edited.items.find((i) => i.description === 'Fonte 12V')?.unitSale ?? 0) >= 85 * 1.4);
  assert.equal(edited.laborItems?.length, 2);
  assert.equal(edited.laborItems?.find((l) => l.description === 'Eletricista')?.professionalCount, 3);

  // sem p10 no celular: a IA recusa e o servidor tambem
  const blind = mobile('semcusto', false);
  assert.match((await blind.run('rascunho_atualizar', { bdi: 1.5 })).erro, /não vê nem define custo/);
  await blind.run('rascunho_atualizar', { cliente: 'Cliente fictício', obra: 'Obra do celular sem custo', escopo: 'Serviço de teste pelo celular' });
  await blind.run('rascunho_itens', { adicionar: [{ codigo: 'CAM-1', quantidade: 2 }, { descricao: 'Avulso', quantidade: 1 }] });
  await blind.run('finalizar_rascunho');
  const blindCreated = await blind.ia.draft.commit(blind.ia.takeConfirm());
  assert.equal(blindCreated.erro, undefined);
  assert.ok(!blindCreated.aviso, blindCreated.aviso ?? '');
  assert.equal((await proposalApi.byId(blindCreated.proposalId)).proposal.items.length, 2);
});
