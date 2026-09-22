import { multiplyDecimal, sumDecimal } from '../../shared/decimal';
import { calculateProposalTotals } from '../../shared/proposalFinancials';
import type { ProposalDetail, ProposalLine, ProposalSummary } from '../../shared/contracts';
import { baseCostSql, finalValueSql } from './proposalTotalsSql';
import type { LocalDatabase } from './database';
import { getProposalStandardMonthlyHours, listProposalLaborItems } from './proposalLabor';
import { roundMoney } from './proposalCommon';
import type { ItemRow } from './proposalItems';
import { updateProposalStatusWithGetter } from './proposalLifecycle';

export * from './proposalCommon';
export * from './proposalMutations';
export * from './proposalItems';
export * from './proposalLifecycle';

type ProposalRow = {
  id: string; series_id?: string; client_id: string; work_id: string | null; proposal_number: string;
  revision: number; client_name: string; work_name: string; scope: string; status: ProposalDetail['status'];
  bdi_multiplier: string; tax_percentage?: string | null; valid_until: string | null; responsible_name: string;
  updated_at: string; is_latest: boolean; has_approved_revision: boolean;
  cost_center_id: number | null; contract_id: string | null; center_url: string | null;
};

export const getProposalById = async (database: LocalDatabase, proposalId: string): Promise<ProposalDetail | null> => {
  const proposalResult = await database.query<ProposalRow>(`
    SELECT p.id, p.series_id::text AS series_id, p.client_id, p.work_id, p.proposal_number, p.revision,
      COALESCE(p.snapshot_client_name, c.trade_name, c.legal_name) AS client_name,
      COALESCE(p.snapshot_work_name, p.work_name) AS work_name, p.scope, p.status, p.bdi_multiplier::text,
      COALESCE(p.tax_percentage, 0)::text AS tax_percentage,
      p.valid_until::text, u.name AS responsible_name, p.updated_at::text,
      NOT EXISTS (
        SELECT 1 FROM proposals newer
        WHERE newer.proposal_number = p.proposal_number AND newer.revision > p.revision
      ) AS is_latest,
      EXISTS (SELECT 1 FROM proposals approved WHERE approved.proposal_number = p.proposal_number AND approved.status = 'approved') AS has_approved_revision,
      (SELECT io.cost_center_id FROM integration_outbox io
        JOIN proposal_approval_snapshots s ON s.id = io.snapshot_id
        WHERE s.proposal_id = p.id AND io.status = 'delivered'
        ORDER BY io.delivered_at DESC LIMIT 1) AS cost_center_id,
      (SELECT io.contract_id FROM integration_outbox io
        JOIN proposal_approval_snapshots s ON s.id = io.snapshot_id
        WHERE s.proposal_id = p.id AND io.status = 'delivered'
        ORDER BY io.delivered_at DESC LIMIT 1) AS contract_id,
      (SELECT io.center_url FROM integration_outbox io
        JOIN proposal_approval_snapshots s ON s.id = io.snapshot_id
        WHERE s.proposal_id = p.id AND io.status = 'delivered'
        ORDER BY io.delivered_at DESC LIMIT 1) AS center_url
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
  const taxPercentage = Number(proposal.tax_percentage ?? 0);
  const laborItems = await listProposalLaborItems(database, proposal.id);
  const standardMonthlyHours = await getProposalStandardMonthlyHours(database, proposal.id);
  const materials = sumDecimal(items.map(item => item.totalCost));
  const labor = sumDecimal(laborItems.map(item => item.totalCost));
  const totals = calculateProposalTotals(materials, labor, bdiMultiplier, taxPercentage);
  const { baseCost, finalValue, additions } = totals;
  const taxAmount = totals.taxAmount ?? 0;
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
    taxPercentage,
    validUntil: proposal.valid_until ? proposal.valid_until.slice(0, 10) : null,
    responsibleName: proposal.responsible_name,
    updatedAt: proposal.updated_at,
    isLatest: proposal.is_latest,
    hasApprovedRevision: proposal.has_approved_revision,
    costCenterId: proposal.cost_center_id ?? undefined,
    contractId: proposal.contract_id ?? undefined,
    centroCustosUrl: proposal.center_url ?? undefined,
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
      taxAmount,
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
    sync_status: 'pending' | 'delivered' | 'failed' | null;
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
      EXISTS (SELECT 1 FROM proposals approved WHERE approved.proposal_number = p.proposal_number AND approved.status = 'approved') AS has_approved_revision,
      (SELECT io.status FROM integration_outbox io
        JOIN proposal_approval_snapshots s ON s.id = io.snapshot_id
        WHERE s.proposal_id = p.id
        ORDER BY io.created_at DESC LIMIT 1) AS sync_status
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
    syncStatus: row.sync_status ?? null,
  }));
};

export const updateProposalStatus = async (
  database: LocalDatabase,
  proposalId: string,
  status: ProposalDetail['status'],
  userId?: string,
): Promise<ProposalDetail> => {
  return updateProposalStatusWithGetter(database, proposalId, status, getProposalById, userId);
};
