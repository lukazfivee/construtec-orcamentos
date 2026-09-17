import { Pool, type PoolClient, types } from 'pg';
import type { LocalDatabase, DatabaseQueries } from './database';

const queries = (connection: Pool | PoolClient): DatabaseQueries => ({
  async query<T>(sql: string, params?: unknown[]) {
    const result = await connection.query(sql, params);
    return { rows: result.rows as T[], affectedRows: result.rowCount ?? 0 };
  },
  async exec(sql: string) {
    await connection.query(sql);
  },
});

export const createPostgresDatabase = (connectionString: string): LocalDatabase => {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL_INVALID');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!local) url.hostname = url.hostname.replace('-pooler', '');
  // Connection-string ssl options otherwise override pg's certificate verification.
  for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) url.searchParams.delete(key);
  const pool = new Pool({
    connectionString: url.toString(),
    options: '-c search_path=orcamentos,public',
    ssl: local ? false : { rejectUnauthorized: process.env.DB_SSL_VERIFY !== 'false' },
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 30_000,
    idle_in_transaction_session_timeout: 30_000,
    // PGlite exposes SQL DATE as YYYY-MM-DD; pg defaults to a timezone-sensitive Date.
    types: { getTypeParser: (oid, format) => oid === 1082 ? (value: string) => value : types.getTypeParser(oid, format) },
  });
  pool.on('error', () => console.error('POSTGRES_IDLE_CONNECTION_ERROR'));
  return {
    ...queries(pool),
    async transaction<T>(callback: (transaction: DatabaseQueries) => Promise<T>) {
      const client = await pool.connect();
      let discard = false;
      try {
        await client.query('BEGIN');
        // ponytail: serialize writes like PGlite; use per-proposal locks if throughput requires it.
        await client.query('SELECT pg_advisory_xact_lock(178241, 2)');
        const result = await callback(queries(client));
        const committed = await client.query('COMMIT');
        if (committed.command !== 'COMMIT') throw new Error('TRANSACTION_ABORTED');
        return result;
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch { discard = true; }
        throw error;
      } finally {
        client.release(discard);
      }
    },
    close: () => pool.end(),
    async dumpDataDir() { throw new Error('REMOTE_BACKUP_UNSUPPORTED'); },
  };
};
