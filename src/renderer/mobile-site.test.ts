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

test('/m/: arquivos do celular com ate 350 linhas (exceto os antigos maiores)', () => {
  for (const file of ['screen-descarte.js', 'descarte.css', 'screen-prop.js', 'screen-misc.js', 'app.js']) {
    assert.ok(read(file).split('\n').length <= 350, `${file} passou de 350 linhas`);
  }
});

test('/m/: excluir, descartar e recuperar usam as rotas do servidor e respeitam os papeis', () => {
  const js = read('screen-descarte.js');
  assert.match(js, /\?mode=all`, \{ method: 'DELETE' \}/);
  assert.match(js, /\/discard`, \{ method: 'POST', body: \{ confirmNumber:/);
  assert.match(js, /\/proposals\/discarded\/\$\{encodeURIComponent\(d\.id\)\}\/restore`/);
  assert.match(js, /OC\.isAdmin = \(\) => user\(\)\.role === 'admin'/);
  assert.match(js, /suiteRole !== 'tecnico'/);
  assert.match(js, /const del = !apr && OC\.canDeleteProposal\(\), desc = apr && OC\.isAdmin\(\)/);
  // Cada sistema descarta so o seu: nada de prometer que a obra sai junto do Centro.
  assert.doesNotMatch(js, /sai junto/);
  assert.match(js, /A obra já tem movimento/);
  assert.match(read('screen-prop.js'), /OC\.propMenu\(p\)/);
  assert.match(read('screen-misc.js'), /id="m-desc"/);
});
