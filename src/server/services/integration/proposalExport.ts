import { randomUUID } from 'node:crypto';
import type { LocalDatabase } from '../database';
import { sealProposalInTransaction } from './proposalSealing';

export const exportProposalIntegration = async (
  database: Pick<LocalDatabase, 'query' | 'exec'>,
  proposalId: string,
  userId?: string,
  markExported = true,
) => {
  const proposalResult = await database.query<{ id: string; status: string; proposal_number: string }>(
    'SELECT id, status, proposal_number FROM proposals WHERE id = $1',
    [proposalId]
  );
  const proposal = proposalResult.rows[0];
  if (!proposal) throw new Error('PROPOSAL_NOT_FOUND');
  if (proposal.status !== 'approved') throw new Error('PROPOSAL_NOT_APPROVED');

  let snapshot = (await database.query<{
    id: string;
    series_id: string;
    revision: number;
    payload: unknown;
    payload_sha256: string;
    sealed_at: string;
  }>('SELECT * FROM proposal_approval_snapshots WHERE proposal_id = $1', [proposalId])).rows[0];

  if (!snapshot) {
    const sealed = await sealProposalInTransaction(database, proposalId, userId);
    if (!sealed) throw new Error('SEAL_FAILED');
    snapshot = (await database.query<{
      id: string;
      series_id: string;
      revision: number;
      payload: unknown;
      payload_sha256: string;
      sealed_at: string;
    }>('SELECT * FROM proposal_approval_snapshots WHERE id = $1', [sealed.id])).rows[0];
  }

  const outboxResult = await database.query<{
    id: string;
    status: string;
    attempts: number;
    created_at: string;
  }>('SELECT id, status, attempts, created_at FROM integration_outbox WHERE snapshot_id = $1 AND destination = $2', [
    snapshot.id,
    'centro-de-custos',
  ]);
  const outbox = outboxResult.rows[0];
  const eventId = outbox?.id || randomUUID();

  const payload = typeof snapshot.payload === 'string' ? JSON.parse(snapshot.payload) : snapshot.payload;

  const envelope = {
    schemaVersion: '1.0.0',
    eventId,
    emittedAt: snapshot.sealed_at,
    payloadSha256: snapshot.payload_sha256,
    payload,
  };

  if (outbox && markExported) {
    await database.query(
      'UPDATE integration_outbox SET attempts = attempts + 1, delivered_at = now(), status = $2 WHERE id = $1',
      [outbox.id, 'delivered']
    );
  }

  return {
    envelope,
    snapshotId: snapshot.id,
    eventId,
  };
};
