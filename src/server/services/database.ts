import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type * as PGliteModule from '@electric-sql/pglite';
import type * as NodeFsModule from '@electric-sql/pglite/nodefs';
import { initialMigration } from '../migrations/001-initial';
import { clientsAndWorksMigration } from '../migrations/002-clients-works';
import { catalogManagementMigration } from '../migrations/003-catalog-management';
import { cleanExsatAdministrativeOcrMigration } from '../migrations/004-clean-exsat-admin-ocr';
import { proposalLaborMigration } from '../migrations/005-proposal-labor';
import { proposalItemCategoryMigration } from '../migrations/006-proposal-item-category';
import { kitsAndSettingsMigration } from '../migrations/007-kits-and-settings';
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

export const getDatabasePath = (userDataPath: string) => path.join(userDataPath, 'data', 'postgres');

const createPGliteFromDump = async (databasePath: string, dump: Uint8Array, packagedModulePath?: string) => {
  await mkdir(databasePath, { recursive: true });
  const { PGlite, NodeFS } = await loadPGlite(packagedModulePath);
  const bytes = Uint8Array.from(dump);
  return PGlite.create({ fs: new NodeFS(databasePath), loadDataDir: new Blob([bytes]) });
};

export const validateDatabaseBackup = async (dump: Uint8Array, packagedModulePath?: string) => {
  if (dump.byteLength < 128) throw new Error('BACKUP_INVALID');
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'construtec-restore-'));
  let database: LocalDatabase | undefined;
  try {
    database = await createPGliteFromDump(path.join(temporaryRoot, 'postgres'), dump, packagedModulePath);
    const required = await database.query<{ migrations: string | null; proposals: string | null; users: string | null }>(`
      SELECT
        to_regclass('public.schema_migrations')::text AS migrations,
        to_regclass('public.proposals')::text AS proposals,
        to_regclass('public.users')::text AS users
    `);
    const row = required.rows[0];
    if (!row?.migrations || !row.proposals || !row.users) throw new Error('BACKUP_INVALID');
    const migration = await database.query<{ version: number }>('SELECT COALESCE(max(version), 0)::int AS version FROM schema_migrations');
    const counts = await database.query<{ proposals: number; users: number }>(`
      SELECT
        (SELECT count(*)::int FROM proposals) AS proposals,
        (SELECT count(*)::int FROM users) AS users
    `);
    return {
      schemaVersion: migration.rows[0]?.version ?? 0,
      proposals: counts.rows[0]?.proposals ?? 0,
      users: counts.rows[0]?.users ?? 0,
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'BACKUP_INVALID') throw error;
    throw new Error('BACKUP_INVALID');
  } finally {
    await database?.close().catch(() => undefined);
    await rm(temporaryRoot, { recursive: true, force: true });
  }
};

export const restoreDatabaseFromBackup = async (userDataPath: string, dump: Uint8Array, packagedModulePath?: string) => {
  const database = await createPGliteFromDump(getDatabasePath(userDataPath), dump, packagedModulePath);
  try {
    await database.query('SELECT 1 FROM schema_migrations LIMIT 1');
    await database.syncToFs();
  } finally {
    await database.close();
  }
};

export const createDatabase = async (userDataPath: string, packagedModulePath?: string) => {
  const databasePath = getDatabasePath(userDataPath);
  await mkdir(databasePath, { recursive: true });
  const { PGlite, NodeFS } = await loadPGlite(packagedModulePath);
  const database = await PGlite.create({ fs: new NodeFS(databasePath) });

  await database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version integer PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const migrations = [
    [1, initialMigration],
    [2, clientsAndWorksMigration],
    [3, catalogManagementMigration],
    [4, cleanExsatAdministrativeOcrMigration],
    [5, proposalLaborMigration],
    [6, proposalItemCategoryMigration],
    [7, kitsAndSettingsMigration],
  ] as const;

  for (const [version, sql] of migrations) {
    const result = await database.query<{ version: number }>(
      'SELECT version FROM schema_migrations WHERE version = $1',
      [version],
    );
    if (result.rows.length === 0) {
      await database.transaction(async (transaction) => {
        await transaction.exec(sql);
        await transaction.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
      });
    }
  }

  // Self-heal: garante coluna snapshot_category mesmo se migration 6 foi marcada antes de aplicar corretamente
  await database.exec("ALTER TABLE proposal_items ADD COLUMN IF NOT EXISTS snapshot_category text NOT NULL DEFAULT 'Outros'");

  await ensureFirstRunData(database);

  return database;
};
