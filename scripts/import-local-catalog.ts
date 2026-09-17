import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { cp, mkdtemp, readFile, readdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { NodeFS } from '@electric-sql/pglite/nodefs';
import type { LocalDatabase } from '../src/server/services/database';
import { createPostgresDatabase } from '../src/server/services/postgresDatabase';

type Product = { id: string; code: string; [key: string]: unknown };
const rows = async (db: Pick<LocalDatabase, 'query'>) => (
  await db.query<{ product: Product }>('SELECT row_to_json(p) AS product FROM products p ORDER BY code')
).rows.map((row) => row.product);
const key = (product: Product) => product.code.trim().toLowerCase();

async function fingerprint(directory: string): Promise<string> {
  const hash = createHash('sha256');
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(directory, entry.name);
    assert(!entry.isSymbolicLink(), 'SOURCE_SYMLINK');
    hash.update(entry.name);
    hash.update(entry.isDirectory() ? await fingerprint(file) : await readFile(file));
  }
  return hash.digest('hex');
}

async function transfer(db: LocalDatabase, products: Product[], apply: boolean) {
  assert(products.length > 0, 'EMPTY_SOURCE');
  assert.equal(new Set(products.map(key)).size, products.length, 'DUPLICATE_SOURCE_CODES');
  return db.transaction(async (tx) => {
    await tx.exec('LOCK TABLE products IN SHARE ROW EXCLUSIVE MODE');
    const before = await rows(tx);
    const existingCodes = new Set(before.map(key));
    const missing = products.filter((product) => !existingCodes.has(key(product)));
    assert(!missing.some((product) => before.some((existing) => existing.id === product.id)), 'ID_CONFLICT');
    if (apply && missing.length) {
      await tx.query(`
        INSERT INTO products (id, code, manufacturer, model, description, category, unit,
          current_cost, source, source_updated_at, revision, created_at, updated_at, active)
        SELECT id, code, manufacturer, model, description, category, unit,
          current_cost, source, source_updated_at, revision, created_at, updated_at, active
        FROM jsonb_populate_recordset(NULL::products, $1::jsonb)
      `, [JSON.stringify(missing)]);
      const after = await rows(tx);
      assert.equal(after.length, before.length + missing.length, 'COUNT_MISMATCH');
      for (const product of before) assert.deepEqual(after.find((row) => row.id === product.id), product, 'EXISTING_CHANGED');
      for (const product of missing) assert.deepEqual(after.find((row) => row.id === product.id), product, 'IMPORTED_CHANGED');
      assert(products.every((product) => after.some((row) => key(row) === key(product))), 'MISSING_CODES');
      await tx.query(`INSERT INTO audit_events (id, entity_type, entity_id, action, after_data)
        VALUES ($1, 'catalog', $2, 'local_catalog_migrated', $3::jsonb)`,
      [randomUUID(), randomUUID(), JSON.stringify({ created: missing.length, preserved: before.length })]);
    }
    return { source: products.length, cloudBefore: before.length, missing: missing.length,
      preserved: products.length - missing.length, applied: apply, cloudAfter: before.length + (apply ? missing.length : 0) };
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--self-test') {
    const { initialMigration } = await import('../src/server/migrations/001-initial');
    const db = await PGlite.create();
    try {
      await db.exec(initialMigration);
      await db.exec('ALTER TABLE products ADD COLUMN active boolean NOT NULL DEFAULT true');
      await db.query(`INSERT INTO products (id, code, description, category, unit, current_cost)
        VALUES ($1, 'TEST', 'Test product', 'Test', 'un', 12.34)`, [randomUUID()]);
      const source = await rows(db);
      await db.exec('DELETE FROM products');
      assert.equal((await transfer(db, source, false)).cloudAfter, 0);
      assert.equal((await transfer(db, source, true)).cloudAfter, 1);
      source[0].current_cost = 99;
      assert.equal((await transfer(db, source, true)).missing, 0);
      assert.notEqual((await rows(db))[0].current_cost, 99);
      await assert.rejects(transfer(db, [...source, ...source], true), /DUPLICATE_SOURCE_CODES/);
      console.log('SELF_TEST_OK: dry-run, insert, idempotency, preserve existing, reject duplicates');
    } finally { await db.close(); }
    return;
  }
  assert(['--inspect', '--preview', '--apply'].includes(args[0]), 'MODE_REQUIRED');
  const source = path.resolve(args[1]);
  assert.equal((await readFile(path.join(source, 'PG_VERSION'), 'utf8')).trim(), '17', 'SOURCE_VERSION');
  const originalHash = await fingerprint(source);
  const snapshotRoot = await mkdtemp(path.join(tmpdir(), 'construtec-catalog-'));
  const snapshot = path.join(snapshotRoot, 'postgres');
  await cp(source, snapshot, { recursive: true, errorOnExist: true });
  assert.equal(await fingerprint(source), originalHash, 'SOURCE_CHANGED_DURING_COPY');
  assert.equal(await fingerprint(snapshot), originalHash, 'SNAPSHOT_MISMATCH');
  // Only the verified disposable copy is opened; the running local database is untouched.
  await unlink(path.join(snapshot, 'postmaster.pid')).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
  const local = await PGlite.create({ fs: new NodeFS(snapshot) });
  let products: Product[];
  try { products = await rows(local); } finally { await local.close(); }
  console.log(JSON.stringify({ localItems: products.length, active: products.filter((p) => p.active).length, snapshotRoot }));
  if (args[0] === '--inspect') return;
  assert(process.env.DATABASE_URL, 'DATABASE_URL_REQUIRED');
  const remote = createPostgresDatabase(process.env.DATABASE_URL);
  try { console.log(JSON.stringify(await transfer(remote, products, args[0] === '--apply'))); }
  finally { await remote.close(); }
}

main().catch((error) => {
  console.error('CATALOG_IMPORT_FAILED', error instanceof assert.AssertionError ? error.message : 'Check source and connection; transaction rolled back if uncommitted.');
  process.exitCode = 1;
});
