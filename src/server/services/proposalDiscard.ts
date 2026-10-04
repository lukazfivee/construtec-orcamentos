import { randomUUID } from 'node:crypto';
import type { LocalDatabase } from './database';
import { discardCenterContract, restoreCenterContract } from './integration/centerTracking';

// Descarte e recuperacao de proposta por um administrador, inclusive aprovada. A aprovacao e definitiva por
// regra de projeto (gatilhos no banco e copia selada enviada ao Centro); por isso o descarte so vale:
//  - com confirmacao (numero da proposta digitado);
//  - se a obra no Centro nao tiver nenhum movimento (lancamento, nota, medicao...).
// A obra sem movimento e descartada no Centro junto e volta quando a proposta e recuperada.
// Tudo e guardado em discarded_proposals e pode ser restaurado.

// Ordem de restauracao (pais primeiro); o descarte apaga na ordem inversa.
const TABLES = ['proposals', 'proposal_items', 'proposal_labor_items', 'proposal_approval_snapshots', 'integration_outbox', 'proposal_center_snapshots', 'proposal_client_links', 'proposal_client_link_events'] as const;
const GUARDS = [
  ['proposals', 'approved_proposal_guard'],
  ['proposal_items', 'approved_material_guard'],
  ['proposal_labor_items', 'approved_labor_guard'],
  ['proposal_approval_snapshots', 'snapshot_immutable_guard'],
] as const;

type Queries = Pick<LocalDatabase, 'query'>;
type CenterDiscard = { contractId: string; discarded: boolean; costCenterCode: string | null };
type Payload = Record<(typeof TABLES)[number], Record<string, unknown>[]> & { centerDiscards?: CenterDiscard[] };
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
  proposal_client_links: 'proposal_id = ANY($1::uuid[])',
  proposal_client_link_events: 'link_id IN (SELECT id FROM proposal_client_links WHERE proposal_id = ANY($1::uuid[]))',
};

// Desfaz no Centro os descartes ja feitos quando algo depois deles falha; falha aqui so e registrada.
const undoCenterDiscards = async (discards: CenterDiscard[], actorName: string) => {
  for (const item of discards.filter(entry => entry.discarded)) {
    const undone = await restoreCenterContract(item.contractId, { actorName });
    if (undone.outcome !== 'restored') console.error(`[descarte] obra ${item.contractId} descartada no Centro e nao recuperada: ${undone.outcome}`);
  }
};

// Descarta no Centro as obras entregues da proposta. O Centro so aceita obra sem movimento (409 caso contrario).
// Qualquer recusa ou falha desfaz os descartes ja feitos e nada local muda.
const discardCenterContracts = async (database: Queries, proposalIds: string[], input: { actorName: string; reason?: string; proposalNumber: string }) => {
  const contracts = await database.query<{ contract_id: string }>(`
    SELECT DISTINCT io.contract_id FROM integration_outbox io
    JOIN proposal_approval_snapshots s ON s.id = io.snapshot_id
    WHERE s.proposal_id = ANY($1::uuid[]) AND io.status = 'delivered' AND io.contract_id IS NOT NULL`, [proposalIds]);
  const done: CenterDiscard[] = [];
  for (const { contract_id: contractId } of contracts.rows) {
    const result = await discardCenterContract(contractId, input);
    if (result.outcome === 'discarded') { done.push({ contractId, discarded: true, costCenterCode: result.costCenterCode }); continue; }
    if (result.outcome === 'already_gone') { done.push({ contractId, discarded: false, costCenterCode: null }); continue; }
    await undoCenterDiscards(done, input.actorName);
    throw new Error(result.outcome === 'has_movement' ? 'DISCARD_CENTER_HAS_MOVEMENT' : 'DISCARD_CENTER_UNAVAILABLE');
  }
  return done;
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
  const reason = input.reason?.trim().slice(0, 300) || undefined;
  const discardId = randomUUID();
  const localDiscard = async (transaction: Queries, centerDiscards: CenterDiscard[]) => {
    const payload = { centerDiscards } as Payload;
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
  };

  // Ensaio local: roda o descarte inteiro e desfaz. Se ele nao passar aqui, o Centro nem e chamado.
  const rehearsal = new Error('DISCARD_REHEARSAL');
  try { await database.transaction(async (transaction) => { await localDiscard(transaction, []); throw rehearsal; }); } catch (error) {
    if (error !== rehearsal) { console.error('[descarte] o descarte local nao passaria; Centro nao foi chamado:', error instanceof Error ? error.message.slice(0, 200) : 'erro'); throw error; }
  }
  const centerDiscards = await discardCenterContracts(database, ids, { actorName: input.actor.name, reason, proposalNumber: number });
  try { await database.transaction(transaction => localDiscard(transaction, centerDiscards)); } catch (error) {
    console.error('[descarte] falha local apos descartar no Centro; recuperando a obra', error);
    await undoCenterDiscards(centerDiscards, input.actor.name);
    throw error;
  }
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
  // Antes de restaurar localmente, devolve a obra no Centro. Sem o Centro, nada e restaurado.
  const pending = (await database.query<{ payload: Payload; restored_at: string | null }>(
    'SELECT payload, restored_at::text AS restored_at FROM discarded_proposals WHERE id = $1', [discardId])).rows[0];
  if (pending && !pending.restored_at) {
    for (const item of (pending.payload.centerDiscards ?? []).filter(entry => entry.discarded)) {
      const result = await restoreCenterContract(item.contractId, { actorName: actor.name });
      if (result.outcome === 'unavailable') throw new Error('DISCARD_CENTER_UNAVAILABLE');
      if (result.outcome === 'conflict') throw new Error('RESTORE_CENTER_CONFLICT');
    }
  }
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
