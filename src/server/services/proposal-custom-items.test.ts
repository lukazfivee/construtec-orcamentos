import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCriticalTestDatabase } from './criticalTestDatabase';
import { addBlankProposalItem, addProposalItemToCatalog, BLANK_ITEM_DESCRIPTION } from './proposalCustomItems';
import { getProposalById, updateProposalItem, updateProposalStatus } from './proposals';
import { listCatalogProducts } from './catalog';

test('linha em branco na proposta e promocao dela ao catalogo', async context => {
  const { database, userId, makeProposal } = await createCriticalTestDatabase();
  context.after(() => database.close());

  await context.test('a linha nasce avulsa, vazia e entra no total depois de preenchida', async () => {
    const id = await makeProposal();
    const proposal = await addBlankProposalItem(database, id, userId);
    assert.equal(proposal.items.length, 1);
    const line = proposal.items[0];
    assert.equal(line.description, BLANK_ITEM_DESCRIPTION);
    assert.equal(line.inCatalog, false);
    assert.equal(line.quantity, 1);
    assert.equal(line.unitSale, 0);
    await updateProposalItem(database, id, line.id, { description: 'Conector especial', unit: 'pc', unitCost: 10, unitSale: 15, quantity: 4 });
    const filled = await getProposalById(database, id);
    assert.equal(filled?.items[0].description, 'Conector especial');
    assert.equal(filled?.items[0].totalSale, 60);
    const second = await addBlankProposalItem(database, id, userId);
    assert.equal(second.items.length, 2);
    assert.notEqual(second.items[0].code, second.items[1].code, 'codigos automaticos nao repetem');
  });

  await context.test('adicionar ao catalogo cria o produto com os dados da linha e liga a linha a ele', async () => {
    const id = await makeProposal();
    const line = (await addBlankProposalItem(database, id, userId)).items[0];
    await updateProposalItem(database, id, line.id, { description: 'Abraçadeira especial', unit: 'PC', unitCost: 2.5, unitSale: 4, category: 'Fixação' });
    const productId = await addProposalItemToCatalog(database, id, line.id, { code: ' abr-esp-01 ' }, userId);
    const product = (await listCatalogProducts(database, 'ABR-ESP-01'))[0];
    assert.equal(product.id, productId);
    assert.equal(product.description, 'Abraçadeira especial');
    assert.equal(product.unit, 'pc');
    assert.equal(product.currentCost, 2.5);
    assert.equal(product.category, 'Fixação');
    const after = await getProposalById(database, id);
    assert.equal(after?.items[0].code, 'ABR-ESP-01');
    assert.equal(after?.items[0].inCatalog, true);
    assert.equal(after?.items[0].unitSale, 4, 'o preco da proposta nao muda');
    await assert.rejects(addProposalItemToCatalog(database, id, line.id, { code: 'OUTRO' }, userId), /ITEM_ALREADY_IN_CATALOG/);
  });

  await context.test('codigo repetido no catalogo e recusado e a linha continua avulsa', async () => {
    const id = await makeProposal();
    const first = (await addBlankProposalItem(database, id, userId)).items[0];
    await addProposalItemToCatalog(database, id, first.id, { code: 'DUP-1' }, userId);
    const second = (await addBlankProposalItem(database, id, userId)).items[1];
    await assert.rejects(addProposalItemToCatalog(database, id, second.id, { code: 'dup-1' }, userId), /PRODUCT_DUPLICATE/);
    assert.equal((await getProposalById(database, id))?.items[1].inCatalog, false);
  });

  await context.test('proposta fechada nao aceita linha em branco nem promocao ao catalogo', async () => {
    const id = await makeProposal();
    const line = (await addBlankProposalItem(database, id, userId)).items[0];
    await updateProposalItem(database, id, line.id, { description: 'Item fechado', unitCost: 1, unitSale: 2 });
    await updateProposalStatus(database, id, 'approved', userId);
    await assert.rejects(addBlankProposalItem(database, id, userId), /PROPOSAL_LOCKED/);
    await assert.rejects(addProposalItemToCatalog(database, id, line.id, { code: 'FECH-1' }, userId), /PROPOSAL_LOCKED/);
  });
});
