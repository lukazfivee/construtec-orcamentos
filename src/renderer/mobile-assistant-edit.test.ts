import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import type { ProposalDetail } from '../shared/contracts';
import { addLabor, emptyDraft, packScope, parseScope, removeLabor, setFields, summary, withClient, withWork } from './assistant/proposalDraft';
import { describeBase, describePlan, planFields, planItems, planLabor, startPlan, toEditBase } from './assistant/proposalEdit';

// Mao de obra e edicao de proposta existente pela IA no celular (public/m/ia-draft.js, ia-edit.js, ia-tools.js, ia-chat.js):
// mesmas regras do computador (um teste compara as duas implementacoes), so o cartao grava, custo e mao de obra so com p10.
const dir = path.join(process.cwd(), 'public', 'm');
const read = (name: string) => readFileSync(path.join(dir, name), 'utf8');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Out = Record<string, any>;
type Calls = Array<{ path: string; method: string; body: unknown }>;

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
const PRODUCTS = [{ code: 'DVR-8', description: 'DVR 8 canais', unit: 'un', category: 'CFTV', active: true, currentCost: 900 }];
const CLIENTS = [{ id: 'c1', legalName: 'Condomínio Alfa Ltda', tradeName: 'Condomínio Alfa', works: [{ id: 'w1', name: 'Bloco A', active: true }] }];

function load(options: { p10?: boolean; edit?: boolean; proposal?: Partial<ProposalDetail>; fail?: string } = {}) {
  const calls: Calls = [];
  const OC: Record<string, unknown> = {
    cents: (v: number) => Math.round(v * 100) / 100,
    can: () => options.p10 ?? false,
    canEdit: () => options.edit ?? true,
    api: async (p: string, init?: { method?: string; body?: unknown }) => {
      calls.push({ path: p, method: init?.method ?? 'GET', body: init?.body });
      if (options.fail && p.includes(options.fail)) throw new Error(`falhou ${options.fail}`);
      if (p === '/proposals/p1') return { proposal: { ...PROPOSAL, ...options.proposal } };
      if (p.startsWith('/clients?q=')) { const q = decodeURIComponent(p.slice(11)).toLowerCase(); return { clients: CLIENTS.filter((c) => c.legalName.toLowerCase().includes(q)) }; }
      if (p.startsWith('/catalog?q=')) { const q = decodeURIComponent(p.slice(11).split('&')[0]).toLowerCase(); return { products: PRODUCTS.filter((x) => x.code.toLowerCase().includes(q)) }; }
      if (p === '/proposals' && init?.method === 'POST') return { proposal: { id: 'p-9' } };
      if (p.endsWith('/labor') && !init?.method) return { standardMonthlyHours: 168, items: [] };
      return {};
    },
  };
  const sandbox = { window: { OC }, JSON, Number, String, Object, Math, Array, Set, Date, encodeURIComponent, decodeURIComponent };
  for (const file of ['ia-draft.js', 'ia-edit.js', 'ia-tools.js']) runInNewContext(read(file), sandbox);
  const ia = (OC as { ia: Out }).ia;
  const run = async (name: string, args: Record<string, unknown> = {}) => JSON.parse(JSON.stringify(await ia.run({ name, args }))) as Out;
  return { ia, run, calls };
}

const clean = (value: unknown) => JSON.parse(JSON.stringify(value));

test('celular: mao de obra e plano de edicao sao o espelho exato do computador', () => {
  const { ia } = load();
  const D = ia.draft;
  const E = ia.edit;
  const labors = [
    { descricao: ' Técnico ', profissionais: 2, salario_mensal: 2500.456, horas_por_profissional: 40, alimentacao_mensal: 200 },
    { descricao: 'Ajudante', profissionais: 1 },
    { descricao: 'X', profissionais: 0, salario_mensal: 1, horas_por_profissional: 1 },
    { profissionais: 1, salario_mensal: 1, horas_por_profissional: 1 },
    { descricao: 'Eletricista', profissionais: 3, salario_mensal: 3000, horas_por_profissional: 40 },
    { descricao: 'eletricista', profissionais: 4, salario_mensal: 3000, horas_por_profissional: 40 },
  ];
  assert.deepEqual(clean(D.addLabor(D.empty(), labors)), clean(addLabor(emptyDraft(), labors)));
  const withLabor = addLabor(emptyDraft(), labors).draft;
  assert.deepEqual(clean(D.summary(JSON.parse(JSON.stringify(withLabor)))), clean(summary(withLabor)));
  for (const refs of [['1'], [2], ['técnico'], ['zz']]) assert.deepEqual(clean(D.removeLabor(withLabor, refs)), clean(removeLabor(withLabor, refs)));
  for (const raw of ['texto puro', PROPOSAL.scope, '{"scope":"x"}']) assert.deepEqual(clean(D.parseScope(raw)), clean(parseScope(raw)));
  const long = { scope: '"'.repeat(1200), executionTerm: '"'.repeat(300), paymentTerms: '', warranty: '', notes: '\\'.repeat(300) };
  assert.equal(D.packScope(long), packScope(long));
  assert.ok(D.packScope(long).length <= 1200);

  const baseTs = toEditBase(PROPOSAL);
  const baseJs = E.toEditBase(PROPOSAL);
  assert.deepEqual(clean(baseJs), clean(baseTs));
  const now = new Date('2026-10-20T12:00:00Z');
  const fieldsInput = { escopo: 'Escopo novo', pagamento: '50% na entrada', validade_dias: 30, bdi: 1.4, imposto_pct: 8 };
  const tsA = planFields(startPlan(baseTs), fieldsInput, now);
  const jsA = E.planFields(E.startPlan(baseJs), fieldsInput, now);
  assert.deepEqual(clean(jsA), clean(tsA));
  assert.deepEqual(clean(E.planFields(E.startPlan(baseJs), { escopo: 'ab', bdi: 0.5, imposto_pct: 101, validade_dias: 0 })), clean(planFields(startPlan(baseTs), { escopo: 'ab', bdi: 0.5, imposto_pct: 101, validade_dias: 0 })));

  const itemInput = {
    alterar: [{ item: 1, quantidade: 6 }, { item: 'utp', quantidade: 120, custo_unitario: 2.5 }, { item: '3', unidade: 'rolo' }, { item: 'cabo', quantidade: 1 }, { item: 9, quantidade: 1 }, { item: 1, quantidade: -3 }, { item: 1 }],
    remover: [3],
    adicionar: [{ input: { codigo: 'DVR-8', quantidade: 1 }, hit: { code: 'DVR-8', description: 'DVR 8 canais', unit: 'un' } }, { input: { descricao: 'Extra', unidade: 'vb', quantidade: 1, custo_unitario: 800 } }],
  };
  const tsB = planItems(tsA.plan, itemInput);
  const jsB = E.planItems(jsA.plan, itemInput);
  assert.deepEqual(clean(jsB), clean(tsB));
  const laborInput = { alterar: [{ item: 1, profissionais: 3 }, { item: 'pintor', profissionais: 1 }], adicionar: [{ descricao: 'Ajudante', profissionais: 1, salario_mensal: 2000, horas_por_profissional: 40 }, { descricao: 'Z', profissionais: 1 }], remover: [] };
  const tsC = planLabor(tsB.plan, laborInput);
  const jsC = E.planLabor(jsB.plan, laborInput);
  assert.deepEqual(clean(jsC), clean(tsC));
  assert.deepEqual(clean(E.describePlan(jsC.plan)), describePlan(tsC.plan));
  for (const sees of [true, false]) assert.deepEqual(clean(E.describeBase(baseJs, sees)), clean(describeBase(baseTs, sees)));
  void withClient; void withWork; void setFields;
});

test('celular: ferramentas de edicao abrem so proposta editavel, so o cartao grava e a ordem do editor vale', async () => {
  const sent = await load({ p10: true, proposal: { status: 'sent' } }).run('editar_abrir', { proposta_id: 'p1' });
  assert.match(sent.erro, /está enviada.*reabrir ou criar uma revisão/);
  const { run, ia, calls } = load({ p10: true });
  assert.ok((await run('editar_campos', { escopo: 'Novo' })).erro, 'sem abrir nao edita');
  const open = await run('editar_abrir', { proposta_id: 'p1' });
  assert.equal(open.itens.length, 3);
  assert.equal(open.itens[0].custo_unitario, 300);
  assert.equal(open.prazo_execucao, '10 dias');
  assert.match((await run('finalizar_edicao')).erro, /nenhuma mudança/);
  await run('editar_campos', { escopo: 'Escopo novo', validade_dias: 30, bdi: 1.4, imposto_pct: 8 });
  const items = await run('editar_itens', { alterar: [{ item: '1', quantidade: 6 }], remover: ['coaxial'], adicionar: [{ codigo: 'dvr-8', quantidade: 1 }, { codigo: 'XYZ', quantidade: 1 }, { descricao: 'Extra', quantidade: 1, custo_unitario: 800 }] });
  assert.equal(items.erros.length, 1);
  await run('editar_mao_de_obra', { alterar: [{ item: 1, profissionais: 3 }], adicionar: [{ descricao: 'Ajudante', profissionais: 1, salario_mensal: 2000, horas_por_profissional: 40 }] });
  assert.equal(ia.takeEditConfirm(), null);
  await run('finalizar_edicao');
  await run('editar_itens', { remover: [2] });
  assert.equal(ia.takeEditConfirm(), null, 'mudar depois de finalizar exige finalizar de novo');
  await run('finalizar_edicao');
  const plan = ia.takeEditConfirm();
  assert.ok(plan);
  assert.equal(ia.takeEditConfirm(), null);
  assert.equal(calls.filter((c) => c.method !== 'GET').length, 0, 'conversar nao grava nada');

  const result = await ia.edit.applyPlan(plan);
  assert.equal(result.erro, undefined);
  assert.deepEqual(calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.path}`), [
    'PATCH /proposals/p1/details', 'PATCH /proposals/p1/bdi', 'PATCH /proposals/p1/tax', 'PATCH /proposals/p1/items/i1', 'POST /proposals/p1/items/remove',
    'POST /proposals/p1/items/import-batch', 'PATCH /proposals/p1/labor/l1', 'POST /proposals/p1/labor',
  ]);
  const body = (suffix: string) => clean(calls.find((c) => c.path.endsWith(suffix))?.body) as Out;
  assert.equal(JSON.parse(body('/details').scope).notes, 'obs interna');
  assert.equal(body('/details').validUntil.length, 10);
  assert.deepEqual(body('/items/remove'), { itemIds: ['i3', 'i2'] });
  assert.equal(body('/labor/l1').standardMonthlyHours, 160, 'alteracao usa as horas-padrao da propria mao de obra');
  assert.equal(clean(calls.at(-1)?.body).standardMonthlyHours, 176, 'nova usa as horas-padrao da proposta');
  assert.equal(ia.edit.planIsEmpty(result.plan), true);
});

test('celular: parou no meio, o cartao guarda so o que falta e a nova tentativa nao repete', async () => {
  const failing = load({ p10: true, fail: '/items/remove' });
  await failing.run('editar_abrir', { proposta_id: 'p1' });
  await failing.run('editar_campos', { escopo: 'Escopo novo', bdi: 1.4 });
  await failing.run('editar_itens', { alterar: [{ item: 1, quantidade: 6 }], remover: [3] });
  await failing.run('finalizar_edicao');
  const plan = failing.ia.takeEditConfirm();
  const first = await failing.ia.edit.applyPlan(plan);
  assert.match(first.erro, /Remover itens: falhou/);
  assert.match(first.erro, /Já aplicado: Escopo, condições e validade, BDI, Alterar item/);
  assert.equal(first.plan.scopeParts, undefined);
  assert.deepEqual(clean(first.plan.itemRemovals), ['i3']);
  const retry = load({ p10: true });
  await retry.run('editar_abrir', { proposta_id: 'p1' });
  const second = await retry.ia.edit.applyPlan(first.plan);
  assert.equal(second.erro, undefined);
  assert.deepEqual(retry.calls.filter((c) => c.method !== 'GET').map((c) => c.path), ['/proposals/p1/items/remove'], 'nao repete detalhes, BDI nem itens ja alterados');
});

test('celular: custo, BDI, imposto e mao de obra so com p10; consulta nao edita', async () => {
  const { run, ia } = load({ p10: false });
  const open = await run('editar_abrir', { proposta_id: 'p1' });
  assert.equal(open.itens[0].custo_unitario, undefined);
  assert.equal(open.mao_de_obra[0].salario_mensal, undefined);
  assert.equal(open.bdi, undefined);
  assert.match((await run('editar_campos', { bdi: 1.3 })).erro, /não vê nem define custo/);
  assert.match((await run('editar_itens', { alterar: [{ item: 1, custo_unitario: 5 }] })).erro, /não vê nem define custo/);
  assert.match((await run('editar_mao_de_obra', { remover: [1] })).erro, /mão de obra é custo/);
  assert.equal((await run('editar_itens', { alterar: [{ item: 1, quantidade: 8 }] })).mudancas.length, 1);
  assert.equal(ia.getPlan().itemUpdates[0].patch.quantity, 8);
  assert.match((await run('rascunho_mao_de_obra', { adicionar: [{ descricao: 'Eletricista', profissionais: 1, salario_mensal: 1, horas_por_profissional: 1 }] })).erro, /mão de obra é custo/);
  const viewer = load({ edit: false });
  for (const name of ['editar_abrir', 'editar_campos', 'editar_itens', 'editar_mao_de_obra', 'finalizar_edicao', 'rascunho_mao_de_obra']) assert.ok((await viewer.run(name, { proposta_id: 'p1' })).erro, name);
  assert.equal(ia.draft.empty().items.length, 0);
});

test('celular: rascunho com mao de obra e commit por ultimo com as horas-padrao da proposta', async () => {
  const { run, ia, calls } = load({ p10: true });
  await run('rascunho_atualizar', { cliente: 'Condomínio Alfa', obra: 'Bloco A', escopo: 'Instalação de câmeras' });
  const labor = await run('rascunho_mao_de_obra', { adicionar: [{ descricao: 'Eletricista', profissionais: 2, salario_mensal: 3000, horas_por_profissional: 40 }, { descricao: 'Ajudante', profissionais: 1 }] });
  assert.equal(labor.erros.length, 1);
  assert.equal(labor.rascunho.mao_de_obra.length, 1);
  await run('rascunho_itens', { adicionar: [{ descricao: 'Cabo', quantidade: 1 }] });
  const result = await ia.draft.commit(ia.state.draft);
  assert.equal(result.proposalId, 'p-9');
  assert.deepEqual(calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.path}`), ['POST /proposals', 'POST /proposals/p-9/items/import-batch', 'POST /proposals/p-9/labor']);
  assert.deepEqual(clean(calls.at(-1)?.body), { description: 'Eletricista', professionalCount: 2, monthlySalary: 3000, monthlyFood: 0, monthlyTransport: 0, monthlyOtherCosts: 0, standardMonthlyHours: 168, plannedHours: 40 });
  const failing = load({ p10: true, fail: '/labor' });
  const draft = ia.draft.addLabor(ia.draft.empty(), [{ descricao: 'Eletricista', profissionais: 2, salario_mensal: 3000, horas_por_profissional: 40 }]).draft;
  const partial = await failing.ia.draft.commit(ia.draft.withWork(ia.draft.withClient({ ...draft, scope: 'Escopo simples' }, { id: 'c1', name: 'A' }), { id: 'w1', name: 'B' }));
  assert.equal(partial.proposalId, 'p-9');
  assert.match(partial.aviso, /mão de obra não entrou/);
});

test('celular: cartao de edicao so aplica pelo botao e o cartao mais novo vale', () => {
  const chat = read('ia-chat.js');
  assert.match(chat, /const editConfirm = IA\.takeEditConfirm\(\);/);
  assert.match(chat, /reply\.card = editConfirm \? \{ plan: editConfirm, state: 'open' \}/);
  assert.match(chat, /if \(m\.card\.plan\) \{/);
  assert.equal((chat.match(/IA\.edit\.applyPlan/g) ?? []).length, 1, 'so o botao chama o applyPlan');
  assert.equal((chat.match(/IA\.draft\.commit/g) ?? []).length, 1, 'so o botao chama o commit');
  assert.match(chat, /Aplicar alterações/);
  assert.doesNotMatch(read('ia-edit.js') + read('ia-draft.js') + read('ia-tools.js'), /indexedDB|localStorage|sessionStorage/, 'plano e rascunho so na memoria');
  assert.match(read('ia-config.js'), /finalizar_edicao: nada foi alterado até a pessoa tocar em Aplicar alterações/);
});
