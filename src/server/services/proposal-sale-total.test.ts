// Regra do Valor final (22/10): soma da venda dos itens (+ mao de obra x BDI), com imposto.
// Venda automatica (custo x BDI) usa o custo do item x BDI sem arredondar; venda digitada usa qtd x venda.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { multiplyDecimal, sumDecimal } from '../../shared/decimal';
import { calculateProposalTotalsFromLines, countManualSales } from '../../shared/proposalFinancials';
import { createCriticalTestDatabase } from './criticalTestDatabase';
import { applyProposalPriceDrift, getProposalPriceDrift } from './priceDrift';
import { finalValueSql } from './proposalTotalsSql';
import { getProposalById, listCurrentProposals, updateProposalTax } from './proposals';

const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

// Calculo antigo do detalhe (calculateProposalTotals antes de 22/10): custo dos materiais (cada linha arredondada)
// + mao de obra, x BDI, depois o imposto sobre o subtotal.
const oldFinalValue = (lines: Array<[number, number]>, labor: number, bdi: number, tax = 0) => {
  const materials = sumDecimal(lines.map(([quantity, cost]) => multiplyDecimal([quantity, cost])));
  const subtotal = multiplyDecimal([sumDecimal([materials, labor]), bdi]);
  return sumDecimal([subtotal, tax > 0 ? multiplyDecimal([subtotal, tax], 100) : 0]);
};

test('Valor final = soma da venda dos itens (TS)', async (context) => {
  await context.test('sem venda digitada, igual ao calculo antigo, inclusive quando arredondar por linha divergiria', () => {
    // 1000 x 0,33 x 1,25 = 412,50; somando a venda unitaria arredondada (0,41) daria 410,00.
    const lines = [{ quantity: 1000, unitCost: 0.33, saleUnitPrice: 0.41 }, { quantity: 3, unitCost: 7.77, saleUnitPrice: 9.71 }];
    const totals = calculateProposalTotalsFromLines(lines, 0, 1.25);
    assert.equal(countManualSales(lines, 1.25), 0);
    assert.equal(totals.finalValue, oldFinalValue([[1000, 0.33], [3, 7.77]], 0, 1.25));
    assert.equal(totals.finalValue, 441.64);
    const withLabor = calculateProposalTotalsFromLines(
      [{ quantity: 1000, unitCost: 0.33, saleUnitPrice: 0.44 }, { quantity: 3, unitCost: 7.77, saleUnitPrice: 10.36 }], 1760, 1.3333);
    assert.equal(withLabor.finalValue, oldFinalValue([[1000, 0.33], [3, 7.77]], 1760, 1.3333));
  });

  await context.test('com venda digitada, Valor final = soma das linhas', () => {
    const lines = [{ quantity: 10, unitCost: 100, saleUnitPrice: 125 }, { quantity: 2, unitCost: 100, saleUnitPrice: 700 }];
    const totals = calculateProposalTotalsFromLines(lines, 0, 1.25);
    assert.equal(countManualSales(lines, 1.25), 1);
    assert.equal(totals.finalValue, 10 * 125 + 2 * 700);
    assert.equal(totals.baseCost, 1200);
    assert.equal(totals.additions, 2650 - 1200);
  });

  await context.test('com imposto e mao de obra: subtotal + imposto fecha o Valor final', () => {
    const lines = [{ quantity: 3, unitCost: 33.33, saleUnitPrice: 50 }, { quantity: 7, unitCost: 12.34, saleUnitPrice: 15.43 }];
    const totals = calculateProposalTotalsFromLines(lines, 1760, 1.25, 8.65);
    // (3 x 50 + 7 x 12,34 x 1,25 + 1760 x 1,25) x 1,0865
    assert.equal(totals.finalValue, cents((150 + 107.975 + 2200) * 1.0865));
    assert.equal(totals.subtotalWithBdi, cents(totals.finalValue / 1.0865));
    assert.equal(cents((totals.subtotalWithBdi ?? 0) + (totals.taxAmount ?? 0)), totals.finalValue);
    assert.equal(totals.additions, cents(totals.finalValue - totals.baseCost));
  });
});

test('Valor final = soma da venda dos itens (banco: detalhe, listas e preco novo)', async (context) => {
  const { database, makeProposal, addMaterial, addLabor } = await createCriticalTestDatabase();
  context.after(() => database.close());
  const detailOf = async (id: string) => { const detail = await getProposalById(database, id); assert.ok(detail); return detail; };
  const driftOf = async (id: string) => { const drift = await getProposalPriceDrift(database, id, true); assert.ok(drift); return drift; };
  const sqlFinal = async (id: string) => Number((await database.query<{ v: string }>(
    `SELECT ${finalValueSql}::text AS v FROM proposals p WHERE p.id = $1`, [id])).rows[0].v);

  await context.test('sem venda digitada o Valor final nao muda; detalhe e SQL batem', async () => {
    const id = await makeProposal();
    await addMaterial(id, '1000', '0.33', '0.41');
    await addMaterial(id, '2.5', '19.99', '24.99');
    const detail = await detailOf(id);
    assert.equal(detail.totals.finalValue, oldFinalValue([[1000, 0.33], [2.5, 19.99]], 0, 1.25));
    assert.equal(await sqlFinal(id), detail.totals.finalValue);
    assert.ok(detail.items.every(item => item.manualSale === false));
  });

  await context.test('venda digitada: Valor final = soma da coluna Venda total; detalhe, SQL e lista batem', async () => {
    const id = await makeProposal();
    await addMaterial(id, '1', '350', '437.5');
    await addMaterial(id, '1', '0', '262.5');
    const detail = await detailOf(id);
    const columnSum = cents(detail.items.reduce((sum, item) => sum + item.totalSale, 0));
    assert.equal(detail.totals.finalValue, 700);
    assert.equal(detail.totals.finalValue, columnSum);
    assert.deepEqual(detail.items.map(item => item.manualSale), [false, true]);
    assert.equal(await sqlFinal(id), 700);
    assert.equal((await listCurrentProposals(database)).find(p => p.id === id)?.totalSale, 700);
  });

  await context.test('com imposto e mao de obra, SQL e TS dao o mesmo numero', async () => {
    const id = await makeProposal();
    await addMaterial(id, '3', '33.33', '50');
    await addMaterial(id, '7.25', '12.34', '15.43');
    await addMaterial(id, '0.5', '0.01', '0.01');
    await addLabor(id);
    await updateProposalTax(database, id, 8.65);
    const detail = await detailOf(id);
    // Venda automatica usa o custo do item (7,25 x 12,34 = 89,47 e 0,5 x 0,01 = 0,01, como na coluna Custo) x BDI, sem arredondar.
    const expected = multiplyDecimal([150 + 111.8375 + 0.0125 + 2200, 1.0865]);
    assert.equal(expected, 2674.8);
    assert.equal(detail.totals.labor, 1760);
    assert.equal(detail.totals.finalValue, expected);
    assert.equal(await sqlFinal(id), expected);
    assert.equal((await listCurrentProposals(database)).find(p => p.id === id)?.totalSale, expected);
    assert.equal(cents((detail.totals.baseCost ?? 0) + (detail.totals.additions ?? 0)), expected);
  });

  await context.test('preco novo do catalogo: venda automatica acompanha, venda digitada fica', async () => {
    const id = await makeProposal();
    const auto = await addMaterial(id, '2', '10', '12.5');
    const manual = await addMaterial(id, '1', '10', '40');
    for (const itemId of [auto, manual]) {
      await database.query(`INSERT INTO products (id, code, description, category, unit, current_cost, source, active)
        VALUES (gen_random_uuid(), $1, 'Material', 'Teste', 'm', 20, 'TESTE', true)`, [`MAT-${itemId}`]);
    }
    const drift = await driftOf(id);
    assert.equal(drift.finalBefore, 25 + 40);
    assert.equal(drift.items.find(item => item.id === manual)?.finalDelta, 0);
    assert.equal(drift.finalAfter, 50 + 40);
    await applyProposalPriceDrift(database, id);
    const after = await detailOf(id);
    assert.equal(after.totals.finalValue, drift.finalAfter);
    assert.equal(await sqlFinal(id), drift.finalAfter);
    assert.deepEqual(after.items.map(item => item.saleUnitPrice), [25, 40]);
  });
});
