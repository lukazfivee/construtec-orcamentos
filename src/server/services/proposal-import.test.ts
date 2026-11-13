import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { importCatalogProducts } from './catalog';
import { createCriticalTestDatabase } from './criticalTestDatabase';
import { applyKitToProposal } from './kits';
import { copyItemsFromProposal, importProposalItemsBatch } from './proposalImport';

type ItemRow = {
  position: number; code: string; description: string; category: string; unit: string;
  cost: number; quantity: number; sale: number; product: string | null; manufacturer: string | null;
};

test('itens em lote: importacao, copia entre propostas, kit e importacao do catalogo', async context => {
  const { database, userId, makeProposal, addMaterial } = await createCriticalTestDatabase();
  context.after(() => database.close());
  const product = async (code: string, cost: string, active = true) => {
    const id = randomUUID();
    await database.query(`INSERT INTO products (id, code, manufacturer, model, description, category, unit, current_cost, source, active)
      VALUES ($1, $2, 'Marca', 'Modelo', $3, 'Cabos', 'pc', $4, 'TESTE', $5)`, [id, code, `Catálogo ${code}`, cost, active]);
    return id;
  };
  const rows = async (proposalId: string) => (await database.query<ItemRow>(`
    SELECT position, snapshot_code AS code, snapshot_description AS description, snapshot_category AS category, snapshot_unit AS unit,
      snapshot_unit_cost::float8 AS cost, quantity::float8 AS quantity, sale_unit_price::float8 AS sale,
      catalog_product_id AS product, snapshot_manufacturer AS manufacturer
    FROM proposal_items WHERE proposal_id = $1 ORDER BY position`, [proposalId])).rows.map((row) => ({ ...row }));
  const setRates = (proposalId: string, bdi: number, tax: number) => database.query(
    'UPDATE proposals SET bdi_multiplier = $2, tax_percentage = $3 WHERE id = $1', [proposalId, bdi, tax]);
  const audits = async (proposalId: string, action: string) => (await database.query(
    'SELECT 1 FROM audit_events WHERE entity_id = $1 AND action = $2', [proposalId, action])).rows.length;
  const catalogId = await product('CAT-1', '20');
  await product('CAT-OFF', '9', false);

  await context.test('importacao em lote usa o catalogo ativo, numera item sem codigo e pula quantidade zero', async () => {
    const proposalId = await makeProposal();
    await setRates(proposalId, 1.5, 10);
    await addMaterial(proposalId);
    await importProposalItemsBatch(database, proposalId, [
      { code: ' CAT-1 ', description: '', quantity: 2 },
      { code: 'CAT-1', description: 'Nome digitado', category: 'Outra', unit: 'm', quantity: 1, unitCost: 5, unitSale: 11 },
      { description: 'Zerado', quantity: 0 },
      { code: 'CAT-OFF', description: 'Inativo', quantity: 1 },
      { description: 'Sem código', quantity: 3, unitCost: 4 },
    ], userId);
    const [, fromCatalog, typed, inactive, noCode, ...rest] = await rows(proposalId);
    assert.equal(rest.length, 0);
    assert.deepEqual(fromCatalog, { position: 2, code: 'CAT-1', description: 'Catálogo CAT-1', category: 'Cabos', unit: 'pc', cost: 20, quantity: 2, sale: 30, product: catalogId, manufacturer: 'Marca' });
    // Venda digitada entra sem o imposto da proposta (11 / 1,10).
    assert.deepEqual(typed, { position: 3, code: 'CAT-1', description: 'Nome digitado', category: 'Outra', unit: 'm', cost: 5, quantity: 1, sale: 10, product: catalogId, manufacturer: 'Marca' });
    assert.deepEqual(inactive, { position: 4, code: 'CAT-OFF', description: 'Inativo', category: 'Importado', unit: 'un', cost: 0, quantity: 1, sale: 0, product: null, manufacturer: null });
    assert.deepEqual(noCode, { position: 5, code: 'ITEM-005', description: 'Sem código', category: 'Importado', unit: 'un', cost: 4, quantity: 3, sale: 6, product: null, manufacturer: null });
    assert.equal(await audits(proposalId, 'items_imported'), 1);
  });

  await context.test('copia entre propostas: venda automatica segue o BDI do destino e venda digitada fica', async () => {
    const source = await makeProposal();
    await setRates(source, 1.25, 0);
    await addMaterial(source, '10', '10', '12.5');
    const manual = await addMaterial(source, '2', '10', '20');
    const target = await makeProposal();
    await setRates(target, 1.5, 0);
    await copyItemsFromProposal(database, target, source, undefined, userId);
    assert.deepEqual((await rows(target)).map((row) => [row.position, row.cost, row.quantity, row.sale]), [[1, 10, 10, 15], [2, 10, 2, 20]]);
    await copyItemsFromProposal(database, target, source, [manual], userId);
    assert.deepEqual((await rows(target)).map((row) => [row.position, row.sale]), [[1, 15], [2, 20], [3, 20]]);
    assert.equal(await audits(target, 'items_copied'), 2);
    await assert.rejects(copyItemsFromProposal(database, target, await makeProposal()), /NO_ITEMS_FOUND/);
  });

  await context.test('kit aplicado entra depois dos itens existentes, com custo do catalogo e venda pelo BDI', async () => {
    const first = await product('KIT-A', '8');
    const second = await product('KIT-B', '2.5');
    const kitId = randomUUID();
    await database.query("INSERT INTO kits (id, name) VALUES ($1, 'Kit do lote')", [kitId]);
    await database.query(`INSERT INTO kit_items (id, kit_id, catalog_product_id, position, snapshot_code, snapshot_description, snapshot_unit, quantity)
      VALUES ($1, $3, $4, 1, 'KIT-A', 'A', 'pc', 2), ($2, $3, $5, 2, 'KIT-B', 'B', 'pc', 4)`, [randomUUID(), randomUUID(), kitId, first, second]);
    const proposalId = await makeProposal();
    await setRates(proposalId, 1.5, 0);
    await addMaterial(proposalId);
    await applyKitToProposal(database, kitId, proposalId, userId);
    assert.deepEqual((await rows(proposalId)).slice(1).map((row) => [row.position, row.code, row.cost, row.quantity, row.sale, row.product]),
      [[2, 'KIT-A', 8, 2, 12, first], [3, 'KIT-B', 2.5, 4, 3.75, second]]);
    assert.equal(await audits(proposalId, 'kit_applied'), 1);
    await database.query("UPDATE proposals SET status = 'sent' WHERE id = $1", [proposalId]);
    await assert.rejects(applyKitToProposal(database, kitId, proposalId, userId), /PROPOSAL_LOCKED/);
  });

  await context.test('importacao do catalogo cria, atualiza sem diferenciar maiusculas e trata codigo repetido no mesmo lote', async () => {
    const item = (code: string, currentCost: number, source = 'TESTE') => ({
      code, manufacturer: null, model: null, description: `Item ${code}`, category: 'Teste', unit: 'UN', currentCost, source, active: true,
    });
    const result = await importCatalogProducts(database, [item('novo-1', 10), item('NOVO-1', 12), item('cat-1', 21), item('EX-1', 0, 'EXSAT')]);
    assert.deepEqual(result, { created: 1, updated: 2, ignored: 1 });
    const stored = (await database.query<{ id: string; code: string; cost: number; unit: string }>(
      "SELECT id, code, current_cost::float8 AS cost, unit FROM products WHERE lower(code) IN ('novo-1', 'cat-1', 'ex-1') ORDER BY code")).rows.map((row) => ({ ...row }));
    assert.equal(stored.length, 2);
    assert.deepEqual(stored[0], { id: catalogId, code: 'CAT-1', cost: 21, unit: 'un' });
    assert.deepEqual([stored[1].code, stored[1].cost], ['NOVO-1', 12]);
  });
});
