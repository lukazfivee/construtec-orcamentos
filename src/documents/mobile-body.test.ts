import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import JSZip from 'jszip';
import type { AppSettings, ProposalDetail } from '../shared/contracts';
import { bodyBlocksError, emptyBodyBlock, legacyBodyBlocks, resolveBodyParts, type BodyBlock } from '../shared/proposalBody';
import { BODY_MODELS, modelBodyBlocks, pendingPlaceholders } from '../shared/proposalBodyModels';
import { buildProposalDocx } from './proposalDocx';
import { commercialLaborTotal } from './proposalDocumentCommon';
import { buildMobileProposalHtml, mobileExportOptions, parseMobileDocumentChoices } from './proposalMobileDocument';
import { proposalPresentation } from './proposalPresentation';

// Corpo da proposta e opcoes do documento no celular (public/m). O JS do celular repete as regras do modulo compartilhado
// (src/shared/proposalBody.ts e proposalBodyModels.ts) para editar e pre-visualizar; aqui se confere que da o mesmo resultado.
type MobileBody = {
  parts: (p: unknown, blocks: unknown) => unknown;
  legacy: (scope: string) => unknown;
  empty: (type: string, today: string, place: string) => Record<string, unknown>;
  error: (blocks: unknown) => string | null;
  pending: (blocks: unknown) => number;
  modelBlocks: (model: unknown, today: string, place: string) => Array<Record<string, unknown>>;
  MODELS: unknown[];
};
type MobileOC = { body: MobileBody; docQuery: (c: Record<string, unknown>) => string; docTerms: (p: unknown, c: Record<string, unknown>) => unknown; docLabor: (p: unknown) => number };
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const noId = (blocks: Array<Record<string, unknown>>) => plain(blocks).map(({ id, ...rest }: Record<string, unknown>) => { assert.match(String(id), /^[A-Za-z0-9_-]{1,64}$/); return rest; });

const loadMobile = (): MobileOC => {
  const cents = (v: number) => Math.sign(v) * Math.round(Math.abs(v) * 100 + 1e-7) / 100;
  const sandbox = { window: { OC: { cents, esc: (v: unknown) => String(v) } } as unknown as { OC: MobileOC }, globalThis: {} };
  vm.createContext(sandbox);
  for (const file of ['prop-cond.js', 'body-core.js', 'body-models.js', 'pdf-corpo.js']) vm.runInContext(readFileSync(path.join(process.cwd(), 'public', 'm', file), 'utf8'), sandbox);
  return sandbox.window.OC;
};

const blocks: BodyBlock[] = [
  { id: 'c1', type: 'carta', title: '', enabled: true, numbered: true, fields: { place: 'Vitória / ES', date: '2026-08-06', recipient: '{{cliente}}', attention: '{{contato}}', department: '', reference: 'Proposta nº {{numero}} - {{escopo}} - {{obra}}', greeting: 'Prezados:', intro: '' } },
  { id: 't1', type: 'titulo', title: 'Seção {{obra}}', enabled: true },
  { id: 'p1', type: 'paragrafo', title: 'Sub', sub: true, text: 'Linha um\nlinha dois\n\nOutro {{valor_total}} {{desconhecida}}', enabled: true },
  { id: 'l1', type: 'lista', title: 'Lista', text: '- a\n* b\n\n• c', enabled: true },
  { id: 'g1', type: 'planilha', title: 'Planilha', enabled: true, table: { headers: ['Item', 'Valor'], rows: [['Cabo', 'R$ 1.200,00'], ['', ''], ['{{cliente}}', '15%']] } },
  { id: 'g2', type: 'planilha', title: 'Vazia', enabled: true, table: { headers: ['A'], rows: [['']] } },
  { id: 'off', type: 'paragrafo', text: 'desligado', enabled: false },
  { id: 'it', type: 'itens', title: '', text: 'Lista de materiais - {{obra}}', enabled: false },
  { id: 'cd', type: 'condicoes', enabled: true },
  { id: 'f1', type: 'fechamento', text: 'Até logo.\n\nAtenciosamente', enabled: true, fields: { signer: '{{responsavel}}', role: 'Engenharia' } },
];

const proposal = (bodyBlocks: BodyBlock[] | null, extra: Record<string, unknown> = {}): ProposalDetail => ({
  id: 'p1', number: 'PA-1001', revision: 2, clientName: 'Cliente Teste', workName: 'Obra Teste', bodyBlocks,
  clientContact: { name: 'Ana', role: 'Compras', department: 'Suprimentos', email: 'ana@x.com', phone: '' },
  scope: JSON.stringify({ scope: 'CFTV do bloco B', executionTerm: '', paymentTerms: '50% entrada', warranty: '', notes: 'Sem obra civil' }),
  responsibleName: 'Maria', validUntil: '2026-12-30', status: 'review', isLatest: true, bdiMultiplier: 1.25, taxPercentage: 10,
  items: [
    { id: 'i1', code: 'CB-01', description: 'Cabo flexivel', unit: 'm', quantity: 10, unitCost: 3, unitSale: 5, totalSale: 50, totalCost: 30, category: 'Cabos' },
    { id: 'i2', code: 'CM-02', description: 'Camera IP', unit: 'un', quantity: 1, unitCost: 100, unitSale: 150, totalSale: 150, totalCost: 100, category: 'CFTV' },
  ],
  laborItems: [{ id: 'l1' }], totals: { materials: 130, labor: 40, baseCost: 170, additions: 42.5, finalValue: 255, taxAmount: 21.25, cost: 170, sale: 255, grossResult: 85, marginPercent: 33 },
  ...extra,
} as unknown as ProposalDetail);

test('/m/: corpo resolvido no celular igual ao do servidor (carta, numeracao, variaveis, planilha, fechamento)', () => {
  const oc = loadMobile();
  const p = proposal(blocks);
  assert.deepEqual(plain(oc.body.parts(p, blocks)), plain(resolveBodyParts(p, blocks)));
  const noContact = proposal(blocks, { clientContact: undefined, validUntil: null, scope: 'A definir' });
  assert.deepEqual(plain(oc.body.parts(noContact, blocks)), plain(resolveBodyParts(noContact, blocks)));
  const legacy = legacyBodyBlocks('Rede lógica');
  assert.deepEqual(plain(oc.body.legacy('Rede lógica')), plain(legacy));
  assert.deepEqual(plain(oc.body.legacy('A definir')), plain(legacyBodyBlocks('A definir')));
  assert.deepEqual(plain(oc.body.parts(p, legacy)), plain(resolveBodyParts(p, legacy)));
});

test('/m/: modelos, bloco novo, regras da lista e trechos pendentes iguais aos do modulo compartilhado', () => {
  const oc = loadMobile();
  assert.deepEqual(plain(oc.body.MODELS), plain(BODY_MODELS));
  for (const model of BODY_MODELS) {
    assert.deepEqual(noId(oc.body.modelBlocks(model, '2026-10-10', 'Recife / PE')), noId(modelBodyBlocks(model, '2026-10-10', 'Recife / PE') as unknown as Array<Record<string, unknown>>));
  }
  for (const type of ['titulo', 'paragrafo', 'lista', 'planilha', 'carta', 'fechamento']) {
    assert.deepEqual(noId([oc.body.empty(type, '2026-10-10', 'Recife / PE')]), noId([emptyBodyBlock(type as BodyBlock['type'], '2026-10-10', 'Recife / PE') as unknown as Record<string, unknown>]));
  }
  const tail: BodyBlock[] = [{ id: 'i', type: 'itens', enabled: true }, { id: 'c', type: 'condicoes', enabled: true }];
  const cases: BodyBlock[][] = [tail, [tail[0]], [...tail, tail[1]], [...tail, { id: 'i', type: 'paragrafo', enabled: true }], [...tail, blocks[0], { ...blocks[0], id: 'c2' }], blocks];
  for (const list of cases) assert.equal(oc.body.error(list), bodyBlocksError(list));
  const model = modelBodyBlocks(BODY_MODELS[0]);
  assert.equal(oc.body.pending(model), pendingPlaceholders(model));
});

test('/m/: clausulas e mao de obra da previa iguais ao documento do servidor', () => {
  const oc = loadMobile();
  const p = proposal(null);
  for (const c of [{ condicoes: true, obs: true, notas: 'Extra' }, { condicoes: false, obs: true, notas: '' }, { condicoes: true, obs: false, notas: 'Extra' }, { condicoes: false, obs: false, notas: '' }]) {
    const expected = proposalPresentation(p, undefined, { includeCommercialTerms: c.condicoes, includeNotes: c.obs, customNotes: c.notas }).terms;
    assert.deepEqual(plain(oc.docTerms(p, c)), plain(expected));
  }
  assert.equal(oc.docLabor(p), commercialLaborTotal(p));
  // Sem p10 o custo chega zerado no celular: a previa usa o que sobra do valor final depois dos itens.
  const masked = proposal(null, { totals: { ...p.totals, labor: 0, materials: 0 }, bdiMultiplier: 0 });
  assert.equal(oc.docLabor(masked), 55);
});

test('documento do celular: opcoes novas tem os padroes de antes e as mesmas do computador', () => {
  assert.deepEqual(parseMobileDocumentChoices({}), { model: 'completo', cover: true, terms: true, validity: true });
  assert.deepEqual(mobileExportOptions(parseMobileDocumentChoices({})), { format: 'pdf', groupByCategory: false, showProductCodes: false, includeLabor: true, includeCommercialTerms: true, includeNotes: true });
  assert.equal(mobileExportOptions(parseMobileDocumentChoices({ modelo: 'resumido' })).includeNotes, false);
  const all = mobileExportOptions(parseMobileDocumentChoices({ agrupar: '1', codigos: '1', mao: '0', observacoes: '0', modelo: 'completo', notas: ' Sem‮ alvenaria\r\n ' }));
  assert.deepEqual(all, { format: 'pdf', groupByCategory: true, showProductCodes: true, includeLabor: false, includeCommercialTerms: true, includeNotes: false, customNotes: 'Sem alvenaria' });
  assert.equal(mobileExportOptions(parseMobileDocumentChoices({ modelo: 'resumido', observacoes: '1' })).includeNotes, true);
  assert.equal(parseMobileDocumentChoices({ notas: 'x'.repeat(5000) }).customNotes?.length, 1000);
  assert.equal(parseMobileDocumentChoices({ agrupar: ['1', '0'] }).group, undefined);
  // O que o celular manda volta igual pelo leitor do servidor.
  const oc = loadMobile();
  const query = oc.docQuery({ capa: false, condicoes: true, validade: false, agrupar: true, codigos: true, mao: false, obs: true, notas: 'Ponto de energia & cia', marca: true });
  const parsed = parseMobileDocumentChoices(Object.fromEntries(new URLSearchParams(query)));
  assert.deepEqual(parsed, { model: 'completo', cover: false, terms: true, validity: false, watermark: true, group: true, codes: true, labor: false, notes: true, customNotes: 'Ponto de energia & cia' });
  assert.doesNotMatch(oc.docQuery({ capa: true, condicoes: true, validade: true, agrupar: false, codigos: false, mao: true, obs: false, notas: 'oculta' }), /notas=|marca=/);
});

test('documento do celular: agrupar, codigos, mao de obra e notas chegam ao HTML e ao Word sem custo', async () => {
  const p = proposal(null);
  const settings = { companyName: 'Construtec Teste Ltda', pdfShowLogo: true, pdfShowSignature: true } as AppSettings;
  const base = buildMobileProposalHtml(p, settings, parseMobileDocumentChoices({}));
  const html = buildMobileProposalHtml(p, settings, parseMobileDocumentChoices({ agrupar: '1', codigos: '1', mao: '0', notas: 'NOTA-EXTRA' }));
  assert.ok(!base.includes('class="category"') && !base.includes('CB-01') && base.includes('Mão de obra'));
  assert.ok(html.includes('class="category"') && html.includes('CB-01') && !html.includes('<span class="item-desc">Mão de obra</span>'));
  assert.ok(html.includes('NOTA-EXTRA') && html.includes('Sem obra civil'));
  assert.ok(!buildMobileProposalHtml(p, settings, parseMobileDocumentChoices({ observacoes: '0', notas: 'NOTA-EXTRA' })).includes('NOTA-EXTRA'));
  const visible = (doc: string) => doc.replace(/<style[\s\S]*?<\/style>/g, '').replace(/[A-Za-z0-9+/=]{200,}/g, '');
  for (const doc of [base, html]) assert.ok(!/\b(BDI|margem|custo)\b/i.test(visible(doc)), 'documento do cliente com custo, BDI ou margem');
  const docx = await buildProposalDocx(p, settings, { ...mobileExportOptions(parseMobileDocumentChoices({ codigos: '1', notas: 'NOTA-WORD' })), format: 'docx' });
  const xml = await (await JSZip.loadAsync(docx)).file('word/document.xml')!.async('string');
  assert.ok(xml.includes('NOTA-WORD') && xml.includes('CB-01'));
});
