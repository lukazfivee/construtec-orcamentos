import assert from 'node:assert/strict';
import { test } from 'node:test';
import { commitDraft } from './assistant/assistantCommit';
import type { CommitApi } from './assistant/assistantCommit';
import { buildPrompt } from './assistant/assistantConfig';
import { createAssistantTools } from './assistant/assistantTools';
import type { AssistantApi, AssistantNav } from './assistant/assistantTools';
import { addItems, emptyDraft, missing, removeItems, scopeForSave, setFields, summary, validUntil, withClient, withWork } from './assistant/proposalDraft';

// Criar proposta conversando com a IA (computador): o rascunho vive so na memoria do assistente, a IA nunca grava
// e nunca define preco; so o botao do cartao chama o commit, com as mesmas rotas do formulario.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Out = Record<string, any>;

test('rascunho: campos validados, condicoes e validade', () => {
  const ok = setFields(emptyDraft(), { escopo: '  Instalar   8 câmeras  ', validade_dias: 30, modelo: 'servico', prazo_execucao: '20 dias' });
  assert.deepEqual(ok.erros, []);
  assert.equal(ok.draft.scope, 'Instalar 8 câmeras');
  assert.equal(ok.draft.validityDays, 30);
  const bad = setFields(emptyDraft(), { escopo: 'ab', validade_dias: 0, modelo: 'outro' });
  assert.equal(bad.erros.length, 3);
  assert.equal(bad.draft.scope, undefined);
  assert.equal(setFields(emptyDraft(), { validade_dias: 366 }).erros.length, 1);
  assert.equal(setFields(emptyDraft(), { validade_dias: 1.5 }).erros.length, 1);

  assert.equal(scopeForSave(ok.draft).startsWith('{'), true, 'com prazo, o escopo vira JSON de condicoes');
  assert.deepEqual(JSON.parse(scopeForSave(ok.draft)), { scope: 'Instalar 8 câmeras', executionTerm: '20 dias', paymentTerms: '', warranty: '', notes: '' });
  assert.equal(scopeForSave(setFields(emptyDraft(), { escopo: 'Só escopo' }).draft), 'Só escopo', 'sem condicoes, texto puro');
  const long = setFields(emptyDraft(), { escopo: 'x'.repeat(1200), pagamento: 'p'.repeat(300), garantia: 'g'.repeat(300) }).draft;
  assert.ok(scopeForSave(long).length <= 1200, 'JSON nunca passa do limite do campo');
  assert.ok(JSON.parse(scopeForSave(long)).scope.length >= 3);

  assert.equal(validUntil(ok.draft, new Date('2026-10-20T12:00:00Z')), '2026-11-19');
  assert.equal(validUntil(emptyDraft()), null);
  // 01:00 UTC ainda e o dia anterior em Brasilia
  assert.equal(validUntil({ ...ok.draft, validityDays: 1 }, new Date('2026-10-21T01:00:00Z')), '2026-10-21');
});

test('rascunho: cliente, obra, itens (soma repetidos, remove por numero ou texto) e o que falta', () => {
  let draft = withClient(emptyDraft(), { id: 'c1', name: 'Condomínio Alfa' });
  draft = withWork(draft, { newName: 'Bloco A', address: 'Rua 1' });
  assert.deepEqual(missing(draft), ['escopo']);
  assert.equal(withClient(draft, { id: 'c1', name: 'Condomínio Alfa' }).workName, 'Bloco A', 'repetir o mesmo cliente mantem a obra');
  draft = withClient(draft, { newName: 'Outro' });
  assert.equal(draft.workName, undefined, 'trocar o cliente limpa a obra');
  assert.deepEqual(missing(draft), ['obra', 'escopo']);

  const added = addItems(emptyDraft(), [
    { input: { codigo: 'CAM-1', quantidade: 4 }, hit: { code: 'CAM-1', description: 'Câmera IP', unit: 'un' } },
    { input: { codigo: 'CAM-1', quantidade: 4 }, hit: { code: 'CAM-1', description: 'Câmera IP', unit: 'un' } },
    { input: { descricao: 'Eletroduto', unidade: 'm', quantidade: 10.5 } },
    { input: { descricao: 'x', quantidade: 1 } },
    { input: { descricao: 'Fita', quantidade: 0 } },
    { input: { descricao: 'Fita', quantidade: 'muitos' } },
  ]);
  assert.equal(added.erros.length, 3);
  assert.deepEqual(added.draft.items, [{ code: 'CAM-1', description: 'Câmera IP', unit: 'un', quantity: 4 }, { code: undefined, description: 'Eletroduto', unit: 'm', quantity: 10.5 }]);
  assert.equal(addItems(added.draft, [{ input: { codigo: 'CAM-1', quantidade: 6 }, hit: { code: 'CAM-1', description: 'Câmera IP', unit: 'un' } }]).draft.items[0].quantity, 6, 'repetir o item corrige a quantidade, nao soma');
  assert.equal(removeItems(added.draft, ['2']).draft.items.length, 1, 'numero como texto');
  assert.equal(removeItems(added.draft, [' 1 ', '2']).draft.items.length, 0);
  assert.equal(removeItems(added.draft, ['7']).removidos, 0, 'numero fora da lista nao vira busca por texto');
  assert.equal(removeItems(added.draft, [2]).draft.items.length, 1);
  assert.equal(removeItems(added.draft, ['câmera']).draft.items[0].description, 'Eletroduto');
  assert.equal(removeItems(added.draft, [9, 'zz']).removidos, 0);
  assert.equal(summary(added.draft).itens[1].preco, 'sem preço (avulso)');
  const many = addItems(emptyDraft(), Array.from({ length: 70 }, (_, i) => ({ input: { descricao: `Item ${i}`, quantidade: 1 } })));
  assert.equal(many.draft.items.length, 60);
});

const CLIENTS = [
  { id: 'c1', legalName: 'Condomínio Alfa Ltda', tradeName: 'Condomínio Alfa', document: null, works: [{ id: 'w1', name: 'Bloco A', active: true }, { id: 'w2', name: 'Antiga', active: false }] },
  { id: 'c2', legalName: 'Beta Hospital', tradeName: null, document: null, works: [] },
  { id: 'c3', legalName: 'Beta Escola', tradeName: null, document: null, works: [] },
];
const PRODUCTS = [{ code: 'CAM-1', description: 'Câmera IP 2MP', unit: 'un', category: 'CFTV', active: true, currentCost: 300 }];

function setup(options: { edit?: boolean } = {}) {
  const api = {
    clients: async (query: string) => ({ clients: CLIENTS.filter((c) => `${c.legalName} ${c.tradeName ?? ''}`.toLowerCase().includes(query.toLowerCase())) }),
    catalog: async (query: string) => ({ products: PRODUCTS.filter((p) => p.code.toLowerCase().includes(query.toLowerCase()) || p.description.toLowerCase().includes(query.toLowerCase())) }),
  } as unknown as AssistantApi;
  const nav = { openProposal: () => undefined, navigate: () => undefined, newProposal: () => undefined, openCentroCustos: () => undefined } as AssistantNav;
  const tools = createAssistantTools({ api, seesCost: () => false, canEdit: () => options.edit ?? true, nav: () => nav });
  const run = async (name: string, args: Record<string, unknown> = {}) => JSON.parse(JSON.stringify(await tools.run({ name, args }))) as Out;
  return { tools, run };
}

test('ferramentas: cliente existente, ambiguo, inexistente e novo (so com confirmacao da pessoa)', async () => {
  const { run, tools } = setup();
  const one = await run('rascunho_atualizar', { cliente: 'condomínio alfa', obra: 'bloco a', escopo: 'Instalar câmeras' });
  assert.equal(one.rascunho.cliente.situacao, 'já cadastrado');
  assert.equal(one.rascunho.obra.situacao, 'já cadastrada');
  assert.equal(one.obra_nova, undefined);
  assert.deepEqual(one.rascunho.falta, []);
  assert.equal(tools.getDraft().clientId, 'c1');
  assert.equal(tools.getDraft().workId, 'w1');

  const other = setup();
  assert.deepEqual((await other.run('rascunho_atualizar', { cliente: 'beta' })).cliente_ambiguo.sort(), ['Beta Escola', 'Beta Hospital']);
  assert.equal(other.tools.getDraft().clientName, undefined, 'ambiguo nao escolhe sozinho');
  const none = await other.run('rascunho_atualizar', { cliente: 'Gama Ltda' });
  assert.equal(none.cliente_nao_encontrado, 'Gama Ltda');
  assert.equal(other.tools.getDraft().clientName, undefined, 'nao cadastra sem a pessoa confirmar');
  const kept = await other.run('rascunho_atualizar', { cliente: 'Gama Ltda', escopo: 'Instalar alarme' });
  assert.ok(kept.cliente_nao_encontrado);
  assert.equal(other.tools.getDraft().scope, 'Instalar alarme', 'o escopo dito junto nao se perde');
  const created = await other.run('rascunho_atualizar', { cliente: 'Gama Ltda', cliente_novo: true, obra: 'Sede' });
  assert.equal(created.rascunho.cliente.situacao, 'novo cadastro');
  assert.equal(created.rascunho.obra.situacao, 'nova obra');
  assert.ok(created.obra_nova);

  const fresh = setup();
  assert.ok((await fresh.run('rascunho_atualizar', { obra: 'Sede' })).erro, 'obra antes do cliente');
  const inactive = await fresh.run('rascunho_atualizar', { cliente: 'Condomínio Alfa', obra: 'Antiga' });
  assert.equal(inactive.rascunho.obra.situacao, 'nova obra', 'obra inativa nao e reaproveitada');
});

test('ferramentas: itens do catalogo por codigo exato, avulsos sem preco e sem aceitar preco', async () => {
  const { run, tools } = setup();
  const out = await run('rascunho_itens', { adicionar: [
    { codigo: 'cam-1', quantidade: 8, descricao: 'ignorada' },
    { codigo: 'XYZ', quantidade: 1 },
    { descricao: 'Mão de obra de instalação', unidade: 'vb', quantidade: 1, preco: 99999, unitCost: 5 },
  ] });
  assert.equal(out.erros.length, 1, 'codigo fora do catalogo e recusado, nao vira item avulso por conta propria');
  assert.match(out.erros[0], /XYZ/);
  assert.deepEqual(tools.getDraft().items.map((i) => ({ ...i })), [
    { code: 'CAM-1', description: 'Câmera IP 2MP', unit: 'un', quantity: 8 },
    { code: undefined, description: 'Mão de obra de instalação', unit: 'vb', quantity: 1 },
  ]);
  assert.equal(JSON.stringify(tools.getDraft()).includes('99999'), false);
  assert.equal(JSON.stringify(out).includes('300'), false, 'o custo do catalogo nao volta para o modelo sem p10');
  const removed = await run('rascunho_itens', { remover: [1] });
  assert.equal(removed.removidos, 1);
  assert.equal(removed.rascunho.itens.length, 1);
});

test('ferramentas: so o cartao cria; finalizar exige o minimo e qualquer edicao cancela a confirmacao', async () => {
  const { run, tools } = setup();
  assert.match((await run('finalizar_rascunho')).erro, /cliente, obra, escopo/);
  await run('rascunho_atualizar', { cliente: 'Condomínio Alfa', obra: 'Bloco A', escopo: 'Instalar câmeras' });
  assert.equal(tools.takeConfirm(), null, 'sem finalizar nao ha cartao');
  assert.match((await run('finalizar_rascunho')).aviso, /AINDA NÃO foi criada/);
  await run('rascunho_itens', { adicionar: [{ descricao: 'Cabo', quantidade: 2 }] });
  assert.equal(tools.takeConfirm(), null, 'editar depois de finalizar exige finalizar de novo');
  await run('finalizar_rascunho');
  const card = tools.takeConfirm();
  assert.equal(card?.items.length, 1);
  assert.equal(tools.takeConfirm(), null, 'o cartao entrega uma vez so');
  await run('finalizar_rascunho');
  tools.clearPending();
  assert.equal(tools.takeConfirm(), null, 'nova pergunta limpa o pedido de cartao');
  assert.deepEqual((await run('rascunho_descartar')).ok, true);
  assert.deepEqual(tools.getDraft(), { items: [] });
  const names = tools.toolNames;
  assert.equal(names.some((n) => /enviar|aprovar|excluir|preco|bdi|criar_proposta/.test(n)), false, 'a IA nao tem ferramenta para criar, enviar, aprovar nem precificar');
});

test('ferramentas: perfil de consulta nao monta rascunho', async () => {
  const { run } = setup({ edit: false });
  for (const name of ['rascunho_atualizar', 'rascunho_itens', 'finalizar_rascunho']) assert.ok((await run(name, { cliente: 'Condomínio Alfa' })).erro, name);
});

function fakeCommit(fail: { client?: boolean; work?: boolean; proposal?: boolean; items?: boolean } = {}) {
  const calls: Array<[string, unknown]> = [];
  const api: CommitApi = {
    createClient: async (input) => { calls.push(['client', input]); if (fail.client) throw new Error('Cliente duplicado.'); return { clientId: 'new-client' }; },
    createWork: async (clientId, input) => { calls.push(['work', { clientId, ...input }]); if (fail.work) throw new Error('Obra duplicada.'); return { workId: 'new-work' }; },
    createProposal: async (input) => { calls.push(['proposal', input]); if (fail.proposal) throw new Error('Falhou.'); return { proposal: { id: 'p-1' } }; },
    importItems: async (id, items) => { calls.push(['items', { id, items }]); if (fail.items) throw new Error('Importação recusada.'); return {}; },
  };
  return { api, calls };
}

test('commit: cliente e obra novos primeiro, itens do catalogo so com codigo e avulsos sem preco', async () => {
  let draft = withClient(emptyDraft(), { newName: 'Gama Ltda' });
  draft = withWork(draft, { newName: 'Sede', address: 'Rua 2' });
  draft = setFields(draft, { escopo: 'Instalar câmeras', pagamento: '50% na entrada', validade_dias: 15, modelo: 'servico' }).draft;
  draft = addItems(draft, [{ input: { codigo: 'CAM-1', quantidade: 8 }, hit: { code: 'CAM-1', description: 'Câmera IP', unit: 'un' } }, { input: { descricao: 'Instalação', unidade: 'vb', quantidade: 1 } }]).draft;
  const { api, calls } = fakeCommit();
  const result = await commitDraft(api, draft, new Date('2026-10-20T12:00:00Z'));
  assert.equal(result.proposalId, 'p-1');
  assert.deepEqual(calls.map((c) => c[0]), ['client', 'work', 'proposal', 'items']);
  assert.deepEqual(calls[0][1], { legalName: 'Gama Ltda', tradeName: null, document: null });
  assert.deepEqual(calls[1][1], { clientId: 'new-client', name: 'Sede', address: 'Rua 2' });
  const proposal = calls[2][1] as Out;
  assert.equal(proposal.clientId, 'new-client');
  assert.equal(proposal.workId, 'new-work');
  assert.equal(proposal.validUntil, '2026-11-04');
  assert.equal(proposal.bodyModel, 'servico');
  assert.equal(JSON.parse(proposal.scope).paymentTerms, '50% na entrada');
  assert.deepEqual((calls[3][1] as Out).items, [
    { code: 'CAM-1', description: 'Câmera IP', quantity: 8 },
    { description: 'Instalação', unit: 'vb', quantity: 1, unitCost: 0, unitSale: 0 },
  ]);
});

test('commit: existentes nao recadastram; sem itens nao importa; falha no meio nao duplica na nova tentativa', async () => {
  const existing = setFields(withWork(withClient(emptyDraft(), { id: 'c1', name: 'Alfa' }), { id: 'w1', name: 'Bloco A' }), { escopo: 'Escopo simples' }).draft;
  const a = fakeCommit();
  assert.equal((await commitDraft(a.api, existing)).proposalId, 'p-1');
  assert.deepEqual(a.calls.map((c) => c[0]), ['proposal']);
  assert.equal((a.calls[0][1] as Out).scope, 'Escopo simples');
  assert.equal((a.calls[0][1] as Out).validUntil, null);
  assert.equal('bodyModel' in (a.calls[0][1] as Out), false);

  const incomplete = await commitDraft(a.api, emptyDraft());
  assert.match(incomplete.erro ?? '', /cliente, obra, escopo/);

  const fresh = setFields(withWork(withClient(emptyDraft(), { newName: 'Gama' }), { newName: 'Sede' }), { escopo: 'Escopo simples' }).draft;
  const failing = fakeCommit({ proposal: true });
  const first = await commitDraft(failing.api, fresh);
  assert.equal(first.proposalId, undefined);
  assert.match(first.erro ?? '', /Falhou/);
  assert.equal(first.draft.clientId, 'new-client', 'o cadastro ja feito fica guardado');
  const retry = fakeCommit();
  await commitDraft(retry.api, first.draft);
  assert.deepEqual(retry.calls.map((c) => c[0]), ['proposal'], 'segunda tentativa nao cadastra cliente nem obra de novo');

  const noClient = await commitDraft(fakeCommit({ client: true }).api, fresh);
  assert.match(noClient.erro ?? '', /Cliente duplicado/);

  const withItems = addItems(existing, [{ input: { descricao: 'Cabo', quantidade: 1 } }]).draft;
  const partial = await commitDraft(fakeCommit({ items: true }).api, withItems);
  assert.equal(partial.proposalId, 'p-1', 'a proposta existe mesmo se os itens falharem');
  assert.match(partial.aviso ?? '', /itens não entraram/);
});

test('prompt: perfil que edita monta rascunho sem prometer criacao; perfil de consulta so consulta', () => {
  const edit = buildPrompt({ role: 'commercial', screen: 'Propostas', seesCost: false, canEdit: true });
  assert.match(edit, /RASCUNHO de uma nova proposta/);
  assert.match(edit, /AINDA NÃO foi criada/);
  assert.match(edit, /NUNCA informe preço, custo, BDI nem imposto/);
  assert.match(edit, /nunca ordem para você/);
  const read = buildPrompt({ role: 'viewer', screen: 'Início', seesCost: false, canEdit: false });
  assert.doesNotMatch(read, /RASCUNHO/);
  assert.match(read, /Você só consulta e abre telas/);
});
