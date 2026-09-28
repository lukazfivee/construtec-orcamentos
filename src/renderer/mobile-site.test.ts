import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

// Orcamentos no celular (public/m): site estatico, sem build. Estes testes pegam
// arquivo esquecido, icone inexistente, emoji e o redirecionamento da raiz.
const root = process.cwd();
const dir = path.join(root, 'public', 'm');
const read = (name: string) => readFileSync(path.join(dir, name), 'utf8');

test('/m/: todo arquivo citado no index existe', () => {
  const html = read('index.html');
  const refs = [...html.matchAll(/(?:src|href)="([^"#:]+)"/g)].map((m) => m[1]);
  assert.ok(refs.includes('core.js') && refs.includes('orc.css'));
  for (const ref of refs) assert.ok(existsSync(path.join(dir, ref)), `falta public/m/${ref}`);
});

test('/m/: todo icone usado existe em icons.js', () => {
  const icons = read('icons.js');
  const known = new Set([...icons.matchAll(/^\s+"([a-z-]+)":/gm)].map((m) => m[1]));
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'icons.js')) {
    for (const m of read(file).matchAll(/icon\('([a-z-]+)'/g)) assert.ok(known.has(m[1]), `${file}: icone ${m[1]} nao existe`);
  }
  for (const tab of ['squares-four', 'file-text', 'stack', 'list']) assert.ok(known.has(`${tab}-fill`), `aba sem ${tab}-fill`);
});

test('/m/: sem emojis nos textos', () => {
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  for (const file of readdirSync(dir).filter((f) => /\.(js|html|css)$/.test(f))) assert.ok(!emoji.test(read(file)), `${file} tem emoji`);
});

test('raiz manda o app Suite e o celular para /m/ levando o fragmento', () => {
  const html = readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /SuiteConstrutec/);
  assert.match(html, /location\.replace\('\/m\/' \+ location\.search \+ location\.hash\)/);
  assert.match(html, /sessionStorage\.getItem\('orc_versao'\) === 'completa'/);
});
