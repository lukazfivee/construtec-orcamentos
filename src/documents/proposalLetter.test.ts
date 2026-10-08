import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import type { AppSettings, ProposalDetail } from '../shared/contracts';
import { BODY_MODELS, modelBodyBlocks } from '../shared/proposalBodyModels';
import type { BodyBlock } from '../shared/proposalBody';
import { buildPdfPages, defaultPdfChoices } from '../renderer/proposalPdfPages';
import { buildProposalHtml, proposalPdfOptions } from './proposalDocument';
import { buildProposalDocx } from './proposalDocx';

const servico = BODY_MODELS[0];
const letterBlocks = (): BodyBlock[] => modelBodyBlocks(servico, '2026-08-06').map((block) => (block.type === 'carta'
  ? { ...block, fields: { ...block.fields, place: 'Vitória / ES', attention: 'Sr. Fulano de Tal', department: 'Engenharia' } }
  : block));

const make = (bodyBlocks: BodyBlock[] | null): ProposalDetail => ({
  id: 'p1', number: 'PA-1042', revision: 0, clientName: 'Cliente Teste', workName: 'Obra Teste', scope: 'instalação de cabeamento',
  bodyBlocks, responsibleName: 'Maria Responsavel', validUntil: '2026-12-30', status: 'draft', isLatest: true, bdiMultiplier: 1.25, taxPercentage: 0,
  items: [{ id: 'i1', code: 'C1', description: 'Mão de obra especializada', unit: 'VB', quantity: 1, unitCost: 700, unitSale: 1000, totalSale: 1000, totalCost: 700, category: 'Serviços' }],
  laborItems: [], totals: { cost: 700, sale: 1000, grossResult: 300, marginPercent: 30, materials: 700, labor: 0, baseCost: 700, additions: 300, finalValue: 1000, taxAmount: 0 },
} as unknown as ProposalDetail);

const settings = { companyName: 'Construtec Teste Ltda', tradeName: 'CONSTRUTEC', pdfShowLogo: true, pdfShowSignature: true } as AppSettings;
const inOrder = (text: string, needles: string[]) => {
  let at = -1;
  for (const needle of needles) {
    const next = text.indexOf(needle, at + 1);
    assert.ok(next > at, `"${needle}" fora de ordem ou ausente`);
    at = next;
  }
};
const readXml = async (zip: JSZip, name: string) => {
  const file = zip.file(name);
  assert.ok(file, name);
  return file.async('string');
};
const visibleText = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/data:image\/png;base64,[A-Za-z0-9+/=]+/g, '');

test('PDF em HTML com carta: cabecalho e rodape pelo @page, sem quadro de identificacao, titulo da carta e fechamento unico', () => {
  const html = buildProposalHtml(make(letterBlocks()), settings);
  inOrder(html, ['Vitória / ES, 06 de Agosto de 2026.', 'Cliente Teste', 'At.:', 'Sr. Fulano de Tal', 'REF.: Proposta nº PA-1042', '<h1>Proposta técnica-comercial</h1>', 'Prezados Senhores:',
    '1. Apresentação – CONSTRUTEC', '2. Objetivo', '12. Planilha orçamentária', 'Planilha de mão de obra - Obra Teste', 'Mão de obra especializada', '14.1. Responsabilidades da CONSTRUTEC', '14.2. Responsabilidades do CLIENTE',
    'Esta proposta é válida até 30/12/2026.', 'No aguardo de breve pronunciamento', 'Maria Responsavel']);
  // Timbrado em tabela: cabecalho no grupo que repete em cada pagina, rodape fixo no pe; nao depende das caixas de margem (@top-left etc.).
  assert.doesNotMatch(html, /@top-left|@bottom-left/);
  assert.match(html, /@bottom-right \{[^}]*counter\(page\)[^}]*counter\(pages\)/);
  assert.match(html, /--run-logo: url\(data:image\/png;base64,/);
  assert.match(html, /<table class="sheet"><thead><tr><td><header class="run-header">/);
  assert.match(html, /<tfoot><tr><td><div class="run-footer-space"><\/div><\/td><\/tr><\/tfoot><\/table>\s*<div class="run-footer">Construtec Teste Ltda • CNPJ:/);
  assert.match(html, /\.run-footer \{ position: fixed;[^}]*bottom: 0;/);
  assert.match(html, /<title>Proposta_Construtec_Cliente_Teste_Obra_Teste<\/title>/);
  assert.doesNotMatch(html, /class="identity"|timbrado-header">|PROPOSTA TÉCNICA COMERCIAL|Permanecemos à disposição/);
  assert.match(html, /<h3 class="sub">14\.1\. Responsabilidades da CONSTRUTEC<\/h3>/);
  assert.equal((html.match(/class="signature"/g) ?? []).length, 1);
  assert.match(html, /<div class="pricing-caption">Planilha de mão de obra - Obra Teste<\/div>/);
  assert.match(html, /table\.summary \{ break-before: avoid/);
  assert.doesNotMatch(html, /Condições comerciais/, 'bloco de condicoes desligado no modelo');
});

test('sem a carta o layout de sempre continua igual; a assinatura global some so quando ha fechamento', () => {
  const legacy = buildProposalHtml(make(null), settings);
  assert.match(legacy, /class="identity"/);
  assert.match(legacy, /<h1>PROPOSTA TÉCNICA COMERCIAL<\/h1>/);
  assert.match(legacy, /Permanecemos à disposição/);
  assert.doesNotMatch(legacy, /run-header|run-footer|class="sheet"/);
  const noClosing = letterBlocks().filter((block) => block.type !== 'fechamento');
  const html = buildProposalHtml(make(noClosing), settings);
  assert.match(html, /Permanecemos à disposição/);
  assert.equal((html.match(/class="signature"/g) ?? []).length, 1);
  const noSign = buildProposalHtml(make(letterBlocks()), { ...settings, pdfShowSignature: false });
  assert.doesNotMatch(noSign, /class="signature"/);
  assert.match(noSign, /No aguardo de breve pronunciamento/);
});

test('carta sem logo usa o nome da marca e opcoes do PDF seguem o cabecalho do CSS', () => {
  const html = buildProposalHtml(make(letterBlocks()), { ...settings, pdfShowLogo: false });
  assert.match(html, /<span class="run-brand">CONSTRUTEC<\/span>/);
  assert.doesNotMatch(html, /--run-logo/);
  assert.equal(proposalPdfOptions(make(letterBlocks()), settings).displayHeaderFooter, false);
  assert.equal(proposalPdfOptions(make(null), settings).displayHeaderFooter, true);
  const off = letterBlocks().map((block) => (block.type === 'carta' ? { ...block, enabled: false } : block));
  assert.equal(proposalPdfOptions(make(off), settings).displayHeaderFooter, true);
});

test('documento do cliente com carta nunca leva custo, BDI ou margem', () => {
  const visible = visibleText(buildProposalHtml(make(letterBlocks()), settings));
  for (const leak of [/BDI/, /[Mm]argem/, /Custo/, /700/, /1[,.]25/]) assert.doesNotMatch(visible, leak, String(leak));
});

test('Word com carta: logo em todas as paginas, carta, numeracao, subtitulos, planilha fixa e assinatura unica', async () => {
  const zip = await JSZip.loadAsync(await buildProposalDocx(make(letterBlocks()), settings));
  const xml = await readXml(zip, 'word/document.xml');
  inOrder(xml, ['Vitória / ES, 06 de Agosto de 2026.', 'At.:', 'Sr. Fulano de Tal', 'REF.: Proposta nº PA-1042', 'PROPOSTA TÉCNICA-COMERCIAL', 'Prezados Senhores:', '1. Apresentação', '12. Planilha orçamentária',
    'Planilha de mão de obra - Obra Teste', '14.1. Responsabilidades da CONSTRUTEC', '14.2. Responsabilidades do CLIENTE', 'Esta proposta é válida até', 'No aguardo de breve pronunciamento']);
  assert.match(xml, /<w:tblLayout w:type="fixed"\/>/);
  assert.match(xml, /w:val="ProposalSubheading"/);
  assert.equal((xml.match(/Maria Responsavel/g) ?? []).length, 1, 'uma assinatura');
  assert.doesNotMatch(xml, /Permanecemos|BDI|Margem|Custo base/);
  const header = Object.keys(zip.files).filter((name) => /^word\/header\d*\.xml$/.test(name));
  assert.ok(header.length >= 1);
  const headerXml = await readXml(zip, header[0]);
  assert.match(headerXml, /<w:drawing>/);
  assert.match(headerXml, /PA-1042/);
  assert.doesNotMatch(xml, /RESPONSÁVEL/, 'sem o quadro de identificacao fixo');
});

test('Word sem carta: cabecalho da primeira pagina, quadro e titulo de sempre', async () => {
  const xml = await readXml(await JSZip.loadAsync(await buildProposalDocx(make(null), settings)), 'word/document.xml');
  assert.match(xml, /Proposta Técnica-Comercial|PROPOSTA TÉCNICA-COMERCIAL/i);
  assert.match(xml, /RESPONSÁVEL/);
  assert.match(xml, /Esta proposta corresponde à revisão/);
});

test('paginas do PDF do desktop com carta: carta e fechamento nas paginas, assinatura nao duplica e capa comeca desligada', () => {
  const proposal = make(letterBlocks());
  assert.equal(defaultPdfChoices(proposal).capa, false);
  assert.equal(defaultPdfChoices(make(null)).capa, true);
  assert.equal(defaultPdfChoices().capa, true);
  const pages = buildPdfPages(proposal, { ...defaultPdfChoices(proposal) });
  const joined = pages.map((page) => page.html).join('\n');
  assert.equal(pages[0].label, 'Texto');
  inOrder(joined, ['Vitória / ES, 06 de Agosto de 2026.', 'At.:', 'REF.: Proposta nº PA-1042', 'Prezados Senhores:', '1. Apresentação', 'pg-caption', 'Planilha de mão de obra', '14.1. Responsabilidades', 'No aguardo de breve pronunciamento', 'pg-sign']);
  assert.equal((joined.match(/class="pg-sign"/g) ?? []).length, 1);
  assert.match(joined, /<h4 class="pg-h2">14\.1\./);
  const noSign = buildPdfPages(proposal, defaultPdfChoices(proposal), { pdfShowLogo: true, pdfShowSignature: false }).map((page) => page.html).join('');
  assert.doesNotMatch(noSign, /pg-sign/);
});

test('PDF com fechamento: segue o texto, inteiro na mesma pagina, sem pagina forcada, e o aviso de validade do celular entra junto', async () => {
  const { buildMobileProposalHtml } = await import('./proposalMobileDocument');
  const html = buildProposalHtml(make(letterBlocks()), settings);
  assert.match(html, /\.closing-end \{ break-inside: avoid; page-break-inside: avoid; \}/);
  assert.doesNotMatch(html, /closing-end \{[^}]*(break-before|min-height)/, 'sem pagina forcada para o fechamento');
  assert.equal((html.match(/class="closing-end"/g) ?? []).length, 1);
  inOrder(html, ['class="closing-end"', 'No aguardo de breve pronunciamento', 'class="signature"', '<!--closing-end-->', '</div>', '</body>']);
  const mobile = buildMobileProposalHtml(make(letterBlocks()), settings, { model: 'completo', cover: false, terms: true, validity: true });
  inOrder(mobile, ['class="closing-end"', 'class="signature"', 'class="m-validity"', '</div>', '</body>']);
  assert.doesNotMatch(mobile, /<!--closing-end-->/);
  assert.equal(mobile.indexOf('<p class="m-validity">') > mobile.indexOf('class="closing-end"'), true);
  const legacy = buildProposalHtml(make(null), settings);
  assert.doesNotMatch(legacy, /closing-end/);
});

test('nome do arquivo do PDF: Proposta_Construtec_CLIENTE_Obra, acentos mantidos, sem caracteres proibidos e REV so da segunda revisao', async () => {
  const { proposalFileBaseName } = await import('./proposalDocumentCommon');
  const base = make(null);
  const named = { ...base, clientName: 'HAERO', workName: 'Instalação Sistema tel IP ANTI ESTATICO ELEVADORES' } as ProposalDetail;
  assert.equal(proposalFileBaseName(named), 'Proposta_Construtec_HAERO_Instalação_Sistema_tel_IP_ANTI_ESTATICO_ELEVADORES');
  assert.equal(proposalFileBaseName({ ...named, revision: 2 } as ProposalDetail), 'Proposta_Construtec_HAERO_Instalação_Sistema_tel_IP_ANTI_ESTATICO_ELEVADORES_REV_02');
  assert.equal(proposalFileBaseName({ ...named, clientName: 'A/B: "C"?', workName: 'Obra - Fase 1 | *x*' } as ProposalDetail), 'Proposta_Construtec_A_B_C_Obra_Fase_1_x');
  assert.equal(proposalFileBaseName({ ...named, clientName: '', workName: '' } as ProposalDetail), 'Proposta_Construtec_PA-1042');
});
