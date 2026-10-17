// Testes da parte logica do kit de conferencia (extracao da Referencia e comparacao). Rodam em `npm run verify`.
import assert from 'node:assert/strict';
import test from 'node:test';
import { extrairEstados, extrairTelas, extrairTokens, textosEstaticos } from './referencia.mjs';
import { compararTokens, corParaHex, formatarLista, normalizarTexto, textosAusentes } from './divergencias.mjs';

const prototipo = `<html><head><style>:root{--color-bg:#f2f8fa;--color-text:#0b2530;--c-warn:#8a5200}[data-theme="escuro"]{--color-bg:#031f29;--color-text:#f2f8fa}</style></head><body>
<div><aside>Menu fixo da casca</aside>
<sc-if value="{{ sPainel }}"><h1>Início</h1><p>Visão geral de orçamentos</p><span>{{ total }}</span></sc-if>
<sc-if value="{{ sProps }}"><h1>Central de Propostas</h1><input placeholder="Buscar por número"><button aria-label="Exportar CSV">x</button></sc-if>
<sc-if value="{{ dOn }}"><div>gaveta</div></sc-if>
<sc-if value="{{ dNova }}"><b>Nova proposta</b><p>Começa como REV 01 em edição</p></sc-if>
<sc-if value="{{ dAdd }}"><b>Adicionar à {{ num }}</b></sc-if>
</div></body></html>`;

test('extrairTokens separa os valores do tema claro e do escuro', () => {
  const t = extrairTokens(prototipo);
  assert.equal(t.claro['--color-bg'], '#f2f8fa');
  assert.equal(t.escuro['--color-bg'], '#031f29');
  assert.equal(t.claro['--c-warn'], '#8a5200');
  assert.equal(t.escuro['--c-warn'], undefined);
});

test('textosEstaticos ignora expressoes dinamicas e guarda placeholder e aria-label', () => {
  const textos = textosEstaticos('<h1>Início</h1><span>{{ total }}</span><p>Olá {{ nome }}, bem-vindo</p><input placeholder="Buscar por número"><button aria-label="Exportar CSV">x</button>');
  assert.deepEqual(textos, ['Início', 'Buscar por número', 'Exportar CSV']);
});

test('extrairTelas devolve os textos de cada tela e de cada gaveta', () => {
  const telas = extrairTelas(prototipo);
  assert.deepEqual(Object.keys(telas), ['sPainel', 'sProps', 'dNova', 'dAdd']);
  assert.deepEqual(telas.sPainel, ['Início', 'Visão geral de orçamentos']);
  assert.ok(telas.sProps.includes('Central de Propostas'));
  assert.deepEqual(telas.dNova, ['Nova proposta', 'Começa como REV 01 em edição']);
  assert.deepEqual(telas.dAdd, []);
});

test('extrairEstados lista os quadros de uma rodada com id, titulo, texto e estado inicial', () => {
  const rodada = `<section class="dv-turn" id="t21"><div class="dv-thd"><a class="dv-tid" href="#t21">21</a><span class="dv-tname">Orçamentos · PDF e comparativo</span></div>
  <div class="dv-opt" id="21a"><div class="dv-olabel"><a class="dv-oid" href="#21a">21a</a><span><b>Proposta · Resumo.</b> Ícone de PDF no cabeçalho.</span></div><dc-import name="Main" start="fromPdf" bare="{{ yes }}"></dc-import></div>
  <div class="dv-opt" id="21b"><div class="dv-olabel"><a class="dv-oid" href="#21b">21b</a><span><b>PDF da proposta.</b> Abre carregando.</span></div><dc-import name="Main" start="pdf"></dc-import></div></section>`;
  const e = extrairEstados(rodada);
  assert.equal(e.rodada, '21');
  assert.equal(e.titulo, 'Orçamentos · PDF e comparativo');
  assert.deepEqual(e.quadros, [
    { id: '21a', titulo: 'Proposta · Resumo.', texto: 'Ícone de PDF no cabeçalho.', inicio: 'fromPdf' },
    { id: '21b', titulo: 'PDF da proposta.', texto: 'Abre carregando.', inicio: 'pdf' },
  ]);
});

test('os prototipos reais do repositorio ainda tem o formato que o extrator entende', async () => {
  const { gerarReferencia } = await import('./referencia.mjs');
  const { fileURLToPath } = await import('node:url');
  const raiz = fileURLToPath(new URL('../..', import.meta.url));
  const ref = gerarReferencia(raiz);
  for (const chave of ['sPainel', 'sProps', 'sProp', 'sPdf', 'sCmp', 'sCat', 'sImp', 'sEx', 'sKits', 'sClis', 'sCfg', 'dNova', 'dKit']) {
    assert.ok(chave in ref.desktop.telas, `tela ${chave} some do DesktopOrc.dc.html`);
  }
  assert.ok(ref.desktop.telas.sProps.includes('Propostas'));
  assert.equal(ref.desktop.tokens.claro['--color-bg'], '#f2f8fa');
  assert.equal(ref.desktop.tokens.escuro['--color-bg'], '#031f29');
  assert.deepEqual(ref.rodadas.map((r) => r.rodada), ['21', '22', '23', '24']);
  assert.ok(ref.rodadas.every((r) => r.quadros.length >= 20 && r.quadros.every((q) => q.id && q.titulo)));
});

test('normalizarTexto ignora caixa, espacos repetidos e pontuacao final', () => {
  assert.equal(normalizarTexto('  Nova   PROPOSTA. '), 'nova proposta');
});

test('textosAusentes acusa so o que a tela nao tem', () => {
  const tela = 'Central de Propostas\nBuscar por número\nNova proposta';
  assert.deepEqual(textosAusentes(['Central de propostas', 'Exportar CSV', 'Nova proposta.'], tela), ['Exportar CSV']);
});

test('corParaHex entende hex curto, rgb e rgba opaco', () => {
  assert.equal(corParaHex('#FFF'), '#ffffff');
  assert.equal(corParaHex('rgb(242, 248, 250)'), '#f2f8fa');
  assert.equal(corParaHex('rgba(3, 31, 41, 1)'), '#031f29');
  assert.equal(corParaHex('rgba(3, 31, 41, 0.5)'), 'rgba(3,31,41,0.5)');
});

test('compararTokens aponta so as cores que diferem da Referencia', () => {
  const ref = { '--color-bg': '#f2f8fa', '--color-text': '#0b2530', '--shadow-sm': '0 0 0 1px #d6e4e9' };
  const real = { '--color-bg': 'rgb(242, 248, 250)', '--color-text': '#111111' };
  const difere = compararTokens(ref, real);
  assert.equal(difere.length, 1);
  assert.deepEqual(Object.values(difere[0]), ['--color-text', '#0b2530', '#111111']);
  // Token que o app nem define (valor vazio) nao e divergencia de cor: o app usa outro nome para ele.
  assert.deepEqual(compararTokens({ '--c-tab': '#031f29' }, { '--c-tab': '' }), []);
});

test('formatarLista agrupa por tela e diz quando esta tudo conferido', () => {
  const md = formatarLista([
    { tela: 'Propostas', referencia: 'sProps', resolucao: '1440x900', tema: 'claro', itens: [{ tipo: 'texto', descricao: 'Texto da Referência ausente: "Exportar CSV"' }] },
    { tela: 'Início', referencia: 'sPainel', resolucao: '1440x900', tema: 'claro', itens: [] },
  ]);
  assert.match(md, /## Propostas/);
  assert.match(md, /Texto da Referência ausente: "Exportar CSV"/);
  assert.match(md, /## Início[\s\S]*sem divergência/);
});
