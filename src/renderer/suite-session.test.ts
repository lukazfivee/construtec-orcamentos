import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CENTRO_ENTRADA, ORCAMENTOS_WEB, centroEntryUrl, claimCentroEntry, isFramed, skipCentroEntry, suiteSessionFromHash } from './suiteSession';

test('#sessao= da Suite aceita so token de sessao do Centro, com ou sem proposta junto', () => {
  const token = `${'ab+/'.repeat(5)}Zm9v`;
  assert.equal(suiteSessionFromHash(`#sessao=${encodeURIComponent(token)}`), token);
  assert.equal(suiteSessionFromHash(`#sessao=${encodeURIComponent('ab+/cd+/ef+/gh+/ij+/kl+/mn')}&proposta=x`), 'ab+/cd+/ef+/gh+/ij+/kl+/mn');
  assert.equal(suiteSessionFromHash('#sessao=curto'), null);
  assert.equal(suiteSessionFromHash(`#sessao=${'a'.repeat(300)}`), null);
  assert.equal(suiteSessionFromHash('#sessao=<script>alert(1)</script>aaaaaaaaaaaa'), null);
  assert.equal(suiteSessionFromHash(`#handoff=${'a'.repeat(43)}`), null);
  assert.equal(suiteSessionFromHash(''), null);
});

const memoria = () => {
  const dados = new Map<string, string>();
  return { getItem: (key: string) => dados.get(key) ?? null, setItem: (key: string, value: string) => { dados.set(key, value); } };
};

test('sem sessao no navegador, o Orcamentos pergunta ao Centro de Custos levando so a proposta', () => {
  assert.equal(CENTRO_ENTRADA, 'https://centro-custos-api.construtec-reports.workers.dev/entrar-orcamentos.html');
  assert.equal(centroEntryUrl(ORCAMENTOS_WEB, ''), CENTRO_ENTRADA);
  assert.equal(centroEntryUrl(ORCAMENTOS_WEB, '#proposta=3f2a-11'), `${CENTRO_ENTRADA}#proposta=3f2a-11`);
  assert.equal(centroEntryUrl(ORCAMENTOS_WEB, '#proposta=%3Cscript%3E'), CENTRO_ENTRADA);
  // Voltando do Centro (com codigo ou sem sessao la) ou entrando pela Suite do Windows: nao pergunta de novo.
  for (const hash of [`#handoff=${'a'.repeat(43)}`, '#centro=0', '#centro=0&proposta=x', `#sessao=${'a'.repeat(30)}`]) {
    assert.equal(centroEntryUrl(ORCAMENTOS_WEB, hash), null, hash);
  }
  // So no site publicado: app do Windows (file://), servidor de desenvolvimento e o Orcamentos embutido no Centro ficam fora.
  for (const origin of ['null', 'file://', 'http://localhost:5173', 'https://centro-custos-api.construtec-reports.workers.dev']) {
    assert.equal(centroEntryUrl(origin, ''), null, origin);
  }
});

test('dentro de moldura (iframe de outro site) o Orcamentos nao pergunta ao Centro', () => {
  const janela = {};
  assert.equal(isFramed({ self: janela, top: janela }), false, 'aba normal pergunta');
  assert.equal(isFramed({ self: janela, top: {} }), true, 'embutido: o Centro recusaria a moldura (frame-ancestors)');
  const bloqueado = { self: janela, get top(): unknown { throw new Error('cross-origin'); } };
  assert.equal(isFramed(bloqueado), true);
});

test('a pergunta ao Centro acontece uma vez por aba, e nunca sem como guardar a marca', () => {
  const aba = memoria();
  assert.equal(claimCentroEntry(aba), true);
  assert.equal(claimCentroEntry(aba), false, 'a volta sem sessao mostra o login, nao pergunta de novo');
  const saiu = memoria();
  skipCentroEntry(saiu);
  assert.equal(claimCentroEntry(saiu), false, 'depois de Sair, recarregar nao entra de novo pelo Centro');
  const bloqueado = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); } };
  assert.equal(claimCentroEntry(bloqueado), false);
  assert.doesNotThrow(() => skipCentroEntry(bloqueado));
});

test('o celular (/m/) segue a mesma regra e nao perde a proposta ao entrar pelo codigo', () => {
  const app = readFileSync('public/m/app.js', 'utf8');
  assert.ok(app.includes(`const ORC_WEB = '${ORCAMENTOS_WEB}'`));
  assert.ok(app.includes(`const CENTRO_ENTRADA = '${CENTRO_ENTRADA}'`));
  assert.ok(app.includes("const ASKED_KEY = 'construtec.auth.centro'"));
  assert.match(app, /if \(!OC\.session\.token\(\)\) return askCentro\(\) \|\| signedOut\(\);/);
  assert.match(app, /if \(inApp\(\) \|\| installed\(\) \|\| window\.self !== window\.top \|\| location\.origin !== ORC_WEB/, 'app Android, site instalado e moldura ficam fora');
  assert.match(app, /OC\.onUnauthorized = \(\) => askCentro\(\) \|\| signedOut/);
  assert.match(app, /async function consumeHandoff\(code\) \{[^}]*proposta \? `#proposta=\$\{proposta\}`/);
  const gate = readFileSync('src/renderer/AuthGate.tsx', 'utf8');
  assert.match(gate, /inApp \|\| isFramed\(window\) \? null : centroEntryUrl\(window\.location\.origin, arrivedHash\)/);
  assert.match(gate, /claimCentroEntry\(sessionStorage\)\) \{\s*window\.location\.replace\(centro\);/);
});
