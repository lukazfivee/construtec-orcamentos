import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import type { AppSettings, ProposalDetail } from '../shared/contracts';
import {
  bodyBlocksError, bodyFingerprintSource, emptyBodyBlock, normalizeBodyBlocks, resolveBodyParts, tableAligns, type BodyBlock,
} from '../shared/proposalBody';
import { bodyBlocksSchema } from '../server/services/proposalBody';
import { buildPdfPages, defaultPdfChoices } from '../renderer/proposalPdfPages';
import { buildProposalHtml } from './proposalDocument';
import { buildProposalDocx } from './proposalDocx';
import { buildMobileProposalHtml, parseMobileDocumentChoices } from './proposalMobileDocument';

const table = { headers: ['Etapa', 'Prazo', 'Valor'], rows: [['Projeto <b>', '5 dias', 'R$ 1.200,00'], ['', '', ''], ['Obra {{obra}}', '30 dias', '15%']] };
const blocks: BodyBlock[] = [
  { id: 'a', type: 'paragrafo', text: 'ANTES da planilha', enabled: true },
  { id: 'p', type: 'planilha', title: 'Cronograma da {{cliente}}', enabled: true, table },
  { id: 'itens', type: 'itens', enabled: true },
  { id: 'cond', type: 'condicoes', enabled: true },
];
const make = (bodyBlocks: BodyBlock[]): ProposalDetail => ({
  id: 'p1', number: 'PA-1001', revision: 1, clientName: 'Cliente Teste', workName: 'Obra Teste', scope: 'Escopo', bodyBlocks, responsibleName: 'Maria', validUntil: '2026-12-30',
  status: 'review', isLatest: true, bdiMultiplier: 1.25, taxPercentage: 0,
  items: [{ id: 'i1', code: 'C1', description: 'Cabo', unit: 'm', quantity: 10, unitCost: 3.37, unitSale: 5, totalSale: 50, totalCost: 33.7, category: 'Cabos' }],
  laborItems: [], totals: { cost: 33.7, sale: 50, grossResult: 16.3, marginPercent: 32.6, materials: 33.7, labor: 0, baseCost: 33.7, additions: 16.3, finalValue: 50, taxAmount: 0 },
} as unknown as ProposalDetail);
const settings = { companyName: 'Construtec Teste Ltda', pdfShowLogo: true, pdfShowSignature: true } as AppSettings;

test('planilha propria: titulo vira secao, variaveis entram nas celulas, linha vazia some e numeros e valores ficam a direita', () => {
  const parts = resolveBodyParts(make(blocks), blocks);
  assert.deepEqual(parts.map((part) => part.kind), ['paragraph', 'heading', 'planilha', 'itens', 'condicoes']);
  assert.deepEqual(parts[1], { kind: 'heading', text: 'Cronograma da Cliente Teste', sub: false });
  assert.deepEqual(parts[2], {
    kind: 'planilha', headers: ['Etapa', 'Prazo', 'Valor'], align: ['left', 'right', 'right'],
    rows: [['Projeto <b>', '5 dias', 'R$ 1.200,00'], ['Obra Obra Teste', '30 dias', '15%']],
  });
});

test('planilha propria: desligada ou sem nenhuma linha preenchida nao sai; colunas so de numeros alinham a direita', () => {
  const off = blocks.map((item) => (item.id === 'p' ? { ...item, enabled: false } : item));
  assert.ok(!resolveBodyParts(make(off), off).some((part) => part.kind === 'planilha'));
  const blank = [...blocks.slice(0, 1), emptyBodyBlock('planilha'), ...blocks.slice(2)];
  assert.ok(!resolveBodyParts(make(blank), blank).some((part) => part.kind === 'planilha'));
  assert.deepEqual(tableAligns(['a', 'b', 'c', 'd'], [['10', 'x', '1,5 m', ''], ['R$ 2,00', '3', '20 un', '']]), ['right', 'left', 'right', 'left']);
});

test('planilha propria: normalizacao iguala as linhas ao cabecalho, limpa texto e respeita o limite', () => {
  const [block] = normalizeBodyBlocks([{ id: 'x', type: 'planilha', enabled: true, table: { headers: [' A‮ ', 'B'], rows: [['1'], ['1', '2', '3']] } }]);
  assert.deepEqual(block.table, { headers: ['A', 'B'], rows: [['1', ''], ['1', '2']] });
  assert.deepEqual(normalizeBodyBlocks([{ id: 'y', type: 'planilha', enabled: true }])[0].table?.headers, ['Descrição', 'Quantidade', 'Valor']);
  const many = normalizeBodyBlocks([{ id: 'z', type: 'planilha', enabled: true, table: { headers: Array.from({ length: 20 }, (_, at) => `c${at}`), rows: [] } }]);
  assert.equal(many[0].table?.headers.length, 8);
  assert.equal(bodyBlocksError([...blocks, { id: 'p2', type: 'planilha', enabled: true }]), null, 'pode haver varias planilhas proprias');
});

test('planilha propria: o servidor aceita a planilha, recusa excesso e o aceite do cliente muda se a planilha mudar', () => {
  assert.equal(bodyBlocksSchema.parse(blocks).find((item) => item.type === 'planilha')?.table?.rows.length, 3);
  assert.throws(() => bodyBlocksSchema.parse([{ id: 'p', type: 'planilha', enabled: true, table: { headers: Array.from({ length: 9 }, () => 'x'), rows: [] } }, ...blocks.slice(2)]));
  assert.throws(() => bodyBlocksSchema.parse([{ id: 'p', type: 'planilha', enabled: true, table: { headers: ['a'], rows: [], extra: 1 } }, ...blocks.slice(2)]));
  const changed = blocks.map((item) => (item.id === 'p' ? { ...item, table: { ...table, rows: [['Projeto', '6 dias', 'R$ 1.200,00']] } } : item));
  assert.notEqual(JSON.stringify(bodyFingerprintSource(blocks)), JSON.stringify(bodyFingerprintSource(changed)));
  const noTable = blocks.filter((item) => item.id !== 'p');
  assert.equal(JSON.stringify(bodyFingerprintSource(noTable)).includes('table'), false, 'corpo sem planilha mantem o mesmo formato do hash');
});

test('planilha propria no PDF em HTML e no documento do cliente: tabela escapada, valores a direita, ordem preservada', () => {
  for (const html of [buildProposalHtml(make(blocks), settings), buildMobileProposalHtml(make(blocks), settings, parseMobileDocumentChoices({}))]) {
    assert.match(html, /<h2>Cronograma da Cliente Teste<\/h2>/);
    assert.match(html, /<table class="body-table"><thead><tr><th>Etapa<\/th><th class="r">Prazo<\/th><th class="r">Valor<\/th><\/tr><\/thead>/);
    assert.match(html, /<td>Projeto &lt;b&gt;<\/td><td class="r">5 dias<\/td><td class="r">R\$ 1\.200,00<\/td>/);
    assert.doesNotMatch(html, /Projeto <b>/);
    assert.ok(html.indexOf('ANTES da planilha') < html.indexOf('class="body-table"'));
    assert.ok(html.indexOf('class="body-table"') < html.indexOf('Cabo'));
  }
});

test('planilha propria no Word: tabela com cabecalho repetido entre a secao e a tabela de itens', async () => {
  const xml = await (await JSZip.loadAsync(await buildProposalDocx(make(blocks), settings))).file('word/document.xml')!.async('string');
  assert.match(xml, /<w:tblHeader\/>/);
  assert.match(xml, /Cronograma da Cliente Teste/);
  assert.match(xml, /Projeto &lt;b&gt;/);
  assert.match(xml, /<w:jc w:val="right"\/>/);
  assert.ok(xml.indexOf('ANTES da planilha') < xml.indexOf('Cronograma da Cliente Teste'));
  assert.ok(xml.indexOf('Cronograma da Cliente Teste') < xml.indexOf('Cabo'));
  assert.doesNotMatch(xml, /BDI|Margem|33[,.]7/);
});

test('planilha propria nas paginas do PDF do desktop: titulo, cabecalho uma vez e tabela longa em varias paginas', () => {
  const joined = buildPdfPages(make(blocks), defaultPdfChoices()).map((page) => page.html).join('\n');
  assert.match(joined, /<h4 class="pg-h">Cronograma da Cliente Teste<\/h4>/);
  assert.match(joined, /<table class="pg-grid"><thead><tr><th>Etapa<\/th>/);
  assert.match(joined, /<td>Projeto &lt;b&gt;<\/td>/);
  const long = blocks.map((item) => (item.id === 'p' ? { ...item, table: { headers: ['Linha'], rows: Array.from({ length: 120 }, (_, at) => [`LINHA-${at} ${'texto '.repeat(8)}`]) } } : item));
  const pages = buildPdfPages(make(long), { ...defaultPdfChoices(), capa: false });
  const all = pages.map((page) => page.html).join('');
  assert.equal((all.match(/LINHA-\d+/g) ?? []).length, 120);
  assert.equal((all.match(/<thead>/g) ?? []).length, 1);
  assert.ok(pages.filter((page) => /pg-grid/.test(page.html)).length >= 2, 'a tabela longa continua na pagina seguinte');
});
