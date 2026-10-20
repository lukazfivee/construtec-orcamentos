import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { addItems, emptyDraft, missing, removeItems, scopeForSave, setFields, summary, validUntil, withClient, withWork } from './assistant/proposalDraft';
import type { ProposalDraft } from './assistant/proposalDraft';

// Criar proposta conversando com a IA no celular (public/m/ia-draft.js, ia-tools.js, ia-chat.js): mesmas regras do
// computador (um teste compara as duas implementacoes), so o botao do cartao cria, e a IA nao tem preco nem envio.
const dir = path.join(process.cwd(), 'public', 'm');
const read = (name: string) => readFileSync(path.join(dir, name), 'utf8');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Out = Record<string, any>;
type Call = { name: string; args?: Record<string, unknown> };
type Calls = Array<{ path: string; method: string; body: unknown }>;

const CLIENTS = [
  { id: 'c1', legalName: 'Condomínio Alfa Ltda', tradeName: 'Condomínio Alfa', works: [{ id: 'w1', name: 'Bloco A', active: true }] },
  { id: 'c2', legalName: 'Beta Hospital', tradeName: null, works: [] },
  { id: 'c3', legalName: 'Beta Escola', tradeName: null, works: [] },
];
const PRODUCTS = [{ code: 'CAM-1', description: 'Câmera IP 2MP', unit: 'un', category: 'CFTV', active: true, currentCost: 300 }];

function load(options: { edit?: boolean; fail?: string } = {}) {
  const calls: Calls = [];
  const OC: Record<string, unknown> = {
    cents: (v: number) => Math.round(v * 100) / 100,
    can: () => false,
    canEdit: () => options.edit ?? true,
    api: async (p: string, init?: { method?: string; body?: unknown }) => {
      calls.push({ path: p, method: init?.method ?? 'GET', body: init?.body });
      if (options.fail && p.includes(options.fail)) throw new Error(`falhou ${options.fail}`);
      if (p.startsWith('/clients?q=')) { const q = decodeURIComponent(p.slice(11)).toLowerCase(); return { clients: CLIENTS.filter((c) => `${c.legalName} ${c.tradeName ?? ''} ${c.works.map((w) => w.name).join(' ')}`.toLowerCase().includes(q)) }; }
      if (p.startsWith('/catalog?q=')) { const q = decodeURIComponent(p.slice(11).split('&')[0]).toLowerCase(); return { products: PRODUCTS.filter((x) => x.code.toLowerCase().includes(q) || x.description.toLowerCase().includes(q)) }; }
      if (p === '/clients' && init?.method === 'POST') return { clientId: 'new-client' };
      if (p.endsWith('/works') && init?.method === 'POST') return { workId: 'new-work' };
      if (p === '/proposals' && init?.method === 'POST') return { proposal: { id: 'p-1' } };
      return {};
    },
  };
  const sandbox = { window: { OC }, JSON, Number, String, Object, Math, Array, Set, Date, encodeURIComponent, decodeURIComponent };
  runInNewContext(read('ia-draft.js'), sandbox);
  runInNewContext(read('ia-tools.js'), sandbox);
  const ia = (OC as { ia: Out }).ia;
  const run = async (name: string, args: Record<string, unknown> = {}) => JSON.parse(JSON.stringify(await ia.run({ name, args } as Call))) as Out;
  return { ia, run, calls };
}

const clean = (value: unknown) => JSON.parse(JSON.stringify(value));

test('celular: rascunho e o espelho exato do computador (mesmos resultados nas mesmas entradas)', () => {
  const { ia } = load();
  const D = ia.draft;
  const input = { escopo: '  Instalar   8 câmeras ', prazo_execucao: '20 dias', pagamento: '50% na entrada', garantia: '12 meses', validade_dias: 30, modelo: 'servico' };
  const ts = setFields(withWork(withClient(emptyDraft(), { id: 'c1', name: 'Alfa' }), { newName: 'Sede', address: 'Rua 2' }), input);
  const js = D.setFields(D.withWork(D.withClient(D.empty(), { id: 'c1', name: 'Alfa' }), { newName: 'Sede', address: 'Rua 2' }), input);
  assert.deepEqual(clean(js), clean(ts));
  assert.equal(D.scopeForSave(js.draft), scopeForSave(ts.draft));
  assert.equal(D.validUntil(js.draft, new Date('2026-10-21T01:00:00Z')), validUntil(ts.draft, new Date('2026-10-21T01:00:00Z')));
  assert.deepEqual(clean(D.summary(js.draft)), clean(summary(ts.draft)));
  assert.deepEqual(clean(D.missing(D.empty())), missing(emptyDraft()));
  for (const bad of [{ escopo: 'ab', validade_dias: 0, modelo: 'x' }, { validade_dias: 366 }, { validade_dias: 1.5 }]) {
    assert.deepEqual(clean(D.setFields(D.empty(), bad)), clean(setFields(emptyDraft(), bad)));
  }
  const long = { escopo: 'x'.repeat(1200), pagamento: 'p'.repeat(300), garantia: 'g'.repeat(300) };
  assert.equal(D.scopeForSave(D.setFields(D.empty(), long).draft), scopeForSave(setFields(emptyDraft(), long).draft));
  const quotes = { escopo: '"'.repeat(1200), pagamento: '"'.repeat(300), garantia: '\\'.repeat(300), prazo_execucao: '"'.repeat(300) };
  const jsQuotes = D.scopeForSave(D.setFields(D.empty(), quotes).draft);
  assert.ok(jsQuotes.length <= 1200, 'o limite vale para o JSON ja escapado');
  assert.equal(jsQuotes, scopeForSave(setFields(emptyDraft(), quotes).draft));

  const items = [
    { input: { codigo: 'CAM-1', quantidade: 4 }, hit: { code: 'CAM-1', description: 'Câmera IP', unit: 'un' } },
    { input: { codigo: 'CAM-1', quantidade: 4 }, hit: { code: 'CAM-1', description: 'Câmera IP', unit: 'un' } },
    { input: { descricao: 'Eletroduto', unidade: 'm', quantidade: 10.5 } },
    { input: { descricao: 'x', quantidade: 1 } },
    { input: { descricao: 'Fita', quantidade: 0 } },
  ];
  const tsItems = addItems(emptyDraft(), items);
  const jsItems = D.addItems(D.empty(), items);
  assert.deepEqual(clean(jsItems), clean(tsItems));
  for (const refs of [[2], ['câmera'], [9, 'zz']]) assert.deepEqual(clean(D.removeItems(jsItems.draft, refs)), clean(removeItems(tsItems.draft as ProposalDraft, refs)));
  const many = Array.from({ length: 70 }, (_, i) => ({ input: { descricao: `Item ${i}`, quantidade: 1 } }));
  assert.equal(D.addItems(D.empty(), many).draft.items.length, addItems(emptyDraft(), many).draft.items.length);
});

test('celular: ferramentas resolvem cliente e obra, itens por codigo exato, e so o cartao cria', async () => {
  const { run, ia, calls } = load();
  const one = await run('rascunho_atualizar', { cliente: 'condomínio alfa', obra: 'bloco a', escopo: 'Instalar câmeras' });
  assert.equal(one.rascunho.cliente.situacao, 'já cadastrado');
  assert.equal(one.rascunho.obra.situacao, 'já cadastrada');
  assert.deepEqual(one.rascunho.falta, []);
  const amb = load();
  assert.deepEqual(clean((await amb.run('rascunho_atualizar', { cliente: 'beta' })).cliente_ambiguo).sort(), ['Beta Escola', 'Beta Hospital']);
  assert.ok((await amb.run('rascunho_atualizar', { cliente: 'Gama', escopo: 'Instalar alarme' })).cliente_nao_encontrado);
  assert.equal((await amb.run('rascunho_ver')).rascunho.escopo, 'Instalar alarme', 'o escopo dito junto nao se perde');
  assert.equal((await amb.run('rascunho_atualizar', { cliente: 'Gama', cliente_novo: true, obra: 'Sede' })).rascunho.obra.situacao, 'nova obra');
  assert.ok((await load().run('rascunho_atualizar', { obra: 'Sede' })).erro, 'obra antes do cliente');
  assert.ok((await load().run('rascunho_atualizar', { cliente: 'Bloco A' })).cliente_nao_encontrado, 'nome de obra nao vira cliente');

  const it = await run('rascunho_itens', { adicionar: [{ codigo: 'cam-1', quantidade: 8 }, { codigo: 'XYZ', quantidade: 1 }, { descricao: 'Instalação', unidade: 'vb', quantidade: 1, preco: 9999 }] });
  assert.equal(it.erros.length, 1);
  assert.equal(it.rascunho.itens.length, 2);
  assert.equal(JSON.stringify(it).includes('9999'), false, 'preco dito pela IA nao entra');
  assert.equal(JSON.stringify(it).includes('300'), false, 'custo do catalogo nao volta sem p10');

  assert.equal(ia.takeConfirm(), null);
  assert.match((await run('finalizar_rascunho')).aviso, /AINDA NÃO foi criada/);
  await run('rascunho_itens', { remover: [2] });
  assert.equal(ia.takeConfirm(), null, 'editar depois de finalizar cancela o pedido');
  await run('finalizar_rascunho');
  assert.equal(ia.takeConfirm().items.length, 1);
  assert.equal(ia.takeConfirm(), null, 'o cartao entrega uma vez so');
  assert.equal(calls.filter((c) => c.method === 'POST').length, 0, 'conversar nao grava nada na API');
  const names = ia.declarations({ object: (s: object) => s, string: (s: object) => s, enumString: (s: object) => s, integer: (s: object) => s, number: (s: object) => s, boolean: (s: object) => s, array: (s: object) => s })[0].functionDeclarations.map((d: { name: string }) => d.name);
  assert.equal(names.length, 14);
  assert.equal(names.some((n: string) => /enviar|aprovar|excluir|preco|bdi|criar_proposta/.test(n)), false);
});

test('celular: perfil de consulta nao monta rascunho', async () => {
  const { run } = load({ edit: false });
  for (const name of ['rascunho_atualizar', 'rascunho_itens', 'finalizar_rascunho']) assert.ok((await run(name, { cliente: 'Condomínio Alfa' })).erro, name);
});

test('celular: o commit usa as rotas da tela Nova proposta, sem duplicar na nova tentativa e sem preco inventado', async () => {
  const { ia, calls } = load();
  const D = ia.draft;
  let draft = D.withWork(D.withClient(D.empty(), { newName: 'Gama Ltda' }), { newName: 'Sede', address: 'Rua 2' });
  draft = D.setFields(draft, { escopo: 'Instalar câmeras', pagamento: '50% na entrada', validade_dias: 15, modelo: 'servico' }).draft;
  draft = D.addItems(draft, [{ input: { codigo: 'CAM-1', quantidade: 8 }, hit: { code: 'CAM-1', description: 'Câmera IP', unit: 'un' } }, { input: { descricao: 'Instalação', unidade: 'vb', quantidade: 1 } }]).draft;
  const result = await D.commit(draft, new Date('2026-10-20T12:00:00Z'));
  assert.equal(result.proposalId, 'p-1');
  assert.deepEqual(calls.map((c) => `${c.method} ${c.path}`), ['POST /clients', 'POST /clients/new-client/works', 'POST /proposals', 'POST /proposals/p-1/items/import-batch']);
  const proposal = calls[2].body as Out;
  assert.equal(proposal.validUntil, '2026-11-04');
  assert.equal(proposal.bodyModel, 'servico');
  assert.equal(JSON.parse(proposal.scope).paymentTerms, '50% na entrada');
  assert.deepEqual(clean((calls[3].body as Out).items), [
    { code: 'CAM-1', description: 'Câmera IP', quantity: 8 },
    { description: 'Instalação', unit: 'vb', quantity: 1, unitCost: 0, unitSale: 0 },
  ]);

  assert.match((await D.commit(D.empty())).erro, /cliente, obra, escopo/);
  const bad = load({ fail: '/proposals' });
  const fresh = D.setFields(D.withWork(D.withClient(D.empty(), { newName: 'Gama' }), { newName: 'Sede' }), { escopo: 'Escopo simples' }).draft;
  const first = await bad.ia.draft.commit(fresh);
  assert.equal(first.proposalId, undefined);
  assert.equal(first.draft.clientId, 'new-client', 'o cadastro ja feito fica guardado');
  const retry = load();
  await retry.ia.draft.commit(first.draft);
  assert.deepEqual(retry.calls.map((c) => `${c.method} ${c.path}`), ['POST /proposals'], 'nova tentativa nao cadastra cliente nem obra de novo');
  const withItems = load({ fail: 'import-batch' });
  const partial = await withItems.ia.draft.commit(D.addItems(fresh, [{ input: { descricao: 'Cabo', quantidade: 1 } }]).draft);
  assert.equal(partial.proposalId, 'p-1');
  assert.match(partial.aviso, /itens não entraram/);
});

test('celular: cartao so cria pelo botao, o mais novo vale, e o prompt segue o perfil', () => {
  const chat = read('ia-chat.js');
  const config = read('ia-config.js');
  const html = read('index.html');
  assert.match(chat, /IA\.clearConfirm\(\)/, 'nova pergunta limpa o pedido de cartao');
  assert.match(chat, /const confirm = IA\.takeConfirm\(\);[\s\S]*reply\.card = /);
  assert.match(chat, /if \(m\.card && m\.card\.state === 'open'\) m\.card\.state = 'dismissed'/, 'so o cartao mais novo vale');
  assert.match(chat, /data-card-create/);
  assert.match(chat, /IA\.draft\.commit\(m\.card\.draft\)/);
  assert.equal((chat.match(/IA\.draft\.commit/g) ?? []).length, 1, 'so o botao chama o commit');
  assert.match(chat, /IA\.resetDraft\(\)/);
  assert.match(config, /OC\.canEdit\(\) \? DRAFTING : SO_CONSULTA/);
  assert.match(config, /AINDA NÃO foi criada/);
  assert.match(config, /NUNCA informe preço, custo, BDI nem imposto/);
  assert.ok(html.indexOf('ia-draft.js') > 0 && html.indexOf('ia-draft.js') < html.indexOf('ia-tools.js'), 'ia-draft.js carrega antes das ferramentas');
  assert.doesNotMatch(read('ia-draft.js') + read('ia-tools.js'), /indexedDB|localStorage|sessionStorage/, 'rascunho so na memoria');
});
