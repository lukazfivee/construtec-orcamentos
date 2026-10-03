import type { CenterDiscardInfo, CenterSummary, CenterTracking } from '../../../shared/contracts';
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
  WHERE s.proposal_id = $1 AND io.status IN ('delivered', 'center_discarded') AND io.contract_id IS NOT NULL
  ORDER BY io.delivered_at DESC NULLS LAST
  LIMIT 1
`, [proposalId])).rows[0] ?? null;

// Obra descartada no Centro (410): a proposta volta a "Aprovada sem Centro de Custo" ate ser reenviada ou a obra recuperada.
class CenterDiscardedError extends Error {
  constructor(readonly info: CenterDiscardInfo) { super('CENTER_DISCARDED'); }
}

const setOutboxStatus = async (database: Queryable, contractId: string, from: string, to: string) => {
  await database.query('UPDATE integration_outbox SET status = $3 WHERE contract_id = $1 AND status = $2', [contractId, from, to]);
};

const contractUrl = (contractId: string, action: string) =>
  `${centerBase()}/api/integracao/orcamentos/contratos/${encodeURIComponent(contractId)}/${action}`;

const postCenter = async (contractId: string, action: string, body: unknown) => {
  const key = resolveIntegrationKey();
  if (!key) return null;
  try {
    const response = await fetch(contractUrl(contractId, action), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Construtec-Integration-Key': key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    return { status: response.status, data };
  } catch { return null; }
};

export type CenterDiscardResult =
  | { outcome: 'discarded'; costCenterCode: string | null }
  | { outcome: 'already_gone' }
  | { outcome: 'has_movement' }
  | { outcome: 'unavailable' };

// Descarta a obra (sem movimento) no Centro junto com a proposta.
export const discardCenterContract = async (
  contractId: string,
  input: { actorName: string; reason?: string; proposalNumber: string },
): Promise<CenterDiscardResult> => {
  const result = await postCenter(contractId, 'descartar', input);
  if (!result) return { outcome: 'unavailable' };
  if (result.status === 409) return { outcome: 'has_movement' };
  if (result.status !== 200) return { outcome: 'unavailable' };
  if (result.data.discarded === true) return { outcome: 'discarded', costCenterCode: (result.data.costCenterCode as string) ?? null };
  if (result.data.alreadyGone === true) return { outcome: 'already_gone' };
  return { outcome: 'unavailable' };
};

export type CenterRestoreResult = { outcome: 'restored' } | { outcome: 'conflict'; message: string | null } | { outcome: 'unavailable' };

// Recupera a obra no Centro. 404 (nao estava descartada) e alreadyActive contam como recuperada.
export const restoreCenterContract = async (contractId: string, input: { actorName: string }): Promise<CenterRestoreResult> => {
  const result = await postCenter(contractId, 'restaurar', input);
  if (!result) return { outcome: 'unavailable' };
  if (result.status === 404 && result.data.code === 'NOT_DISCARDED') return { outcome: 'restored' };
  if (result.status === 409) return { outcome: 'conflict', message: (result.data.erro as string) ?? null };
  if (result.status === 200 && (result.data.restored === true || result.data.alreadyActive === true)) return { outcome: 'restored' };
  return { outcome: 'unavailable' };
};

const fetchSummary = async (contractId: string): Promise<CenterSummary> => {
  const key = resolveIntegrationKey();
  if (!key) throw new Error('CENTER_TRACKING_NOT_CONFIGURED');
  const response = await fetch(contractUrl(contractId, 'resumo'), {
    headers: { 'X-Construtec-Integration-Key': key },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 410) {
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (body.code === 'CENTER_DISCARDED') {
      throw new CenterDiscardedError({
        discardedAt: (body.discardedAt as string) ?? null,
        discardedBy: (body.discardedBy as string) ?? null,
        costCenterCode: (body.costCenterCode as string) ?? null,
      });
    }
  }
  if (!response.ok) throw new Error(`CENTER_TRACKING_HTTP_${response.status}`);
  return await response.json() as CenterSummary;
};

// Movimento da obra no Centro (lancamentos, notas, medicoes...), para decidir se a proposta pode ser descartada.
// 404 (obra ja removida) e 410 (obra descartada no Centro) contam como sem movimento; qualquer falha de rede ou configuracao, como indisponivel.
export const fetchContractMovement = async (contractId: string): Promise<number | 'unavailable'> => {
  const key = resolveIntegrationKey();
  if (!key) return 'unavailable';
  try {
    const response = await fetch(`${centerBase()}/api/integracao/orcamentos/contratos/${encodeURIComponent(contractId)}/resumo`, {
      headers: { 'X-Construtec-Integration-Key': key },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 404 || response.status === 410) return 0;
    if (!response.ok) return 'unavailable';
    const summary = await response.json() as { movementCount?: unknown };
    // Centro antigo (sem o campo) nao permite garantir que a obra esta vazia.
    return typeof summary.movementCount === 'number' ? summary.movementCount : 'unavailable';
  } catch { return 'unavailable'; }
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
    // Obra recuperada no Centro: a proposta volta a constar como integrada.
    await setOutboxStatus(database, contract.contract_id, 'center_discarded', 'delivered');
    return { integrated: true, summary, fetchedAt: new Date().toISOString(), stale: false, centerUrl };
  } catch (error) {
    if (error instanceof CenterDiscardedError) {
      await setOutboxStatus(database, contract.contract_id, 'delivered', 'center_discarded');
      return { integrated: false, summary: null, fetchedAt: new Date().toISOString(), stale: false, centerUrl: null, centerDiscarded: error.info };
    }
    const cached = await lastSnapshot(database, proposalId);
    return { integrated: true, summary: cached?.payload ?? null, fetchedAt: cached?.fetched_at ?? null, stale: true, centerUrl };
  }
};

// Passada do Cron: atualiza as copias das obras que ainda nao foram concluidas e confere as descartadas no Centro.
export const refreshCenterTracking = async (database: Queryable): Promise<number> => {
  const rows = (await database.query<{ proposal_id: string }>(`
    SELECT DISTINCT s.proposal_id
    FROM integration_outbox io
    JOIN proposal_approval_snapshots s ON s.id = io.snapshot_id
    LEFT JOIN proposal_center_snapshots pcs ON pcs.proposal_id = s.proposal_id
    WHERE io.status IN ('delivered', 'center_discarded') AND io.contract_id IS NOT NULL
      AND (io.status = 'center_discarded' OR COALESCE(pcs.payload->>'costCenterStatus', '') <> 'concluido')
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
