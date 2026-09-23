import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { createCriticalTestDatabase } from '../criticalTestDatabase';
import { updateProposalStatus } from '../proposals';
import { getCenterTracking, refreshCenterTracking } from './centerTracking';

const CONTRACT_ID = '11111111-1111-4111-8111-111111111111';

test('acompanhamento da obra vindo do Centro de Custos', async context => {
  let status = 'execucao';
  let calls = 0;
  let receivedKey: string | undefined;
  const server: Server = createServer((request, response) => {
    calls += 1;
    receivedKey = request.headers['x-construtec-integration-key'] as string | undefined;
    const ok = request.url === `/api/integracao/orcamentos/contratos/${CONTRACT_ID}/resumo`;
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

  await new Promise<void>(resolve => server.close(() => resolve()));
  const offline = await getCenterTracking(database, proposalId);
  assert.equal(offline.stale, true);
  assert.equal(offline.summary?.costCenterStatus, 'concluido');
  assert.ok(offline.fetchedAt);
});
