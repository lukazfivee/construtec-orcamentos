import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

// Assistente de IA do Orcamentos no celular (public/m): botao flutuante em todas as telas, sem chave do
// Gemini no codigo, ferramentas que respeitam a permissao de custo (p10) e navegam depois da resposta.
const dir = path.join(process.cwd(), 'public', 'm');
const read = (name: string) => readFileSync(path.join(dir, name), 'utf8');

// Resposta das ferramentas: JSON solto, lido campo a campo pelas asserções.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Out = Record<string, any>;
type Call = { name: string; args?: Record<string, unknown> };
type Tools = { OC: { went?: unknown[]; ia: { run: (call: Call) => Promise<Record<string, unknown>>; declarations: (s: unknown) => Array<{ functionDeclarations: Array<{ name: string }> }>; pendingNav?: () => void } } };

function loadTools(api: (p: string) => Promise<unknown>, permissions?: string[]) {
  const location = { href: '' };
  const OC: Record<string, unknown> = {
    cents: (v: number) => Math.round(v * 100) / 100,
    api,
    can: (p: string) => !permissions || permissions.includes(p),
    canEdit: () => true,
    isAdmin: () => false,
    go: (...a: unknown[]) => { (OC as { went?: unknown[] }).went = a; },
    suite: { centroLink: (id?: number) => `suite://app/centro-custos${id ? `?obra=${id}` : ''}` },
  };
  runInNewContext(read('ia-tools.js'), { window: { OC }, location, JSON, Number, String, Object, Math, encodeURIComponent });
  return { OC, location } as unknown as Tools & { location: { href: string } };
}

test('assistente: botao flutuante unico, so com sessao e fora do login, sem chave de API do Gemini', () => {
  const chat = read('ia-chat.js');
  const css = read('m.css');
  assert.match(chat, /fab\.id = 'ia-fab'/);
  assert.match(chat, /fab\.hidden = !OC\.session\.token\(\) \|\| Boolean\(document\.querySelector\('\.login'\)\)/);
  assert.match(chat, /closest\('\[data-ia\]'\)/);
  assert.doesNotMatch(chat + read('ia-config.js') + read('ia-tools.js'), /generativelanguage\.googleapis|x-goog-api-key|indexedDB|localStorage/);
  // App Check (reCAPTCHA v3) antes de usar o Gemini; SDK so em segundo plano e com sessao.
  assert.match(chat, /if \(OC\.iaConfig\.recaptcha\) \{[\s\S]*new check\.ReCaptchaV3Provider\(OC\.iaConfig\.recaptcha\)[\s\S]*\}\s*return \{ ai, backend: ai\.getAI/);
  assert.match(chat, /if \(OC\.session\.token\(\)\) IA\.warm\(\)/);
  assert.match(chat, /sendMessageStream\(content\)/);
  // Texto do modelo passa por esc() antes de virar HTML; a conversa some ao sair ou quando a sessao cai.
  assert.match(chat, /const inline = \(s\) => esc\(s\)/);
  assert.match(chat, /\['logout', 'onUnauthorized'\]/);
  // Botao acima da barra de abas, sobe com a barra de acoes e some com o teclado.
  assert.match(css, /\.ia-fab \{[^}]*position: fixed;[^}]*z-index: 21;/);
  assert.match(css, /body\.no-tabs \.ia-fab \{/);
  assert.match(css, /body:has\(input:focus, textarea:focus, select:focus\) \.ia-fab/);
  assert.doesNotMatch(css, /\.ia-btn/);
});

test('assistente: carrega depois das telas e usa so icones que existem', () => {
  const html = read('index.html');
  const order = ['screen-avisos.js', 'ia-config.js', 'ia-tools.js', 'ia-chat.js'].map((f) => html.indexOf(`src="${f}"`));
  assert.ok(order.every((i) => i > 0) && [...order].sort((a, b) => a - b).join() === order.join(), 'ia-*.js depois das telas, na ordem');
  const icons = read('icons.js');
  for (const name of ['sparkle', 'sparkle-fill', 'paper-plane-right', 'arrow-right', 'x']) assert.match(icons, new RegExp(`^\\s+"${name}":`, 'm'));
});

test('assistente: custo, BDI e margem so chegam ao modelo com p10', async () => {
  const proposal = { id: 'p1', number: 'P-1', revision: 2, clientName: 'Cliente', workName: 'Obra', status: 'sent', isLatest: true, bdiMultiplier: 1.4, taxPercentage: 8,
    scope: 'Escopo', responsibleName: 'Ana', updatedAt: '2026-09-01', costCenterId: 7,
    items: [{ description: 'Cabo', category: 'Eletrica', quantity: 2, unit: 'm', totalCost: 100, totalSale: 140 }],
    laborItems: [{ description: 'Eletricista', professionalCount: 2, plannedTeamHours: 40, totalCost: 900 }],
    totals: { baseCost: 1000, materials: 100, labor: 900, taxAmount: 90, finalValue: 1490, grossResult: 390, marginPercent: 26.17 } };
  const api = async () => ({ proposal });
  const full = await loadTools(api).OC.ia.run({ name: 'ver_proposta', args: { proposta_id: 'p1' } }) as Out;
  assert.equal(full.bdi_multiplicador, 1.4);
  assert.equal(full.totais.custo_base, 1000);
  assert.equal(full.totais.margem_pct, 26.17);
  assert.equal(full.itens_principais[0].custo_total, 100);
  assert.equal(full.mao_de_obra[0].custo_total, 900);
  assert.equal(full.centro_custo_id, 7);

  const blind = JSON.parse(JSON.stringify(await loadTools(api, ['p1']).OC.ia.run({ name: 'ver_proposta', args: { proposta_id: 'p1' } }))) as Out;
  assert.equal(blind.totais.valor_final, 1490, 'valor de venda continua');
  for (const field of ['custo_base', 'materiais', 'mao_de_obra', 'impostos', 'resultado_bruto', 'margem_pct']) assert.equal(blind.totais[field], undefined, field);
  assert.equal(blind.bdi_multiplicador, undefined);
  assert.equal(blind.itens_principais[0].custo_total, undefined);
  assert.equal(blind.itens_principais[0].venda_total, 140);
  assert.equal(blind.mao_de_obra[0].custo_total, undefined);

  const kits = JSON.parse(JSON.stringify(await loadTools(async () => ({ kits: [{ id: 'k', name: 'Kit', category: 'Geral', itemCount: 2, totalEstimatedCost: 50, active: true }] }), ['p1']).OC.ia.run({ name: 'listar_kits', args: {} }))) as Out;
  assert.equal(kits.kits[0].custo_estimado, undefined);
});

test('assistente: listas filtram, erros viram texto e a tela so abre depois da resposta', async () => {
  const seen: string[] = [];
  const { OC, location } = loadTools(async (p) => {
    seen.push(p);
    if (p === '/proposals') return { proposals: [
      { id: 'a', number: 'P-1', revision: 1, clientName: 'Hospital Sao Lucas', workName: 'Obra 1', status: 'sent', totalSale: 1000, isLatest: true },
      { id: 'b', number: 'P-2', revision: 0, clientName: 'Escola', workName: 'Obra 2', status: 'approved', totalSale: 500, isLatest: true },
      { id: 'c', number: 'P-1', revision: 0, clientName: 'Hospital Sao Lucas', workName: 'Obra 1', status: 'draft', totalSale: 900, isLatest: false },
    ] };
    const error = Object.assign(new Error('Seu perfil não permite esta consulta.'), { status: 403 });
    throw error;
  });
  const sent = await OC.ia.run({ name: 'listar_propostas', args: { busca: 'são lucas', status: 'enviada' } });
  assert.equal(sent.total_encontradas, 1);
  assert.equal(sent.soma_valor_venda, 1000);
  assert.equal((await OC.ia.run({ name: 'listar_propostas', args: {} })).total_encontradas, 2, 'so a revisao atual');

  assert.deepEqual({ ...(await OC.ia.run({ name: 'resumo_comercial', args: {} })) }, { erro: 'Seu perfil não permite esta consulta.' });
  assert.equal((await OC.ia.run({ name: 'apagar_tudo', args: {} })).erro, 'Ferramenta desconhecida.');
  assert.ok((await OC.ia.run({ name: 'ver_proposta', args: { proposta_id: '../x' } })).erro, 'id invalido nem vai ao servidor');
  assert.ok(!seen.some((p) => p.includes('..')));
  assert.equal((await OC.ia.run({ name: 'buscar_catalogo', args: { busca: 'a' } })).erro, 'Informe ao menos 2 letras para buscar no catálogo.');

  // Navegacao: nada muda antes da resposta; a acao fica guardada.
  assert.equal((await OC.ia.run({ name: 'abrir_tela', args: { tela: 'proposta', proposta_id: 'a' } })).ok, true);
  assert.equal(OC.went, undefined);
  OC.ia.pendingNav?.();
  assert.equal(JSON.stringify(OC.went), JSON.stringify(['prop', { id: 'a' }]));
  assert.ok((await OC.ia.run({ name: 'abrir_tela', args: { tela: 'proposta' } })).erro);
  assert.ok((await OC.ia.run({ name: 'abrir_tela', args: { tela: 'descartadas' } })).erro, 'descartadas so para administrador');
  await OC.ia.run({ name: 'abrir_tela', args: { tela: 'obra', obra_id: 7 } });
  OC.ia.pendingNav?.();
  assert.equal(location.href, 'suite://app/centro-custos?obra=7');
});

test('assistente: status com acento filtra e o acompanhamento da obra pede p10', async () => {
  const api = async (p: string) => {
    if (p === '/proposals') return { proposals: [{ id: 'a', number: 'P-1', status: 'draft', isLatest: true, totalSale: 10 }, { id: 'b', number: 'P-2', status: 'review', isLatest: true, totalSale: 20 }, { id: 'c', number: 'P-3', status: 'sent', isLatest: true, totalSale: 30 }] };
    return { integrated: true, summary: { costCenterId: 7, costCenterStatus: 'execucao', hasBudget: true, realizedCents: 5000, updatedAt: '2026-10-01' }, fetchedAt: null, stale: false };
  };
  const { OC } = loadTools(api);
  for (const [status, id] of [['em edição', 'a'], ['em revisão', 'b'], ['enviada', 'c']] as const) {
    const out = await OC.ia.run({ name: 'listar_propostas', args: { status } }) as Out;
    assert.deepEqual(Array.from(out.propostas, (p: Out) => p.id), [id], status);
  }
  const semCusto = await loadTools(api, ['p1']).OC.ia.run({ name: 'acompanhamento_obra', args: { proposta_id: 'p1' } });
  assert.match(String(semCusto.erro), /permissão de custo/);
  assert.equal((await OC.ia.run({ name: 'acompanhamento_obra', args: { proposta_id: 'p1' } })).realizado, 50);
});

test('assistente: declaracoes cobrem todas as ferramentas', () => {
  const { OC } = loadTools(async () => ({}));
  const schema = new Proxy({}, { get: (_, kind) => (spec: object) => ({ kind, ...spec }) });
  const names = Array.from(OC.ia.declarations(schema)[0].functionDeclarations, (d) => d.name).sort(); // Array.from: a lista nasce em outro contexto do vm
  const source = read('ia-tools.js');
  const runs = [...source.slice(source.indexOf('const RUN = {'), source.indexOf('IA.run =')).matchAll(/^ {4}async (\w+)\(/gm)].map((m) => m[1]).sort();
  assert.deepEqual(names, runs);
});
