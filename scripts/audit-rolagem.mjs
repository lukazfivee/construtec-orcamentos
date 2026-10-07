// Auditoria de rolagem do desktop (playwright). Para cada tela e aba do editor, rola todos os conteineres rolaveis ate o fim e confere:
//  - o ultimo elemento visivel cabe na janela (bottom <= innerHeight) e nao e cortado por overflow de nenhum ancestral;
//  - sobra respiro embaixo (>= 12 px);
//  - nao ha rolagem vertical aninhada (rolavel dentro de rolavel) e o painel Resumo/Acoes nao rola sozinho;
//  - nenhuma barra ou painel cobre o ultimo elemento.
// Requisitos: app web servido (renderer compilado atras de um proxy que tambem encaminha /api), `npm i --no-save playwright-core`
// e Chrome instalado. Variaveis: ORC_BASE (padrao http://localhost:5173/), ORC_EMAIL e ORC_PASSWORD (login), ORC_SESSION (token da
// sessao, usado so para criar as propostas de teste pela API), VPS (padrao 1280x720,1920x1080), THEMES (padrao claro,escuro).
// Uso: ORC_SESSION=... node scripts/audit-rolagem.mjs
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BASE = (process.env.ORC_BASE || 'http://localhost:5173/').replace(/\/?$/, '/');
const SESSION = process.env.ORC_SESSION || '';
const VPS = (process.env.VPS || '1280x720,1920x1080').split(',').map((v) => v.split('x').map(Number));
const THEMES = (process.env.THEMES || 'claro,escuro').split(',');

let chromium;
try { ({ chromium } = require('playwright-core')); } catch { console.error('Instale playwright-core: npm i --no-save playwright-core'); process.exit(2); }

const api = async (method, path, body) => {
  const response = await fetch(`${BASE}api${path}`, { method, headers: { 'content-type': 'application/json', 'X-Construtec-Session': SESSION }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${text.slice(0, 160)}`);
  return JSON.parse(text);
};

// Propostas de teste: uma com 40 itens e 6 funcoes de mao de obra e outra com duas revisoes (para o comparativo).
async function seed() {
  const tag = `Rolagem ${Date.now()}`;
  const { clientId } = await api('POST', '/clients', { legalName: `${tag} Ltda`, tradeName: tag, document: null });
  await api('POST', `/clients/${clientId}/works`, { name: 'Residencial Parque das Palmeiras Torre A - Controle de acesso, CFTV e interfonia', address: null });
  const workId = (await api('GET', '/clients')).clients.find((c) => c.id === clientId).works[0].id;
  const items = Array.from({ length: 40 }, (_, i) => ({ code: `COD-${i + 1}`, description: `Item de teste ${i + 1}`, category: 'CFTV', unit: 'un', quantity: i + 1, unitCost: 10 + i, unitSale: 30 + i }));
  const make = async (scope) => (await api('POST', '/proposals', { clientId, workId, scope, validUntil: '2026-12-20' })).proposal.id;
  const full = await make('Auditoria de rolagem');
  await api('POST', `/proposals/${full}/items/import-batch`, { items });
  for (let i = 1; i <= 6; i += 1) await api('POST', `/proposals/${full}/labor`, { description: `Instalador ${i}`, professionalCount: i, monthlySalary: 3200, monthlyFood: 600, monthlyTransport: 300, monthlyOtherCosts: 100, standardMonthlyHours: 176, plannedHours: 320 });
  const rev = await make('Auditoria com revisoes');
  await api('POST', `/proposals/${rev}/items/import-batch`, { items: items.slice(0, 30) });
  await api('PATCH', `/proposals/${rev}/status`, { status: 'review' });
  await api('PATCH', `/proposals/${rev}/status`, { status: 'sent' });
  await api('POST', `/proposals/${rev}/revisions`, {});
  const list = (await api('GET', '/proposals')).proposals;
  return { full: list.find((p) => p.id === full).number, rev: list.find((p) => p.id === rev).number };
}

const measure = () => {
  const vh = innerHeight;
  const vis = (e) => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let n = e; n && n !== document.body; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0 || n.getAttribute?.('aria-hidden') === 'true') return false; } return true; };
  const desc = (e) => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? `.${e.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '');
  const oy = (e) => getComputedStyle(e).overflowY;
  const scrollers = [...document.querySelectorAll('body *')].filter((e) => vis(e) && (oy(e) === 'auto' || oy(e) === 'scroll') && e.scrollHeight > e.clientHeight + 1);
  for (let k = 0; k < 2; k += 1) for (const s of scrollers) s.scrollTop = s.scrollHeight;
  document.scrollingElement.scrollTop = document.scrollingElement.scrollHeight;
  const clip = (e) => { const r = e.getBoundingClientRect(); let worst = 0; let by = null; for (let n = e.parentElement; n && n !== document.documentElement; n = n.parentElement) { if (oy(n) === 'visible') continue; const cut = r.bottom - n.getBoundingClientRect().bottom; if (cut > worst + 0.5) { worst = cut; by = n; } } return { worst, by }; };
  const scope = document.querySelector('main.workspace') || document.body;
  const issues = []; let last = null;
  for (const e of scope.querySelectorAll('*')) {
    if ((e.closest('svg') && e.tagName !== 'svg') || e.closest('.sr') || getComputedStyle(e).position === 'fixed' || !vis(e)) continue;
    const hasText = [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
    if (!hasText && !e.matches('button,input,select,textarea,a[href],img,svg,table,tr')) continue;
    const r = e.getBoundingClientRect(); const c = clip(e);
    if (c.worst > 1) issues.push(`cortado ${desc(e)} por ${desc(c.by)} (${Math.round(c.worst)} px)`);
    else if (r.bottom > vh + 1) issues.push(`fora da janela ${desc(e)} (${Math.round(r.bottom)} > ${vh})`);
    if (!last || r.bottom > last.bottom) last = { el: e, bottom: r.bottom, r };
  }
  const nested = scrollers.filter((a) => scrollers.some((b) => b !== a && b.contains(a))).map(desc);
  const rightScroll = scrollers.filter((e) => e.matches('.commercial-panel')).map(desc);
  let gap = null; let covered = null;
  if (last) {
    let sc = null; for (let n = last.el.parentElement; n && !sc; n = n.parentElement) if ((oy(n) === 'auto' || oy(n) === 'scroll') && n.scrollHeight > n.clientHeight + 1) sc = n;
    gap = Math.round(Math.min(vh, sc ? sc.getBoundingClientRect().bottom : vh) - last.bottom);
    const top = document.elementFromPoint(Math.min(Math.max(last.r.left + last.r.width / 2, 1), innerWidth - 1), Math.min(last.r.bottom - 2, vh - 1));
    if (top && !last.el.contains(top) && !top.contains(last.el)) covered = desc(top);
  }
  return { issues: issues.slice(0, 5), nested, rightScroll, gap, covered, scrollers: scrollers.map((s) => `${desc(s)} ${s.scrollHeight}/${s.clientHeight}`) };
};

const nav = async (page, text) => { await page.click(`.side .nav:has-text("${text}")`); await page.waitForTimeout(1200); };
const openProposal = async (page, number) => { await nav(page, 'Propostas'); await page.click(`text=${number} >> nth=0`); await page.waitForTimeout(1500); };
const screens = (numbers) => [
  ...['Início', 'Propostas', 'Catálogo', 'Clientes', 'Kits', 'Configurações'].map((t) => [t.toLowerCase(), (p) => nav(p, t)]),
  ...['Itens', 'Mão de obra', 'Kits', 'Condições', 'Histórico'].map((t) => [`editor ${t}`, async (p) => { await openProposal(p, numbers.full); await p.click(`.section-tabs button:has-text("${t}")`); await p.waitForTimeout(700); }]),
  ['pdf', async (p) => { await openProposal(p, numbers.full); await p.click('button:has-text("PDF")'); await p.waitForTimeout(2000); }],
  ['comparativo', async (p) => { await openProposal(p, numbers.rev); await p.click('button:has-text("Comparar revisões")'); await p.waitForTimeout(2000); }],
];

const numbers = await seed();
const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
let failures = 0;
for (const theme of THEMES) for (const [w, h] of VPS) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await context.addInitScript((t) => { try { localStorage.setItem('orc_d_tema', t); } catch { /* sem storage */ } }, theme);
  const page = await context.newPage();
  await page.goto(BASE);
  await page.waitForSelector('input[type=email]', { timeout: 15000 });
  await page.fill('input[type=email]', process.env.ORC_EMAIL || 'admin@teste.local');
  await page.fill('input[type=password]', process.env.ORC_PASSWORD || 'x12345678');
  await page.click('button[type=submit]');
  await page.waitForTimeout(2500);
  for (const [name, go] of screens(numbers)) {
    let r;
    try { await go(page); await page.waitForTimeout(400); r = await page.evaluate(measure); } catch (error) { r = { issues: [String(error).slice(0, 160)], nested: [], rightScroll: [], gap: null, covered: null, scrollers: [] }; }
    const ok = r.issues.length === 0 && !r.nested.length && !r.rightScroll.length && !r.covered && (r.gap === null || r.gap >= 12);
    if (!ok) failures += 1;
    console.log(`${ok ? 'OK    ' : 'FALHA '}${theme} ${w}x${h} ${name} gap=${r.gap}${ok ? '' : ` ${JSON.stringify(r)}`}`);
  }
  await context.close();
}
await browser.close();
console.log(failures ? `${failures} verificacoes com problema` : 'Todas as telas alcancaveis');
process.exit(failures ? 1 : 0);
