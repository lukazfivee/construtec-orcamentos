import type { LocalDatabase } from './database';
import { syncProposalDirectly } from './integration/proposalSync';

const MAX_ATTEMPTS = 5;
// O Cron de hora em hora continua tentando o que o laco de 30s esgotou
// (indisponibilidade longa do Centro): ate 3 dias de tentativas horarias.
export const CRON_MAX_ATTEMPTS = 72;
const RETRY_INTERVAL_MS = 30_000;

// Uma passada de reenvio da outbox. Roda a cada 30s enquanto o processo esta
// vivo e, na nuvem, tambem pelo Cron do Worker (o Container dorme sem uso).
export const runOutboxRetryPass = async (
  database: Pick<LocalDatabase, 'query' | 'exec'>,
  maxAttempts = MAX_ATTEMPTS,
): Promise<number> => {
  const pending = await database.query<{
    outbox_id: string;
    proposal_id: string;
    attempts: number;
  }>(`
    SELECT io.id AS outbox_id, s.proposal_id, io.attempts
    FROM integration_outbox io
    JOIN proposal_approval_snapshots s ON s.id = io.snapshot_id
    WHERE io.status = 'pending' AND io.attempts < $1
    ORDER BY io.created_at ASC
    LIMIT 5
  `, [maxAttempts]);

  let attempted = 0;
  for (const row of pending.rows) {
    attempted += 1;
    const result = await syncProposalDirectly(database, row.proposal_id);
    if (result.status === 'offline') break;
  }
  return attempted;
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
