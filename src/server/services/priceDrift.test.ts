import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createCriticalTestDatabase } from './criticalTestDatabase';
import { applyProposalPriceDrift, getProposalPriceDrift, listPriceDriftProposals } from './priceDrift';
import { getProposalById, updateProposalStatus } from './proposals';
import { importCatalogProducts, listCatalogUnits, previewCatalogImport } from './catalog';

const item = (code: string, cost: number, extra: Partial<Parameters<typeof importCatalogProducts>[1][number]> = {}) => ({
  code, manufacturer: null, model: null, description: `Item ${code}`, category: 'Teste', unit: 'un', currentCost: cost, source: 'TESTE', active: true, ...extra,
});

test('catalogo no celular: aviso de preco novo na proposta e previa de importacao', async context => {
  const fixture = await createCriticalTestDatabase();
  const { database, userId, makeProposal, addMaterial } = fixture;
  context.after(() => database.close());
  const setCatalog = async (itemId: string, cost: string, active = true) => {
    await database.query(`INSERT INTO products (id, code, description, category, unit, current_cost, source, active)
      VALUES ($1, $2, 'Material fictício', 'Teste', 'm', $3, 'TESTE', $4)
      ON CONFLICT (code) DO UPDATE SET current_cost = EXCLUDED.current_cost, active = EXCLUDED.active`, [randomUUID(), `MAT-${itemId}`, cost, active]);
  };

  await context.test('detecta, soma o efeito no valor final e some custo sem p10', async () => {
    const proposalId = await makeProposal();
    const itemId = await addMaterial(proposalId, '10', '10', '12');
    await setCatalog(itemId, '12.50');
    const before = await getProposalById(database, proposalId);
    assert.ok(before);
    const withCost = await getProposalPriceDrift(database, proposalId, true);
    assert.ok(withCost && !withCost.frozen);
    assert.equal(withCost.items.length, 1);
    assert.equal(withCost.items[0].fromUnit, 10);
    assert.equal(withCost.items[0].toUnit, 12.5);
    assert.equal(withCost.items[0].costDelta, 25);
    assert.equal(withCost.items[0].changePercent, 25);
    assert.equal(withCost.finalBefore, before.totals.finalValue);
    assert.ok(withCost.finalDelta > 25 * before.bdiMultiplier - 0.05);
    const noCost = await getProposalPriceDrift(database, proposalId, false);
    assert.ok(noCost);
    assert.equal(noCost.items[0].fromUnit, undefined);
    assert.equal(noCost.items[0].costDelta, undefined);
    assert.equal(noCost.costDelta, undefined);
    assert.equal(noCost.finalDelta, withCost.finalDelta);
    assert.deepEqual((await listPriceDriftProposals(database, false)).map(p => p.id), [proposalId]);
  });

  await context.test('aplicar grava o custo do catalogo e o valor final bate com a previsao', async () => {
    const proposalId = await makeProposal();
    const itemId = await addMaterial(proposalId, '4', '100', '120');
    const otherId = await addMaterial(proposalId, '1', '50', '60');
    await setCatalog(itemId, '90');
    await setCatalog(otherId, '55');
    const drift = await getProposalPriceDrift(database, proposalId, true);
    assert.ok(drift);
    assert.equal(drift.items.length, 2);
    const only = await applyProposalPriceDrift(database, proposalId, [itemId]);
    assert.equal(only, 1);
    assert.equal((await getProposalPriceDrift(database, proposalId, true))?.items.length, 1);
    assert.equal(await applyProposalPriceDrift(database, proposalId), 1);
    const after = await getProposalById(database, proposalId);
    assert.ok(after);
    assert.equal(after.totals.finalValue, drift.finalAfter);
    assert.equal((await getProposalPriceDrift(database, proposalId, false))?.items.length, 0);
    assert.equal(await applyProposalPriceDrift(database, proposalId), 0);
    const audit = await database.query("SELECT 1 FROM audit_events WHERE entity_id = $1 AND action = 'price_drift_applied'", [proposalId]);
    assert.ok(audit.rows.length >= 1);
  });

  await context.test('item inativo no catalogo e ignorado; proposta em revisao fica congelada', async () => {
    const proposalId = await makeProposal();
    const itemId = await addMaterial(proposalId, '1', '10', '12');
    await setCatalog(itemId, '99', false);
    assert.equal((await getProposalPriceDrift(database, proposalId, true))?.items.length, 0);
    await setCatalog(itemId, '99', true);
    assert.equal((await getProposalPriceDrift(database, proposalId, true))?.items.length, 1);
    await updateProposalStatus(database, proposalId, 'review', userId);
    const frozen = await getProposalPriceDrift(database, proposalId, true);
    assert.ok(frozen?.frozen);
    assert.equal(frozen.items.length, 0);
    assert.equal(frozen.finalDelta, 0);
    await assert.rejects(() => applyProposalPriceDrift(database, proposalId), /PROPOSAL_LOCKED/);
    assert.ok(!(await listPriceDriftProposals(database, false)).some(p => p.id === proposalId));
  });
await context.test('previa de importacao devolve novo, atualizado (com o anterior) e igual; unidades do catalogo', async () => {
    await importCatalogProducts(database, [item('A1', 10, { manufacturer: 'Marca X' }), item('B2', 5, { unit: 'M' }), item('C3', 7, { unit: 'un' })]);
    const preview = await previewCatalogImport(database, [item('A1', 12, { manufacturer: 'Marca X' }), item('NOVO', 3), item('B2', 5, { unit: 'M' })]);
    const by = Object.fromEntries(preview.items.map(i => [i.code, i]));
    assert.equal(by.A1.status, 'updated');
    assert.equal(by.A1.previous?.currentCost, 10);
    assert.equal(by.A1.previous?.manufacturer, 'Marca X');
    assert.equal(by.A1.previous?.category, 'Teste');
    assert.equal(by.NOVO.status, 'new');
    assert.equal(by.NOVO.previous, undefined);
    assert.equal(by.B2.status, 'unchanged');
    assert.deepEqual(preview.summary, { new: 1, updated: 1, unchanged: 1, noPrice: 0 });
    const units = (await listCatalogUnits(database)).filter(u => ['un', 'm'].includes(u.unit));
    assert.ok((units.find(u => u.unit === 'm')?.total ?? 0) >= 1);
    assert.ok((units.find(u => u.unit === 'un')?.total ?? 0) >= 2);
    assert.ok(units.every(u => u.unit === u.unit.toLowerCase()));
  });
});
