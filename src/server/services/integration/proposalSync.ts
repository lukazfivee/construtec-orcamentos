import type { LocalDatabase } from '../database';
import { exportProposalIntegration } from './proposalExport';

export interface DirectSyncResult {
  ok: boolean;
  status: 'imported' | 'already_imported' | 'failed' | 'offline';
  isDuplicate?: boolean;
  contractId?: string;
  costCenterId?: number;
  baselineId?: string;
  proposalNumber?: string;
  revision?: number;
  message?: string;
  error?: string;
  offline?: boolean;
  centerUrl?: string;
}

const DEFAULT_CENTER_URL = 'https://centro-custos-api.construtec-reports.workers.dev/api/integracao/orcamentos/sync-direto';
// Chave padrao so vale no desktop (PGlite local). Na nuvem (DATABASE_URL
// definido) o valor e publico no repositorio; a chave precisa vir do segredo
// CONSTRUTEC_INTEGRATION_KEY, senao a integracao fica desligada.
const DEFAULT_INTEGRATION_KEY = 'construtec-internal-integration-secret-2026';
const MIN_CLOUD_KEY_LENGTH = 32;

export const resolveIntegrationKey = (): string | null => {
  const configured = process.env.CONSTRUTEC_INTEGRATION_KEY || '';
  if (!process.env.DATABASE_URL) return configured || DEFAULT_INTEGRATION_KEY;
  if (configured.length < MIN_CLOUD_KEY_LENGTH || configured === DEFAULT_INTEGRATION_KEY) return null;
  return configured;
};

export const syncProposalDirectly = async (
  database: Pick<LocalDatabase, 'query' | 'exec'>,
  proposalId: string,
  userId?: string,
  customCenterUrl?: string,
): Promise<DirectSyncResult> => {
  const exportResult = await exportProposalIntegration(database, proposalId, userId, false);
  const { envelope, eventId } = exportResult;

  const centerUrl = customCenterUrl || process.env.CENTRO_CUSTOS_API_URL || DEFAULT_CENTER_URL;
  const integrationKey = resolveIntegrationKey();

  if (!integrationKey) {
    // Configuracao ausente nao conta como tentativa: senao o reenvio desiste
    // do registro antes de o segredo ser configurado.
    const errorMsg = 'Integração com o Centro de Custos não configurada neste servidor.';
    await database.query(
      `UPDATE integration_outbox
       SET last_error = $2
       WHERE id = $1`,
      [eventId, errorMsg]
    );
    return { ok: false, status: 'failed', error: errorMsg, centerUrl };
  }

  try {
    const response = await fetch(centerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Construtec-Integration-Key': integrationKey,
      },
      body: JSON.stringify(envelope),
      signal: AbortSignal.timeout(6000),
    });

    const responseBody = await response.json().catch(() => ({}));

    const validReceipt = responseBody.ok === true
      && ['imported', 'already_imported'].includes(responseBody.status)
      && responseBody.contractId && responseBody.costCenterId && responseBody.baselineId;
    if (!response.ok || !validReceipt) {
      const errorMsg = responseBody.erro || responseBody.message || `Erro HTTP ${response.status} ao sincronizar com Centro de Custos`;
      await database.query(
        `UPDATE integration_outbox
         SET attempts = attempts + 1, last_error = $2
         WHERE id = $1`,
        [eventId, errorMsg]
      );
      return {
        ok: false,
        status: 'failed',
        error: errorMsg,
        centerUrl,
      };
    }

    const isDuplicate = responseBody.status === 'already_imported' || Boolean(responseBody.isDuplicate);
    const p = envelope.payload?.proposal;
    const resolvedCenterUrl = new URL('/', centerUrl).href;

    // Sucesso ou já importado (200/201)
    await database.query(
      `UPDATE integration_outbox
       SET attempts = attempts + 1, delivered_at = now(), status = 'delivered', last_error = NULL,
         cost_center_id = $2, contract_id = $3, center_url = $4
       WHERE id = $1`,
      [eventId, responseBody.costCenterId ?? null, responseBody.contractId ?? null, resolvedCenterUrl]
    );

    return {
      ok: true,
      status: isDuplicate ? 'already_imported' : 'imported',
      isDuplicate,
      contractId: responseBody.contractId,
      costCenterId: responseBody.costCenterId,
      baselineId: responseBody.baselineId,
      proposalNumber: p?.number,
      revision: p?.revision,
      message: isDuplicate
        ? 'Esta revisão já estava integrada e vigente no Centro de Custos.'
        : 'Proposta sincronizada com sucesso no Centro de Custos.',
      centerUrl: resolvedCenterUrl,
    };
  } catch (err: unknown) {
    const error = err as { code?: string; name?: string; message?: string };
    const isOffline =
      error?.code === 'ECONNREFUSED' ||
      error?.name === 'TimeoutError' ||
      error?.message?.includes('fetch failed') ||
      error?.message?.includes('network');

    const errorMsg = isOffline
      ? 'Não foi possível conectar ao Centro de Custos. Verifique a conexão e tente novamente.'
      : (error?.message || 'Falha na comunicação direta');

    await database.query(
      `UPDATE integration_outbox
       SET attempts = attempts + 1, last_error = $2
       WHERE id = $1`,
      [eventId, errorMsg]
    );

    return {
      ok: false,
      status: isOffline ? 'offline' : 'failed',
      offline: isOffline,
      error: errorMsg,
      centerUrl,
    };
  }
};
