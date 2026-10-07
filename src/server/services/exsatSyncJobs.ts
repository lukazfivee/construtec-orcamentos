import { randomUUID } from 'node:crypto';
import type { CatalogImportItem } from '../../shared/contracts';
import type { ExsatSyncJob } from '../../shared/exsatServer';
import type { ExsatCard } from './exsatCards';
import type { LocalDatabase } from './database';
import { ExsatServerError, exsatMessage } from './exsatErrors';
import type { ExsatRuntime } from './exsatRuntime';

// Departamentos por onde a varredura comeca; o resto vem dos links do menu lateral de cada departamento.
export const EXSAT_SEEDS = [
  'controle-de-acesso', 'seguranca-eletronica', 'redes-e-cabeamento', 'linha-comunicacao', 'linha-energia',
  'energia-solar', 'automatizadores', 'gravadores-digitais', 'cameras-ip', 'acessorios-smart-home',
].map((slug) => `https://exsat.com.br/produtos/departamento/${slug}/`);

export const MAX_PAGES = 400;
const KEEP_JOBS = 5;

export type JobRow = {
  id: string; status: ExsatSyncJob['status']; queue: string[]; visited: string[]; pages_read: number; pages_failed: number;
  relogins: number; error_code: string | null; created_at: string; updated_at: string; finished_at: string | null;
};

const COLUMNS = 'id, status, queue, visited, pages_read, pages_failed, relogins, error_code, created_at::text, updated_at::text, finished_at::text';

export const loadJob = async (database: LocalDatabase, id: string): Promise<JobRow | null> => (
  (await database.query<JobRow>(`SELECT ${COLUMNS} FROM exsat_sync_jobs WHERE id = $1`, [id])).rows[0] ?? null
);

export const latestJob = async (database: LocalDatabase): Promise<JobRow | null> => (
  (await database.query<JobRow>(`SELECT ${COLUMNS} FROM exsat_sync_jobs ORDER BY created_at DESC LIMIT 1`)).rows[0] ?? null
);

export const createJob = async (database: LocalDatabase, userId: string, id: string = randomUUID()): Promise<string> => {
  try {
    await database.query(
      "INSERT INTO exsat_sync_jobs (id, status, started_by, queue) VALUES ($1, 'running', $2, $3::jsonb)",
      [id, userId, JSON.stringify(EXSAT_SEEDS)],
    );
  } catch (error) {
    if (error instanceof Error && /duplicate key|unique/i.test(error.message)) throw new ExsatServerError('EXSAT_JOB_RUNNING');
    throw error;
  }
  await database.query(
    `DELETE FROM exsat_sync_jobs WHERE id NOT IN (SELECT id FROM exsat_sync_jobs ORDER BY created_at DESC LIMIT ${KEEP_JOBS})`,
  );
  return id;
};

export const saveProgress = (database: LocalDatabase, id: string, state: { queue: string[]; visited: string[]; pagesRead: number; pagesFailed: number; relogins: number }) => database.query(
  `UPDATE exsat_sync_jobs SET queue = $2::jsonb, visited = $3::jsonb, pages_read = $4, pages_failed = $5, relogins = $6, updated_at = now()
   WHERE id = $1 AND status = 'running'`,
  [id, JSON.stringify(state.queue), JSON.stringify(state.visited), state.pagesRead, state.pagesFailed, state.relogins],
);

export const setJobStatus = (database: LocalDatabase, id: string, status: ExsatSyncJob['status'], errorCode: string | null = null) => database.query(
  `UPDATE exsat_sync_jobs SET status = $2, error_code = $3, updated_at = now(),
     finished_at = CASE WHEN $2 IN ('done', 'failed', 'cancelled') THEN now() ELSE NULL END
   WHERE id = $1 AND status IN ('running', 'paused')`,
  [id, status, errorCode],
);

// Reabre uma varredura pausada. O indice unico garante uma so em andamento.
export const reopenJob = async (database: LocalDatabase, id: string) => {
  try {
    const result = await database.query(
      "UPDATE exsat_sync_jobs SET status = 'running', error_code = NULL, relogins = 0, updated_at = now() WHERE id = $1 AND status = 'paused'",
      [id],
    );
    if (!result.affectedRows) throw new ExsatServerError('EXSAT_JOB_RUNNING');
  } catch (error) {
    if (error instanceof Error && /duplicate key|unique/i.test(error.message)) throw new ExsatServerError('EXSAT_JOB_RUNNING');
    throw error;
  }
};

export const stageItems = async (database: LocalDatabase, jobId: string, cards: ExsatCard[]) => {
  if (cards.length === 0) return;
  const params: unknown[] = [jobId];
  const values = cards.map((card, index) => {
    params.push(card.item.code, card.item.currentCost, JSON.stringify(card.item));
    return `($1, $${index * 3 + 2}, $${index * 3 + 3}, $${index * 3 + 4}::jsonb)`;
  });
  await database.query(`
    INSERT INTO exsat_sync_items (job_id, code, price, item) VALUES ${values.join(', ')}
    ON CONFLICT (job_id, code) DO UPDATE SET price = EXCLUDED.price, item = EXCLUDED.item
    WHERE exsat_sync_items.price = 0 AND EXCLUDED.price > 0
  `, params);
};

export const jobCounts = async (database: LocalDatabase, jobId: string) => {
  const { rows } = await database.query<{ priced: number; unpriced: number }>(`
    SELECT (count(*) FILTER (WHERE price > 0))::int AS priced, (count(*) FILTER (WHERE price = 0))::int AS unpriced
    FROM exsat_sync_items WHERE job_id = $1
  `, [jobId]);
  return { priced: rows[0]?.priced ?? 0, unpriced: rows[0]?.unpriced ?? 0 };
};

// Itens COM preco, em paginas. Os sem preco nunca saem do servidor: so a contagem.
export const listPricedItems = async (database: LocalDatabase, jobId: string, offset: number, limit: number) => {
  const { rows } = await database.query<{ item: CatalogImportItem; price: string }>(
    'SELECT item, price::text FROM exsat_sync_items WHERE job_id = $1 AND price > 0 ORDER BY code OFFSET $2 LIMIT $3',
    [jobId, offset, limit],
  );
  const { priced } = await jobCounts(database, jobId);
  return { items: rows.map((row) => ({ ...row.item, currentCost: Number(row.price) })), total: priced, offset };
};

// Varredura "em andamento" no banco sem corredor vivo neste processo (servidor reiniciou ou dormiu): vira pausada.
export const reconcileInterrupted = async (database: LocalDatabase, runtime: ExsatRuntime) => {
  const running = await database.query<{ id: string }>("SELECT id FROM exsat_sync_jobs WHERE status = 'running'");
  for (const { id } of running.rows) {
    if (!runtime.runs.has(id)) await database.query("UPDATE exsat_sync_jobs SET status = 'paused', error_code = 'EXSAT_INTERRUPTED', updated_at = now() WHERE id = $1", [id]);
  }
};

export const toJobView = async (database: LocalDatabase, row: JobRow): Promise<ExsatSyncJob> => {
  const counts = await jobCounts(database, row.id);
  return {
    id: row.id, status: row.status, startedAt: row.created_at, updatedAt: row.updated_at, finishedAt: row.finished_at,
    pagesRead: row.pages_read, pagesFailed: row.pages_failed,
    pagesTotal: row.pages_read + row.pages_failed + (row.status === 'running' || row.status === 'paused' ? row.queue.length : 0),
    itemsWithPrice: counts.priced, itemsWithoutPrice: counts.unpriced,
    errorCode: row.error_code, message: exsatMessage(row.error_code),
  };
};
