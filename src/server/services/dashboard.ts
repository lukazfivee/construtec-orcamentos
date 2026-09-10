import type {
  AbcItem,
  CommercialIntelligenceMetrics,
  CommercialPipelineStage,
  DashboardMetrics,
  ProposalDetail,
  TopClientMetric,
} from '../../shared/contracts';
import { finalValueSql } from './proposalTotalsSql';
import type { LocalDatabase } from './database';
import { listCurrentProposals } from './proposals';

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const STAGE_ORDER: ProposalDetail['status'][] = ['draft', 'review', 'sent', 'approved', 'rejected'];
const STAGE_LABELS: Record<ProposalDetail['status'], string> = {
  draft: 'Em edição',
  review: 'Em revisão',
  sent: 'Enviada / Negociação',
  approved: 'Aprovada',
  rejected: 'Recusada',
};

export const getDashboardSummary = async (database: LocalDatabase): Promise<DashboardMetrics> => {
  const [recentProposals, countsResult, pipelineResult, itemsResult, clientsResult] = await Promise.all([
    listCurrentProposals(database),
    database.query<{
      active_proposals_count: string;
      approved_proposals_count: string;
      total_in_negotiation: string;
      total_approved: string;
      total_clients: string;
      total_products: string;
      total_kits: string;
    }>(`
      WITH current_proposals AS (
        SELECT p.id, p.status, p.bdi_multiplier,
          ${finalValueSql} AS total_val
        FROM proposals p
        WHERE NOT EXISTS (
          SELECT 1 FROM proposals newer
          WHERE newer.proposal_number = p.proposal_number AND newer.revision > p.revision
        )
      )
      SELECT
        (SELECT count(*)::text FROM current_proposals WHERE status IN ('draft', 'review', 'sent')) AS active_proposals_count,
        (SELECT count(*)::text FROM current_proposals WHERE status = 'approved') AS approved_proposals_count,
        COALESCE((SELECT SUM(total_val)::text FROM current_proposals WHERE status IN ('draft', 'review', 'sent')), '0') AS total_in_negotiation,
        COALESCE((SELECT SUM(total_val)::text FROM current_proposals WHERE status = 'approved'), '0') AS total_approved,
        (SELECT count(*)::text FROM clients) AS total_clients,
        (SELECT count(*)::text FROM products WHERE active = true) AS total_products,
        (SELECT count(*)::text FROM kits WHERE active = true) AS total_kits
    `),
    database.query<{ status: ProposalDetail['status']; count: string; total_val: string }>(`
      WITH current_proposals AS (
        SELECT p.id, p.status, p.bdi_multiplier,
          ${finalValueSql} AS total_val
        FROM proposals p
        WHERE NOT EXISTS (
          SELECT 1 FROM proposals newer
          WHERE newer.proposal_number = p.proposal_number AND newer.revision > p.revision
        )
      )
      SELECT status, count(*)::text AS count, COALESCE(SUM(total_val)::text, '0') AS total_val
      FROM current_proposals
      GROUP BY status
    `),
    database.query<{
      product_code: string;
      description: string;
      unit: string;
      category: string;
      total_quantity: string;
      total_value: string;
      proposals_count: string;
    }>(`
      WITH current_proposals AS (
        SELECT p.id, p.bdi_multiplier
        FROM proposals p
        WHERE NOT EXISTS (
          SELECT 1 FROM proposals newer
          WHERE newer.proposal_number = p.proposal_number AND newer.revision > p.revision
        )
      )
      SELECT
        COALESCE(pi.snapshot_code, '') AS product_code,
        pi.snapshot_description AS description,
        pi.snapshot_unit AS unit,
        COALESCE(pi.snapshot_category, 'Outros') AS category,
        SUM(pi.quantity)::text AS total_quantity,
        ROUND(SUM(pi.quantity * pi.snapshot_unit_cost * cp.bdi_multiplier), 2)::text AS total_value,
        COUNT(DISTINCT pi.proposal_id)::text AS proposals_count
      FROM proposal_items pi
      JOIN current_proposals cp ON cp.id = pi.proposal_id
      GROUP BY pi.snapshot_code, pi.snapshot_description, pi.snapshot_unit, pi.snapshot_category
      ORDER BY ROUND(SUM(pi.quantity * pi.snapshot_unit_cost * cp.bdi_multiplier), 2) DESC
      LIMIT 12
    `),
    database.query<{
      client_name: string;
      proposals_count: string;
      approved_value: string;
      in_negotiation_value: string;
      total_value: string;
    }>(`
      WITH current_proposals AS (
        SELECT p.id, p.client_id, p.snapshot_client_name, p.status, p.bdi_multiplier,
          ${finalValueSql} AS total_val
        FROM proposals p
        WHERE NOT EXISTS (
          SELECT 1 FROM proposals newer
          WHERE newer.proposal_number = p.proposal_number AND newer.revision > p.revision
        )
      )
      SELECT
        COALESCE(NULLIF(trim(cp.snapshot_client_name), ''), c.trade_name, c.legal_name, 'Cliente não informado') AS client_name,
        COUNT(*)::text AS proposals_count,
        COALESCE(SUM(CASE WHEN cp.status = 'approved' THEN cp.total_val ELSE 0 END)::text, '0') AS approved_value,
        COALESCE(SUM(CASE WHEN cp.status IN ('draft', 'review', 'sent') THEN cp.total_val ELSE 0 END)::text, '0') AS in_negotiation_value,
        COALESCE(SUM(cp.total_val)::text, '0') AS total_value
      FROM current_proposals cp
      LEFT JOIN clients c ON c.id = cp.client_id
      GROUP BY COALESCE(NULLIF(trim(cp.snapshot_client_name), ''), c.trade_name, c.legal_name, 'Cliente não informado')
      ORDER BY SUM(cp.total_val) DESC
      LIMIT 8
    `),
  ]);

  const row = countsResult.rows[0];
  const activeCount = Number(row?.active_proposals_count ?? 0);
  const approvedCount = Number(row?.approved_proposals_count ?? 0);
  const totalInNegotiation = roundMoney(Number(row?.total_in_negotiation ?? 0));
  const totalApproved = roundMoney(Number(row?.total_approved ?? 0));

  // Pipeline computation
  const statusMap = new Map<ProposalDetail['status'], { count: number; totalVal: number }>();
  let grandPipelineValue = 0;
  for (const r of pipelineResult.rows) {
    const val = roundMoney(Number(r.total_val));
    statusMap.set(r.status, { count: Number(r.count), totalVal: val });
    grandPipelineValue += val;
  }

  const pipeline: CommercialPipelineStage[] = STAGE_ORDER.map((st) => {
    const data = statusMap.get(st) ?? { count: 0, totalVal: 0 };
    const pct = grandPipelineValue > 0 ? Math.round((data.totalVal / grandPipelineValue) * 1000) / 10 : 0;
    return {
      status: st,
      label: STAGE_LABELS[st],
      count: data.count,
      totalValue: data.totalVal,
      percentage: pct,
    };
  });

  // Conversion rate: approved / (approved + rejected)
  const rejectedCount = statusMap.get('rejected')?.count ?? 0;
  const decidedCount = approvedCount + rejectedCount;
  const conversionRate = decidedCount > 0 ? Math.round((approvedCount / decidedCount) * 1000) / 10 : 0;

  // Average tickets
  const averageTicketApproved = approvedCount > 0 ? roundMoney(totalApproved / approvedCount) : 0;
  const averageTicketNegotiation = activeCount > 0 ? roundMoney(totalInNegotiation / activeCount) : 0;

  // Curva ABC computation
  const rawItems = itemsResult.rows.map((r) => ({
    code: r.product_code,
    description: r.description,
    unit: r.unit,
    category: r.category,
    totalQuantity: Number(r.total_quantity),
    totalValue: roundMoney(Number(r.total_value)),
    proposalsCount: Number(r.proposals_count),
  }));

  const itemsTotalSum = rawItems.reduce((acc, it) => acc + it.totalValue, 0);
  let runningSum = 0;
  const topItems: AbcItem[] = rawItems.map((it) => {
    runningSum += it.totalValue;
    const cumPct = itemsTotalSum > 0 ? Math.round((runningSum / itemsTotalSum) * 1000) / 10 : 0;
    let abcClass: 'A' | 'B' | 'C' = 'A';
    if (cumPct > 95) abcClass = 'C';
    else if (cumPct > 80) abcClass = 'B';
    return {
      ...it,
      cumulativePercentage: cumPct,
      abcClass,
    };
  });

  // Top clients
  const topClients: TopClientMetric[] = clientsResult.rows.map((r) => ({
    clientName: r.client_name,
    proposalsCount: Number(r.proposals_count),
    approvedValue: roundMoney(Number(r.approved_value)),
    inNegotiationValue: roundMoney(Number(r.in_negotiation_value)),
    totalValue: roundMoney(Number(r.total_value)),
  }));

  const intelligence: CommercialIntelligenceMetrics = {
    conversionRate,
    averageTicketApproved,
    averageTicketNegotiation,
    pipeline,
    topItems,
    topClients,
  };

  return {
    activeProposalsCount: activeCount,
    approvedProposalsCount: approvedCount,
    totalInNegotiation,
    totalApproved,
    totalClientsCount: Number(row?.total_clients ?? 0),
    totalProductsCount: Number(row?.total_products ?? 0),
    totalKitsCount: Number(row?.total_kits ?? 0),
    recentProposals: recentProposals.slice(0, 10),
    intelligence,
  };
};
