import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCriticalTestDatabase } from './criticalTestDatabase';
import { deleteDiscardedProposals, listDiscardedProposals } from './proposalDiscard';

const ids = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'];

test('exclusao permanente de propostas descartadas: selecionadas ou todas', async context => {
  const { database, userId } = await createCriticalTestDatabase();
  context.after(() => database.close());
  const actor = { id: userId, name: 'Admin' };
  for (const [index, id] of ids.entries()) {
    await database.query(`INSERT INTO discarded_proposals (id, proposal_number, payload, restored_at) VALUES ($1, $2, '{}'::jsonb, $3)`,
      [id, `PA-000${index + 1}`, index === 2 ? new Date().toISOString() : null]);
  }
  assert.equal((await listDiscardedProposals(database)).length, 3);

  // Uma so: some da lista; id desconhecido e repetido nao conta nem quebra.
  assert.deepEqual(await deleteDiscardedProposals(database, [ids[0], ids[0], '00000000-0000-4000-8000-000000000000'], actor), { deleted: 1 });
  assert.deepEqual((await listDiscardedProposals(database)).map(item => item.id).sort(), [ids[1], ids[2]]);

  // Todas (inclusive a ja restaurada).
  assert.deepEqual(await deleteDiscardedProposals(database, [ids[1], ids[2]], actor), { deleted: 2 });
  assert.equal((await listDiscardedProposals(database)).length, 0);
  assert.deepEqual(await deleteDiscardedProposals(database, ids, actor), { deleted: 0 });

  // Fica o registro de auditoria, sem o conteudo da proposta.
  const audit = await database.query<{ before_data: { number: string; restored: boolean } }>("SELECT before_data FROM audit_events WHERE action = 'discard_deleted' ORDER BY before_data->>'number'");
  assert.deepEqual(audit.rows.map(row => [row.before_data.number, row.before_data.restored]), [['PA-0001', false], ['PA-0002', false], ['PA-0003', true]]);
});
