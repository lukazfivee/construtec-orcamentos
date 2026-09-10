import { randomUUID } from 'node:crypto';
import { multiplyDecimal, sumDecimal } from '../../shared/decimal';
import { calculateProposalTotals } from '../../shared/proposalFinancials';
import type { ProposalDetail, ProposalLine, ProposalSummary } from '../../shared/contracts';
import { baseCostSql, finalValueSql } from './proposalTotalsSql';
import type { LocalDatabase } from './database';
import { logEvent } from './logger';
import { getProposalStandardMonthlyHours, listProposalLaborItems } from './proposalLabor';
import { getEditableProposal, roundMoney } from './proposalCommon';
import type { ItemRow } from './proposalItems';
import { updateProposalStatusWithGetter } from './proposalLifecycle';

export * from './proposalCommon';
export * from './proposalItems';
export * from './proposalLifecycle';

type ProposalRow = {
  id: string;
  series_id?: string;
  client_id: string;
  work_id: string | null;
  proposal_number: string;
  revision: number;
  client_name: string;
  work_name: string;
  scope: string;
  status: ProposalDetail['status'];
  bdi_multiplier: string;
  valid_until: string | null;
  responsible_name: string;
  updated_at: string;
  is_latest: boolean;
  has_approved_revision: boolean;
};

export const getProposalById = async (database: LocalDatabase, proposalId: string): Promise<ProposalDetail | null> => {
  const proposalResult = await database.query<ProposalRow>(`
    SELECT p.id, p.series_id::text AS series_id, p.client_id, p.work_id, p.proposal_number, p.revision,
      COALESCE(p.snapshot_client_name, c.trade_name, c.legal_name) AS client_name,
      COALESCE(p.snapshot_work_name, p.work_name) AS work_name, p.scope, p.status, p.bdi_multiplier::text,
      p.valid_until::text, u.name AS responsible_name, p.updated_at::text,
      NOT EXISTS (
        SELECT 1 FROM proposals newer
        WHERE newer.proposal_number = p.proposal_number AND newer.revision > p.revision
      ) AS is_latest,
      EXISTS (SELECT 1 FROM proposals approved WHERE approved.proposal_number = p.proposal_number AND approved.status = 'approved') AS has_approved_revision
    FROM proposals p
    JOIN clients c ON c.id = p.client_id
    JOIN users u ON u.id = p.created_by
    WHERE p.id = $1
  `, [proposalId]);
  const proposal = proposalResult.rows[0];
  if (!proposal) return null;

  const isDraftOrReview = proposal.status === 'draft' || proposal.status === 'review';
  const itemResult = await database.query<ItemRow & { catalog_cost?: string | null }>(`
    SELECT pi.id, pi.snapshot_code, pi.snapshot_description, pi.snapshot_category, pi.quantity::text,
      pi.snapshot_unit, pi.snapshot_unit_cost::text, pi.sale_unit_price::text, pr.current_cost::text AS catalog_cost
    FROM proposal_items pi
    LEFT JOIN products pr ON pr.code = pi.snapshot_code AND pr.active = true
    WHERE pi.proposal_id = $1
    ORDER BY pi.position
  `, [proposal.id]);

  const items: ProposalLine[] = itemResult.rows.map((item) => {
    const quantity = Number(item.quantity);
    const unitCost = Number(item.snapshot_unit_cost);
    const unitSale = Number(item.sale_unit_price);
    const catalogCurrentCost = isDraftOrReview && item.catalog_cost ? Number(item.catalog_cost) : null;
    return {
      id: item.id,
      code: item.snapshot_code,
      description: item.snapshot_description,
      category: item.snapshot_category ?? 'Outros',
      quantity,
      unit: item.snapshot_unit,
      unitCost,
      totalCost: multiplyDecimal([item.quantity, item.snapshot_unit_cost]),
      unitSale,
      totalSale: multiplyDecimal([item.quantity, item.sale_unit_price]),
      catalogCurrentCost,
    };
  });

  const bdiMultiplier = Number(proposal.bdi_multiplier);
  const laborItems = await listProposalLaborItems(database, proposal.id);
  const standardMonthlyHours = await getProposalStandardMonthlyHours(database, proposal.id);
  const materials = sumDecimal(items.map(item => item.totalCost));
  const labor = sumDecimal(laborItems.map(item => item.totalCost));
  const { baseCost, finalValue, additions } = calculateProposalTotals(materials, labor, bdiMultiplier);
  const sale = sumDecimal(items.map(item => item.totalSale));
  const grossResult = additions;

  return {
    id: proposal.id,
    seriesId: proposal.series_id,
    clientId: proposal.client_id,
    workId: proposal.work_id,
    number: proposal.proposal_number,
    revision: proposal.revision,
    clientName: proposal.client_name,
    workName: proposal.work_name,
    scope: proposal.scope,
    status: proposal.status,
    bdiMultiplier,
    validUntil: proposal.valid_until ? proposal.valid_until.slice(0, 10) : null,
    responsibleName: proposal.responsible_name,
    updatedAt: proposal.updated_at,
    isLatest: proposal.is_latest,
    hasApprovedRevision: proposal.has_approved_revision,
    items,
    laborItems,
    standardMonthlyHours,
    totals: {
      cost: materials,
      sale,
      grossResult,
      marginPercent: finalValue > 0 ? roundMoney((grossResult / finalValue) * 100) : 0,
      materials,
      labor,
      baseCost,
      additions,
      finalValue,
    },
  };
};

export const getCurrentProposal = async (database: LocalDatabase): Promise<ProposalDetail | null> => {
  const latestIdResult = await database.query<{ id: string }>(`
    SELECT id
    FROM proposals
    ORDER BY updated_at DESC
    LIMIT 1
  `);
  const latestId = latestIdResult.rows[0]?.id;
  if (!latestId) return null;
  return getProposalById(database, latestId);
};

export const listCurrentProposals = async (database: LocalDatabase): Promise<ProposalSummary[]> => {
  const result = await database.query<{
    id: string;
    proposal_number: string;
    revision: number;
    client_name: string;
    work_name: string;
    status: ProposalDetail['status'];
    valid_until: string | null;
    item_count: string;
    total_cost: string;
    total_sale: string;
    responsible_name: string;
    updated_at: string;
    is_latest: boolean;
    has_approved_revision: boolean;
  }>(`
    SELECT p.id, p.proposal_number, p.revision,
      COALESCE(p.snapshot_client_name, c.trade_name, c.legal_name) AS client_name,
      COALESCE(p.snapshot_work_name, p.work_name) AS work_name,
      p.status,
      p.valid_until::text AS valid_until,
      count(i.id)::text AS item_count,
      ${baseCostSql}::text AS total_cost,
      ${finalValueSql}::text AS total_sale,
      u.name AS responsible_name, p.updated_at::text,
      NOT EXISTS (
        SELECT 1 FROM proposals newer
        WHERE newer.proposal_number = p.proposal_number AND newer.revision > p.revision
      ) AS is_latest,
      EXISTS (SELECT 1 FROM proposals approved WHERE approved.proposal_number = p.proposal_number AND approved.status = 'approved') AS has_approved_revision
    FROM proposals p
    JOIN clients c ON c.id = p.client_id
    JOIN users u ON u.id = p.created_by
    LEFT JOIN proposal_items i ON i.proposal_id = p.id
    GROUP BY p.id, c.trade_name, c.legal_name, u.name, p.bdi_multiplier, p.valid_until
    ORDER BY p.updated_at DESC
  `);

  return result.rows.map((row) => ({
    id: row.id,
    number: row.proposal_number,
    revision: row.revision,
    clientName: row.client_name,
    workName: row.work_name,
    status: row.status,
    validUntil: row.valid_until ? row.valid_until.slice(0, 10) : null,
    itemCount: Number(row.item_count),
    totalCost: roundMoney(Number(row.total_cost)),
    totalSale: roundMoney(Number(row.total_sale)),
    responsibleName: row.responsible_name,
    updatedAt: row.updated_at,
    isLatest: row.is_latest,
    hasApprovedRevision: row.has_approved_revision,
  }));
};

export const createProposal = async (
  database: LocalDatabase,
  input: {
    clientId: string;
    workId: string;
    scope: string;
    bdiMultiplier?: number;
    validUntil?: string | null;
  },
): Promise<string> => {
  return database.transaction(async (transaction) => {
    const userResult = await transaction.query<{ id: string }>('SELECT id FROM users ORDER BY created_at ASC LIMIT 1');
    const userId = userResult.rows[0]?.id;
    if (!userId) throw new Error('NO_USER_FOUND');

    const workResult = await transaction.query<{
      work_name: string;
      client_name: string;
    }>(`
      SELECT w.name AS work_name, COALESCE(c.trade_name, c.legal_name) AS client_name
      FROM works w
      JOIN clients c ON c.id = w.client_id
      WHERE w.id = $1 AND w.client_id = $2 AND w.active = true
    `, [input.workId, input.clientId]);
    const context = workResult.rows[0];
    if (!context) throw new Error('WORK_NOT_FOUND');

    const numberResult = await transaction.query<{ proposal_number: string }>(`
      SELECT proposal_number
      FROM proposals
      WHERE proposal_number ~ '^PA-[0-9]+$'
      ORDER BY substring(proposal_number from 4)::integer DESC
      LIMIT 1
    `);
    const currentNumber = Number(numberResult.rows[0]?.proposal_number.slice(3) ?? 1000);
    const proposalNumber = `PA-${String(currentNumber + 1).padStart(4, '0')}`;
    const proposalId = randomUUID();

    await transaction.query(`
      INSERT INTO proposals
        (id, proposal_number, revision, client_id, work_id, work_name, snapshot_client_name,
         snapshot_work_name, scope, status, bdi_multiplier, valid_until, created_by)
      VALUES ($1, $2, 0, $3, $4, $5, $6, $5, $7, 'draft', $8, $9, $10)
    `, [
      proposalId,
      proposalNumber,
      input.clientId,
      input.workId,
      context.work_name,
      context.client_name,
      input.scope.trim(),
      input.bdiMultiplier ?? 1.25,
      input.validUntil ?? null,
      userId,
    ]);

    await transaction.query(`
      INSERT INTO audit_events (id, user_id, entity_type, entity_id, action, after_data)
      VALUES ($1, $2, 'proposal', $3, 'created', $4::jsonb)
    `, [randomUUID(), userId, proposalId, JSON.stringify({ proposalNumber, revision: 0, ...input })]);
    logEvent('info', 'proposal.created', { proposalId, proposalNumber });
    return proposalId;
  });
};

export const updateProposalBdi = async (
  database: LocalDatabase,
  proposalId: string,
  bdiMultiplier: number,
) => {
  await database.transaction(async (transaction) => {
    const proposal = await getEditableProposal(transaction, proposalId);

    await transaction.query(
      'UPDATE proposals SET bdi_multiplier = $2, updated_at = now() WHERE id = $1',
      [proposalId, bdiMultiplier],
    );
    await transaction.query(
      `UPDATE proposal_items
       SET sale_unit_price = round(snapshot_unit_cost * $2, 2)
       WHERE proposal_id = $1`,
      [proposalId, bdiMultiplier],
    );
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data)
      VALUES ($1, 'proposal', $2, 'bdi_updated', $3::jsonb, $4::jsonb)
    `, [randomUUID(), proposalId, JSON.stringify({ bdiMultiplier: Number(proposal.bdi_multiplier) }), JSON.stringify({ bdiMultiplier })]);
    logEvent('info', 'proposal.bdi_updated', { proposalId });
  });
};

export const updateProposalDetails = async (
  database: LocalDatabase,
  proposalId: string,
  input: { scope?: string; validUntil?: string | null },
) => {
  await database.transaction(async (transaction) => {
    await getEditableProposal(transaction, proposalId);
    const current = await transaction.query<{ scope: string; valid_until: string | null }>(
      'SELECT scope, valid_until::text FROM proposals WHERE id = $1 FOR UPDATE',
      [proposalId],
    );
    const before = current.rows[0];
    if (!before) throw new Error('PROPOSAL_NOT_FOUND');

    const hasValidUntil = Object.prototype.hasOwnProperty.call(input, 'validUntil');
    const next = {
      scope: input.scope?.trim() ?? before.scope,
      validUntil: hasValidUntil ? input.validUntil ?? null : before.valid_until,
    };

    await transaction.query(
      'UPDATE proposals SET scope = $2, valid_until = $3, updated_at = now() WHERE id = $1',
      [proposalId, next.scope, next.validUntil],
    );
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data)
      VALUES ($1, 'proposal', $2, 'details_updated', $3::jsonb, $4::jsonb)
    `, [randomUUID(), proposalId, JSON.stringify(before), JSON.stringify(next)]);
    logEvent('info', 'proposal.details_updated', { proposalId });
  });
};

export const updateProposalStatus = async (
  database: LocalDatabase,
  proposalId: string,
  status: ProposalDetail['status'],
  userId?: string,
): Promise<ProposalDetail> => {
  return updateProposalStatusWithGetter(database, proposalId, status, getProposalById, userId);
};
