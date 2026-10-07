import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';

// Editor da proposta: a coluna central tem UMA rolagem vertical; os paineis das abas crescem com o conteudo. Antes um
// `.labor-panel { overflow: hidden }` do index.css vencia o `overflow: auto` da propria aba e cortava Mao de obra.
const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const layout = read('src/editor-layout-centro.css');
const base = read('src/index.css');

const bodyOf = (css: string, selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const bodies = [...css.matchAll(new RegExp(`(?:^|[\\s}])${escaped}\\s*\\{([^}]*)\\}`, 'gm'))].map((match) => match[1]);
  assert.ok(bodies.length > 0, `regra ${selector} nao encontrada`);
  return bodies.join(' ');
};

test('editor-layout-centro.css entra depois dos CSS do editor que ele sobrescreve', () => {
  const renderer = read('src/renderer.tsx');
  const order = ['./editor-itens-centro.css', './editor-paineis-centro.css', './editor-layout-centro.css'].map((file) => renderer.indexOf(file));
  assert.ok(order.every((index) => index >= 0) && order[0] < order[1] && order[1] < order[2], 'ordem dos imports');
});

test('o conteiner central do editor rola na vertical e pode encolher (overflow-y auto, min-height 0)', () => {
  assert.match(bodyOf(layout, '.app-shell.cc .proposal-editor'), /overflow-y:\s*auto/);
  assert.match(bodyOf(base, '.proposal-editor'), /min-height:\s*0/);
  assert.match(bodyOf(base, '.workspace'), /minmax\(0,\s*1fr\)/);
});

test('paineis das abas nao tem overflow proprio: crescem com o conteudo e a coluna central rola', () => {
  const rule = layout.match(/\.app-shell\.cc \.proposal-items-panel,[^{]*\{([^}]*)\}/);
  assert.ok(rule, 'regra conjunta dos paineis');
  for (const name of ['.proposal-items-panel', '.history-region', '.labor-panel', '.proposal-kits-panel']) assert.ok(rule[0].includes(`.app-shell.cc ${name}`), `${name} fora da regra`);
  assert.match(rule[1], /overflow:\s*visible/);
  assert.match(rule[1], /height:\s*auto/);
});

test('abas internas e cabecalho de colunas ficam fixos no topo da coluna central', () => {
  const tabs = bodyOf(layout, '.app-shell.cc .proposal-editor > .section-tabs');
  assert.match(tabs, /position:\s*sticky/);
  assert.match(tabs, /top:\s*0/);
  assert.match(tabs, /height:\s*40px/);
  assert.match(bodyOf(layout, '.app-shell.cc .proposal-items-panel .proposal-items-table thead th'), /top:\s*40px/);
});

test('painel lateral rola so como reserva e as acoes ficam em grade', () => {
  assert.match(bodyOf(base, '.commercial-panel'), /overflow-y:\s*auto/);
  assert.match(bodyOf(layout, '.app-shell.cc .commercial-panel .panel-section.actions'), /grid-template-columns/);
});

test('ruido removido do painel Resumo/Acoes: nota demonstrativa, Pre-visualizar repetido e atalhos em kbd', () => {
  const summary = read('src/renderer/ProposalSummaryPanel.tsx');
  assert.ok(!summary.includes('Base inicial demonstrativa'));
  assert.ok(!summary.includes('demo-data-note'));
  assert.ok(!/<Eye\b/.test(summary), 'Pre-visualizar ja existe no cabecalho (PDF) e em Ctrl+P');
  assert.ok(!/<kbd>/.test(summary), 'atalhos ficam no title dos botoes');
});
