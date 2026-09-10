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

const DEFAULT_CENTER_URL = 'http://localhost:3333/api/integracao/orcamentos/sync-direto';
const DEFAULT_INTEGRATION_KEY = 'construtec-internal-integration-secret-2026';

export const syncProposalDirectly = async (
  database: Pick<LocalDatabase, 'query' | 'exec'>,
  proposalId: string,
  userId?: string,
  customCenterUrl?: string,
): Promise<DirectSyncResult> => {
  const exportResult = await exportProposalIntegration(database, proposalId, userId, false);
  const { envelope, eventId } = exportResult;

  const centerUrl = customCenterUrl || process.env.CENTRO_CUSTOS_API_URL || DEFAULT_CENTER_URL;
  const integrationKey = process.env.CONSTRUTEC_INTEGRATION_KEY || DEFAULT_INTEGRATION_KEY;

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

    // Sucesso ou já importado (200/201)
    await database.query(
      `UPDATE integration_outbox
       SET attempts = attempts + 1, delivered_at = now(), status = 'delivered', last_error = NULL
       WHERE id = $1`,
      [eventId]
    );

    const isDuplicate = responseBody.status === 'already_imported' || Boolean(responseBody.isDuplicate);
    const p = envelope.payload?.proposal;

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
      centerUrl: new URL('/', centerUrl).href,
    };
  } catch (err: unknown) {
    const error = err as { code?: string; name?: string; message?: string };
    const isOffline =
      error?.code === 'ECONNREFUSED' ||
      error?.name === 'TimeoutError' ||
      error?.message?.includes('fetch failed') ||
      error?.message?.includes('network');

    const errorMsg = isOffline
      ? 'O Centro de Custos não está em execução na porta 3333. Inicie o sistema no Portal Hub e tente novamente.'
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
