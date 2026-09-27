import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createDatabase } from './database';
import { mirrorCentroUser } from './auth';

// Banco da nuvem com a 013 registrada por outro branch: as colunas da
// identidade faltavam e o login respondia 500 (42703).
test('migracao recria colunas da identidade marcadas como aplicadas sem existir', async () => {
  const previousUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const dir = await mkdtemp(path.join(os.tmpdir(), 'orc-heal-'));
  try {
    const first = await createDatabase(dir);
    await first.exec('ALTER TABLE users DROP COLUMN centro_admin; ALTER TABLE users DROP COLUMN local_role;');
    await first.close();

    const database = await createDatabase(dir);
    try {
      const mirrored = await mirrorCentroUser(database, { id: 'centro-1', name: 'Teste', email: 'teste@example.invalid', role: 'gestor', active: true });
      assert.equal(mirrored.role, 'viewer');
      assert.equal(mirrored.centro_admin, false);
    } finally {
      await database.close();
    }
  } finally {
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    await rm(dir, { recursive: true, force: true });
  }
});
