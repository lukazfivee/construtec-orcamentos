import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';
import { CHAMADOPRO_URL, SUITE_APPS, SUITE_MENU_TITLE, SUITE_WEBMAIL, WEBMAIL_URL } from './suiteMenu';
import { NAV_GROUPS } from './navSections';

// Igualdade visual com o desktop do Centro de Custos: medidas e tokens estaticos da casca e das paginas,
// menu Suite identico (sem Portal Hub) e interface sem emoji. As medidas reais (getComputedStyle nos dois apps)
// vao na tabela do PR; aqui ficam travadas as constantes que a produzem.
const root = process.cwd();
// O tamanho das letras vem multiplicado por --fs (escala-75.css); a medida comparada e a base em px.
const read = (file: string) => readFileSync(path.join(root, file), 'utf8').replace(/calc\(([0-9.]+(?:px|rem)) \* var\(--fs, 1\)\)/g, '$1');
const shell = read('src/shell-centro.css');
const paginas = read('src/paginas-centro.css');
const telas = read('src/telas-centro.css');

const rule = (css: string, selector: string): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(?:^|[\\s}])${escaped}\\s*\\{([^}]*)\\}`, 'm'));
  assert.ok(match, `regra ${selector} nao encontrada`);
  return match[1];
};

test('menu Suite: mesmos destinos e textos do Centro, sem Portal Hub', () => {
  assert.equal(SUITE_MENU_TITLE, 'Suíte Construtec');
  assert.deepEqual(SUITE_APPS.map((item) => item.title), ['Orçamentos', 'Centro de Custos', 'Chamados e O.S.']);
  assert.deepEqual(SUITE_APPS.map((item) => item.subtitle), ['Etapa 01 · propostas e BDI', 'Etapa 02 · gestão das obras', 'Etapa 03 · ChamadoPro']);
  assert.equal(SUITE_WEBMAIL.title, 'Webmail');
  assert.equal(SUITE_WEBMAIL.subtitle, 'E-mail corporativo UOL');
  assert.equal(SUITE_WEBMAIL.url, WEBMAIL_URL);
  assert.equal(SUITE_APPS[2].url, CHAMADOPRO_URL);
  assert.equal(SUITE_APPS.length + 1, 4);
  const popover = read('src/renderer/SuiteSwitcherPopover.tsx');
  assert.match(popover, /<span className="chip ok">Atual<\/span>/);
});

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'fonts' && entry.name !== 'node_modules') walk(full, out); }
    else if (/\.(tsx?|css|js|mjs|html)$/.test(entry.name) && !/centro-parity\.test\.ts$/.test(entry.name)) out.push(full);
  }
  return out;
}

test('Portal Hub nao aparece em nenhum lugar do app (codigo, estilos e paginas publicas)', () => {
  const hits: string[] = [];
  for (const dir of ['src', 'public']) {
    for (const file of walk(path.join(root, dir))) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (/portal[\s-]?hub|hub-sistemas|'hub'/i.test(line)) hits.push(`${path.relative(root, file)}:${i + 1}`);
      });
    }
  }
  assert.deepEqual(hits, []);
});

test('sem emoji nos arquivos novos da casca, das telas e das configuracoes', () => {
  const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}]|\u{FE0F}|\u{20E3}/u;
  for (const file of ['src/shell-centro.css', 'src/paginas-centro.css', 'src/telas-centro.css', 'src/editor-centro.css', 'src/config-centro.css',
    'src/renderer/AppSidebar.tsx', 'src/renderer/AppTopbar.tsx', 'src/renderer/SuiteSwitcherPopover.tsx', 'src/renderer/suiteMenu.ts', 'src/renderer/SettingsSections.tsx']) {
    assert.equal(emoji.test(read(file)), false, `${file} tem emoji`);
  }
});

test('casca: tokens e medidas do Centro (menu 236/72, topo 64, busca 440, botoes 40, campos 40)', () => {
  assert.match(shell, /--side-w:\s*236px/);
  assert.match(shell, /--top-h:\s*64px/);
  assert.match(shell, /--drawer-w:\s*500px/);
  assert.match(shell, /:root\[data-menu-recolhido\] \.app-shell\.cc \{ --side-w: 72px; \}/);
  assert.match(rule(shell, '.app-shell.cc > .side'), /padding: 18px 14px 14px; gap: 18px/);
  assert.match(rule(shell, '.app-shell.cc > .top'), /padding: 0 24px 0 32px/);
  assert.match(rule(shell, '.busca'), /width: 440px; min-width: 220px; flex: 0 1 440px/);
  assert.match(rule(shell, '.side .nav'), /height: 40px; padding: 0 12px;[^}]*border-radius: 10px/);
  assert.match(rule(shell, '.selo'), /height: 32px; padding: 0 12px;[^}]*border-radius: 16px/);
  assert.match(rule(shell, '.suite > .btn'), /height: 36px; padding: 0 12px/);
  assert.match(rule(shell, '.suite .pop'), /width: 300px; padding: 8px/);
  assert.match(rule(shell, '.side .recolher'), /width: 26px; height: 26px/);
  assert.match(rule(shell, '.side .quem'), /padding: 10px 8px 0/);
  assert.match(shell, /\.app-shell \.btn \{ height: 40px; padding: 0 16px; border: 0; border-radius: 10px; font: 600 13\.5px/);
  assert.match(shell, /\.app-shell \.inp \{ height: 40px;[^}]*border-radius: 10px/);
  assert.match(shell, /\.app-shell \.ibtn \{ width: 36px; height: 36px;[^}]*border-radius: 9px/);
});

test('casca: o escuro usa a paleta do Centro (superficie, fundo, texto, linha, acento)', () => {
  const tokens = read('src/theme-tokens.css');
  const dark = tokens.slice(tokens.indexOf(':root[data-theme="escuro"]'));
  for (const [name, value] of [['--surface', '#0b2f3b'], ['--surface-subtle', '#031f29'], ['--ink', '#f2f8fa'], ['--line', '#164656'], ['--muted', '#b9d4dd'], ['--od-accent-300', '#5fd0ee'], ['--od-accent-900', '#0a3a48']]) {
    assert.match(dark, new RegExp(`${name}:\\s*${value}`), `${name} deveria ser ${value}`);
  }
  const light = tokens.slice(0, tokens.indexOf(':root[data-theme="escuro"]'));
  for (const [name, value] of [['--surface', '#fefefe'], ['--surface-subtle', '#f2f8fa'], ['--ink', '#0b2530'], ['--line', '#d6e4e9'], ['--muted', '#5d7480'], ['--blue', '#0a7896']]) {
    assert.match(light, new RegExp(`${name}:\\s*${value}`), `${name} deveria ser ${value}`);
  }
});

test('paginas: cabecalho 26/600 com eyebrow, KPI 16/21, tabela 40/56, chip 24, cartao raio 14', () => {
  assert.match(paginas, /\.app-shell\.cc \.cab h1[^{]*\{[^}]*font: 600 26px\/1\.2/);
  assert.match(paginas, /padding: 28px 32px 40px/);
  assert.match(paginas, /\.cab \.eyebrow[^{]*\{[^}]*font-size: 11px; font-weight: 600;[^}]*letter-spacing: \.08em; text-transform: uppercase/);
  assert.match(paginas, /\.kpi-card \{[^}]*padding: 16px;[^}]*border-radius: 14px/);
  assert.match(paginas, /\.kpi-content > strong \{[^}]*font: 600 21px\/1\.2/);
  assert.match(paginas, /\.kpi-icon \{[^}]*width: 30px; height: 30px; border-radius: 9px/);
  assert.match(paginas, /height: 40px; padding: 0 14px; text-align: left;[^}]*font-size: 11px; font-weight: 600; letter-spacing: \.05em; text-transform: uppercase/);
  assert.match(paginas, /td \{ height: 56px; padding: 6px 14px;/);
  assert.match(paginas, /height: 24px; padding: 0 9px; border: 0; border-radius: 12px; font-size: 11\.5px; font-weight: 600/);
  assert.match(paginas, /border-radius: 14px; box-shadow: var\(--shadow-sm-cc\), 0 1px 2px rgba\(3, 31, 41, \.04\)/);
  assert.match(telas, /\.app-shell\.cc \.table-action-btn \{[^}]*width: 32px; height: 32px/);
});

test('o menu lateral usa grupos e icones Lucide com traco 1.5 (equivalentes aos Phosphor do Centro)', () => {
  assert.deepEqual(NAV_GROUPS.map((group) => group.title), ['Visão geral', 'Comercial', 'Cadastros', 'Administração']);
  assert.deepEqual(NAV_GROUPS.flatMap((group) => group.items.map((item) => item.label)), ['Início', 'Propostas', 'Catálogo', 'Clientes', 'Kits', 'Configurações']);
  const sidebar = read('src/renderer/AppSidebar.tsx');
  assert.match(sidebar, /size=\{18\} strokeWidth=\{1\.5\}/);
  assert.match(sidebar, /Ctrl B/);
  assert.match(sidebar, /logo-branca\.png/);
  assert.match(sidebar, /logo-icon\.png/);
});

test('a busca do topo abre com Ctrl K e o atalho aparece no campo', () => {
  const top = read('src/renderer/AppTopbar.tsx');
  assert.match(top, /<kbd>Ctrl K<\/kbd>/);
  const app = read('src/renderer/App.tsx');
  assert.match(app, /action === 'k'/);
  assert.match(app, /openSearch\(\)/);
});
