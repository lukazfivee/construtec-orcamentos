import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCriticalTestDatabase } from './criticalTestDatabase';
import { cloneProposal, createProposalRevision, getProposalById, updateProposalStatus } from './proposals';
import { canonicalJsonStringify, computeSha256 } from './integration/proposalSealing';

test('F2.1 - Selo Canônico de Proposta e Outbox de Integração', async context => {
  const fixture = await createCriticalTestDatabase();
  const { database, userId, makeProposal, addMaterial, addLabor } = fixture;
  context.after(() => database.close());

  await context.test('aprovação sela proposta, cria snapshot com SHA-256 canônico e enfileira na outbox', async () => {
    const proposalId = await makeProposal();
    await addMaterial(proposalId, '50', '20', '30');
    await addLabor(proposalId, 44);

    // Aprovar proposta
    const approved = await updateProposalStatus(database, proposalId, 'approved', userId);
    assert.equal(approved.status, 'approved');
    assert.ok(approved.seriesId, 'seriesId deve estar preenchido');

    // Verificar snapshot gravado
    const snapshotResult = await database.query<{
      id: string;
      proposal_id: string;
      series_id: string;
      revision: number;
      payload: Record<string, unknown>;
      payload_sha256: string;
    }>('SELECT * FROM proposal_approval_snapshots WHERE proposal_id = $1', [proposalId]);

    assert.equal(snapshotResult.rows.length, 1);
    const snapshot = snapshotResult.rows[0];
    assert.equal(snapshot.series_id, approved.seriesId);
    assert.equal(snapshot.revision, 0);

    const payload = typeof snapshot.payload === 'string' ? JSON.parse(snapshot.payload) : snapshot.payload;
    assert.equal(payload.proposal.id, proposalId);
    assert.equal(payload.proposal.seriesId, approved.seriesId);
    assert.equal(payload.proposal.status, 'approved');
    assert.equal(payload.materials.length, 1);
    assert.equal(payload.labor.length, 1);

    // Conferir integridade SHA-256 canônico
    const expectedCanonical = canonicalJsonStringify(payload);
    const expectedHash = computeSha256(expectedCanonical);
    assert.equal(snapshot.payload_sha256, expectedHash);

    // Verificar enfileiramento na outbox
    const outboxResult = await database.query<{
      id: string;
      snapshot_id: string;
      destination: string;
      status: string;
    }>('SELECT * FROM integration_outbox WHERE snapshot_id = $1', [snapshot.id]);

    assert.equal(outboxResult.rows.length, 1);
    assert.equal(outboxResult.rows[0].destination, 'centro-de-custos');
    assert.equal(outboxResult.rows[0].status, 'pending');

    // Trigger de imutabilidade do snapshot
    await assert.rejects(
      database.query("UPDATE proposal_approval_snapshots SET revision = 99 WHERE id = $1", [snapshot.id]),
      /SNAPSHOT_LOCKED/,
    );
    await assert.rejects(
      database.query("DELETE FROM proposal_approval_snapshots WHERE id = $1", [snapshot.id]),
      /SNAPSHOT_LOCKED/,
    );
  });

  await context.test('revisão preserva series_id e clone gera nova série', async () => {
    const origId = await makeProposal();
    const orig = await getProposalById(database, origId);
    assert.ok(orig?.seriesId);

    // Revisão
    const revId = await createProposalRevision(database, origId, userId);
    const rev = await getProposalById(database, revId);
    assert.ok(rev?.seriesId);
    assert.equal(rev.seriesId, orig.seriesId, 'Revisão deve herdar o series_id da proposta original');
    assert.equal(rev.revision, orig.revision + 1);

    // Clone
    const cloneId = await cloneProposal(database, origId, undefined, userId);
    const cloned = await getProposalById(database, cloneId);
    assert.ok(cloned?.seriesId);
    assert.notEqual(cloned.seriesId, orig.seriesId, 'Clone deve gerar um novo series_id');
    assert.equal(cloned.revision, 0);
  });

  await context.test('exportação da integração extrai snapshot imutável e marca outbox como entregue', async () => {
    const { exportProposalIntegration } = await import('./integration/proposalExport');
    const pId = await makeProposal();
    await addMaterial(pId, '10', '5', '8');

    // Tentar exportar proposta não aprovada deve falhar
    await assert.rejects(exportProposalIntegration(database, pId, userId), /PROPOSAL_NOT_APPROVED/);

    // Aprovar proposta
    await updateProposalStatus(database, pId, 'approved', userId);

    // Exportar integração
    const exportResult = await exportProposalIntegration(database, pId, userId);
    assert.ok(exportResult.envelope);
    assert.equal(exportResult.envelope.schemaVersion, '1.0.0');
    assert.ok(exportResult.envelope.payloadSha256);
    assert.equal(exportResult.envelope.payload.proposal.id, pId);

    // Verificar outbox marcada como entregue
    const outbox = await database.query<{ status: string; attempts: number }>(
      'SELECT status, attempts FROM integration_outbox WHERE snapshot_id = $1',
      [exportResult.snapshotId]
    );
    assert.equal(outbox.rows[0].status, 'delivered');
    assert.equal(outbox.rows[0].attempts, 1);
  });

  await context.test('sincronização direta transmite envelope com sucesso e trata servidor offline', async () => {
    const { syncProposalDirectly } = await import('./integration/proposalSync');
    const pId = await makeProposal();
    await addMaterial(pId, '20', '10', '15');
    await updateProposalStatus(database, pId, 'approved', userId);

    // 1. Servidor offline
    const offlineResult = await syncProposalDirectly(
      database,
      pId,
      userId,
      'http://127.0.0.1:59999/api/integracao/orcamentos/sync-direto'
    );
    assert.equal(offlineResult.ok, false);
    assert.equal(offlineResult.status, 'offline');
    assert.equal(offlineResult.offline, true);
    const pending = (await database.query<{ status: string; attempts: number; delivered_at: string | null }>(
      'SELECT status, attempts, delivered_at FROM integration_outbox WHERE snapshot_id IN (SELECT id FROM proposal_approval_snapshots WHERE proposal_id = $1)', [pId]
    )).rows[0];
    assert.equal(pending.status, 'pending');
    assert.equal(pending.attempts, 1);
    assert.equal(pending.delivered_at, null);
    assert.match(offlineResult.error || '', /não está em execução|conexão|ECONNREFUSED|fetch failed/i);

    // 2. Servidor mock online
    let receivedHeader = '';
    let validReceipt = false;
    let receivedBody: Record<string, unknown> | null = null;
    const { createServer } = await import('node:http');
    const mockServer = createServer((req, res) => {
      receivedHeader = req.headers['x-construtec-integration-key'] as string || '';
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end', () => {
        receivedBody = JSON.parse(data) as Record<string, unknown>;
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          status: validReceipt ? 'imported' : 'invalid-receipt',
          contractId: 'mock-contract-123',
          costCenterId: 10,
          baselineId: 'mock-baseline-456',
        }));
      });
    });

    await new Promise<void>(resolve => { mockServer.listen(0, '127.0.0.1', () => resolve()); });
    const address = mockServer.address() as { port: number };
    const mockUrl = `http://127.0.0.1:${address.port}/api/integracao/orcamentos/sync-direto`;

    try {
      const invalid = await syncProposalDirectly(database, pId, userId, mockUrl);
      assert.equal(invalid.ok, false);
      assert.equal((await database.query<{ status: string }>(
        'SELECT status FROM integration_outbox WHERE snapshot_id IN (SELECT id FROM proposal_approval_snapshots WHERE proposal_id = $1)', [pId]
      )).rows[0].status, 'pending');
      validReceipt = true;
      const syncRes = await syncProposalDirectly(database, pId, userId, mockUrl);
      assert.equal(syncRes.ok, true);
      assert.equal(syncRes.status, 'imported');
      assert.equal(syncRes.contractId, 'mock-contract-123');
      assert.equal(syncRes.centerUrl, new URL('/', mockUrl).href);
      assert.equal(receivedHeader, 'construtec-internal-integration-secret-2026');
      assert.ok(receivedBody);
      assert.equal((receivedBody as Record<string, unknown>).schemaVersion, '1.0.0');

      // Verificar outbox marcada como delivered
      const outbox = await database.query<{ status: string }>(
        'SELECT io.status FROM integration_outbox io JOIN proposal_approval_snapshots s ON s.id = io.snapshot_id WHERE s.proposal_id = $1',
        [pId]
      );
      assert.equal(outbox.rows[0].status, 'delivered');
    } finally {
      await new Promise(resolve => mockServer.close(resolve));
    }
  });
});
