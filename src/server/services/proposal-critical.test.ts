import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { sign } from 'jsonwebtoken';
import { documentTotal } from '../../documents/proposalDocumentCommon';
import { computeFinancialDelta } from '../../renderer/proposalDiffHelpers';
import { getProposalFinancials } from '../../shared/proposalFinancials';
import { createApp } from '../createApp';
import { approvedProposalGuardsMigration } from '../migrations/008-approved-proposal-guards';
import { createCriticalTestDatabase } from './criticalTestDatabase';
import { getDashboardSummary } from './dashboard';
import { createProposalLaborItem } from './proposalLabor';
import { cloneProposal, createProposalRevision, deleteProposal, getProposalById,
  listCurrentProposals, listProposalHistory, updateProposalBdi, updateProposalStatus } from './proposals';

test('regras críticas com PGlite real e HTTP autenticado', async context => {
  const fixture = await createCriticalTestDatabase();
  const { database, userId, makeProposal, addMaterial, addLabor } = fixture;
  context.after(() => database.close());
  const detail = async (id: string) => {
    const proposal = await getProposalById(database, id);
    assert.ok(proposal);
    return proposal;
  };

  await context.test('migração protege aprovações preexistentes sem regravar seus dados', async () => {
    const previous = await createCriticalTestDatabase(false);
    try {
      const id = await previous.makeProposal();
      await previous.addMaterial(id);
      await previous.addLabor(id);
      await updateProposalStatus(previous.database, id, 'approved', previous.userId);
      const snapshot = async () => (await previous.database.query(
        'SELECT row_to_json(p) AS proposal, (SELECT json_agg(i) FROM proposal_items i WHERE i.proposal_id=p.id) AS materials FROM proposals p WHERE p.id=$1', [id],
      )).rows;
      const before = await snapshot();
      await previous.database.exec(approvedProposalGuardsMigration);
      assert.deepEqual(await snapshot(), before);
      await assert.rejects(previous.database.query("UPDATE proposals SET status='draft' WHERE id=$1", [id]), /PROPOSAL_LOCKED/);
    } finally {
      await previous.database.close();
    }
  });

  await context.test('contrato inclui mão de obra, sem mudar aliases de materiais', async () => {
    const id = await makeProposal();
    await addMaterial(id);
    await addLabor(id);
    const proposal = await detail(id);
    assert.equal(proposal.totals.cost, 1000);
    assert.equal(proposal.totals.sale, 1250);
    assert.equal(proposal.totals.baseCost, 2760);
    assert.equal(proposal.totals.finalValue, 3450);
    assert.equal(documentTotal(proposal), 3450);
    assert.equal(proposal.laborItems?.[0].plannedTeamHours, 88);
    const legacy = { ...proposal, totals: { cost: 1000, sale: 1250, grossResult: 690, marginPercent: 20 } };
    assert.equal(getProposalFinancials(legacy).finalValue, 3450);
    const revision = await createProposalRevision(database, id, userId);
    const comparison = computeFinancialDelta(proposal, await detail(revision));
    assert.equal(comparison.saleA, 3450);
    assert.equal(comparison.costA, 2760);
    assert.equal(comparison.deltaSale, 0);
  });

  await context.test('meio centavo e mão de obra: detalhe, lista, histórico e dashboard iguais', async () => {
    const id = await makeProposal();
    await addMaterial(id, '0.5', '0.01', '0.01');
    await addMaterial(id, '0.5', '0.01', '0.01');
    await addLabor(id, 0.01);
    await updateProposalBdi(database, id, 1.25);
    const proposal = await updateProposalStatus(database, id, 'approved', userId);
    assert.equal(proposal.totals.materials, 0.02);
    assert.equal(proposal.totals.labor, 0.4);
    assert.equal(proposal.totals.finalValue, 0.53);
    assert.equal((await listCurrentProposals(database)).find(p => p.id === id)?.totalSale, 0.53);
    assert.equal((await listProposalHistory(database, id))[0].totalSale, 0.53);
    const dashboard = await getDashboardSummary(database);
    assert.equal(dashboard.totalApproved, 0.53);
    assert.equal(dashboard.intelligence?.pipeline.find(stage => stage.status === 'approved')?.totalValue, 0.53);
    assert.equal(dashboard.intelligence?.topClients[0].approvedValue, 0.53);
  });

  await context.test('approved não reabre, não apaga e não aceita alterações diretas de itens', async () => {
    const id = await makeProposal();
    const itemId = await addMaterial(id);
    await addLabor(id);
    const before = await updateProposalStatus(database, id, 'approved', userId);
    for (const next of ['draft', 'review', 'sent', 'rejected'] as const) {
      await assert.rejects(updateProposalStatus(database, id, next, userId), /PROPOSAL_LOCKED/);
    }
    await assert.rejects(deleteProposal(database, id, 'revision'), /PROPOSAL_LOCKED/);
    await assert.rejects(deleteProposal(database, id, 'all'), /PROPOSAL_LOCKED/);
    await assert.rejects(database.query("UPDATE proposals SET status='draft' WHERE id=$1", [id]), /PROPOSAL_LOCKED/);
    await assert.rejects(database.query("UPDATE proposals SET scope='Alterado' WHERE id=$1", [id]), /PROPOSAL_LOCKED/);
    await assert.rejects(database.query('UPDATE proposal_items SET quantity=2 WHERE id=$1', [itemId]), /PROPOSAL_LOCKED/);
    await assert.rejects(database.query('DELETE FROM proposal_labor_items WHERE proposal_id=$1', [id]), /PROPOSAL_LOCKED/);
    await assert.rejects(addMaterial(id), /PROPOSAL_LOCKED/);
    const draft = await makeProposal();
    await assert.rejects(database.query('UPDATE proposal_items SET proposal_id=$2 WHERE id=$1', [itemId, draft]), /PROPOSAL_LOCKED/);
    const incomingItem = await addMaterial(draft);
    await assert.rejects(database.query('UPDATE proposal_items SET proposal_id=$2 WHERE id=$1', [incomingItem, id]), /PROPOSAL_LOCKED/);
    await assert.rejects(database.query('DELETE FROM proposals WHERE id=$1', [id]), /PROPOSAL_LOCKED/);
    const after = await updateProposalStatus(database, id, 'approved', userId);
    assert.equal(after.updatedAt, before.updatedAt);
    assert.deepEqual(after.totals, before.totals);
    const events = await database.query<{ count: number }>("SELECT COUNT(*)::int AS count FROM audit_events WHERE entity_id=$1 AND action='status_updated'", [id]);
    assert.equal(events.rows[0].count, 1);
  });

  await context.test('nova revisão contém mão de obra e não permite apagar família aprovada', async () => {
    const id = await makeProposal();
    await addLabor(id);
    await updateProposalStatus(database, id, 'approved', userId);
    const revisionId = await createProposalRevision(database, id, userId);
    const revision = await detail(revisionId);
    assert.equal(revision.status, 'draft');
    assert.equal(revision.laborItems?.length, 1);
    assert.equal(revision.hasApprovedRevision, true);
    assert.equal((await listCurrentProposals(database)).find(p => p.id === revisionId)?.hasApprovedRevision, true);
    await assert.rejects(deleteProposal(database, revisionId, 'all'), /PROPOSAL_LOCKED/);
    await assert.rejects(updateProposalStatus(database, id, 'approved', userId), /PROPOSAL_LOCKED/);
    const cloneId = await cloneProposal(database, id, undefined, userId);
    assert.equal((await detail(cloneId)).laborItems?.length, 1);
    assert.notEqual((await detail(cloneId)).number, revision.number);
    await deleteProposal(database, cloneId);
    assert.equal(await getProposalById(database, cloneId), null);
  });

  await context.test('falha na cópia de mão de obra desfaz revisão/clonagem e sua auditoria', async () => {
    const id = await makeProposal();
    await addMaterial(id);
    await addLabor(id);
    await database.exec(`CREATE FUNCTION fail_labor_copy() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'TEST_LABOR_COPY_FAILURE'; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER test_labor_failure BEFORE INSERT ON proposal_labor_items
      FOR EACH ROW EXECUTE FUNCTION fail_labor_copy();`);
    const counts = async () => (await database.query<{ proposals: number; audits: number }>(
      'SELECT (SELECT COUNT(*)::int FROM proposals) AS proposals, (SELECT COUNT(*)::int FROM audit_events) AS audits',
    )).rows[0];
    const before = await counts();
    try {
      await assert.rejects(createProposalRevision(database, id, userId), /TEST_LABOR_COPY_FAILURE/);
      await assert.rejects(cloneProposal(database, id, undefined, userId), /TEST_LABOR_COPY_FAILURE/);
      assert.deepEqual(await counts(), before);
    } finally {
      await database.exec('DROP TRIGGER test_labor_failure ON proposal_labor_items; DROP FUNCTION fail_labor_copy();');
    }
  });

  await context.test('duas revisões concorrentes da mesma origem não duplicam revisão', async () => {
    const id = await makeProposal();
    await addLabor(id);
    const attempts = await Promise.allSettled([
      createProposalRevision(database, id, userId), createProposalRevision(database, id, userId),
    ]);
    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal((await listProposalHistory(database, id)).length, 2);
  });

  await context.test('HTTP mantém RBAC, 409 para aprovação bloqueada e autoria atômica', async () => {
    const secret = randomUUID();
    const server = createApp(database, 'test-only-local-token', secret).listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}/api`;
    const session = (id: string) => sign({}, secret, { algorithm: 'HS256', subject: id,
      issuer: 'construtec-orcamentos', audience: 'local-api', expiresIn: '1h' });
    const request = (path: string, token: string, method = 'POST', body?: unknown) => fetch(base + path, {
      method, headers: { 'Content-Type': 'application/json', 'X-Construtec-Session': token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    try {
      const viewerId = randomUUID();
      await database.query("INSERT INTO users (id,name,email,password_hash,role) VALUES ($1,'Leitor','reader@example.invalid','not-a-password','viewer')", [viewerId]);
      const id = await makeProposal();
      await addLabor(id);
      assert.equal((await request(`/proposals/${id}/status`, session(viewerId), 'PATCH', { status: 'approved' })).status, 403);
      assert.equal((await request(`/proposals/${id}/status`, session(userId), 'PATCH', { status: 'approved' })).status, 200);
      assert.equal((await request(`/proposals/${id}/status`, session(userId), 'PATCH', { status: 'draft' })).status, 409);
      assert.equal((await request(`/proposals/${id}`, session(userId), 'DELETE')).status, 409);
      const response = await request(`/proposals/${id}/revisions`, session(userId));
      assert.equal(response.status, 201);
      const { proposal } = await response.json();
      assert.equal(proposal.laborItems.length, 1);
      const audit = await database.query<{ user_id: string }>("SELECT user_id FROM audit_events WHERE entity_id=$1 AND action='revision_created'", [proposal.id]);
      assert.equal(audit.rows[0].user_id, userId);
      await assert.rejects(createProposalLaborItem(database, id, {
        description: 'Bloqueado', professionalCount: 1, monthlySalary: 1, monthlyFood: 0,
        monthlyTransport: 0, monthlyOtherCosts: 0, standardMonthlyHours: 1, plannedHours: 1,
      }, userId), /PROPOSAL_LOCKED/);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });
});
