import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type * as PGliteModule from '@electric-sql/pglite';
import type * as NodeFsModule from '@electric-sql/pglite/nodefs';
import { initialMigration } from '../migrations/001-initial';
import { ensureFirstRunData } from './bootstrap';

export type LocalDatabase = PGliteModule.PGlite;

const loadPGlite = async (packagedModulePath?: string) => {
  const pgliteSpecifier = packagedModulePath
    ? pathToFileURL(path.join(packagedModulePath, 'dist', 'index.js')).href
    : '@electric-sql/pglite';
  const nodeFsSpecifier = packagedModulePath
    ? pathToFileURL(path.join(packagedModulePath, 'dist', 'fs', 'nodefs.js')).href
    : '@electric-sql/pglite/nodefs';
  const [pgliteModule, nodeFsModule] = await Promise.all([
    import(/* @vite-ignore */ pgliteSpecifier) as Promise<typeof PGliteModule>,
    import(/* @vite-ignore */ nodeFsSpecifier) as Promise<typeof NodeFsModule>,
  ]);
  return { PGlite: pgliteModule.PGlite, NodeFS: nodeFsModule.NodeFS };
};

export const createDatabase = async (userDataPath: string, packagedModulePath?: string) => {
  const databasePath = path.join(userDataPath, 'data', 'postgres');
  await mkdir(databasePath, { recursive: true });
  const { PGlite, NodeFS } = await loadPGlite(packagedModulePath);
  const database = await PGlite.create({ fs: new NodeFS(databasePath) });

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

  await ensureFirstRunData(database);

  return database;
};
