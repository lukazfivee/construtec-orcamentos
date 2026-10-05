import type { LocalDatabase } from './database';
import { refreshCenterTracking } from './integration/centerTracking';
import { syncProposalDirectly } from './integration/proposalSync';

const MAX_ATTEMPTS = 5;
// O Cron de hora em hora continua tentando o que o laco de 30s esgotou
// (indisponibilidade longa do Centro): ate 3 dias de tentativas horarias.
export const CRON_MAX_ATTEMPTS = 72;
const RETRY_INTERVAL_MS = 30_000;

// Lease da reserva: se o processo cair no meio do envio, a linha volta a ser elegivel depois disso.
const CLAIM_LEASE_SECONDS = 120;
const BATCH_SIZE = 5;

// Reserva atomica: FOR UPDATE SKIP LOCKED + UPDATE ... RETURNING. Duas passadas simultaneas (laco de 30s
// e Cron, ou duas instancias) nunca recebem a mesma linha.
export const claimOutboxBatch = async (
  database: Pick<LocalDatabase, 'query'>,
  maxAttempts: number,
  limit = BATCH_SIZE,
) => (await database.query<{ outbox_id: string; proposal_id: string; attempts: number }>(`
  UPDATE integration_outbox io
  SET claimed_at = now()
  FROM proposal_approval_snapshots s
  WHERE s.id = io.snapshot_id AND io.id IN (
    SELECT id FROM integration_outbox
    WHERE status = 'pending' AND attempts < $1
      AND (claimed_at IS NULL OR claimed_at < now() - make_interval(secs => $3))
    ORDER BY created_at ASC
    LIMIT $2
    FOR UPDATE SKIP LOCKED
  )
  RETURNING io.id AS outbox_id, s.proposal_id, io.attempts
`, [maxAttempts, limit, CLAIM_LEASE_SECONDS])).rows;

// Linhas que esgotaram as tentativas do Cron (3 dias de falhas) viram 'failed': aparecem como Falha na lista
// em vez de ficarem "pendentes" para sempre. Um reenvio manual que der certo as leva a 'delivered'.
export const failExhaustedOutbox = async (database: Pick<LocalDatabase, 'query'>, maxAttempts = CRON_MAX_ATTEMPTS) =>
  (await database.query<{ id: string }>(
    "UPDATE integration_outbox SET status = 'failed', claimed_at = NULL WHERE status = 'pending' AND attempts >= $1 RETURNING id",
    [maxAttempts],
  )).rows.length;

// Uma passada de reenvio da outbox. Roda a cada 30s enquanto o processo esta
// vivo e, na nuvem, tambem pelo Cron do Worker (o Container dorme sem uso).
export const runOutboxRetryPass = async (
  database: Pick<LocalDatabase, 'query' | 'exec'>,
  maxAttempts = MAX_ATTEMPTS,
): Promise<number> => {
  const pending = await claimOutboxBatch(database, maxAttempts);

  let attempted = 0;
  try {
    for (const row of pending) {
      attempted += 1;
      try {
        const result = await syncProposalDirectly(database, row.proposal_id);
        if (result.status === 'offline') break;
      } catch {
        // A falha desta linha nao impede as demais; a reserva e solta abaixo.
      }
    }
  } finally {
    // Solta a reserva (inclusive das linhas nao tentadas apos um 'offline'); a tentativa ja foi contada.
    const toRelease = pending.map(row => row.outbox_id);
    if (toRelease.length) await database.query('UPDATE integration_outbox SET claimed_at = NULL WHERE id = ANY($1::uuid[])', [toRelease]);
  }
  return attempted;
};

// Passada completa do Cron: reenvio pendente e atualizacao do acompanhamento.
export const runScheduledIntegrationPass = async (database: Pick<LocalDatabase, 'query' | 'exec'>, maxAttempts = MAX_ATTEMPTS) => {
  const attempted = await runOutboxRetryPass(database, maxAttempts);
  // So o Cron (limite de 72) encerra linhas: o laco de 30s para em 5 e deixa o resto para o Cron.
  if (maxAttempts >= CRON_MAX_ATTEMPTS) await failExhaustedOutbox(database, CRON_MAX_ATTEMPTS);
  return { attempted, refreshed: await refreshCenterTracking(database) };
};

export const startOutboxRetryWorker = (database: LocalDatabase): ReturnType<typeof setInterval> => {
  return setInterval(async () => {
    try {
      await runOutboxRetryPass(database);
    } catch {
      // Worker silently swallows errors to avoid crashing the interval
    }
  }, RETRY_INTERVAL_MS);
};
