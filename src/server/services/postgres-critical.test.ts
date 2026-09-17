import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Pool } from 'pg';
import { createDatabase, type LocalDatabase } from './database';
import { createPostgresDatabase } from './postgresDatabase';
import { setupFirstAdmin, loginUser } from './auth';
import { createClient, createWork, listClients } from './clients';
import { createProposal, getProposalById } from './proposals';

test('PostgreSQL real: migrations, transações, serviços e persistência', {
  skip: !process.env.POSTGRES_TEST_URL,
}, async () => {
  // A URL de teste só cria/remove um banco descartável de nome aleatório.
  const admin = new Pool({ connectionString: process.env.POSTGRES_TEST_URL });
  const name = `adapter_test_${randomUUID().replaceAll('-', '')}`;
  const previousUrl = process.env.DATABASE_URL;
  const databases: LocalDatabase[] = [];
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    assert.ok(process.env.POSTGRES_TEST_URL);
    const url = new URL(process.env.POSTGRES_TEST_URL);
    url.pathname = `/${name}`;
    process.env.DATABASE_URL = url.toString();
    const database = await createDatabase('unused-remote-test');
    databases.push(database);
    assert.equal((await database.query<{ count: number }>('SELECT count(*)::int AS count FROM schema_migrations')).rows[0].count, 10);
    assert.equal((await database.query<{ count: number }>('SELECT count(*)::int AS count FROM users')).rows[0].count, 0);
    assert.equal((await database.query<{ count: number }>('SELECT count(*)::int AS count FROM proposals')).rows[0].count, 0);
    await assert.rejects(database.dumpDataDir('gzip'), /REMOTE_BACKUP_UNSUPPORTED/);

    await database.exec('CREATE TABLE adapter_probe (id integer PRIMARY KEY, value text);');
    await assert.rejects(database.transaction(async transaction => {
      await transaction.query('INSERT INTO adapter_probe VALUES ($1, $2)', [1, 'rollback']);
      throw new Error('expected rollback');
    }), /expected rollback/);
    assert.equal((await database.query('SELECT * FROM adapter_probe')).rows.length, 0);
    const untrusted = "São Paulo '); DROP TABLE users; --";
    await database.transaction(async transaction => {
      await transaction.query('INSERT INTO adapter_probe VALUES ($1, $2)', [2, untrusted]);
      assert.equal((await database.query('SELECT * FROM adapter_probe')).rows.length, 0, 'uncommitted rows stay private to client');
    });
    assert.equal((await database.query('SELECT value FROM adapter_probe')).rows[0].value, untrusted);
    assert.equal((await database.query('DELETE FROM adapter_probe WHERE id=$1', [2])).affectedRows, 1);
    assert.equal((await database.query('DELETE FROM adapter_probe WHERE id=$1', [2])).affectedRows, 0);
    assert.deepEqual((await database.query("SELECT '2026-09-15'::date AS date, 1.25::numeric AS money, true AS flag, NULL::text AS missing, '{\"a\":1}'::jsonb AS json")).rows[0],
      { date: '2026-09-15', money: '1.25', flag: true, missing: null, json: { a: 1 } });

    const secret = randomUUID();
    const session = await setupFirstAdmin(database, secret, { name: 'Teste', email: 'teste@example.invalid', password: 'test-password-123' });
    assert.equal((await loginUser(database, secret, 'teste@example.invalid', 'test-password-123')).user.id, session.user.id);
    const clientId = await createClient(database, { legalName: 'Cliente de teste' });
    const workId = await createWork(database, clientId, { name: 'Obra de teste' });
    const proposalId = await createProposal(database, { clientId, workId, scope: 'Teste', validUntil: '2026-12-31' });
    assert.equal((await getProposalById(database, proposalId))?.validUntil, '2026-12-31');
    await database.close();
    databases.pop();
    // Simula reinício: novo pool, migrations idempotentes, dados preservados.
    const reopened = await createDatabase('unused-remote-test');
    databases.push(reopened);
    assert.equal((await listClients(reopened))[0].id, clientId);
    assert.equal((await getProposalById(reopened, proposalId))?.id, proposalId);
    const concurrent = createPostgresDatabase(url.toString());
    databases.push(concurrent);
    await Promise.all([reopened.transaction(async tx => {
      await tx.query('INSERT INTO adapter_probe VALUES (3, $1)', ['first']);
      await tx.query('SELECT pg_sleep(0.05)');
    }), concurrent.transaction(async tx => {
      await tx.query('INSERT INTO adapter_probe VALUES (4, $1)', ['second']);
    })]);
    assert.equal((await reopened.query('SELECT * FROM adapter_probe')).rows.length, 2);
  } finally {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    await Promise.all(databases.map(database => database.close()));
    await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
    await admin.end();
  }
});
