import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ProposalDetail } from '../shared/contracts';
import { commitDraft } from './assistant/assistantCommit';
import type { CommitApi } from './assistant/assistantCommit';
import { createAssistantTools } from './assistant/assistantTools';
import type { AssistantApi, AssistantNav } from './assistant/assistantTools';
import { addLabor, emptyDraft, normalizeLabor, packScope, parseScope, removeLabor, summary, withClient, withWork } from './assistant/proposalDraft';
import { applyPlan, describeBase, describePlan, isEditable, planFields, planIsEmpty, planItems, planLabor, startPlan, toEditBase } from './assistant/proposalEdit';
import type { EditApi } from './assistant/proposalEdit';

// Mao de obra e edicao de proposta existente pela IA (computador): a IA anota num plano em memoria, so o cartao grava,
// BDI antes dos itens novos, parada no primeiro erro com o que sobrou, e custo/mao de obra so com p10.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Out = Record<string, any>;

const PROPOSAL = {
  id: 'p1', number: 'PA-1005', revision: 0, clientName: 'Alfa', workName: 'Bloco A', status: 'draft', isLatest: true, bdiMultiplier: 1.3, taxPercentage: 6, validUntil: '2026-11-01', standardMonthlyHours: 176,
  scope: JSON.stringify({ scope: 'Escopo antigo', executionTerm: '10 dias', paymentTerms: '', warranty: '', notes: 'obs interna' }),
  items: [
    { id: 'i1', code: 'CAM-1', description: 'Câmera IP', unit: 'un', quantity: 4, unitCost: 300, unitSale: 400, inCatalog: true },
    { id: 'i2', code: 'ITEM-002', description: 'Cabo UTP cat6', unit: 'm', quantity: 100, unitCost: 2, unitSale: 3, inCatalog: false },
    { id: 'i3', code: 'ITEM-003', description: 'Cabo coaxial', unit: 'm', quantity: 50, unitCost: 1, unitSale: 2, inCatalog: false },
  ],
  laborItems: [{ id: 'l1', description: 'Eletricista', professionalCount: 2, monthlySalary: 3000, monthlyFood: 300, monthlyTransport: 100, monthlyOtherCosts: 0, standardMonthlyHours: 160, plannedHours: 40 }],
} as unknown as ProposalDetail;

const base = () => toEditBase(PROPOSAL);

test('edicao: so a ultima revisao em edicao ou em revisao e editavel', () => {
  assert.equal(isEditable(PROPOSAL), true);
  assert.equal(isEditable({ ...PROPOSAL, status: 'review' }), true);
  for (const status of ['sent', 'approved', 'rejected'] as const) assert.equal(isEditable({ ...PROPOSAL, status }), false, status);
  assert.equal(isEditable({ ...PROPOSAL, isLatest: false }), false);
});

test('edicao: escopo e condicoes mesclam com o que a proposta ja tinha, BDI e imposto validados', () => {
  const start = startPlan(base());
  const a = planFields(start, { escopo: 'Escopo novo', pagamento: '50% na entrada', validade_dias: 30, bdi: 1.4, imposto_pct: 8 }, new Date('2026-10-20T12:00:00Z'));
  assert.deepEqual(a.erros, []);
  assert.deepEqual(a.plan.scopeParts, { scope: 'Escopo novo', executionTerm: '10 dias', paymentTerms: '50% na entrada', warranty: '', notes: 'obs interna' }, 'mantem prazo e observacoes');
  assert.equal(a.plan.validUntil, '2026-11-19');
  assert.equal(a.plan.bdi, 1.4);
  assert.equal(a.plan.tax, 8);
  const removed = planFields(a.plan, { prazo_execucao: '' });
  assert.equal(removed.plan.scopeParts?.executionTerm, '', 'texto vazio remove o prazo');
  assert.equal(removed.plan.scopeParts?.scope, 'Escopo novo', 'segunda mudanca soma com a primeira');
  const bad = planFields(start, { escopo: 'ab', bdi: 0.5, imposto_pct: 101, validade_dias: 0 });
  assert.equal(bad.erros.length, 4);
  assert.equal(planIsEmpty(bad.plan), true, 'nada invalido entra no plano');
  assert.deepEqual(parseScope('texto puro'), { scope: 'texto puro', executionTerm: '', paymentTerms: '', warranty: '', notes: '' });
  assert.equal(packScope(parseScope('texto puro')), 'texto puro');
  assert.ok(packScope({ scope: '"'.repeat(1200), executionTerm: '"'.repeat(300), paymentTerms: '', warranty: '', notes: '\\'.repeat(300) }).length <= 1200);
});

test('edicao: itens por numero ou texto, remocao, inclusao e custo', () => {
  const start = startPlan(base());
  const a = planItems(start, { alterar: [{ item: 1, quantidade: 6 }, { item: 'utp', quantidade: 120, custo_unitario: 2.5 }, { item: '3', unidade: 'rolo' }] });
  assert.deepEqual(a.erros, []);
  assert.deepEqual(a.plan.itemUpdates, [{ id: 'i1', patch: { quantity: 6 } }, { id: 'i2', patch: { quantity: 120, unitCost: 2.5 } }, { id: 'i3', patch: { unit: 'rolo' } }]);
  const amb = planItems(start, { alterar: [{ item: 'cabo', quantidade: 1 }, { item: 9, quantidade: 1 }, { item: 1, quantidade: -3 }, { item: 1 }] });
  assert.equal(amb.erros.length, 4, 'ambiguo, inexistente, quantidade invalida e nada para alterar');
  assert.match(amb.erros[0], /combina com 2 resultados/);
  assert.equal(planIsEmpty(amb.plan), true);
  const merged = planItems(a.plan, { alterar: [{ item: 1, custo_unitario: 310 }, { item: 1, quantidade: 7 }] });
  assert.deepEqual(merged.plan.itemUpdates[0], { id: 'i1', patch: { quantity: 7, unitCost: 310 } }, 'mudancas do mesmo item se somam');
  const removed = planItems(merged.plan, { remover: [1, 'coaxial'] });
  assert.deepEqual(removed.plan.itemRemovals, ['i1', 'i3']);
  assert.equal(removed.plan.itemUpdates.some((u) => u.id === 'i1' || u.id === 'i3'), false, 'item removido perde as alteracoes');
  assert.match(planItems(removed.plan, { alterar: [{ item: 1, quantidade: 2 }] }).erros[0], /já está marcado para remoção/);
  const added = planItems(start, { adicionar: [
    { input: { codigo: 'DVR-8', quantidade: 1 }, hit: { code: 'DVR-8', description: 'DVR 8 canais', unit: 'un' } },
    { input: { descricao: 'Mão de obra extra', unidade: 'vb', quantidade: 1, custo_unitario: 800 } },
  ] });
  assert.deepEqual(added.plan.itemAdds.map((i) => ({ ...i })), [{ code: 'DVR-8', description: 'DVR 8 canais', unit: 'un', quantity: 1 }, { code: undefined, description: 'Mão de obra extra', unit: 'vb', quantity: 1, unitCost: 800 }]);
  const lines = describePlan(planItems(a.plan, { remover: [2] }).plan);
  assert.ok(lines.includes('Alterar item 1 (Câmera IP): quantidade 4 → 6'));
  assert.ok(lines.includes('Remover item 2 (Cabo UTP cat6)'));
  assert.ok(describePlan(added.plan).some((l) => l.startsWith('Adicionar 1 vb · Mão de obra extra (custo R$')));
});

test('mao de obra: nova exige os campos, alteracao so troca o que veio, remocao por numero', () => {
  assert.match(normalizeLabor({ descricao: 'Eletricista', profissionais: 2 }).erro ?? '', /salário mensal, horas por profissional/);
  assert.match(normalizeLabor({ descricao: 'Eletricista', profissionais: 0, salario_mensal: 3000, horas_por_profissional: 10 }).erro ?? '', /profissionais inválido/);
  assert.match(normalizeLabor({ profissionais: 1, salario_mensal: 1, horas_por_profissional: 1 }).erro ?? '', /descrição/);
  const ok = normalizeLabor({ descricao: ' Técnico ', profissionais: 2, salario_mensal: 2500.456, horas_por_profissional: 40, alimentacao_mensal: 200 });
  assert.deepEqual(ok.labor, { description: 'Técnico', professionalCount: 2, monthlySalary: 2500.46, monthlyFood: 200, monthlyTransport: 0, monthlyOtherCosts: 0, plannedHours: 40 });
  const changed = normalizeLabor({ salario_mensal: 3200 }, ok.labor);
  assert.equal(changed.labor?.monthlySalary, 3200);
  assert.equal(changed.labor?.professionalCount, 2, 'o resto fica igual');

  let draft = addLabor(emptyDraft(), [{ descricao: 'Eletricista', profissionais: 2, salario_mensal: 3000, horas_por_profissional: 40 }, { descricao: 'Ajudante', profissionais: 1 }]);
  assert.equal(draft.erros.length, 1);
  assert.equal(draft.draft.labor?.length, 1);
  draft = addLabor(draft.draft, [{ descricao: 'eletricista', profissionais: 3, salario_mensal: 3000, horas_por_profissional: 40 }]);
  assert.equal(draft.draft.labor?.[0].professionalCount, 3, 'repetir a mesma mao de obra corrige os valores');
  assert.equal(removeLabor(draft.draft, ['1']).draft.labor?.length, 0);
  assert.equal(summary(draft.draft).mao_de_obra[0].profissionais, 3);

  const plan = planLabor(startPlan(base()), { alterar: [{ item: 1, profissionais: 3 }], adicionar: [{ descricao: 'Ajudante', profissionais: 1, salario_mensal: 2000, horas_por_profissional: 40 }] });
  assert.deepEqual(plan.erros, []);
  assert.equal(plan.plan.laborUpdates[0].labor.professionalCount, 3);
  assert.equal(plan.plan.laborUpdates[0].labor.monthlySalary, 3000, 'alteracao parte da mao de obra existente');
  assert.deepEqual(planLabor(plan.plan, { remover: ['eletric'] }).plan.laborRemovals, ['l1']);
  assert.equal(planLabor(plan.plan, { remover: ['eletric'] }).plan.laborUpdates.length, 0, 'removida perde as alteracoes');
  assert.match(planLabor(startPlan(base()), { alterar: [{ item: 'pintor', profissionais: 1 }] }).erros[0], /Não achei mão de obra/);
  const many = planLabor(startPlan(base()), { adicionar: Array.from({ length: 21 }, (_, i) => ({ descricao: `Função ${i}`, profissionais: 1, salario_mensal: 1000, horas_por_profissional: 8 })) });
  assert.equal(many.plan.laborAdds.length, 20);
  assert.match(many.erros[0], /Limite de 20 inclusões.*"Função 20" não entrou/, 'o limite avisa em vez de descartar em silencio');
  const again = planLabor(many.plan, { adicionar: [{ descricao: 'Função 20', profissionais: 1, salario_mensal: 1000, horas_por_profissional: 8 }, { descricao: 'função 3', profissionais: 2, salario_mensal: 1000, horas_por_profissional: 8 }] });
  assert.equal(again.erros.length, 1, 'so a nova e recusada; repetir uma existente corrige os valores');
  assert.equal(again.plan.laborAdds.find((l) => l.description === 'função 3')?.professionalCount, 2);
  assert.ok(describePlan(plan.plan).some((l) => l.startsWith('Alterar mão de obra 1 (Eletricista): Eletricista, 3 prof.')));
});

function fakeEditApi(failOn?: string) {
  const calls: Array<[string, unknown]> = [];
  const rec = (name: string, payload: unknown) => async () => { calls.push([name, payload]); if (failOn === name) throw new Error(`falhou ${name}`); return {}; };
  const api: EditApi = {
    details: async (id, input) => rec('details', { id, ...input })(),
    updateBdi: async (id, v) => rec('bdi', { id, v })(),
    updateTax: async (id, v) => rec('tax', { id, v })(),
    updateItem: async (id, itemId, patch) => rec('updateItem', { id, itemId, patch })(),
    removeItems: async (id, ids) => rec('removeItems', { id, ids })(),
    importItems: async (id, items) => rec('importItems', { id, items })(),
    addLabor: async (id, input) => rec('addLabor', { id, input })(),
    updateLabor: async (id, laborId, input) => rec('updateLabor', { id, laborId, input })(),
    removeLabor: async (id, laborId) => rec('removeLabor', { id, laborId })(),
  };
  return { api, calls };
}

function fullPlan() {
  let { plan } = planFields(startPlan(base()), { escopo: 'Escopo novo', validade_dias: 30, bdi: 1.4, imposto_pct: 8 }, new Date('2026-10-20T12:00:00Z'));
  plan = planItems(plan, { alterar: [{ item: 1, quantidade: 6 }], remover: [3], adicionar: [{ input: { descricao: 'Extra', quantidade: 1, custo_unitario: 800 } }] }).plan;
  plan = planLabor(plan, { alterar: [{ item: 1, profissionais: 3 }], adicionar: [{ descricao: 'Ajudante', profissionais: 1, salario_mensal: 2000, horas_por_profissional: 40 }] }).plan;
  return plan;
}

test('edicao: aplicar grava na ordem do editor (BDI antes dos itens novos) e usa as horas-padrao certas', async () => {
  const { api, calls } = fakeEditApi();
  const result = await applyPlan(api, fullPlan());
  assert.equal(result.erro, undefined);
  assert.equal(planIsEmpty(result.plan), true);
  assert.deepEqual(calls.map((c) => c[0]), ['details', 'bdi', 'tax', 'updateItem', 'removeItems', 'importItems', 'updateLabor', 'addLabor']);
  assert.equal(JSON.parse((calls[0][1] as Out).scope).notes, 'obs interna');
  assert.equal((calls[0][1] as Out).validUntil, '2026-11-19');
  assert.deepEqual(calls[3][1], { id: 'p1', itemId: 'i1', patch: { quantity: 6 } });
  assert.deepEqual(calls[4][1], { id: 'p1', ids: ['i3'] });
  assert.deepEqual((calls[5][1] as Out).items, [{ description: 'Extra', unit: 'un', quantity: 1, unitCost: 800 }]);
  assert.equal((calls[6][1] as Out).input.standardMonthlyHours, 160, 'alteracao usa as horas-padrao da propria mao de obra');
  assert.equal((calls[7][1] as Out).input.standardMonthlyHours, 176, 'nova usa as horas-padrao da proposta');
});

test('edicao: parou no meio, o cartao guarda so o que falta e a nova tentativa nao repete', async () => {
  const failing = fakeEditApi('removeItems');
  const first = await applyPlan(failing.api, fullPlan());
  assert.match(first.erro ?? '', /Remover itens: falhou removeItems/);
  assert.match(first.erro ?? '', /Já aplicado: Escopo, condições e validade, BDI, Imposto, Alterar item/);
  assert.equal(first.plan.scopeParts, undefined);
  assert.equal(first.plan.bdi, undefined);
  assert.equal(first.plan.itemUpdates.length, 0);
  assert.deepEqual(first.plan.itemRemovals, ['i3']);
  const retry = fakeEditApi();
  const second = await applyPlan(retry.api, first.plan);
  assert.equal(second.erro, undefined);
  assert.deepEqual(retry.calls.map((c) => c[0]), ['removeItems', 'importItems', 'updateLabor', 'addLabor'], 'nao repete detalhes, BDI nem itens ja alterados');
  const none = fakeEditApi();
  const empty = await applyPlan(none.api, startPlan(base()));
  assert.deepEqual(none.calls, []);
  assert.equal(empty.erro, undefined);
});

const CLIENTS = [{ id: 'c1', legalName: 'Condomínio Alfa Ltda', tradeName: 'Condomínio Alfa', document: null, works: [{ id: 'w1', name: 'Bloco A', active: true }] }];
const PRODUCTS = [{ code: 'DVR-8', description: 'DVR 8 canais', unit: 'un', category: 'CFTV', active: true, currentCost: 900 }];

function setup(options: { sees?: boolean; edit?: boolean; proposal?: Partial<ProposalDetail> } = {}) {
  const api = {
    proposal: async () => ({ proposal: { ...PROPOSAL, ...options.proposal } }),
    clients: async (q: string) => ({ clients: CLIENTS.filter((c) => c.legalName.toLowerCase().includes(q.toLowerCase())) }),
    catalog: async (q: string) => ({ products: PRODUCTS.filter((p) => p.code.toLowerCase().includes(q.toLowerCase())) }),
  } as unknown as AssistantApi;
  const nav = { openProposal: () => undefined, navigate: () => undefined, newProposal: () => undefined, openCentroCustos: () => undefined } as AssistantNav;
  const tools = createAssistantTools({ api, seesCost: () => options.sees ?? true, canEdit: () => options.edit ?? true, nav: () => nav });
  const run = async (name: string, args: Record<string, unknown> = {}) => JSON.parse(JSON.stringify(await tools.run({ name, args }))) as Out;
  return { tools, run };
}

test('ferramentas de edicao: abrir so proposta editavel, numeros estaveis e confirmacao so do cartao', async () => {
  const sent = await setup({ proposal: { status: 'sent' } }).run('editar_abrir', { proposta_id: 'p1' });
  assert.match(sent.erro, /está enviada.*reabrir ou criar uma revisão/);
  const old = await setup({ proposal: { isLatest: false } }).run('editar_abrir', { proposta_id: 'p1' });
  assert.match(old.erro, /não é a revisão atual/);
  const { run, tools } = setup();
  assert.ok((await run('editar_campos', { escopo: 'Novo' })).erro, 'sem abrir nao edita');
  assert.ok((await run('editar_abrir', { proposta_id: '../x' })).erro, 'id invalido');
  const open = await run('editar_abrir', { proposta_id: 'p1' });
  assert.equal(open.itens.length, 3);
  assert.equal(open.itens[1].codigo, null, 'item avulso nao tem codigo de catalogo');
  assert.equal(open.itens[0].custo_unitario, 300, 'com p10 o modelo ve o custo');
  assert.equal(open.mao_de_obra[0].numero, 1);
  assert.equal(open.escopo, 'Escopo antigo');
  assert.equal(open.prazo_execucao, '10 dias');

  assert.match((await run('finalizar_edicao')).erro, /nenhuma mudança/);
  const items = await run('editar_itens', { alterar: [{ item: '1', quantidade: 6 }], remover: ['coaxial'], adicionar: [{ codigo: 'dvr-8', quantidade: 1 }, { codigo: 'XYZ', quantidade: 1 }] });
  assert.equal(items.erros.length, 1, 'codigo fora do catalogo e recusado');
  assert.ok(items.mudancas.includes('Alterar item 1 (Câmera IP): quantidade 4 → 6'));
  assert.ok(items.mudancas.includes('Adicionar 1 un · DVR 8 canais (catálogo)'));
  await run('editar_campos', { pagamento: '30 dias', bdi: 1.35 });
  assert.equal(tools.takeEditConfirm(), null);
  assert.match((await run('finalizar_edicao')).aviso, /Nada foi alterado ainda/);
  await run('editar_itens', { remover: [2] });
  assert.equal(tools.takeEditConfirm(), null, 'mudar depois de finalizar exige finalizar de novo');
  await run('finalizar_edicao');
  const card = tools.takeEditConfirm();
  assert.equal(card?.base.id, 'p1');
  assert.equal(tools.takeEditConfirm(), null, 'o cartao entrega uma vez so');
  await run('finalizar_edicao');
  tools.clearPending();
  assert.equal(tools.takeEditConfirm(), null, 'nova pergunta limpa o pedido de cartao');
  assert.equal((await run('editar_descartar')).ok, true);
  assert.equal(tools.getPlan(), null);
  assert.equal(tools.toolNames.some((n) => /enviar|aprovar|excluir|status|aplicar/.test(n)), false, 'a IA nao tem ferramenta para aplicar, enviar, aprovar nem mudar status');
});

test('ferramentas: custo, BDI, imposto e mao de obra so com p10; consulta nao edita', async () => {
  const { run, tools } = setup({ sees: false });
  const open = await run('editar_abrir', { proposta_id: 'p1' });
  assert.equal(open.itens[0].custo_unitario, undefined, 'sem p10 o modelo nao ve custo');
  assert.equal(open.mao_de_obra[0].salario_mensal, undefined);
  assert.equal(open.bdi, undefined);
  assert.match((await run('editar_campos', { bdi: 1.3 })).erro, /não vê nem define custo/);
  assert.match((await run('editar_itens', { alterar: [{ item: 1, custo_unitario: 5 }] })).erro, /não vê nem define custo/);
  assert.match((await run('editar_mao_de_obra', { remover: [1] })).erro, /mão de obra é custo/);
  assert.equal((await run('editar_itens', { alterar: [{ item: 1, quantidade: 8 }] })).mudancas.length, 1, 'quantidade e texto sao liberados sem p10');
  assert.equal(tools.getPlan()?.itemUpdates[0].patch.quantity, 8);

  assert.match((await run('rascunho_mao_de_obra', { adicionar: [{ descricao: 'Eletricista', profissionais: 1, salario_mensal: 1, horas_por_profissional: 1 }] })).erro, /mão de obra é custo/);
  const viewer = setup({ edit: false });
  for (const name of ['editar_abrir', 'editar_campos', 'editar_itens', 'editar_mao_de_obra', 'finalizar_edicao', 'rascunho_mao_de_obra']) assert.ok((await viewer.run(name, { proposta_id: 'p1' })).erro, name);
});

test('rascunho: mao de obra entra pela ferramenta e o commit a grava por ultimo com as horas-padrao da proposta', async () => {
  const { run, tools } = setup();
  await run('rascunho_atualizar', { cliente: 'Condomínio Alfa', obra: 'Bloco A', escopo: 'Instalação de câmeras' });
  const labor = await run('rascunho_mao_de_obra', { adicionar: [{ descricao: 'Eletricista', profissionais: 2, salario_mensal: 3000, horas_por_profissional: 40 }, { descricao: 'Ajudante', profissionais: 1 }] });
  assert.equal(labor.erros.length, 1);
  assert.match(labor.erros[0], /salário mensal, horas por profissional/);
  assert.equal(labor.rascunho.mao_de_obra.length, 1);
  await run('rascunho_itens', { adicionar: [{ descricao: 'Cabo', quantidade: 1 }] });

  const calls: Array<[string, unknown]> = [];
  const api: CommitApi = {
    createClient: async () => ({ clientId: 'c' }), createWork: async () => ({ workId: 'w' }),
    createProposal: async () => { calls.push(['proposal', 1]); return { proposal: { id: 'p-9' } }; },
    updateBdi: async () => ({}), updateTax: async () => ({}),
    standardMonthlyHours: async (id) => { calls.push(['horas', id]); return 168; },
    addLabor: async (id, input) => { calls.push(['labor', { id, input }]); return {}; },
    importItems: async () => { calls.push(['items', 1]); return {}; },
  };
  const result = await commitDraft(api, tools.getDraft());
  assert.equal(result.proposalId, 'p-9');
  assert.deepEqual(calls.map((c) => c[0]), ['proposal', 'items', 'horas', 'labor']);
  assert.deepEqual((calls[3][1] as Out).input, { description: 'Eletricista', professionalCount: 2, monthlySalary: 3000, monthlyFood: 0, monthlyTransport: 0, monthlyOtherCosts: 0, standardMonthlyHours: 168, plannedHours: 40 });
  const failing = await commitDraft({ ...api, addLabor: async () => { throw new Error('recusada'); } }, tools.getDraft());
  assert.equal(failing.proposalId, 'p-9');
  assert.match(failing.aviso ?? '', /mão de obra não entrou/);
  void withClient; void withWork;
  // varias mãos de obra e a segunda falha: o aviso diz o que ja entrou e o que falta (adicionar tudo de novo duplicaria custo)
  const two = addLabor(addLabor(emptyDraft(), [{ descricao: 'Eletricista', profissionais: 2, salario_mensal: 3000, horas_por_profissional: 40 }]).draft, [{ descricao: 'Ajudante', profissionais: 1, salario_mensal: 2000, horas_por_profissional: 40 }]).draft;
  let n = 0;
  const half = await commitDraft({ ...api, addLabor: async () => { n += 1; if (n === 2) throw new Error('recusada'); return {}; } }, { ...two, ...tools.getDraft(), labor: two.labor });
  assert.match(half.aviso ?? '', /Já gravada: Eletricista\./);
  assert.match(half.aviso ?? '', /Falta adicionar na aba Mão de obra: Ajudante\./);
  assert.equal(describeBase(base(), false).mao_de_obra[0].salario_mensal, undefined);
});
