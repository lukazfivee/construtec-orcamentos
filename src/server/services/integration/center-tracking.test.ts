import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { createCriticalTestDatabase } from '../criticalTestDatabase';
import { getProposalById, listCurrentProposals, updateProposalStatus } from '../proposals';
import { fetchContractMovement, getCenterTracking, refreshCenterTracking } from './centerTracking';
import { syncProposalDirectly } from './proposalSync';

const CONTRACT_ID = '11111111-1111-4111-8111-111111111111';
const NEW_CONTRACT_ID = '33333333-3333-4333-8333-333333333333';

test('acompanhamento da obra vindo do Centro de Custos', async context => {
  let status = 'execucao';
  let discarded = false;
  let calls = 0;
  let receivedKey: string | undefined;
  const server: Server = createServer((request, response) => {
    calls += 1;
    receivedKey = request.headers['x-construtec-integration-key'] as string | undefined;
    if (request.url === '/api/integracao/orcamentos/sync-direto') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ ok: true, status: 'imported', contractId: NEW_CONTRACT_ID, costCenterId: 8, baselineId: 'b2' }));
      return;
    }
    const ok = request.url === `/api/integracao/orcamentos/contratos/${CONTRACT_ID}/resumo`;
    if (ok && discarded) {
      response.writeHead(410, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ code: 'CENTER_DISCARDED', discarded: true, discardedAt: '2026-10-01T10:00:00Z', discardedBy: 'Lucas', costCenterCode: 'CC-7' }));
      return;
    }
    response.writeHead(ok ? 200 : 404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(ok ? {
      contractId: CONTRACT_ID, costCenterId: 7, costCenterStatus: status, hasBudget: true,
      baseline: { id: 'b1', version: 1, contractValueCents: 345000, baseCostCents: 276000, sealedAt: null },
      realizedCents: 300000, realizedPercent: 108.7, balanceCents: -24000, overBudget: true, unlinkedExpenseCents: 1500,
      updatedAt: new Date().toISOString(),
    } : { erro: 'Contrato não encontrado' }));
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

  const proposalId = await makeProposal();
  await addMaterial(proposalId);
  await addLabor(proposalId);
  assert.equal((await getCenterTracking(database, proposalId)).integrated, false);

  await updateProposalStatus(database, proposalId, 'approved', userId);
  await database.query(`UPDATE integration_outbox SET status = 'delivered', delivered_at = now(), contract_id = $2, cost_center_id = 7
    WHERE snapshot_id IN (SELECT id FROM proposal_approval_snapshots WHERE proposal_id = $1)`, [proposalId, CONTRACT_ID]);

  const live = await getCenterTracking(database, proposalId);
  assert.equal(live.integrated, true);
  assert.equal(live.stale, false);
  assert.equal(live.summary?.realizedCents, 300000);
  assert.equal(live.summary?.overBudget, true);
  assert.equal(receivedKey, 'construtec-internal-integration-secret-2026');

  status = 'concluido';
  assert.equal(await refreshCenterTracking(database), 1);
  const callsAfterFinish = calls;
  assert.equal(await refreshCenterTracking(database), 0, 'obra concluida sai do Cron');
  assert.equal(calls, callsAfterFinish);

  // Obra descartada no Centro (410): proposta volta a "Aprovada sem Centro de Custo" e o reenvio fica liberado.
  discarded = true;
  const gone = await getCenterTracking(database, proposalId);
  assert.equal(gone.integrated, false);
  assert.equal(gone.stale, false);
  assert.deepEqual(gone.centerDiscarded, { discardedAt: '2026-10-01T10:00:00Z', discardedBy: 'Lucas', costCenterCode: 'CC-7' });
  const listedStatus = async () => (await listCurrentProposals(database)).find(item => item.id === proposalId)?.syncStatus;
  assert.equal(await listedStatus(), 'center_discarded');
  assert.equal(await fetchContractMovement(CONTRACT_ID), 0, '410 conta como sem movimento');
  assert.equal((await getProposalById(database, proposalId))?.costCenterId ?? null, null, 'sem obra ligada: aparece Gerar Centro de Custo');

  // O Cron continua olhando a obra descartada e percebe quando ela e recuperada no Centro.
  assert.equal(await refreshCenterTracking(database), 1);
  assert.equal(await listedStatus(), 'center_discarded');
  discarded = false;
  assert.equal(await refreshCenterTracking(database), 1);
  assert.equal(await listedStatus(), 'delivered', 'obra recuperada no Centro');

  // Reenvio (Gerar Centro de Custo) com a obra descartada: nao e barrado e liga a obra nova.
  discarded = true;
  await getCenterTracking(database, proposalId);
  assert.equal(await listedStatus(), 'center_discarded');
  const resent = await syncProposalDirectly(database, proposalId, userId);
  assert.equal(resent.ok, true);
  assert.equal(resent.contractId, NEW_CONTRACT_ID);
  assert.equal(await listedStatus(), 'delivered');
  discarded = false;

  await new Promise<void>(resolve => server.close(() => resolve()));
  const offline = await getCenterTracking(database, proposalId);
  assert.equal(offline.stale, true);
  assert.equal(offline.summary?.costCenterStatus, 'concluido');
  assert.ok(offline.fetchedAt);
});
