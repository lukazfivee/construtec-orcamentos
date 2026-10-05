import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';
import { parseThemeMode, resolveTheme, THEME_COLORS, THEME_STORAGE_KEY } from './theme';

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

// ---------- logica do tema ----------
test('tema: escolha salva vence; automatico segue o sistema', () => {
  assert.equal(parseThemeMode('escuro'), 'escuro');
  assert.equal(parseThemeMode('claro'), 'claro');
  assert.equal(parseThemeMode('qualquer'), 'auto');
  assert.equal(parseThemeMode(null), 'auto');
  assert.equal(resolveTheme('auto', true), 'escuro');
  assert.equal(resolveTheme('auto', false), 'claro');
  assert.equal(resolveTheme('claro', true), 'claro');
  assert.equal(resolveTheme('escuro', false), 'escuro');
});

test('index.html aplica o tema antes da pintura com a mesma chave, meta color-scheme e theme-color', () => {
  const html = read('index.html');
  assert.ok(html.includes(`'${THEME_STORAGE_KEY}'`));
  assert.match(html, /<meta name="color-scheme" content="light dark"/);
  assert.match(html, /<meta name="theme-color"/);
  assert.ok(html.includes(THEME_COLORS.claro) && html.includes(THEME_COLORS.escuro));
  assert.ok(html.indexOf('dataset.theme') < html.indexOf('/src/renderer.tsx'), 'script do tema deve vir antes do app');
});

// ---------- tokens ----------
const tokensCss = read('src/theme-tokens.css');
const split = tokensCss.indexOf(':root[data-theme="escuro"]');
const declarations = (block: string) => {
  const out = new Map<string, string>();
  for (const m of block.matchAll(/(--[\w-]+):\s*([^;]+);/g)) out.set(m[1], m[2].trim());
  return out;
};
const light = declarations(tokensCss.slice(0, split));
const darkOnly = declarations(tokensCss.slice(split));
const dark = new Map([...light, ...darkOnly]);

test('todo token tem valor nos dois temas', () => {
  assert.ok(split > 0 && light.size > 80);
  for (const name of light.keys()) assert.ok(darkOnly.has(name), `${name} sem valor no tema escuro`);
  for (const name of darkOnly.keys()) assert.ok(light.has(name), `${name} so existe no escuro`);
  assert.match(tokensCss, /color-scheme:\s*light/);
  assert.match(tokensCss, /color-scheme:\s*dark/);
});

function cssFiles(dir: string, out: string[] = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'fonts' && entry.name !== 'node_modules') cssFiles(full, out); }
    else if (/\.(css|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}
const sources = cssFiles(path.join(root, 'src')).filter((file) => !/proposal-pdf-page\.css$/.test(file));

test('todo var(--token) usado no desktop esta definido', () => {
  const defined = new Set<string>();
  for (const file of sources) for (const m of readFileSync(file, 'utf8').matchAll(/(--[\w-]+)\s*:/g)) defined.add(m[1]);
  const missing = new Set<string>();
  for (const file of sources) {
    for (const m of readFileSync(file, 'utf8').matchAll(/var\((--[\w-]+)/g)) if (!defined.has(m[1])) missing.add(`${m[1]} (${path.relative(root, file)})`);
  }
  assert.deepEqual([...missing], []);
});

const channel = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = (hex: string) => 0.2126 * channel(parseInt(hex.slice(1, 3), 16)) + 0.7152 * channel(parseInt(hex.slice(3, 5), 16)) + 0.0722 * channel(parseInt(hex.slice(5, 7), 16));
const ratio = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const get = (theme: Map<string, string>, name: string) => { const v = theme.get(name); assert.ok(v && /^#[0-9a-f]{6}$/i.test(v), `${name} precisa ser #rrggbb`); return v as string; };

const textOnSurface = ['--ink', '--ink-secondary', '--muted', '--muted-ink', '--danger', '--blue-ink', '--green-ink'];
const pairs: Array<[string, string]> = [
  ['--on-fill', '--blue'], ['--on-fill', '--fill-ink'], ['--on-fill', '--fill-ink-2'], ['--on-fill', '--fill-muted'], ['--on-fill', '--green'],
  ['--status-draft-text', '--status-draft-bg'], ['--status-review-text', '--status-review-bg'], ['--status-sent-text', '--status-sent-bg'],
  ['--status-approved-text', '--status-approved-bg'], ['--status-rejected-text', '--status-rejected-bg'],
  ['--od-ok-fg', '--od-ok-bg'], ['--od-warn-fg', '--od-warn-bg'], ['--od-bad-fg', '--od-bad-bg'], ['--od-neu-fg', '--od-neu-bg'],
  ['--blue-ink', '--blue-soft'], ['--danger', '--danger-soft'],
];

for (const [label, theme] of [['claro', light], ['escuro', dark]] as const) {
  test(`contraste minimo 4.5:1 no tema ${label}`, () => {
    for (const surface of ['--surface', '--surface-subtle']) {
      for (const name of textOnSurface) {
        assert.ok(ratio(get(theme, name), get(theme, surface)) >= 4.5, `${name} sobre ${surface} (${label}): ${ratio(get(theme, name), get(theme, surface)).toFixed(2)}`);
      }
    }
    for (const [fg, bg] of pairs) assert.ok(ratio(get(theme, fg), get(theme, bg)) >= 4.5, `${fg} sobre ${bg} (${label}): ${ratio(get(theme, fg), get(theme, bg)).toFixed(2)}`);
  });
}

test('escuro: todo token de texto (--tx-*) passa 4.5:1 nas duas superficies', () => {
  for (const name of dark.keys()) {
    if (!name.startsWith('--tx-')) continue;
    for (const surface of ['--surface', '--surface-subtle']) assert.ok(ratio(get(dark, name), get(dark, surface)) >= 4.5, `${name} sobre ${surface}: ${ratio(get(dark, name), get(dark, surface)).toFixed(2)}`);
  }
});

test('escuro: borda de campo (--line-strong) passa 3:1 e tema escuro fica abaixo do claro em luminosidade', () => {
  assert.ok(ratio(get(dark, '--line-strong'), get(dark, '--surface')) >= 3);
  assert.ok(luminance(get(dark, '--surface')) < 0.05 && luminance(get(light, '--surface')) > 0.9);
  assert.ok(luminance(get(dark, '--surface-subtle')) < luminance(get(dark, '--surface')), 'fundo da pagina mais fundo que o cartao');
});

// ---------- regressao: nada de fundo branco fixo ----------
test('desktop nao volta a usar fundo branco fixo (usa var(--surface)); o PDF/DOC fica claro', () => {
  const offenders: string[] = [];
  for (const file of sources.filter((f) => f.endsWith('.css') && !/theme-tokens\.css$/.test(f))) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (/background(-color)?\s*:\s*(#fff(fff)?|white)\b(?!\s*url)/i.test(line) && !/pdf-thumb-box/.test(line)) offenders.push(`${path.relative(root, file)}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, []);
  const pdf = read('src/renderer/ProposalPdfView.tsx');
  assert.ok(pdf.includes('<meta name="color-scheme" content="light">'), 'iframe do PDF deve declarar color-scheme claro');
  assert.match(read('src/proposal-pdf-page.css'), /\.pg \{[^}]*background: #fff/);
  assert.match(read('src/theme-dark.css'), /\.pdf-thumb-box \{ background: #fff; \}/);
});

test('alternancia de tema existe na barra superior e em Configuracoes', () => {
  assert.ok(read('src/renderer/AppTopbar.tsx').includes('theme-toggle'));
  assert.ok(read('src/renderer/SettingsWorkspace.tsx').includes('<AppearancePanel />'));
  const panel = read('src/renderer/AppearancePanel.tsx');
  for (const label of ['Automático', 'Claro', 'Escuro']) assert.ok(panel.includes(label));
});
