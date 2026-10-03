import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createCriticalTestDatabase } from './criticalTestDatabase';
import { getCatalogOverview } from './catalogOverview';
import { getAppSettings, updateAppSettings } from './settings';
import { getProposalById, updateProposalStatus } from './proposals';

test('catalogo no computador: uso, mudanca de preco, itens novos e padroes da empresa', async context => {
  const fixture = await createCriticalTestDatabase();
  const { database, userId, makeProposal, addMaterial } = fixture;
  context.after(() => database.close());
  const setCatalog = (itemId: string, cost: string, extra = '') => database.query(
    `INSERT INTO products (id, code, description, category, unit, current_cost, source, active ${extra ? ', created_at' : ''})
     VALUES ($1, $2, 'Material fictício', 'Teste', 'm', $3, 'TESTE', true ${extra ? ', $4' : ''})
     ON CONFLICT (code) DO UPDATE SET current_cost = EXCLUDED.current_cost`,
    extra ? [randomUUID(), `MAT-${itemId}`, cost, extra] : [randomUUID(), `MAT-${itemId}`, cost]);

  await context.test('mostra onde o item e usado e o preco que mudou, e esconde o custo sem p10', async () => {
    const proposalId = await makeProposal();
    const itemId = await addMaterial(proposalId, '4', '10', '12');
    await setCatalog(itemId, '12.50', '2020-01-01');
    const proposal = await getProposalById(database, proposalId);
    assert.ok(proposal);
    const withCost = await getCatalogOverview(database, true);
    const row = withCost.items.find(item => item.code === `MAT-${itemId}`);
    assert.ok(row);
    assert.deepEqual(row.usedIn, [proposal.number]);
    assert.equal(row.changePercent, 25);
    assert.equal(row.fromUnit, 10);
    assert.equal(row.toUnit, 12.5);
    assert.equal(row.isNew, false);
    assert.equal(withCost.changedItems.find(item => item.code === `MAT-${itemId}`)?.currentCost, 12.5);
    const noCost = await getCatalogOverview(database, false);
    const hidden = noCost.items.find(item => item.code === `MAT-${itemId}`);
    assert.ok(hidden);
    assert.equal(hidden.changePercent, 25);
    assert.equal(hidden.fromUnit, undefined);
    assert.equal(hidden.toUnit, undefined);
  });

  await context.test('proposta fora de edicao mantem o preco: vira congelada, nao mudanca', async () => {
    const proposalId = await makeProposal();
    const itemId = await addMaterial(proposalId, '1', '10', '12');
    await setCatalog(itemId, '30', '2020-01-01');
    await updateProposalStatus(database, proposalId, 'review', userId);
    const overview = await getCatalogOverview(database, true);
    const row = overview.items.find(item => item.code === `MAT-${itemId}`);
    assert.ok(row);
    assert.equal(row.changePercent, undefined);
    assert.equal(row.usedIn.length, 1);
    const frozen = overview.frozenProposals.find(item => item.id === proposalId);
    assert.ok(frozen);
    assert.equal(frozen.status, 'review');
    assert.equal(frozen.itemCount, 1);
  });

  await context.test('item criado ha pouco aparece como novo e a contagem total bate', async () => {
    const code = `NOVO-${randomUUID().slice(0, 6)}`;
    await database.query(`INSERT INTO products (id, code, description, category, unit, current_cost, source, active)
      VALUES ($1, $2, 'Câmera nova', 'CFTV', 'un', 99.9, 'EXSAT', true)`, [randomUUID(), code]);
    const overview = await getCatalogOverview(database, true);
    assert.ok(overview.items.find(item => item.code === code)?.isNew);
    assert.ok(overview.newCount >= 1);
    const fresh = overview.newItems.find(item => item.code === code);
    assert.equal(fresh?.currentCost, 99.9);
    assert.equal((await getCatalogOverview(database, false)).newItems.find(item => item.code === code)?.currentCost, undefined);
    const total = await database.query<{ total: string }>('SELECT count(*)::text AS total FROM products');
    assert.equal(overview.productCount, Number(total.rows[0].total));
    // Itens antigos (criados fora da janela) nao entram como novos.
    assert.ok(!overview.newItems.some(item => item.code.startsWith('MAT-')));
  });

  await context.test('padroes da empresa: BDI e impostos entram na proposta nova e os toggles do PDF salvam', async () => {
    const before = await getAppSettings(database);
    assert.equal(before.defaultTaxPercentage, 0);
    assert.equal(before.pdfShowLogo, true);
    // Antes de alguem confirmar o BDI em Padroes da empresa, a proposta nova nasce com 1,25 como sempre.
    assert.equal((await getProposalById(database, await makeProposal()))?.bdiMultiplier, 1.25);
    const saved = await updateAppSettings(database, { defaultBdi: 1.3, defaultTaxPercentage: 15, pdfShowLogo: false, pdfShowSignature: false });
    assert.equal(saved.defaultBdi, 1.3);
    assert.equal(saved.defaultTaxPercentage, 15);
    assert.equal(saved.pdfShowLogo, false);
    assert.equal(saved.pdfShowSignature, false);
    // Valor fora da faixa e ignorado.
    assert.equal((await updateAppSettings(database, { defaultTaxPercentage: 400 })).defaultTaxPercentage, 15);
    const proposal = await getProposalById(database, await makeProposal());
    assert.ok(proposal);
    assert.equal(proposal.bdiMultiplier, 1.3);
    assert.equal(proposal.taxPercentage, 15);
  });
});
