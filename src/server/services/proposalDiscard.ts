import { randomUUID } from 'node:crypto';
import type { LocalDatabase } from './database';
import { fetchContractMovement } from './integration/centerTracking';

// Descarte e recuperacao de proposta por um administrador, inclusive aprovada. A aprovacao e definitiva por
// regra de projeto (gatilhos no banco e copia selada enviada ao Centro); por isso o descarte so vale:
//  - com confirmacao (numero da proposta digitado);
//  - se a obra no Centro nao tiver nenhum movimento (lancamento, nota, medicao...).
// Tudo e guardado em discarded_proposals e pode ser restaurado.

// Ordem de restauracao (pais primeiro); o descarte apaga na ordem inversa.
const TABLES = ['proposals', 'proposal_items', 'proposal_labor_items', 'proposal_approval_snapshots', 'integration_outbox', 'proposal_center_snapshots'] as const;
const GUARDS = [
  ['proposals', 'approved_proposal_guard'],
  ['proposal_items', 'approved_material_guard'],
  ['proposal_labor_items', 'approved_labor_guard'],
  ['proposal_approval_snapshots', 'snapshot_immutable_guard'],
] as const;

type Queries = Pick<LocalDatabase, 'query'>;
type Payload = Record<(typeof TABLES)[number], Record<string, unknown>[]>;
export type DiscardedProposal = {
  id: string; proposal_number: string; client_name: string | null; work_name: string | null; revision_count: number;
  had_approval: boolean; reason: string | null; discarded_by_name: string | null; discarded_at: string; restored_at: string | null; restored_by_name: string | null;
};

const setGuards = async (queries: Queries, enable: boolean) => {
  for (const [table, trigger] of GUARDS) {
    const exists = await queries.query('SELECT 1 FROM pg_trigger WHERE tgname = $1', [trigger]);
    if (exists.rows.length) await queries.query(`ALTER TABLE ${table} ${enable ? 'ENABLE' : 'DISABLE'} TRIGGER ${trigger}`);
  }
};

const selectors: Record<(typeof TABLES)[number], string> = {
  proposals: 'id = ANY($1::uuid[])',
  proposal_items: 'proposal_id = ANY($1::uuid[])',
  proposal_labor_items: 'proposal_id = ANY($1::uuid[])',
  proposal_approval_snapshots: 'proposal_id = ANY($1::uuid[])',
  integration_outbox: 'snapshot_id IN (SELECT id FROM proposal_approval_snapshots WHERE proposal_id = ANY($1::uuid[]))',
  proposal_center_snapshots: 'proposal_id = ANY($1::uuid[])',
};

// Antes de descartar uma proposta integrada, confere no Centro que a obra nao tem movimento.
const assertCenterWithoutMovement = async (database: Queries, proposalIds: string[]) => {
  const contracts = await database.query<{ contract_id: string }>(`
    SELECT DISTINCT io.contract_id FROM integration_outbox io
    JOIN proposal_approval_snapshots s ON s.id = io.snapshot_id
    WHERE s.proposal_id = ANY($1::uuid[]) AND io.status = 'delivered' AND io.contract_id IS NOT NULL`, [proposalIds]);
  for (const { contract_id: contractId } of contracts.rows) {
    const movement = await fetchContractMovement(contractId);
    if (movement === 'unavailable') throw new Error('DISCARD_CENTER_UNAVAILABLE');
    if (movement > 0) throw new Error('DISCARD_CENTER_HAS_MOVEMENT');
  }
};

export const discardProposal = async (
  database: LocalDatabase,
  proposalId: string,
  input: { confirmNumber: string; reason?: string; actor: { id: string; name: string } },
): Promise<{ discardId: string; proposalNumber: string }> => {
  const current = await database.query<{ proposal_number: string }>('SELECT proposal_number FROM proposals WHERE id = $1', [proposalId]);
  const number = current.rows[0]?.proposal_number;
  if (!number) throw new Error('PROPOSAL_NOT_FOUND');
  if (input.confirmNumber.trim().toUpperCase() !== number.toUpperCase()) throw new Error('DISCARD_CONFIRMATION');
  const ids = (await database.query<{ id: string }>('SELECT id FROM proposals WHERE proposal_number = $1', [number])).rows.map(row => row.id);
  await assertCenterWithoutMovement(database, ids);

  const discardId = randomUUID();
  await database.transaction(async (transaction) => {
    const payload = {} as Payload;
    for (const table of TABLES) {
      const dumped = await transaction.query<{ rows: Record<string, unknown>[] }>(
        `SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS rows FROM ${table} t WHERE ${selectors[table]}`, [ids]);
      payload[table] = dumped.rows[0].rows;
    }
    const head = payload.proposals[0] ?? {};
    await setGuards(transaction, false);
    for (const table of [...TABLES].reverse()) await transaction.query(`DELETE FROM ${table} WHERE ${selectors[table]}`, [ids]);
    await setGuards(transaction, true);
    await transaction.query(`
      INSERT INTO discarded_proposals (id, proposal_number, client_name, work_name, revision_count, had_approval, reason, payload, discarded_by, discarded_by_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)`, [
      discardId, number, (head.snapshot_client_name as string) ?? null, ((head.snapshot_work_name ?? head.work_name) as string) ?? null, ids.length,
      payload.proposals.some(row => row.status === 'approved'), input.reason?.trim().slice(0, 300) || null, JSON.stringify(payload),
      input.actor.id, input.actor.name]);
    await transaction.query(`INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data, user_id)
      VALUES ($1, 'proposal', $2, 'discarded', $3::jsonb, $4::jsonb, $5)`, [
      randomUUID(), proposalId, JSON.stringify({ number, revisions: ids.length }), JSON.stringify({ discardId, reason: input.reason ?? null }), input.actor.id]);
  });
  return { discardId, proposalNumber: number };
};

export const listDiscardedProposals = async (database: Queries): Promise<DiscardedProposal[]> => (await database.query<DiscardedProposal>(`
  SELECT id, proposal_number, client_name, work_name, revision_count, had_approval, reason, discarded_by_name,
    discarded_at::text AS discarded_at, restored_at::text AS restored_at, restored_by_name
  FROM discarded_proposals ORDER BY discarded_at DESC LIMIT 200`)).rows;

export const restoreProposal = async (
  database: LocalDatabase,
  discardId: string,
  actor: { id: string; name: string },
): Promise<{ proposalId: string | null; proposalNumber: string }> => {
  return database.transaction(async (transaction) => {
    const row = (await transaction.query<{ proposal_number: string; payload: Payload; restored_at: string | null }>(
      'SELECT proposal_number, payload, restored_at::text AS restored_at FROM discarded_proposals WHERE id = $1 FOR UPDATE', [discardId])).rows[0];
    if (!row) throw new Error('DISCARD_NOT_FOUND');
    if (row.restored_at) throw new Error('DISCARD_ALREADY_RESTORED');
    const clash = await transaction.query('SELECT 1 FROM proposals WHERE proposal_number = $1 LIMIT 1', [row.proposal_number]);
    if (clash.rows.length) throw new Error('DISCARD_NUMBER_IN_USE');
    await setGuards(transaction, false);
    for (const table of TABLES) {
      const rows = row.payload[table] ?? [];
      if (!rows.length) continue;
      await transaction.query(`INSERT INTO ${table} SELECT * FROM jsonb_populate_recordset(NULL::${table}, $1::jsonb)`, [JSON.stringify(rows)]);
    }
    await setGuards(transaction, true);
    await transaction.query('UPDATE discarded_proposals SET restored_at = now(), restored_by_name = $2 WHERE id = $1', [discardId, actor.name]);
    const latest = row.payload.proposals.find(item => item.is_latest === true) ?? row.payload.proposals[0];
    await transaction.query(`INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data, user_id)
      VALUES ($1, 'proposal', $2, 'restored', NULL, $3::jsonb, $4)`, [randomUUID(), (latest?.id as string) ?? discardId, JSON.stringify({ discardId, number: row.proposal_number }), actor.id]);
    return { proposalId: (latest?.id as string) ?? null, proposalNumber: row.proposal_number };
  });
};
