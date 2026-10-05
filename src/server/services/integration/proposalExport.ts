import { randomUUID } from 'node:crypto';
import type { LocalDatabase } from '../database';
import { sealProposalInTransaction } from './proposalSealing';

export const exportProposalIntegration = async (
  database: Pick<LocalDatabase, 'query' | 'exec'>,
  proposalId: string,
  userId?: string,
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

  // Snapshot selado sem linha de envio (dado antigo ou falha parcial): cria a linha em vez de inventar um
  // eventId que nao casa com nenhuma linha (o resultado do envio nunca seria gravado).
  await database.query(
    `INSERT INTO integration_outbox (id, snapshot_id, destination, status, attempts, created_at)
     VALUES ($1, $2, 'centro-de-custos', 'pending', 0, $3)
     ON CONFLICT (snapshot_id, destination) DO NOTHING`,
    [randomUUID(), snapshot.id, snapshot.sealed_at],
  );
  const outbox = (await database.query<{ id: string }>(
    'SELECT id FROM integration_outbox WHERE snapshot_id = $1 AND destination = $2',
    [snapshot.id, 'centro-de-custos'],
  )).rows[0];
  if (!outbox) throw new Error('OUTBOX_MISSING');
  const eventId = outbox.id;

  const payload = typeof snapshot.payload === 'string' ? JSON.parse(snapshot.payload) : snapshot.payload;

  const envelope = {
    schemaVersion: '1.0.0',
    eventId,
    emittedAt: snapshot.sealed_at,
    payloadSha256: snapshot.payload_sha256,
    payload,
  };

  // Exportar so monta o envelope: a linha so vira 'delivered' quando o Centro confirma o recebimento
  // (syncProposalDirectly). Marcar aqui escondia propostas que o Centro nunca recebeu.

  return {
    envelope,
    snapshotId: snapshot.id,
    eventId,
  };
};
