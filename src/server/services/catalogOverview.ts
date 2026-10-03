// Visao do catalogo no computador (Rodada 24): onde cada item e usado, qual preco mudou em relacao as propostas
// e quais itens entraram ha pouco. So olha a ultima revisao de cada proposta. Preco novo so conta em proposta em
// edicao (as demais mantem o preco de quando foram montadas). O custo (de e para) so sai com p10.
import type { CatalogOverview, CatalogOverviewFrozen, CatalogOverviewItem, CatalogOverviewNewItem } from '../../shared/contracts';
import type { LocalDatabase } from './database';

export type { CatalogOverview, CatalogOverviewFrozen, CatalogOverviewItem, CatalogOverviewNewItem };

export const NEW_DAYS = 7;
const MIN_DIFF = 0.01;
const NEW_LIST_LIMIT = 50;
const CHANGED_LIST_LIMIT = 200;

type UsageRow = {
  code: string; proposal_id: string; proposal_number: string; revision: number; status: string;
  client_name: string; work_name: string; snap: string; cur: string | null; active: boolean | null;
};

const round1 = (value: number) => Math.round(value * 10) / 10;

export const getCatalogOverview = async (database: LocalDatabase, withCost: boolean): Promise<CatalogOverview> => {
  const usage = await database.query<UsageRow>(`
    SELECT pi.snapshot_code AS code, p.id AS proposal_id, p.proposal_number, p.revision, p.status,
      COALESCE(p.snapshot_client_name, c.trade_name, c.legal_name) AS client_name,
      COALESCE(p.snapshot_work_name, p.work_name) AS work_name,
      pi.snapshot_unit_cost::text AS snap, pr.current_cost::text AS cur, pr.active
    FROM proposal_items pi
    JOIN proposals p ON p.id = pi.proposal_id
    JOIN clients c ON c.id = p.client_id
    LEFT JOIN products pr ON pr.code = pi.snapshot_code
    WHERE NOT EXISTS (SELECT 1 FROM proposals newer WHERE newer.proposal_number = p.proposal_number AND newer.revision > p.revision)
    ORDER BY p.proposal_number, pi.snapshot_code
  `);

  const byCode = new Map<string, CatalogOverviewItem & { biggest: number }>();
  const frozen = new Map<string, CatalogOverviewFrozen>();
  for (const row of usage.rows) {
    const entry = byCode.get(row.code) ?? { code: row.code, usedIn: [], isNew: false, biggest: 0 };
    if (!entry.usedIn.includes(row.proposal_number)) entry.usedIn.push(row.proposal_number);
    const snap = Number(row.snap), cur = row.cur === null ? null : Number(row.cur);
    const differs = cur !== null && row.active === true && Math.abs(cur - snap) >= MIN_DIFF;
    if (differs && row.status === 'draft' && cur !== null) {
      const pct = snap > 0 ? round1((cur / snap - 1) * 100) : 0;
      if (entry.changePercent === undefined || Math.abs(pct) > entry.biggest) {
        entry.biggest = Math.abs(pct);
        entry.changePercent = pct;
        if (withCost) { entry.fromUnit = snap; entry.toUnit = cur; }
      }
    }
    if (differs && row.status !== 'draft') {
      const current = frozen.get(row.proposal_id) ?? {
        id: row.proposal_id, number: row.proposal_number, revision: row.revision, status: row.status,
        clientName: row.client_name, workName: row.work_name, itemCount: 0,
      };
      current.itemCount += 1;
      frozen.set(row.proposal_id, current);
    }
    byCode.set(row.code, entry);
  }

  const counts = await database.query<{ total: string; fresh: string }>(`
    SELECT count(*)::text AS total, count(*) FILTER (WHERE created_at >= now() - ($1 || ' days')::interval)::text AS fresh FROM products
  `, [String(NEW_DAYS)]);
  const fresh = await database.query<{ code: string; description: string; category: string; unit: string; current_cost: string }>(`
    SELECT code, description, category, unit, current_cost::text FROM products
    WHERE created_at >= now() - ($1 || ' days')::interval
    ORDER BY created_at DESC, code LIMIT ${NEW_LIST_LIMIT}
  `, [String(NEW_DAYS)]);
  const freshCodes = new Set(fresh.rows.map((row) => row.code));
  for (const code of freshCodes) {
    const entry = byCode.get(code) ?? { code, usedIn: [], isNew: true, biggest: 0 };
    entry.isNew = true;
    byCode.set(code, entry);
  }

  const changedCodes = [...byCode.values()].filter((entry) => entry.changePercent !== undefined).map((entry) => entry.code).slice(0, CHANGED_LIST_LIMIT);
  const changed = changedCodes.length === 0 ? [] : (await database.query<{ code: string; description: string; category: string; unit: string; current_cost: string }>(`
    SELECT code, description, category, unit, current_cost::text FROM products WHERE code = ANY($1::text[]) ORDER BY code
  `, [changedCodes])).rows;
  const toListItem = (row: { code: string; description: string; category: string; unit: string; current_cost: string }): CatalogOverviewNewItem => ({
    code: row.code, description: row.description, category: row.category, unit: row.unit,
    ...(withCost ? { currentCost: Number(row.current_cost) } : {}),
  });

  const items: CatalogOverviewItem[] = [...byCode.values()].map(({ biggest, ...rest }) => { void biggest; return rest; });
  return {
    productCount: Number(counts.rows[0]?.total ?? 0),
    newCount: Number(counts.rows[0]?.fresh ?? 0),
    items,
    newItems: fresh.rows.map(toListItem),
    changedItems: changed.map(toListItem),
    frozenProposals: [...frozen.values()],
  };
};
