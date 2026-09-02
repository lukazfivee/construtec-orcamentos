import type { DashboardMetrics } from '../../shared/contracts';
import type { LocalDatabase } from './database';
import { listCurrentProposals } from './proposals';

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const getDashboardSummary = async (database: LocalDatabase): Promise<DashboardMetrics> => {
  const [recentProposals, countsResult] = await Promise.all([
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
          COALESCE((
            COALESCE(ROUND((SELECT SUM(pi.quantity * pi.snapshot_unit_cost) FROM proposal_items pi WHERE pi.proposal_id = p.id), 2), 0)
            + COALESCE(ROUND((SELECT SUM(
                pli.professional_count * (pli.monthly_salary + pli.monthly_food + pli.monthly_transport + pli.monthly_other_costs)
                / NULLIF(pli.standard_monthly_hours, 0) * pli.planned_hours
              ) FROM proposal_labor_items pli WHERE pli.proposal_id = p.id), 2), 0)
          ) * p.bdi_multiplier, 0) AS total_val
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
  ]);

  const row = countsResult.rows[0];

  return {
    activeProposalsCount: Number(row?.active_proposals_count ?? 0),
    approvedProposalsCount: Number(row?.approved_proposals_count ?? 0),
    totalInNegotiation: roundMoney(Number(row?.total_in_negotiation ?? 0)),
    totalApproved: roundMoney(Number(row?.total_approved ?? 0)),
    totalClientsCount: Number(row?.total_clients ?? 0),
    totalProductsCount: Number(row?.total_products ?? 0),
    totalKitsCount: Number(row?.total_kits ?? 0),
    recentProposals: recentProposals.slice(0, 10),
  };
};
