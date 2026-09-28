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
    // Estrutura encontrada em producao: sem role e sem as colunas da 012/013,
    // com senha local obrigatoria.
    await first.exec(`
      DROP INDEX IF EXISTS users_centro_user_id_unique;
      ALTER TABLE users DROP COLUMN centro_admin, DROP COLUMN local_role, DROP COLUMN centro_user_id, DROP COLUMN role;
      ALTER TABLE users ADD COLUMN password_salt text NOT NULL DEFAULT 'x', ADD COLUMN password_iterations integer NOT NULL DEFAULT 1;
      ALTER TABLE users ALTER COLUMN password_salt DROP DEFAULT, ALTER COLUMN password_iterations DROP DEFAULT;
    `);
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
