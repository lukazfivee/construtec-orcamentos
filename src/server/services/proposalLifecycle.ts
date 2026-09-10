import { randomUUID } from 'node:crypto';
import { canChangeProposalStatus } from '../../shared/proposalStatus';
import type { ProposalDetail, ProposalRevisionSummary } from '../../shared/contracts';
import { copyProposalLabor } from './proposalLabor';
import { finalValueSql } from './proposalTotalsSql';
import type { LocalDatabase } from './database';
import { logEvent } from './logger';
import { getEditableProposal, getLatestProposal, roundMoney } from './proposalCommon';
import { sealProposalInTransaction } from './integration/proposalSealing';

type GetProposalByIdFn = (database: LocalDatabase, proposalId: string) => Promise<ProposalDetail | null>;

export const createProposalRevision = async (database: LocalDatabase, sourceProposalId: string, userId?: string) => {
  return database.transaction(async (transaction) => {
    const source = await getLatestProposal(transaction, sourceProposalId);
    const newProposalId = randomUUID();
    const created = await transaction.query<{ revision: number }>(`
      INSERT INTO proposals
        (id, series_id, proposal_number, revision, client_id, work_id, work_name, snapshot_client_name,
         snapshot_work_name, scope, status, bdi_multiplier, valid_until, created_by)
      SELECT $2, series_id, proposal_number, revision + 1, client_id, work_id, work_name, snapshot_client_name,
        snapshot_work_name, scope, 'draft', bdi_multiplier, valid_until, created_by
      FROM proposals
      WHERE id = $1
      RETURNING revision
    `, [sourceProposalId, newProposalId]);

    const items = await transaction.query<{
      catalog_product_id: string | null;
      position: number;
      snapshot_code: string;
      snapshot_manufacturer: string | null;
      snapshot_model: string | null;
      snapshot_description: string;
      snapshot_category: string;
      snapshot_unit: string;
      snapshot_unit_cost: string;
      quantity: string;
      sale_unit_price: string;
    }>(`
      SELECT catalog_product_id, position, snapshot_code, snapshot_manufacturer, snapshot_model,
        snapshot_description, snapshot_category, snapshot_unit, snapshot_unit_cost::text, quantity::text, sale_unit_price::text
      FROM proposal_items
      WHERE proposal_id = $1
      ORDER BY position
    `, [sourceProposalId]);

    for (const item of items.rows) {
      await transaction.query(`
        INSERT INTO proposal_items
          (id, proposal_id, catalog_product_id, position, snapshot_code, snapshot_manufacturer,
           snapshot_model, snapshot_description, snapshot_category, snapshot_unit, snapshot_unit_cost, quantity, sale_unit_price)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        randomUUID(),
        newProposalId,
        item.catalog_product_id,
        item.position,
        item.snapshot_code,
        item.snapshot_manufacturer,
        item.snapshot_model,
        item.snapshot_description,
        item.snapshot_category ?? 'Outros',
        item.snapshot_unit,
        Number(item.snapshot_unit_cost),
        Number(item.quantity),
        Number(item.sale_unit_price),
      ]);
    }

    await copyProposalLabor(transaction, sourceProposalId, newProposalId);
    if (userId) await transaction.query('UPDATE proposals SET created_by = $2 WHERE id = $1', [newProposalId, userId]);
    const revision = created.rows[0]?.revision ?? source.revision + 1;
    await transaction.query(
      'INSERT INTO audit_events (id, entity_type, entity_id, action, after_data, user_id) VALUES ($1, $2, $3, $4, $5::jsonb, $6)',
      [randomUUID(), 'proposal', newProposalId, 'revision_created', JSON.stringify({ sourceProposalId, proposalNumber: source.proposal_number, revision }), userId ?? null],
    );
    logEvent('info', 'proposal.revision_created', { sourceProposalId, newProposalId, revision });
    return newProposalId;
  });
};

export const updateProposalContext = async (
  database: LocalDatabase,
  proposalId: string,
  clientId: string,
  workId: string,
) => {
  await database.transaction(async (transaction) => {
    await getEditableProposal(transaction, proposalId);
    const current = await transaction.query<{
      client_id: string;
      work_id: string | null;
      snapshot_client_name: string | null;
      snapshot_work_name: string | null;
    }>('SELECT client_id, work_id, snapshot_client_name, snapshot_work_name FROM proposals WHERE id = $1', [proposalId]);
    const workResult = await transaction.query<{
      work_name: string;
      client_name: string;
    }>(`
      SELECT w.name AS work_name, COALESCE(c.trade_name, c.legal_name) AS client_name
      FROM works w
      JOIN clients c ON c.id = w.client_id
      WHERE w.id = $1 AND w.client_id = $2 AND w.active = true
    `, [workId, clientId]);
    const context = workResult.rows[0];
    if (!context) throw new Error('WORK_NOT_FOUND');

    await transaction.query(`
      UPDATE proposals
      SET client_id = $2, work_id = $3, work_name = $4,
          snapshot_client_name = $5, snapshot_work_name = $4, updated_at = now()
      WHERE id = $1
    `, [proposalId, clientId, workId, context.work_name, context.client_name]);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data)
      VALUES ($1, 'proposal', $2, 'context_updated', $3::jsonb, $4::jsonb)
    `, [randomUUID(), proposalId, JSON.stringify(current.rows[0] ?? null), JSON.stringify({ clientId, workId, clientName: context.client_name, workName: context.work_name })]);
    logEvent('info', 'proposal.context_updated', { proposalId });
  });
};

export const listProposalHistory = async (database: LocalDatabase, proposalId: string): Promise<ProposalRevisionSummary[]> => {
  const result = await database.query<{
    id: string;
    proposal_number: string;
    revision: number;
    status: ProposalDetail['status'];
    item_count: string;
    total_sale: string;
    responsible_name: string;
    updated_at: string;
    is_latest: boolean;
  }>(`
    SELECT p.id, p.proposal_number, p.revision, p.status,
      count(i.id)::text AS item_count,
      ${finalValueSql}::text AS total_sale,
      u.name AS responsible_name, p.updated_at::text,
      p.revision = max(p.revision) OVER (PARTITION BY p.proposal_number) AS is_latest
    FROM proposals p
    JOIN proposals selected ON selected.id = $1 AND selected.proposal_number = p.proposal_number
    JOIN users u ON u.id = p.created_by
    LEFT JOIN proposal_items i ON i.proposal_id = p.id
    GROUP BY p.id, u.name, p.bdi_multiplier
    ORDER BY p.revision DESC
  `, [proposalId]);
  return result.rows.map((revision) => ({
    id: revision.id,
    number: revision.proposal_number,
    revision: revision.revision,
    status: revision.status,
    itemCount: Number(revision.item_count),
    totalSale: roundMoney(Number(revision.total_sale)),
    responsibleName: revision.responsible_name,
    updatedAt: revision.updated_at,
    isLatest: revision.is_latest,
  }));
};

export const deleteProposal = async (
  database: LocalDatabase,
  proposalId: string,
  mode: 'all' | 'revision' = 'all',
): Promise<{ nextProposalId?: string }> => {
  let nextProposalId: string | undefined;

  await database.transaction(async (transaction) => {
    const current = await transaction.query<{ proposal_number: string; revision: number }>(
      'SELECT proposal_number, revision FROM proposals WHERE id = $1',
      [proposalId],
    );
    const row = current.rows[0];
    if (!row) throw new Error('PROPOSAL_NOT_FOUND');

    const candidates = await transaction.query<{ status: ProposalDetail['status'] }>(
      "SELECT status FROM proposals WHERE proposal_number = $1 AND ($2::text = 'all' OR id = $3) ORDER BY revision FOR UPDATE",
      [row.proposal_number, mode, proposalId],
    );
    if (candidates.rows.some(candidate => candidate.status === 'approved')) throw new Error('PROPOSAL_LOCKED');

    if (mode === 'all') {
      await transaction.query('DELETE FROM proposals WHERE proposal_number = $1', [row.proposal_number]);
      logEvent('info', 'proposal.deleted_all', { proposalNumber: row.proposal_number });
    } else {
      await transaction.query('DELETE FROM proposals WHERE id = $1', [proposalId]);
      logEvent('info', 'proposal.deleted_revision', { proposalId, proposalNumber: row.proposal_number, revision: row.revision });
    }

    const remaining = await transaction.query<{ id: string }>(`
      SELECT id FROM proposals
      ORDER BY updated_at DESC
      LIMIT 1
    `);
    nextProposalId = remaining.rows[0]?.id;
  });

  return { nextProposalId };
};

export const updateProposalStatusWithGetter = async (
  database: LocalDatabase,
  proposalId: string,
  status: ProposalDetail['status'],
  getById: GetProposalByIdFn,
  userId?: string,
): Promise<ProposalDetail> => {
  await database.transaction(async (transaction) => {
    const row = await getLatestProposal(transaction, proposalId);
    if (!canChangeProposalStatus(row.status, status)) throw new Error('PROPOSAL_LOCKED');
    if (row.status === status) return;

    await transaction.query('UPDATE proposals SET status = $2, updated_at = now() WHERE id = $1', [proposalId, status]);
    if (status === 'approved') {
      await sealProposalInTransaction(transaction, proposalId, userId);
    }
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data, user_id)
      VALUES ($1, 'proposal', $2, 'status_updated', $3::jsonb, $4::jsonb, $5)
    `, [randomUUID(), proposalId, JSON.stringify({ status: row.status }), JSON.stringify({ status }), userId ?? null]);
    logEvent('info', 'proposal.status_updated', { proposalId, status });
  });

  const updated = await getById(database, proposalId);
  if (!updated) throw new Error('PROPOSAL_NOT_FOUND');
  return updated;
};

export const cloneProposal = async (
  database: LocalDatabase,
  sourceProposalId: string,
  input?: { clientId?: string; workId?: string; scope?: string },
  actorId?: string,
): Promise<string> => {
  return database.transaction(async (transaction) => {
    const userResult = await transaction.query<{ id: string }>('SELECT id FROM users ORDER BY created_at ASC LIMIT 1');
    const userId = actorId ?? userResult.rows[0]?.id;
    if (!userId) throw new Error('NO_USER_FOUND');

    const sourceResult = await transaction.query<{
      client_id: string;
      work_id: string;
      work_name: string;
      snapshot_client_name: string;
      snapshot_work_name: string;
      scope: string;
      bdi_multiplier: string;
      proposal_number: string;
    }>(`
      SELECT p.client_id, p.work_id, p.work_name, p.snapshot_client_name,
        p.snapshot_work_name, p.scope, p.bdi_multiplier::text, p.proposal_number
      FROM proposals p
      WHERE p.id = $1 FOR UPDATE
    `, [sourceProposalId]);
    const source = sourceResult.rows[0];
    if (!source) throw new Error('PROPOSAL_NOT_FOUND');

    const targetClientId = input?.clientId || source.client_id;
    const targetWorkId = input?.workId || source.work_id;

    const workResult = await transaction.query<{ client_name: string; work_name: string }>(`
      SELECT c.trade_name AS client_name, w.name AS work_name
      FROM works w
      JOIN clients c ON c.id = w.client_id
      WHERE w.id = $1 AND w.client_id = $2 AND w.active = true
    `, [targetWorkId, targetClientId]);
    const targetContext = workResult.rows[0];
    if (!targetContext) throw new Error('WORK_NOT_FOUND');

    const numberResult = await transaction.query<{ proposal_number: string }>(`
      SELECT proposal_number
      FROM proposals
      WHERE proposal_number ~ '^PA-[0-9]+$'
      ORDER BY substring(proposal_number from 4)::integer DESC
      LIMIT 1
    `);
    const currentNumber = Number(numberResult.rows[0]?.proposal_number.slice(3) ?? 1000);
    const newProposalNumber = `PA-${String(currentNumber + 1).padStart(4, '0')}`;
    const newProposalId = randomUUID();

    await transaction.query(`
      INSERT INTO proposals
        (id, proposal_number, revision, client_id, work_id, work_name, snapshot_client_name,
         snapshot_work_name, scope, status, bdi_multiplier, created_by)
      VALUES ($1, $2, 0, $3, $4, $5, $6, $5, $7, 'draft', $8, $9)
    `, [
      newProposalId,
      newProposalNumber,
      targetClientId,
      targetWorkId,
      targetContext.work_name,
      targetContext.client_name,
      input?.scope?.trim() || source.scope,
      Number(source.bdi_multiplier),
      userId,
    ]);

    const items = await transaction.query<{
      catalog_product_id: string | null;
      position: number;
      snapshot_code: string;
      snapshot_manufacturer: string | null;
      snapshot_model: string | null;
      snapshot_description: string;
      snapshot_category: string;
      snapshot_unit: string;
      snapshot_unit_cost: string;
      quantity: string;
      sale_unit_price: string;
    }>(`
      SELECT catalog_product_id, position, snapshot_code, snapshot_manufacturer, snapshot_model,
        snapshot_description, snapshot_category, snapshot_unit, snapshot_unit_cost::text, quantity::text, sale_unit_price::text
      FROM proposal_items
      WHERE proposal_id = $1
      ORDER BY position
    `, [sourceProposalId]);

    for (const item of items.rows) {
      await transaction.query(`
        INSERT INTO proposal_items
          (id, proposal_id, catalog_product_id, position, snapshot_code, snapshot_manufacturer,
           snapshot_model, snapshot_description, snapshot_category, snapshot_unit, snapshot_unit_cost, quantity, sale_unit_price)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        randomUUID(),
        newProposalId,
        item.catalog_product_id,
        item.position,
        item.snapshot_code,
        item.snapshot_manufacturer,
        item.snapshot_model,
        item.snapshot_description,
        item.snapshot_category ?? 'Outros',
        item.snapshot_unit,
        Number(item.snapshot_unit_cost),
        Number(item.quantity),
        Number(item.sale_unit_price),
      ]);
    }

    await copyProposalLabor(transaction, sourceProposalId, newProposalId);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, after_data, user_id)
      VALUES ($1, 'proposal', $2, 'cloned', $3::jsonb, $4)
    `, [randomUUID(), newProposalId, JSON.stringify({ sourceProposalId, newProposalNumber }), userId]);
    logEvent('info', 'proposal.cloned', { sourceProposalId, newProposalId, newProposalNumber });
    return newProposalId;
  });
};
