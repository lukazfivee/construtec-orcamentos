import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCriticalTestDatabase } from './criticalTestDatabase';
import { addBlankProposalItem } from './proposalCustomItems';
import { getProposalById, updateProposalBdi, updateProposalItem, updateProposalTax } from './proposals';

test('preco de venda final: imposto embutido nas linhas, edicao em valor final e venda automatica pelo custo', async context => {
  const { database, userId, makeProposal } = await createCriticalTestDatabase();
  context.after(() => database.close());

  await context.test('as linhas mostram a venda com o imposto e o total da linha bate com o valor final', async () => {
    const id = await makeProposal();
    await updateProposalBdi(database, id, 1.25);
    await updateProposalTax(database, id, 15);
    const line = (await addBlankProposalItem(database, id, userId)).items[0];
    await updateProposalItem(database, id, line.id, { unitCost: 197.8, unit: 'un' });
    const proposal = await getProposalById(database, id);
    assert.equal(proposal?.items[0].unitSale, 284.34, '197,80 x 1,25 x 1,15');
    assert.equal(proposal?.items[0].totalSale, 284.34);
    assert.equal(proposal?.totals.finalValue, 284.34);
  });

  await context.test('custo novo recalcula a venda quando ela ainda e automatica; venda digitada a mao fica', async () => {
    const id = await makeProposal();
    await updateProposalBdi(database, id, 1.25);
    await updateProposalTax(database, id, 15);
    const line = (await addBlankProposalItem(database, id, userId)).items[0];
    await updateProposalItem(database, id, line.id, { unitCost: 100 });
    assert.equal((await getProposalById(database, id))?.items[0].unitSale, 143.75);
    await updateProposalItem(database, id, line.id, { unitCost: 200 });
    assert.equal((await getProposalById(database, id))?.items[0].unitSale, 287.5, 'segue o custo');
    await updateProposalItem(database, id, line.id, { unitSale: 400 });
    assert.equal((await getProposalById(database, id))?.items[0].unitSale, 400, 'o valor digitado e o valor final');
    await updateProposalItem(database, id, line.id, { unitCost: 300 });
    assert.equal((await getProposalById(database, id))?.items[0].unitSale, 400, 'venda a mao nao muda com o custo');
  });

  await context.test('sem imposto nada muda e o custo continua sem aparecer na venda', async () => {
    const id = await makeProposal();
    await updateProposalBdi(database, id, 1.5);
    const line = (await addBlankProposalItem(database, id, userId)).items[0];
    await updateProposalItem(database, id, line.id, { unitCost: 10, quantity: 3 });
    const item = (await getProposalById(database, id))?.items[0];
    assert.equal(item?.unitSale, 15);
    assert.equal(item?.totalSale, 45);
  });
});
