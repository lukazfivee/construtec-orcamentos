import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { appCheckAllowed, buildPrompt } from './assistant/assistantConfig';
import { parseMarkdown } from './assistant/assistantMarkdown';
import { createAssistantTools } from './assistant/assistantTools';
import type { AssistantApi, AssistantNav, SchemaBuilder } from './assistant/assistantTools';

// Assistente de IA do Orcamentos no computador (src/renderer/assistant): botao flutuante, sem chave do
// Gemini no codigo, ferramentas que respeitam a permissao de custo (p10) e navegam depois da resposta.
const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

// Respostas das APIs: dados parciais lidos campo a campo; o tipo exato do app nao importa aqui.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Out = Record<string, any>;

const PROPOSAL = { id: 'p1', number: 'P-1', revision: 2, clientName: 'Cliente', workName: 'Obra', status: 'sent', isLatest: true, bdiMultiplier: 1.4, taxPercentage: 8,
  scope: 'Escopo', responsibleName: 'Ana', updatedAt: '2026-09-01', costCenterId: 7,
  items: [{ description: 'Cabo', category: 'Eletrica', quantity: 2, unit: 'm', totalCost: 100, totalSale: 140 }],
  laborItems: [{ description: 'Eletricista', professionalCount: 2, plannedTeamHours: 40, totalCost: 900 }],
  totals: { cost: 100, sale: 140, baseCost: 1000, materials: 100, labor: 900, taxAmount: 90, finalValue: 1490, grossResult: 390, marginPercent: 26.17 } };

const LIST = [
  { id: 'a', number: 'P-1', revision: 1, clientName: 'Hospital Sao Lucas', workName: 'Obra 1', status: 'sent', totalSale: 1000, isLatest: true },
  { id: 'b', number: 'P-2', revision: 0, clientName: 'Escola', workName: 'Obra 2', status: 'approved', totalSale: 500, isLatest: true },
  { id: 'c', number: 'P-1', revision: 0, clientName: 'Hospital Sao Lucas', workName: 'Obra 1', status: 'draft', totalSale: 900, isLatest: false },
  { id: 'd', number: 'P-3', revision: 0, clientName: 'Fabrica', workName: 'Obra 3', status: 'draft', totalSale: 300, isLatest: true },
];

type Fakes = { [K in keyof AssistantApi]?: (arg?: string) => Promise<unknown> };

function setup(options: { api?: Fakes; sees?: boolean; edit?: boolean } = {}) {
  const went: unknown[][] = [];
  const seen: string[] = [];
  const reject = async () => { throw Object.assign(new Error('Seu perfil não permite esta consulta.'), { status: 403 }); };
  const api = {
    proposals: async () => ({ proposals: LIST }),
    proposal: async (id: string) => { seen.push(id); return { proposal: PROPOSAL }; },
    history: reject, tracking: reject, dashboard: reject, clients: reject, kits: reject, catalog: reject,
    ...options.api,
  } as unknown as AssistantApi;
  const nav: AssistantNav = {
    openProposal: (id) => went.push(['proposta', id]),
    navigate: (section) => went.push(['secao', section]),
    newProposal: () => went.push(['nova']),
    openCentroCustos: (id) => went.push(['centro', id]),
  };
  const tools = createAssistantTools({ api, seesCost: () => options.sees ?? true, canEdit: () => options.edit ?? true, nav: () => nav });
  const run = async (name: string, args: Record<string, unknown> = {}) => JSON.parse(JSON.stringify(await tools.run({ name, args }))) as Out;
  return { tools, run, went, seen };
}

test('assistente: custo, BDI e margem so chegam ao modelo com p10', async () => {
  const full = await setup().run('ver_proposta', { proposta_id: 'p1' });
  assert.equal(full.bdi_multiplicador, 1.4);
  assert.equal(full.totais.custo_base, 1000);
  assert.equal(full.totais.margem_pct, 26.17);
  assert.equal(full.itens_principais[0].custo_total, 100);
  assert.equal(full.mao_de_obra[0].custo_total, 900);
  assert.equal(full.centro_custo_id, 7);

  const blind = await setup({ sees: false }).run('ver_proposta', { proposta_id: 'p1' });
  assert.equal(blind.totais.valor_final, 1490, 'valor de venda continua');
  for (const field of ['custo_base', 'materiais', 'mao_de_obra', 'impostos', 'resultado_bruto', 'margem_pct']) assert.equal(blind.totais[field], undefined, field);
  assert.equal(blind.bdi_multiplicador, undefined);
  assert.equal(blind.itens_principais[0].custo_total, undefined);
  assert.equal(blind.itens_principais[0].venda_total, 140);
  assert.equal(blind.mao_de_obra[0].custo_total, undefined);
  assert.ok(!JSON.stringify(blind).includes('1000') && !JSON.stringify(blind).includes('26.17'), 'nenhum numero de custo vaza');

  const kits = { kits: async () => ({ kits: [{ id: 'k', name: 'Kit', category: 'Geral', itemCount: 2, totalEstimatedCost: 50, active: true }] }) };
  assert.equal((await setup({ api: kits }).run('listar_kits')).kits[0].custo_estimado, 50);
  assert.equal((await setup({ api: kits, sees: false }).run('listar_kits')).kits[0].custo_estimado, undefined);

  const catalog = { catalog: async () => ({ products: [{ code: 'C1', description: 'Cabo 2,5mm', category: 'Eletrica', unit: 'm', currentCost: 3.5, manufacturer: null, active: true }, { code: 'C2', description: 'Cabo velho', active: false }] }) };
  const withCost = await setup({ api: catalog }).run('buscar_catalogo', { busca: 'cabo' });
  assert.equal(withCost.total, 1, 'item inativo fica de fora');
  assert.equal(withCost.itens[0].custo_unitario, 3.5);
  assert.equal((await setup({ api: catalog, sees: false }).run('buscar_catalogo', { busca: 'cabo' })).itens[0].custo_unitario, undefined);
});

test('assistente: acompanhamento da obra (orcado e realizado) so com p10', async () => {
  const tracking = { tracking: async () => ({ integrated: true, fetchedAt: '2026-10-01', stale: false, centerUrl: null,
    summary: { contractId: 'x', costCenterId: 7, costCenterName: 'Obra', costCenterStatus: 'execucao', hasBudget: true, baseline: { id: 'b', version: 1, contractValueCents: 200000, baseCostCents: 150000, sealedAt: null },
      realizedCents: 50000, realizedPercent: 33.3, balanceCents: 100000, overBudget: false, updatedAt: '2026-10-01' } }) };
  const full = await setup({ api: tracking }).run('acompanhamento_obra', { proposta_id: 'p1' });
  assert.equal(full.valor_contrato, 2000);
  assert.equal(full.custo_orcado, 1500);
  assert.equal(full.realizado, 500);
  assert.equal(full.obra_id, 7);
  const blind = await setup({ api: tracking, sees: false }).run('acompanhamento_obra', { proposta_id: 'p1' });
  assert.ok(blind.erro);
  assert.equal(JSON.stringify(blind).includes('1500'), false);
  const none = await setup({ api: { tracking: async () => ({ integrated: false, summary: null, fetchedAt: null, stale: false, centerUrl: null }) } }).run('acompanhamento_obra', { proposta_id: 'p1' });
  assert.equal(none.sem_obra, true);
});

test('assistente: listas filtram, ids sao validados e erros viram texto', async () => {
  const { run, seen } = setup();
  const sent = await run('listar_propostas', { busca: 'são lucas', status: 'enviada' });
  assert.equal(sent.total_encontradas, 1);
  assert.equal(sent.soma_valor_venda, 1000);
  assert.equal((await run('listar_propostas')).total_encontradas, 3, 'so a revisao atual');
  assert.equal((await run('listar_propostas', { status: 'em edição' })).total_encontradas, 1, 'status com acento filtra');
  assert.equal((await run('listar_propostas', { status: 'aprovada' })).propostas[0].numero, 'P-2');

  assert.deepEqual(await run('resumo_comercial'), { erro: 'Seu perfil não permite esta consulta.' });
  assert.equal((await run('apagar_tudo')).erro, 'Ferramenta desconhecida.');
  for (const id of ['../x', '', 'a/b', 'x'.repeat(65)]) assert.ok((await run('ver_proposta', { proposta_id: id })).erro, `id invalido: ${id}`);
  assert.ok((await run('historico_revisoes', { proposta_id: '../x' })).erro);
  assert.ok((await run('acompanhamento_obra', { proposta_id: 'a b' })).erro);
  assert.deepEqual(seen, [], 'id invalido nem vai ao servidor');
  await run('ver_proposta', { proposta_id: 'p1' });
  assert.deepEqual(seen, ['p1']);
  assert.equal((await run('buscar_catalogo', { busca: 'a' })).erro, 'Informe ao menos 2 letras para buscar no catálogo.');

  const dash = { dashboard: async () => ({ summary: { activeProposalsCount: 4, approvedProposalsCount: 2, totalInNegotiation: 1000.456, totalApproved: 500, totalClientsCount: 3, totalProductsCount: 9, totalKitsCount: 1, recentProposals: [] } }) };
  const summary = await setup({ api: dash }).run('resumo_comercial');
  assert.equal(summary.total_em_negociacao, 1000.46);
  assert.equal(summary.taxa_conversao_pct, undefined, 'sem inteligencia comercial nao quebra');

  const clients = { clients: async () => ({ clients: [{ id: 'c1', legalName: 'Cliente SA', tradeName: null, document: null, works: [{ name: 'Obra A', active: true }, { name: 'Obra B', active: false }], contact: { name: 'Ana', role: '', email: 'a@x.com', phone: '' } }] }) };
  const found = await setup({ api: clients }).run('listar_clientes', { busca: 'cli' });
  assert.deepEqual(found.clientes[0].obras, ['Obra A']);
  assert.equal(found.clientes[0].contato.email, 'a@x.com');

  const offline = await setup({ api: { dashboard: async () => { throw new TypeError('Failed to fetch'); } } }).run('resumo_comercial');
  assert.equal(offline.erro, 'Sem conexão com o servidor.');
});

test('assistente: a tela so abre depois da resposta e respeita perfil e ids', async () => {
  const { tools, run, went } = setup();
  assert.equal((await run('abrir_tela', { tela: 'proposta', proposta_id: 'a' })).ok, true);
  assert.deepEqual(went, [], 'nada muda antes da resposta');
  tools.takePending()?.run();
  assert.deepEqual(went, [['proposta', 'a']]);
  assert.equal(tools.takePending(), null, 'a acao e entregue uma vez so');

  await run('abrir_tela', { tela: 'catalogo' });
  const pending = tools.takePending();
  assert.equal(pending?.label, 'Catálogo');
  pending?.run();
  await run('abrir_tela', { tela: 'configuracoes' });
  tools.takePending()?.run();
  await run('abrir_tela', { tela: 'centro_custos' });
  tools.takePending()?.run();
  await run('abrir_tela', { tela: 'obra', obra_id: 7 });
  tools.takePending()?.run();
  await run('abrir_tela', { tela: 'nova_proposta' });
  tools.takePending()?.run();
  assert.deepEqual(went.slice(1), [['secao', 'Catálogo'], ['secao', 'Configurações'], ['centro', undefined], ['centro', 7], ['nova']]);

  for (const args of [{ tela: 'proposta' }, { tela: 'proposta', proposta_id: '../x' }, { tela: 'obra' }, { tela: 'obra', obra_id: -1 }, { tela: 'obra', obra_id: 1.5 }, { tela: 'obra', obra_id: true }, { tela: 'obra', obra_id: '7x' }, { tela: 'obra', obra_id: null },{ tela: 'descartadas' }, { tela: 'x' }]) {
    const out = await run('abrir_tela', args);
    assert.ok(out.erro, JSON.stringify(args));
    assert.equal(tools.takePending(), null);
  }
  const viewer = setup({ edit: false });
  assert.ok((await viewer.run('abrir_tela', { tela: 'nova_proposta' })).erro, 'consulta nao cria proposta');
  assert.equal(viewer.tools.takePending(), null);

  // Uma nova pergunta descarta a tela pedida na anterior.
  await run('abrir_tela', { tela: 'kits' });
  tools.clearPending();
  assert.equal(tools.takePending(), null);
});

test('assistente: declaracoes cobrem todas as ferramentas e o prompt segue a permissao', () => {
  const { tools } = setup();
  const schema = new Proxy({}, { get: (_, kind) => (spec: object) => ({ kind, ...spec }) }) as SchemaBuilder;
  const names = tools.declarations(schema)[0].functionDeclarations.map((d) => d.name).sort();
  assert.deepEqual(names, [...tools.toolNames].sort());
  assert.equal(names.length, 9);

  const withCost = buildPrompt({ name: 'Ana', role: 'admin', screen: 'Propostas', seesCost: true, now: new Date('2026-10-10T15:00:00Z') });
  assert.match(withCost, /Ana, perfil administrador\. Tela aberta agora: Propostas\. Esta pessoa pode ver custo/);
  assert.match(withCost, /sábado, 10\/10\/2026/);
  const blind = buildPrompt({ role: 'viewer', screen: 'Início', seesCost: false });
  assert.match(blind, /NÃO pode ver custo, BDI nem margem/);
  assert.doesNotMatch(blind, /Esta pessoa pode ver custo/);
});

test('assistente: App Check so em site https fora de localhost', () => {
  assert.equal(appCheckAllowed({ protocol: 'https:', hostname: 'construtec-orcamentos-cloud.construtec-reports.workers.dev' }), true);
  for (const place of [{ protocol: 'file:', hostname: '' }, { protocol: 'http:', hostname: '127.0.0.1' }, { protocol: 'https:', hostname: 'localhost' }, { protocol: 'https:', hostname: '127.0.0.1' }, { protocol: 'http:', hostname: 'exemplo.com' }]) {
    assert.equal(appCheckAllowed(place), false, `${place.protocol}//${place.hostname}`);
  }
});

test('assistente: markdown da resposta vira dados (paragrafos, listas e negrito), nunca HTML', () => {
  const blocks = parseMarkdown('## Resumo\nValor **R$ 1.000,00** hoje\n- primeiro\n* segundo **forte**\n1. terceiro\n\n<img src=x onerror=alert(1)>');
  assert.deepEqual(blocks[0], { kind: 'p', parts: [{ text: 'Resumo', bold: false }] });
  assert.deepEqual(blocks[1], { kind: 'p', parts: [{ text: 'Valor ', bold: false }, { text: 'R$ 1.000,00', bold: true }, { text: ' hoje', bold: false }] });
  const list = blocks[2];
  assert.equal(list.kind, 'ul');
  assert.equal(list.kind === 'ul' && list.items.length, 3);
  const raw = blocks[3];
  assert.deepEqual(raw, { kind: 'p', parts: [{ text: '<img src=x onerror=alert(1)>', bold: false }] }, 'tags ficam como texto');
  assert.deepEqual(parseMarkdown(''), []);
});

test('assistente: sem chave do Gemini, sem armazenamento local e sem HTML cru', () => {
  const files = ['assistantApi.ts', 'assistantChat.ts', 'assistantConfig.ts', 'assistantMarkdown.ts', 'assistantTools.ts'].map((f) => read(`src/renderer/assistant/${f}`));
  files.push(read('src/renderer/AssistantFab.tsx'), read('src/renderer/AssistantLog.tsx'));
  const source = files.join('\n');
  assert.doesNotMatch(source, /generativelanguage\.googleapis|x-goog-api-key|GEMINI_API_KEY/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML|innerHTML/);
  // SDK so do CDN do Google e sem dependencia nova.
  assert.match(read('src/renderer/assistant/assistantConfig.ts'), /SDK_BASE = 'https:\/\/www\.gstatic\.com\/firebasejs\/12\.19\.0\/'/);
  assert.doesNotMatch(read('package.json'), /"firebase"/);
  assert.match(read('src/renderer/assistant/assistantChat.ts'), /import\(\/\* @vite-ignore \*\//);
  // App Check nunca impede a conversa.
  assert.match(read('src/renderer/assistant/assistantChat.ts'), /if \(typeof location !== 'undefined' && appCheckAllowed\(location\)\) \{\s*try \{[\s\S]*\} catch \{/);
});

test('assistente: botao so no App (depois do login), em camada abaixo de toasts e modais, e a CSP libera o SDK', () => {
  const app = read('src/renderer/App.tsx');
  assert.match(app, /<AssistantFab[\s\S]*?\/>\s*<\/div>\s*<\/SuiteUserProvider>/);
  assert.match(read('src/renderer.tsx'), /import '\.\/assistant\.css'/);
  const css = read('src/assistant.css');
  assert.match(css, /\.assistant-fab \{[^}]*position: fixed;[^}]*z-index: 35;/);
  assert.match(css, /\.assistant-panel \{[^}]*z-index: 36;/);
  assert.match(css, /body:has\(\.proposal-items-fab-menu\) \.assistant-fab/);
  assert.match(css, /body:has\(\.proposal-items-fab\) \.assistant-fab/);
  assert.match(css, /\.grecaptcha-badge \{ visibility: hidden; \}/);
  for (const z of [...css.matchAll(/z-index: (\d+)/g)].map((m) => Number(m[1]))) assert.ok(z < 60 || (z >= 66 && z < 70), `z-index ${z} fora da faixa`);
  const html = read('index.html');
  const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)?.[1] ?? '';
  assert.match(csp, /script-src 'self' 'unsafe-inline' 'unsafe-eval' file: https:\/\/www\.gstatic\.com https:\/\/www\.google\.com\/recaptcha\/ https:\/\/www\.gstatic\.com\/recaptcha\//);
  assert.match(csp, /connect-src[^;]*https:\/\/firebasevertexai\.googleapis\.com[^;]*https:\/\/firebaseinstallations\.googleapis\.com[^;]*https:\/\/content-firebaseappcheck\.googleapis\.com[^;]*https:\/\/www\.google\.com/);
  assert.match(csp, /frame-src https:\/\/www\.google\.com\/recaptcha\/ https:\/\/recaptcha\.google\.com/);
  assert.doesNotMatch(csp, /\*\.googleapis\.com|script-src[^;]*\*/, 'sem curinga');
  // O plugin de CSP do Vite (so em dev) procura o inicio do script-src; ele tem que continuar la.
  assert.ok(html.includes(read('vite.renderer.config.mjs').match(/replace\(\s*"([^"]+)"/)?.[1] ?? '\0'));
});
