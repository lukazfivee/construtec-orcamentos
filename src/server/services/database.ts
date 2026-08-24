import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { initialMigration } from '../migrations/001-initial';

export type LocalDatabase = PGlite;

export const createDatabase = async (userDataPath: string) => {
  const database = await PGlite.create(path.join(userDataPath, 'data', 'postgres'));

  await database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version integer PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const result = await database.query<{ version: number }>(
    'SELECT version FROM schema_migrations WHERE version = $1',
    [1],
  );

  if (result.rows.length === 0) {
    await database.transaction(async (transaction) => {
      await transaction.exec(initialMigration);
      await transaction.query('INSERT INTO schema_migrations (version) VALUES ($1)', [1]);
    });
  }

  return database;
};
