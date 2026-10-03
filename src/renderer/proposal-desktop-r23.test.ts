import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ProposalDetail, ProposalLine } from '../shared/contracts';
import { FLOW_STEPS, flowStepIndex, nextStep } from './proposalFlow';
import { compareProposals, deltaDirection, rowTag } from './proposalCompare';
import { buildPdfPages, defaultPdfChoices, effectiveChoices, hasPdfContent, laborSale, pdfQuery } from './proposalPdfPages';

// Rodada 23 (desktop do Orcamentos): proximo passo por situacao e papel, paginas do PDF so com preco de venda
// e comparativo de revisoes.
const line = (code: string, description: string, category: string, quantity: number, unitCost: number, unitSale: number): ProposalLine => ({
  id: code, code, description, category, quantity, unit: 'un', unitCost, totalCost: unitCost * quantity, unitSale, totalSale: unitSale * quantity,
});

const proposal = (overrides: Partial<ProposalDetail> = {}): ProposalDetail => ({
  id: 'p1', clientId: 'c', workId: 'w', number: 'PA-1', revision: 1, clientName: 'Cliente', workName: 'Obra Norte', scope: '', status: 'draft',
  bdiMultiplier: 1.37, taxPercentage: 0, validUntil: '2026-12-31', responsibleName: 'Marina', updatedAt: '2026-10-01T10:00:00Z', isLatest: true,
  items: [line('A', 'Camera dome', 'CFTV', 2, 421.13, 600), line('B', 'Switch PoE', 'Rede', 1, 2301.77, 3100)],
  totals: { cost: 3144.03, sale: 4300, grossResult: 0, marginPercent: 27.31, materials: 3144.03, labor: 0, baseCost: 3144.03, additions: 1155.97, taxAmount: 0, finalValue: 4300 },
  ...overrides,
});

const commercial = { canEdit: true, p10: true, p11: true };

test('proximo passo: em edicao com itens manda para revisao; sem itens pede itens', () => {
  const base = { status: 'draft' as const, isLatest: true, costCenterId: undefined };
  assert.equal(nextStep({ ...base, itemCount: 3 }, commercial).primary?.action, 'to-review');
  assert.equal(nextStep({ ...base, itemCount: 0 }, commercial).primary?.action, 'add-items');
});

test('proximo passo: revisao gera PDF e envia, enviada registra aprovacao ou recusa, aprovada gera o Centro de Custo', () => {
  const at = (status: ProposalDetail['status'], costCenterId?: number) => nextStep({ status, isLatest: true, costCenterId, itemCount: 2 }, commercial);
  assert.equal(at('review').primary?.action, 'pdf-send');
  assert.equal(at('review').secondary?.action, 'mark-sent');
  assert.equal(at('sent').primary?.action, 'approve');
  assert.equal(at('sent').secondary?.action, 'reject');
  assert.equal(at('approved').primary?.action, 'cost-center');
  assert.equal(at('approved', 12).primary?.action, 'open-cost-center');
  assert.equal(at('rejected').primary?.action, 'new-revision');
});

test('proximo passo: sem p11 (ou p10) nao envia nem aprova; consulta e revisao antiga nao avancam', () => {
  const review = { status: 'review' as const, isLatest: true, itemCount: 2 };
  assert.equal(nextStep(review, { canEdit: true, p10: true, p11: false }).primary, undefined);
  assert.equal(nextStep(review, { canEdit: true, p10: false, p11: true }).primary, undefined);
  assert.equal(nextStep({ ...review, status: 'sent' }, { canEdit: true, p10: true, p11: false }).primary, undefined);
  assert.equal(nextStep({ ...review, status: 'draft' }, { canEdit: true, p10: false, p11: false }).primary?.action, 'to-review');
  assert.equal(nextStep(review, { canEdit: false, p10: true, p11: true }).primary, undefined);
  assert.equal(nextStep({ ...review, isLatest: false }, commercial).primary, undefined);
});

test('passo a passo: posicao por situacao', () => {
  assert.equal(FLOW_STEPS.length, 5);
  assert.equal(flowStepIndex({ status: 'draft' }), 0);
  assert.equal(flowStepIndex({ status: 'review' }), 1);
  assert.equal(flowStepIndex({ status: 'sent' }), 2);
  assert.equal(flowStepIndex({ status: 'approved' }), 4);
  assert.equal(flowStepIndex({ status: 'approved', costCenterId: 3 }), 5);
});

test('PDF: paginas so com preco de venda, nunca custo, BDI ou margem', () => {
  const p = proposal();
  const html = buildPdfPages(p, defaultPdfChoices()).map((page) => page.html).join('\n');
  for (const secret of ['421,13', '2.301,77', '3.144,03', '1,37', '27,3', 'BDI', 'Margem', 'margem', 'Custo']) assert.ok(!html.includes(secret), `PDF vazou ${secret}`);
  assert.ok(html.includes('R$') && html.includes('4.300,00') && html.includes('Camera dome'));
});

test('PDF: capa, itens e condicoes seguem as escolhas; resumido tem so o total por sistema', () => {
  const p = proposal();
  const labels = (choices: Parameters<typeof buildPdfPages>[1]) => buildPdfPages(p, choices).map((page) => page.label);
  assert.deepEqual(labels(defaultPdfChoices()), ['Capa', 'Itens', 'Condições']);
  assert.deepEqual(labels({ ...defaultPdfChoices(), capa: false, condicoes: false }), ['Itens']);
  const resumido = buildPdfPages(p, { ...defaultPdfChoices(), modelo: 'resumido' }).map((page) => page.html).join('\n');
  assert.ok(resumido.includes('Resumo por sistema') && !resumido.includes('Camera dome'));
  assert.equal(pdfQuery(defaultPdfChoices()), 'modelo=completo&capa=1&condicoes=1&validade=1');
});

test('PDF: validade so conta com data; sem p10 a mao de obra vem do valor final', () => {
  const sem = proposal({ validUntil: null });
  assert.equal(effectiveChoices(defaultPdfChoices(), sem).validade, false);
  assert.ok(!buildPdfPages(sem, defaultPdfChoices()).map((page) => page.html).join('').includes('Válida até'));
  const labor = { id: 'l', description: 'Equipe' } as NonNullable<ProposalDetail['laborItems']>[number];
  const masked = proposal({ laborItems: [labor], taxPercentage: 10, totals: { ...proposal().totals, labor: 0, finalValue: 5500 } });
  assert.equal(laborSale(masked), 700);
  assert.ok(hasPdfContent(proposal({ items: [], laborItems: [labor], totals: { ...proposal().totals, labor: 1000, finalValue: 1370 } })));
  assert.ok(!hasPdfContent(proposal({ items: [] })));
});

test('comparativo: incluido, removido, quantidade, preco, igual e ajuste geral', () => {
  const from = proposal({ revision: 1, items: [line('A', 'Camera dome', 'CFTV', 2, 400, 600), line('B', 'Switch PoE', 'Rede', 1, 2000, 3000), line('C', 'Rack', 'Rede', 1, 500, 700)], totals: { ...proposal().totals, finalValue: 4900 } });
  const to = proposal({ revision: 2, items: [line('A', 'Camera dome', 'CFTV', 3, 400, 600), line('B', 'Switch PoE', 'Rede', 1, 2000, 3200), line('D', 'Nobreak', 'Energia', 1, 900, 1300)], totals: { ...proposal().totals, finalValue: 6600 } });
  const result = compareProposals(from, to);
  const kind = (code: string) => result.rows.find((row) => row.item.code === code)?.kind;
  assert.equal(kind('A'), 'qty');
  assert.equal(kind('B'), 'price');
  assert.equal(kind('C'), 'del');
  assert.equal(kind('D'), 'add');
  assert.deepEqual(result.counts, { add: 1, del: 1, qty: 1, price: 1 });
  assert.equal(result.itemsDelta, 600 + 200 - 700 + 1300);
  assert.equal(result.finalDelta, 1700);
  assert.equal(Math.round(result.generalDelta), 1700 - 1400);
  assert.equal(result.changedCount, 4);
  assert.equal(result.groups.map((group) => group.system).join(','), 'CFTV,Rede,Energia');
  assert.equal(rowTag(result.rows.filter((row) => row.item.code === 'D')[0]), 'Incluído');
  assert.equal(deltaDirection(result.finalDelta), 'up');
  assert.equal(deltaDirection(-5), 'down');
  assert.equal(deltaDirection(0.2), 'eq');
});

test('comparativo: revisoes iguais nao mudam nada e a mao de obra entra como uma linha', () => {
  const same = compareProposals(proposal(), proposal());
  assert.equal(same.changedCount, 0);
  assert.equal(same.finalDelta, 0);
  const labor = { id: 'l', description: 'Equipe' } as NonNullable<ProposalDetail['laborItems']>[number];
  const withLabor = proposal({ laborItems: [labor], totals: { ...proposal().totals, labor: 1000, finalValue: 5670 } });
  const result = compareProposals(proposal(), withLabor);
  assert.equal(result.rows.find((row) => row.kind === 'add')?.item.category, 'Mão de obra');
});
