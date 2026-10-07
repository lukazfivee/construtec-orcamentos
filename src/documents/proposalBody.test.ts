import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import type { AppSettings, ProposalDetail } from '../shared/contracts';
import type { BodyBlock } from '../shared/proposalBody';
import { defaultPdfChoices, buildPdfPages } from '../renderer/proposalPdfPages';
import { buildProposalHtml } from './proposalDocument';
import { buildProposalDocx } from './proposalDocx';
import { buildMobileProposalHtml, parseMobileDocumentChoices } from './proposalMobileDocument';

const blocks: BodyBlock[] = [
  { id: 'a', type: 'paragrafo', title: 'Abertura', text: 'ALFA para {{cliente}}\nsegunda linha', enabled: true },
  { id: 'itens', type: 'itens', title: 'Tabela de precos', enabled: true },
  { id: 'b', type: 'lista', title: 'Escopo', text: '- BETA item um\n- GAMA item dois', enabled: true },
  { id: 'c', type: 'paragrafo', text: 'DESLIGADO nao sai', enabled: false },
  { id: 'cond', type: 'condicoes', title: 'Condicoes finais', enabled: true },
  { id: 'd', type: 'titulo', title: 'DELTA fecho', enabled: true },
  { id: 'e', type: 'paragrafo', text: 'EPSILON <script>alert(1)</script> & "aspas" total {{valor_total}}', enabled: true },
];

const make = (bodyBlocks: BodyBlock[] | null): ProposalDetail => ({
  id: 'p1', number: 'PA-1001', revision: 1, clientName: 'Cliente Teste', workName: 'Obra Teste',
  scope: JSON.stringify({ scope: 'ESCOPOLEGADO unico', executionTerm: '15 dias', paymentTerms: '50% entrada', warranty: '90 dias', notes: '' }),
  bodyBlocks, responsibleName: 'Maria Responsavel', validUntil: '2026-12-30', status: 'review', isLatest: true, bdiMultiplier: 1.25, taxPercentage: 0,
  items: [{ id: 'i1', code: 'C1', description: 'Cabo flexivel', unit: 'm', quantity: 10, unitCost: 3.37, unitSale: 5, totalSale: 50, totalCost: 33.7, category: 'Cabos' }],
  laborItems: [], totals: { cost: 33.7, sale: 50, grossResult: 16.3, marginPercent: 32.6, materials: 33.7, labor: 0, baseCost: 33.7, additions: 16.3, finalValue: 50, taxAmount: 0 },
} as unknown as ProposalDetail);

const settings = { companyName: 'Construtec Teste Ltda', pdfShowLogo: true, pdfShowSignature: true } as AppSettings;
const inOrder = (text: string, needles: string[]) => {
  let at = -1;
  for (const needle of needles) {
    const next = text.indexOf(needle, at + 1);
    assert.ok(next > at, `"${needle}" fora de ordem ou ausente`);
    at = next;
  }
};
const ORDER = ['ALFA para Cliente Teste', 'Tabela de precos', 'BETA item um', 'GAMA item dois', 'Condicoes finais', 'DELTA fecho', 'EPSILON'];

test('PDF em HTML: blocos na ordem escolhida, listas em marcadores, escape e variaveis', () => {
  const html = buildProposalHtml(make(blocks), settings);
  inOrder(html, ORDER);
  assert.match(html, /<ul class="body-list"><li>BETA item um<\/li><li>GAMA item dois<\/li><\/ul>/);
  assert.match(html, /ALFA para Cliente Teste\nsegunda linha/);
  assert.match(html, /EPSILON &lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; &quot;aspas&quot; total R\$\s50,00/);
  assert.doesNotMatch(html, /<script>alert|DESLIGADO/);
  assert.doesNotMatch(html, /ESCOPOLEGADO|Apresentação —/);
  assert.match(html, /<h2>Abertura<\/h2>/);
});

test('PDF em HTML: sem corpo montado mantem o layout de sempre', () => {
  const html = buildProposalHtml(make(null), settings);
  assert.match(html, /<h2>1\. Composição e Precificação<\/h2>/);
  assert.match(html, /<h2>2\. Condições Comerciais<\/h2>/);
  assert.match(html, /<b>Escopo:<\/b> ESCOPOLEGADO unico/);
  assert.match(html, /Apresentação — /);
  assert.doesNotMatch(html, /body-list|body-p/);
  inOrder(html, ['Prezados Senhores', 'Apresentação —', '1. Composição', 'Cabo flexivel', '2. Condições']);
});

test('Word: paragrafos, lista e titulos na ordem escolhida, sem custo, BDI ou margem', async () => {
  const zip = await JSZip.loadAsync(await buildProposalDocx(make(blocks), settings));
  const xml = await zip.file('word/document.xml')!.async('string');
  inOrder(xml, ORDER);
  assert.match(xml, /<w:numPr>/);
  assert.match(xml, /EPSILON &lt;script&gt;/);
  assert.doesNotMatch(xml, /DESLIGADO|ESCOPOLEGADO/);
  assert.doesNotMatch(xml, /BDI|Margem|Custo base|33[,.]7|3[,.]37/);
  const legacy = await (await JSZip.loadAsync(await buildProposalDocx(make(null), settings))).file('word/document.xml')!.async('string');
  assert.match(legacy, /ESCOPOLEGADO unico/);
  assert.match(legacy, /Composição da proposta/);
});

test('documento do cliente (celular e pagina publica) leva o corpo e nunca custo, BDI ou margem', () => {
  const html = buildMobileProposalHtml(make(blocks), settings, parseMobileDocumentChoices({}));
  inOrder(html, ORDER);
  const visible = html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/data:image\/png;base64,[A-Za-z0-9+/=]+/g, '');
  for (const leak of [/BDI/, /[Mm]argem/, /Custo/, /33[,.]7/, /3[,.]37/, /1[,.]25/]) assert.doesNotMatch(visible, leak, String(leak));
});

test('paginas do PDF do desktop seguem a ordem dos blocos e paginam o texto longo', () => {
  const pages = buildPdfPages(make(blocks), defaultPdfChoices());
  // Conteudo em fluxo continuo: pagina nova so quando a anterior enche; a capa vem primeiro e o resto segue a ordem dos blocos.
  assert.equal(pages[0].label, 'Capa');
  inOrder(pages.map((page) => page.html).join('\n'), ORDER);
  assert.ok(pages.some((page) => /<ul class="pg-ul"><li>BETA item um<\/li><li>GAMA item dois<\/li><\/ul>/.test(page.html)));
  assert.ok(pages.some((page) => page.label === 'Itens'));
  assert.match(pages[pages.length - 1].html, /pg-sign/);
  const joined = pages.map((page) => page.html).join('');
  assert.doesNotMatch(joined, /<script>|DESLIGADO/);

  const long: BodyBlock[] = [{ id: 'l', type: 'paragrafo', text: 'palavra '.repeat(600).trim(), enabled: true }, ...blocks.filter((item) => item.id === 'itens' || item.id === 'cond')];
  const paged = buildPdfPages(make(long), { ...defaultPdfChoices(), capa: false });
  assert.ok(paged.filter((page) => page.label === 'Texto').length >= 2, 'texto longo ocupa mais de uma pagina');
  assert.equal((paged.map((page) => page.html).join('').match(/palavra/g) ?? []).length, 600);

  const legacy = buildPdfPages(make(null), defaultPdfChoices()).map((page) => page.label);
  assert.equal(legacy[0], 'Capa');
  assert.ok(legacy.includes('Itens'));
});

test('condicoes desligadas somem do documento e das paginas', () => {
  const off = blocks.map((item) => (item.id === 'cond' ? { ...item, enabled: false } : item));
  const html = buildProposalHtml(make(off), settings);
  assert.doesNotMatch(html, /Condicoes finais|Forma de pagamento/);
  assert.ok(!buildPdfPages(make(off), defaultPdfChoices()).some((page) => page.label === 'Condições'));
});
