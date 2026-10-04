import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import type { AppSettings, ProposalDetail } from '../shared/contracts';
import { buildProposalDocx } from './proposalDocx';

const proposal = {
  id: 'p1', number: 'PA-1001', revision: 1, clientName: 'Cliente Teste', workName: 'Obra Teste', scope: 'Instalacao eletrica',
  responsibleName: 'Maria Responsavel', validUntil: '2026-12-30', status: 'review', isLatest: true, bdiMultiplier: 1.25, taxPercentage: 0,
  items: [{ id: 'i1', code: 'C1', description: 'Cabo flexivel', unit: 'm', quantity: 10, unitCost: 3, unitSale: 5, totalSale: 50, totalCost: 30, category: 'Cabos' }],
  laborItems: [], totals: { materials: 30, labor: 0, baseCost: 30, additions: 20, finalValue: 50, taxAmount: 0 },
} as unknown as ProposalDetail;

const settings = (extra: Partial<AppSettings>) => ({ companyName: 'Construtec Teste Ltda', pdfShowLogo: true, pdfShowSignature: true, ...extra }) as AppSettings;

const read = async (extra: Partial<AppSettings>) => {
  const zip = await JSZip.loadAsync(await buildProposalDocx(proposal, settings(extra)));
  const media = Object.keys(zip.files).filter(name => name.startsWith('word/media/'));
  const headers = await Promise.all(Object.keys(zip.files).filter(name => /word\/header\d*\.xml$/.test(name)).map(name => zip.file(name)!.async('string')));
  return { document: await zip.file('word/document.xml')!.async('string'), media, headers: headers.join('') };
};

test('word segue os controles de logo e assinatura do PDF', async () => {
  // O nome tambem aparece na tabela de dados; a assinatura acrescenta uma ocorrencia.
  const count = (text: string) => (text.match(/Maria Responsavel/g) ?? []).length;
  const on = await read({});
  assert.ok(count(on.document) >= 2, 'assinatura presente');
  assert.ok(on.media.length > 0, 'logo presente');

  const noSignature = await read({ pdfShowSignature: false });
  assert.equal(count(noSignature.document), count(on.document) - 1, 'sem assinatura');
  assert.ok(noSignature.media.length > 0);

  const noLogo = await read({ pdfShowLogo: false });
  assert.equal(noLogo.media.length, 0, 'sem logo nao embute imagem');
  assert.equal(count(noLogo.document), count(on.document));
});

test('word nunca expoe custo, BDI ou margem', async () => {
  const { document } = await read({});
  assert.doesNotMatch(document, /BDI|Margem|Custo base|unitCost/i);
});
