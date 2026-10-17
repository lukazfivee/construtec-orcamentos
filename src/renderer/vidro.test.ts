import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';

// Vidro: a cortina, o painel e o desfoque ficam so em src/vidro.css, com os tokens do Centro de Custos.
const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const vidro = read('src/vidro.css');
const scrims = ['dialog-backdrop', 'modal-overlay', 'modal-backdrop', 'cid-overlay', 'od-drawer-bg', 'side-drawer-scrim'];

test('vidro.css define os tokens e e o ultimo CSS do renderer', () => {
  for (const token of ['--vidro-blur: 14px', '--vidro-blur-painel: 12px', '--vidro-saturar: 1.2', '--vidro-cortina', '--vidro-painel', '--vidro-borda', '--vidro-brilho']) assert.ok(vidro.includes(token), token);
  assert.match(vidro, /--vidro-cortina:\s*rgba\(2, 13, 20, \.55\)/);
  const imports = [...read('src/renderer.tsx').matchAll(/import '\.\/([\w-]+\.css)'/g)].map((m) => m[1]);
  assert.equal(imports[imports.length - 1], 'vidro.css');
});

test('toda cortina usa o token, com desfoque e fallback sem backdrop-filter', () => {
  const rule = vidro.match(/([^{}]*dialog-backdrop[^{}]*)\{([^}]*)\}/);
  assert.ok(rule, 'regra da cortina');
  for (const name of scrims) assert.ok(rule[1].includes(`.${name}`), name);
  assert.match(rule[2], /background:\s*var\(--vidro-cortina\)/);
  assert.match(rule[2], /backdrop-filter:\s*var\(--vidro-filtro\)/);
  assert.match(vidro, /@supports not \(\(backdrop-filter/);
  assert.match(vidro, /prefers-reduced-motion/);
  assert.match(vidro, /prefers-reduced-transparency/);
});

test('os outros CSS nao repetem cortina nem desfoque', () => {
  for (const file of ['src/index.css', 'src/desktop-polish.css', 'src/impeccable-audit.css', 'src/dialogos-centro.css', 'src/paginas-centro.css', 'src/proposal-pages.css', 'src/assistant.css', 'src/renderer/catalogImportDialog.css', 'src/renderer/orcDesk.css']) {
    const css = read(file);
    assert.ok(!/backdrop-filter:\s*blur/.test(css), `${file} com blur proprio`);
    for (const name of scrims) {
      for (const m of css.matchAll(new RegExp('[.]' + name + '\\b[^{}]*[{]([^}]*)[}]', 'g'))) assert.ok(!/background(-color)?:/.test(m[1]), `${file}: .${name} com fundo proprio`);
    }
  }
});
