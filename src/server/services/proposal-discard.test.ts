import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { createCriticalTestDatabase } from './criticalTestDatabase';
import { updateProposalStatus } from './proposals';
import { discardProposal, listDiscardedProposals, restoreProposal } from './proposalDiscard';

const CONTRACT_ID = '22222222-2222-4222-8222-222222222222';
const TABLES = ['proposals', 'proposal_items', 'proposal_labor_items', 'proposal_approval_snapshots', 'integration_outbox', 'proposal_center_snapshots'];

test('descarte e recuperacao de proposta aprovada', async context => {
  let movement: number | null = 0; // null = Centro fora do ar
  const server: Server = createServer((request, response) => {
    if (movement === null) { response.writeHead(500); response.end('{}'); return; }
    const ok = request.url === `/api/integracao/orcamentos/contratos/${CONTRACT_ID}/resumo`;
    response.writeHead(ok ? 200 : 404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(ok ? { contractId: CONTRACT_ID, costCenterId: 7, movementCount: movement } : { erro: 'nao' }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const saved = process.env.CENTRO_CUSTOS_API_URL;
  process.env.CENTRO_CUSTOS_API_URL = `http://127.0.0.1:${address.port}/api/integracao/orcamentos/sync-direto`;
  const fixture = await createCriticalTestDatabase();
  const { database, userId, makeProposal, addMaterial, addLabor } = fixture;
  context.after(async () => {
    if (saved === undefined) delete process.env.CENTRO_CUSTOS_API_URL; else process.env.CENTRO_CUSTOS_API_URL = saved;
    await database.close();
    if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
  });
  const actor = { id: userId, name: 'Admin' };
  const counts = async () => Object.fromEntries(await Promise.all(TABLES.map(async table =>
    [table, Number((await database.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${table}`)).rows[0].n)])));

  const proposalId = await makeProposal();
  await addMaterial(proposalId);
  await addLabor(proposalId);
  await updateProposalStatus(database, proposalId, 'approved', userId);
  await database.query(`UPDATE integration_outbox SET status = 'delivered', delivered_at = now(), contract_id = $2, cost_center_id = 7
    WHERE snapshot_id IN (SELECT id FROM proposal_approval_snapshots WHERE proposal_id = $1)`, [proposalId, CONTRACT_ID]);
  const number = (await database.query<{ proposal_number: string }>('SELECT proposal_number FROM proposals WHERE id = $1', [proposalId])).rows[0].proposal_number;
  const before = await counts();
  assert.ok(before.proposal_approval_snapshots >= 1 && before.integration_outbox >= 1 && before.proposal_items >= 1, 'aprovada, selada e integrada');

  // A aprovacao e definitiva pelos caminhos normais.
  await assert.rejects(database.query('DELETE FROM proposals WHERE id = $1', [proposalId]), /PROPOSAL_LOCKED/);

  // Sem confirmacao do numero, ou com movimento na obra, ou com o Centro fora do ar: nada e apagado.
  await assert.rejects(discardProposal(database, proposalId, { confirmNumber: 'PA-0000', actor }), /DISCARD_CONFIRMATION/);
  movement = 3;
  await assert.rejects(discardProposal(database, proposalId, { confirmNumber: number, actor }), /DISCARD_CENTER_HAS_MOVEMENT/);
  movement = null;
  await assert.rejects(discardProposal(database, proposalId, { confirmNumber: number, actor }), /DISCARD_CENTER_UNAVAILABLE/);
  assert.deepEqual(await counts(), before, 'recusado: tudo no lugar');

  // Descarte permitido: obra sem movimento.
  movement = 0;
  const { discardId } = await discardProposal(database, proposalId, { confirmNumber: number.toLowerCase(), reason: 'proposta de teste', actor });
  assert.deepEqual(await counts(), Object.fromEntries(TABLES.map(table => [table, 0])));
  const listed = await listDiscardedProposals(database);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].proposal_number, number);
  assert.equal(listed[0].had_approval, true);
  assert.equal(listed[0].reason, 'proposta de teste');
  assert.equal(listed[0].restored_at, null);
  assert.ok((await database.query("SELECT 1 FROM audit_events WHERE action = 'discarded'")).rows.length);

  // Recuperacao devolve tudo como era, e as travas de aprovacao voltam a valer.
  const restored = await restoreProposal(database, discardId, actor);
  assert.equal(restored.proposalNumber, number);
  assert.deepEqual(await counts(), before);
  await assert.rejects(database.query('DELETE FROM proposals WHERE id = $1', [proposalId]), /PROPOSAL_LOCKED/);
  await assert.rejects(restoreProposal(database, discardId, actor), /DISCARD_ALREADY_RESTORED/);
  assert.ok((await listDiscardedProposals(database))[0].restored_at);
  await assert.rejects(database.query('DELETE FROM proposal_approval_snapshots'), /SNAPSHOT_LOCKED/);

  // Pode descartar de novo; com o numero ja em uso, nao restaura duas vezes.
  const again = await discardProposal(database, proposalId, { confirmNumber: number, actor });
  assert.deepEqual(await counts(), Object.fromEntries(TABLES.map(table => [table, 0])));
  await restoreProposal(database, again.discardId, actor);
  assert.deepEqual(await counts(), before);
});
