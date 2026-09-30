import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type * as PGliteModule from '@electric-sql/pglite';
import type * as NodeFsModule from '@electric-sql/pglite/nodefs';
import { approvedProposalGuardsMigration } from '../migrations/008-approved-proposal-guards';
import { proposalIntegrationMigration } from '../migrations/009-proposal-integration';
import { integrationOutboxResultMigration } from '../migrations/011-integration-outbox-result';
import { sharedIdentityMigration } from '../migrations/012-shared-identity';
import { centroAdminMigration } from '../migrations/013-centro-admin';
import { proposalCenterSnapshotsMigration } from '../migrations/014-proposal-center-snapshots';
import { discardedProposalsMigration } from '../migrations/015-discarded-proposals';
import { proposalTaxMigration } from '../migrations/010-proposal-tax';
import { initialMigration } from '../migrations/001-initial';
import { clientsAndWorksMigration } from '../migrations/002-clients-works';
import { catalogManagementMigration } from '../migrations/003-catalog-management';
import { cleanExsatAdministrativeOcrMigration } from '../migrations/004-clean-exsat-admin-ocr';
import { proposalLaborMigration } from '../migrations/005-proposal-labor';
import { proposalItemCategoryMigration } from '../migrations/006-proposal-item-category';
import { kitsAndSettingsMigration } from '../migrations/007-kits-and-settings';
import { ensureFirstRunData } from './bootstrap';

export interface DatabaseQueries {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[]; affectedRows?: number }>;
  exec(sql: string): Promise<unknown>;
}

export interface LocalDatabase extends DatabaseQueries {
  transaction<T>(callback: (transaction: DatabaseQueries) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  dumpDataDir(compression?: 'gzip' | 'none'): Promise<Blob>;
}

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
  if (process.env.DATABASE_URL) {
    const { createPostgresDatabase } = await import('./postgresDatabase');
    const database = createPostgresDatabase(process.env.DATABASE_URL);
    try {
      await database.transaction(async transaction => {
        await transaction.query('SELECT pg_advisory_xact_lock(178241, 1)');
        await migrateDatabase(transaction);
      });
      return database;
    } catch (error) {
      await database.close();
      throw error;
    }
  }
  const databasePath = getDatabasePath(userDataPath);
  await mkdir(databasePath, { recursive: true });
  try {
    await rm(path.join(databasePath, 'postmaster.pid'), { force: true });
  } catch {
    // Ignore if not found
  }
  const { PGlite, NodeFS } = await loadPGlite(packagedModulePath);
  const database = await PGlite.create({ fs: new NodeFS(databasePath) });

  try {
    await database.transaction(migrateDatabase);
    await ensureFirstRunData(database);
    return database;
  } catch (error) {
    await database.close();
    throw error;
  }
};

// Resultado da conferencia das colunas da identidade (exposto no /health).
export let identityHealStatus = 'pending';

const migrateDatabase = async (database: DatabaseQueries) => {
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
    [8, approvedProposalGuardsMigration],
    [9, proposalIntegrationMigration],
    [10, proposalTaxMigration],
    [11, integrationOutboxResultMigration],
    [12, sharedIdentityMigration],
    [13, centroAdminMigration],
    [14, proposalCenterSnapshotsMigration],
    [15, discardedProposalsMigration],
  ] as const;

  for (const [version, sql] of migrations) {
    const result = await database.query<{ version: number }>(
      'SELECT version FROM schema_migrations WHERE version = $1',
      [version],
    );
    if (result.rows.length === 0) {
      await database.exec(sql);
      await database.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
    }
  }

  // Self-heal: um branch antigo (acompanhamento da obra) registrou outra
  // migracao com o numero 13 no banco da nuvem; a 012/013 da identidade ficou
  // marcada como aplicada sem as colunas e o login falhava com 42703.
  // Em savepoint e sem derrubar a inicializacao: se falhar, o servidor sobe
  // e o /health mostra o codigo. So acrescenta colunas; nada e apagado.
  // Em producao (27/09/2026) a tabela users do esquema orcamentos foi trocada
  // por outra estrutura fora do codigo (sem role e sem as colunas da 012/013).
  identityHealStatus = 'ok';
  await database.exec('SAVEPOINT identity_heal');
  try {
    const identityColumns = await database.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = (SELECT n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.oid = to_regclass('users'))
         AND table_name = 'users'`,
    );
    const present = new Set(identityColumns.rows.map(row => row.column_name));
    const missing = ['role', 'centro_user_id', 'deleted_at', 'centro_admin', 'local_role'].filter(column => !present.has(column));
    if (missing.length) {
      await database.exec(`
        ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'commercial', 'viewer'));
        ALTER TABLE users ADD COLUMN IF NOT EXISTS centro_user_id text;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS centro_admin boolean NOT NULL DEFAULT false;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS local_role text;
      `);
      // Colunas da outra estrutura: a senha vive no Centro, o espelho nao as preenche.
      for (const column of ['password_salt', 'password_iterations']) {
        if (present.has(column)) await database.exec(`ALTER TABLE users ALTER COLUMN ${column} DROP NOT NULL`);
      }
      identityHealStatus = `healed:${missing.join(',')}`;
    }
    await database.exec('RELEASE SAVEPOINT identity_heal');
  } catch (error) {
    await database.exec('ROLLBACK TO SAVEPOINT identity_heal');
    const code = (error as { code?: unknown }).code;
    // So o nome da coluna/objeto, nunca dados.
    const target = /(?:column|relation) "([\w.]+)"/.exec(String((error as Error)?.message))?.[1] ?? '';
    identityHealStatus = `error:${typeof code === 'string' ? code : 'unknown'}${target ? `:${target}` : ''}`;
    console.error('[identity-heal]', error);
  }
  // Indices unicos em savepoint proprio: duplicatas antigas nao podem impedir o login.
  await database.exec('SAVEPOINT identity_indexes');
  try {
    await database.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_live_unique ON users (lower(email)) WHERE deleted_at IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS users_centro_user_id_unique ON users (centro_user_id) WHERE centro_user_id IS NOT NULL AND deleted_at IS NULL;
    `);
    await database.exec('RELEASE SAVEPOINT identity_indexes');
  } catch (error) {
    await database.exec('ROLLBACK TO SAVEPOINT identity_indexes');
    identityHealStatus += `;index:${String((error as { code?: unknown }).code ?? 'unknown')}`;
    console.error('[identity-heal] indices', error);
  }

  // Self-heal: garante coluna snapshot_category e que description em kits seja opcional
  await database.exec("ALTER TABLE proposal_items ADD COLUMN IF NOT EXISTS snapshot_category text NOT NULL DEFAULT 'Outros'");
  await database.exec('ALTER TABLE kits ALTER COLUMN description DROP NOT NULL');
};
