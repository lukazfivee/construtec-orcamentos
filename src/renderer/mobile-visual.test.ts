import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

// Visual do celular (public/m) e da pagina do cliente (public/c): contraste dos tokens nos dois temas, barras fixas com
// fundo opaco, area segura e metas de cor. Sao checagens de arquivo; a auditoria com navegador fica fora da CI.
const root = process.cwd();
const m = (name: string) => readFileSync(path.join(root, 'public', 'm', name), 'utf8');
const c = (name: string) => readFileSync(path.join(root, 'public', 'c', name), 'utf8');

type Tokens = Record<string, string>;
const vars = (block: string): Tokens => Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((x) => [x[1], x[2].trim()]));
const blockOf = (css: string, open: RegExp) => {
  const match = open.exec(css);
  assert.ok(match, `bloco ${open} nao encontrado`);
  const rest = css.slice(match.index + match[0].length);
  return rest.slice(0, rest.indexOf('}'));
};
const channel = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (hex: string) => {
  const raw = hex.replace('#', '');
  const h = raw.length === 3 ? [...raw].map((x) => x + x).join('') : raw;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const css = m('m.css');
const light = vars(blockOf(css, /^:root\s*\{/m));
const dark = { ...light, ...vars(blockOf(css, /^html\[data-theme="escuro"\]\s*\{/m)) };
const PAIRS: Array<[string, string]> = [
  ['text', 'bg'], ['text', 'surface'], ['text', 'n800'], ['n300', 'bg'], ['n300', 'surface'],
  ['on-accent', 'btn'], ['accent-300', 'bg'], ['accent-300', 'surface'], ['accent-300', 'accent-900'],
  ['danger', 'bg'], ['danger', 'surface'], ['warn', 'warn-soft'], ['warn-text', 'warn-soft'], ['tab-ink', 'bg'],
];

for (const [theme, tokens] of [['claro', light], ['escuro', dark]] as const) {
  test(`/m/: contraste dos tokens no tema ${theme} (texto 4.5:1)`, () => {
    for (const [fg, bg] of PAIRS) {
      assert.ok(tokens[fg] && tokens[bg], `token ${fg} ou ${bg} ausente`);
      const value = ratio(tokens[fg], tokens[bg]);
      assert.ok(value >= 4.5, `${fg} sobre ${bg} no tema ${theme}: ${value.toFixed(2)}:1`);
    }
  });
}

test('/m/: botao de marca usa o par de contraste, nunca branco fixo sobre #12a9d1', () => {
  assert.match(css, /\.btn \{[^}]*background: var\(--btn\); color: var\(--on-accent\)/);
  assert.match(m('orc.css'), /a\.btn \{ color: var\(--on-accent\); \}/);
  for (const file of ['m.css', 'orc.css']) assert.doesNotMatch(m(file), /background: var\(--accent\); color: #fff/, `${file}: texto branco sobre a cor de marca clara`);
});

test('/m/: barras fixas tem fundo opaco, encostam na borda e respeitam a area segura', () => {
  const actions = css.match(/\.actions \{[^}]*\}/)?.[0] ?? '';
  assert.match(actions, /position: sticky; bottom: 0/);
  assert.match(actions, /background: var\(--bg\)/);
  assert.match(actions, /var\(--sab\)/);
  // faixa sob a barra de abas: o conteudo nao aparece atras dela nem atras do home indicator
  const scrim = css.match(/body:not\(\.no-tabs\)::after \{[^}]*\}/)?.[0] ?? '';
  assert.match(scrim, /position: fixed/);
  assert.match(scrim, /var\(--bg\)/);
  assert.match(scrim, /var\(--sab\)/);
  assert.match(css, /html, body \{[^}]*background: var\(--bg\)/);
  assert.match(css, /scroll-padding-bottom/);
});

test('/m/: entrada animada nao alarga a pagina e o cabecalho interno nao come o titulo', () => {
  assert.match(css, /#view \{ overflow-x: clip; \}/);
  assert.match(css, /\.top \.back ~ \.suite-pill \.sp-t/);
  assert.match(m('core.js'), /class="sp-t"/);
  assert.match(m('screen-imp.js'), /class="sp-t"/);
  assert.match(css, /\.seg button \{ min-height: 44px/);
  assert.match(css, /\.back \{ flex: none; width: 44px; height: 44px/);
});

test('/m/: metas de cor e esquema para claro e escuro, tambem no tema escolhido no app', () => {
  const html = m('index.html');
  assert.match(html, /name="theme-color" content="#f2f8fa" media="\(prefers-color-scheme: light\)"/);
  assert.match(html, /name="theme-color" content="#031f29" media="\(prefers-color-scheme: dark\)"/);
  assert.match(html, /name="color-scheme" content="light dark"/);
  assert.match(m('core.js'), /\$\$\('meta\[name="theme-color"\]'\)\.forEach/);
  assert.match(m('core.js'), /style\.colorScheme/);
  assert.equal(light.bg, '#f2f8fa');
  assert.equal(dark.bg, '#031f29');
});

test('/m/: teclado nao cobre folha nem campo', () => {
  const core = m('core.js');
  assert.match(core, /visualViewport/);
  assert.match(core, /focusin/);
});

test('/c/: pagina do cliente com tema, contraste, campos de 16px e area segura', () => {
  const style = c('c.css');
  const lightC = vars(blockOf(style, /^:root\s*\{/m));
  const darkC = { ...lightC, ...vars(blockOf(style, /@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{/)) };
  for (const [theme, t] of [['claro', lightC], ['escuro', darkC]] as const) {
    for (const [fg, bg] of [['text', 'bg'], ['muted', 'bg'], ['muted', 'surface'], ['accent-d', 'bg'], ['accent-d', 'surface'], ['on-accent', 'accent-d'], ['warn', 'warn-soft'], ['bad', 'bg'], ['bad', 'surface']] as const) {
      const value = ratio(t[fg], t[bg]);
      assert.ok(value >= 4.5, `/c/ ${fg} sobre ${bg} no tema ${theme}: ${value.toFixed(2)}:1`);
    }
  }
  assert.match(style, /color-scheme: dark/);
  assert.match(style, /input\[type=text\], textarea \{[^}]*font-size: 16px/);
  assert.match(style, /\.bar \{[^}]*safe-area-inset-bottom/);
  const html = c('index.html');
  assert.match(html, /name="color-scheme" content="light dark"/);
  assert.match(html, /prefers-color-scheme: dark/);
});
