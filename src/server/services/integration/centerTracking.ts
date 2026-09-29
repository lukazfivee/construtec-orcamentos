import type { CenterSummary, CenterTracking } from '../../../shared/contracts';
import type { LocalDatabase } from '../database';
import { resolveIntegrationKey } from './proposalSync';

// Acompanhamento da obra no Centro de Custos para a proposta integrada
// (docs/superpowers/specs/2026-09-22-sincronizacao-orcamentos-design.md).
// Somente leitura: guarda a ultima copia do resumo para mostrar sem conexao.

const DEFAULT_CENTER_API = 'https://centro-custos-api.construtec-reports.workers.dev';
const TIMEOUT_MS = 6000;
const REFRESH_LIMIT = 20;

type Queryable = Pick<LocalDatabase, 'query'>;

const centerBase = () => {
  const configured = process.env.CENTRO_CUSTOS_API_URL;
  return configured ? new URL('/', configured).href.replace(/\/+$/, '') : DEFAULT_CENTER_API;
};

const integratedContract = async (database: Queryable, proposalId: string) => (await database.query<{ contract_id: string; center_url: string | null }>(`
  SELECT io.contract_id, io.center_url
  FROM integration_outbox io
  JOIN proposal_approval_snapshots s ON s.id = io.snapshot_id
  WHERE s.proposal_id = $1 AND io.status = 'delivered' AND io.contract_id IS NOT NULL
  ORDER BY io.delivered_at DESC NULLS LAST
  LIMIT 1
`, [proposalId])).rows[0] ?? null;

const fetchSummary = async (contractId: string): Promise<CenterSummary> => {
  const key = resolveIntegrationKey();
  if (!key) throw new Error('CENTER_TRACKING_NOT_CONFIGURED');
  const response = await fetch(`${centerBase()}/api/integracao/orcamentos/contratos/${encodeURIComponent(contractId)}/resumo`, {
    headers: { 'X-Construtec-Integration-Key': key },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`CENTER_TRACKING_HTTP_${response.status}`);
  return await response.json() as CenterSummary;
};

const saveSnapshot = async (database: Queryable, proposalId: string, contractId: string, summary: CenterSummary) => {
  await database.query(`
    INSERT INTO proposal_center_snapshots (proposal_id, contract_id, payload, fetched_at)
    VALUES ($1, $2, $3::jsonb, now())
    ON CONFLICT (proposal_id) DO UPDATE SET contract_id = EXCLUDED.contract_id, payload = EXCLUDED.payload, fetched_at = EXCLUDED.fetched_at
  `, [proposalId, contractId, JSON.stringify(summary)]);
};

const lastSnapshot = async (database: Queryable, proposalId: string) => (await database.query<{ payload: CenterSummary; fetched_at: string }>(
  'SELECT payload, fetched_at::text AS fetched_at FROM proposal_center_snapshots WHERE proposal_id = $1',
  [proposalId],
)).rows[0] ?? null;

// Consulta o Centro e atualiza a copia; sem conexao, devolve a ultima copia
// marcada como desatualizada.
export const getCenterTracking = async (database: Queryable, proposalId: string): Promise<CenterTracking> => {
  const contract = await integratedContract(database, proposalId);
  if (!contract) return { integrated: false, summary: null, fetchedAt: null, stale: false, centerUrl: null };
  const centerUrl = contract.center_url;
  try {
    const summary = await fetchSummary(contract.contract_id);
    await saveSnapshot(database, proposalId, contract.contract_id, summary);
    return { integrated: true, summary, fetchedAt: new Date().toISOString(), stale: false, centerUrl };
  } catch {
    const cached = await lastSnapshot(database, proposalId);
    return { integrated: true, summary: cached?.payload ?? null, fetchedAt: cached?.fetched_at ?? null, stale: true, centerUrl };
  }
};

// Passada do Cron: atualiza as copias das obras que ainda nao foram concluidas.
export const refreshCenterTracking = async (database: Queryable): Promise<number> => {
  const rows = (await database.query<{ proposal_id: string }>(`
    SELECT DISTINCT s.proposal_id
    FROM integration_outbox io
    JOIN proposal_approval_snapshots s ON s.id = io.snapshot_id
    LEFT JOIN proposal_center_snapshots pcs ON pcs.proposal_id = s.proposal_id
    WHERE io.status = 'delivered' AND io.contract_id IS NOT NULL
      AND COALESCE(pcs.payload->>'costCenterStatus', '') <> 'concluido'
    LIMIT ${REFRESH_LIMIT}
  `)).rows;
  let refreshed = 0;
  for (const row of rows) {
    const tracking = await getCenterTracking(database, row.proposal_id);
    if (!tracking.stale) refreshed += 1;
    else break;
  }
  return refreshed;
};
