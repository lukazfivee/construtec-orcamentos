import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseExsatProductsHtml } from './catalog';
import { parseExsatCards } from './exsatCards';
import { ExsatServerError } from './exsatErrors';
import { createMockExsat } from './exsatMockSite';
import { classifyLoginResponse, ExsatLoginGate, ExsatSession } from './exsatServerSession';
import { departmentLinks } from './exsatSyncRunner';

const rejects = (code: string) => (error: unknown) => error instanceof ExsatServerError && error.code === code;

test('login da Exsat: resposta JSON vira entrou, recusou, bloqueio, desafio ou pagina mudou, sem eco do texto', () => {
  assert.deepEqual(classifyLoginResponse('{"redirect":"/central-cliente/"}'), { ok: true, redirect: '/central-cliente/' });
  assert.deepEqual(classifyLoginResponse('{"danger":"E-mail ou senha inv\\u00e1lidos."}'), { ok: false, code: 'EXSAT_LOGIN_REJECTED' });
  assert.deepEqual(classifyLoginResponse('{"danger":"<b>Conta bloqueada</b> por muitas tentativas"}'), { ok: false, code: 'EXSAT_LOGIN_BLOCKED' });
  assert.deepEqual(classifyLoginResponse('{"danger":"Confirme o captcha"}'), { ok: false, code: 'EXSAT_CHALLENGE' });
  assert.deepEqual(classifyLoginResponse('<html><div class="g-recaptcha"></div></html>'), { ok: false, code: 'EXSAT_CHALLENGE' });
  assert.deepEqual(classifyLoginResponse('<html>manutencao</html>'), { ok: false, code: 'EXSAT_LOGIN_CHANGED' });
  assert.deepEqual(classifyLoginResponse('{"outra":"coisa"}'), { ok: false, code: 'EXSAT_LOGIN_CHANGED' });
  assert.deepEqual(classifyLoginResponse('{"redirect":""}'), { ok: false, code: 'EXSAT_LOGIN_CHANGED' });
});

test('login da Exsat: uma unica tentativa por clique, senha so no corpo do POST e cookie de sessao reaproveitado', async () => {
  const site = createMockExsat();
  const session = new ExsatSession(site.http);
  await session.login(site.email, site.password);
  assert.equal(session.connected, true);
  const posts = site.log.filter((entry) => entry.method === 'POST');
  assert.equal(posts.length, 1, 'nada de tentar de novo sozinho');
  assert.equal(posts[0].url, 'https://exsat.com.br/ajax/actions');
  const form = new URLSearchParams(posts[0].body);
  assert.equal(form.get('action'), 'enterAccount');
  assert.equal(form.get('email'), site.email);
  assert.equal(form.get('password'), site.password);
  assert.ok(posts[0].cookie.includes('PHPSESSID=abc123'), 'cookie da pagina de login vai no POST');
  for (const entry of site.log) assert.ok(!entry.url.includes(site.password) && !entry.url.includes('password'), 'senha na URL');
  const page = await session.getAuthenticated('https://exsat.com.br/produtos/departamento/cameras-ip/');
  assert.equal(page.status, 200);
  assert.ok(site.log.at(-1)?.cookie.includes('sess=ok'));
});

test('login da Exsat: senha errada, desafio e pagina mudada viram erro claro e nao deixam sessao', async () => {
  const wrong = createMockExsat();
  const session = new ExsatSession(wrong.http);
  await assert.rejects(session.login(wrong.email, 'errada'), rejects('EXSAT_LOGIN_REJECTED'));
  assert.equal(session.connected, false);
  assert.equal(wrong.log.filter((entry) => entry.method === 'POST').length, 1);

  const challenge = createMockExsat({ challenge: true });
  await assert.rejects(new ExsatSession(challenge.http).login(challenge.email, challenge.password), rejects('EXSAT_CHALLENGE'));
  assert.equal(challenge.log.filter((entry) => entry.method === 'POST').length, 0, 'com captcha na pagina nem tenta o login');

  const changed = new ExsatSession(async () => new Response('<html>outra pagina</html>', { headers: { 'content-type': 'text/html' } }));
  await assert.rejects(changed.login('a@b.com', 'x'), rejects('EXSAT_LOGIN_CHANGED'));
  const down = new ExsatSession(async () => { throw new Error('ECONNRESET senha-vazada'); });
  await assert.rejects(down.login('a@b.com', 'x'), (error) => error instanceof ExsatServerError && error.code === 'EXSAT_UNAVAILABLE' && !error.message.includes('senha'));
});

test('pausa depois de falha de login: 1 minuto na primeira recusa, 30 minutos a partir da segunda, 30 minutos com desafio', () => {
  let now = 1_000_000;
  const gate = new ExsatLoginGate(() => now);
  gate.assertOpen();
  gate.fail('EXSAT_LOGIN_REJECTED');
  assert.throws(() => gate.assertOpen(), (error) => error instanceof ExsatServerError && error.code === 'EXSAT_LOGIN_PAUSED' && error.retryAfterSeconds === 60);
  now += 61_000;
  gate.assertOpen();
  gate.fail('EXSAT_LOGIN_REJECTED');
  assert.equal(gate.remainingSeconds(), 1800);
  gate.succeed();
  assert.equal(gate.remainingSeconds(), 0);
  gate.fail('EXSAT_CHALLENGE');
  assert.equal(gate.remainingSeconds(), 1800);
  gate.succeed();
  gate.fail('EXSAT_UNAVAILABLE');
  assert.equal(gate.remainingSeconds(), 120);
});

test('so vale pagina com a conta logada: sem o marcador da conta o preco pode ser o publico', async () => {
  const site = createMockExsat();
  const session = new ExsatSession(site.http);
  // Sem login: a pagina publica traz o mesmo cartao, sem preco, e o JSON de analytics com um "price" qualquer.
  await assert.rejects(session.getAuthenticated('https://exsat.com.br/produtos/departamento/cameras-ip/'), rejects('EXSAT_LOGIN_REQUIRED'));
  await session.login(site.email, site.password);
  site.state.loggedIn = false; // a Exsat derrubou a sessao
  await assert.rejects(session.getAuthenticated('https://exsat.com.br/produtos/departamento/cameras-ip/'), rejects('EXSAT_LOGIN_REQUIRED'));
  assert.equal(session.connected, false);
});

test('cartoes: preco so do que o cartao mostra, nunca do JSON de analytics; sem preco e indisponivel contam como sem preco', () => {
  const html = `<h1>Câmeras</h1><script>var d=[{"id": "A1000", "name": "x", "brand": "Intelbras", "category": "Câmeras IP", "price": "999.00"},
    {"id": "B2000", "name": "y", "brand": "", "category": "Câmeras IP", "price": "999.00"},{"id": "C3000", "name": "z", "brand": "", "category": "Câmeras IP", "price": "999.00"}];</script>
    <div class="product-card"><div class="product-sku">A1000</div><a class="product-title">Câmera Dome</a>
      <div class="product-pricing"><div class="price-old">R$ 400,00</div><div class="price-current">R$ 1.225,65</div><div class="price-installment">10x de R$ 122,56</div></div></div>
    <div class="product-card"><div class="product-sku">B2000</div><a class="product-title">Câmera Bullet</a></div>
    <div class="product-card"><div class="product-sku">C3000</div><a class="product-title">Câmera Esgotada</a><div class="price-current">R$ 50,00</div><span>Esgotado</span></div>
    <div class="product-card"><div class="product-sku">A1000</div><a class="product-title">Câmera Dome repetida</a></div>`;
  const cards = parseExsatCards(html);
  assert.deepEqual(cards.map((card) => [card.item.code, card.item.currentCost, card.hasPrice]), [['A1000', 1225.65, true], ['B2000', 0, false], ['C3000', 0, false]]);
  assert.equal(cards[0].item.manufacturer, 'Intelbras');
  assert.equal(cards[0].item.category, 'Câmeras IP');
  assert.equal(cards[0].item.source, 'EXSAT');
  // O leitor antigo (dataLayer) leria 999,00: e por isso que a varredura do servidor nao o usa.
  assert.equal(parseExsatProductsHtml(html).find((item) => item.code === 'A1000')?.currentCost, 999);
});

test('o limite de 500 itens por pagina saiu do leitor da Exsat', () => {
  const html = Array.from({ length: 640 }, (_, index) => `{"id": "P${String(index).padStart(5, '0')}", "name": "Produto ${index}", "brand": "X", "category": "Cat", "price": "10.50"}`).join(',');
  assert.equal(parseExsatProductsHtml(`<h1>Tudo</h1><script>var d=[${html}];</script>`).length, 640);
});

test('links de departamento: so a pagina do departamento, sem busca, filtro, produto ou outro site', () => {
  const html = `<a href="/produtos/departamento/cameras-ip/">a</a><a href="/produtos/departamento/Cameras-Wifi">b</a>
    <a href="/produtos/departamento/cameras-ip/?busca=x">c</a><a href="/produtos/detalhes/1/x/">d</a><a href="https://outro.com/produtos/departamento/x/">e</a>
    <a href="https://www.exsat.com.br/produtos/departamento/alarmes/">f</a><a href="/produtos/pesquisa/?busca=1">g</a>`;
  assert.deepEqual(departmentLinks(html, 'https://exsat.com.br/produtos/departamento/x/').sort(), [
    'https://exsat.com.br/produtos/departamento/alarmes/',
    'https://exsat.com.br/produtos/departamento/cameras-ip/',
    'https://exsat.com.br/produtos/departamento/cameras-wifi/',
  ]);
});
