import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { createCriticalTestDatabase } from './criticalTestDatabase';
import { updateProposalStatus } from './proposals';
import { discardProposal, listDiscardedProposals, restoreProposal } from './proposalDiscard';

const CONTRACT_ID = '22222222-2222-4222-8222-222222222222';
const TABLES = ['proposals', 'proposal_items', 'proposal_labor_items', 'proposal_approval_snapshots', 'integration_outbox', 'proposal_center_snapshots'];

test('descarte e recuperacao de proposta aprovada', async context => {
  // Centro falso: descartar e restaurar a obra (contrato da integracao).
  let discardMode: 'ok' | 'movement' | 'down' | 'gone' = 'ok';
  let restoreMode: 'ok' | 'conflict' | 'down' | 'not_discarded' = 'ok';
  const calls: { action: string; body: Record<string, unknown> }[] = [];
  const base = `/api/integracao/orcamentos/contratos/${CONTRACT_ID}/`;
  const server: Server = createServer((request, response) => {
    let raw = '';
    request.on('data', chunk => { raw += chunk; });
    request.on('end', () => {
      const action = request.url?.startsWith(base) ? request.url.slice(base.length) : 'other';
      calls.push({ action, body: raw ? JSON.parse(raw) : {} });
      const reply = (status: number, body: unknown) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(body)); };
      if (action === 'descartar') {
        if (discardMode === 'down') return reply(502, {});
        if (discardMode === 'movement') return reply(409, { code: 'HAS_MOVEMENT', movementCount: 3, erro: 'tem movimento' });
        if (discardMode === 'gone') return reply(200, { ok: true, discarded: false, alreadyGone: true });
        return reply(200, { ok: true, discarded: true, discardId: 'd1', costCenterCode: 'CC-7' });
      }
      if (action === 'restaurar') {
        if (restoreMode === 'down') return reply(503, {});
        if (restoreMode === 'conflict') return reply(409, { code: 'CODE_IN_USE', erro: 'conflito' });
        if (restoreMode === 'not_discarded') return reply(404, { code: 'NOT_DISCARDED' });
        return reply(200, { ok: true, restored: true, costCenterId: 7, costCenterCode: 'CC-7' });
      }
      reply(404, { erro: 'nao' });
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const saved = process.env.CENTRO_CUSTOS_API_URL;
  process.env.CENTRO_CUSTOS_API_URL = `http://127.0.0.1:${address.port}/api/integracao/orcamentos/sync-direto`;
  const fixture = await createCriticalTestDatabase();
  const { database, userId, makeProposal, addMaterial, addLabor } = fixture;
  context.after(async () => {
    if (saved === undefined) delete process.env.CENTRO_CUSTOS_API_URL; else process.env.CENTRO_CUSTOS_API_URL = saved;
    await database.close();
    if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
  });
  const actor = { id: userId, name: 'Admin' };
  const counts = async () => Object.fromEntries(await Promise.all(TABLES.map(async table =>
    [table, Number((await database.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${table}`)).rows[0].n)])));
  const empty = Object.fromEntries(TABLES.map(table => [table, 0]));

  const proposalId = await makeProposal();
  await addMaterial(proposalId);
  await addLabor(proposalId);
  await updateProposalStatus(database, proposalId, 'approved', userId);
  await database.query(`UPDATE integration_outbox SET status = 'delivered', delivered_at = now(), contract_id = $2, cost_center_id = 7
    WHERE snapshot_id IN (SELECT id FROM proposal_approval_snapshots WHERE proposal_id = $1)`, [proposalId, CONTRACT_ID]);
  const number = (await database.query<{ proposal_number: string }>('SELECT proposal_number FROM proposals WHERE id = $1', [proposalId])).rows[0].proposal_number;
  const before = await counts();
  assert.ok(before.proposal_approval_snapshots >= 1 && before.integration_outbox >= 1 && before.proposal_items >= 1, 'aprovada, selada e integrada');

  // A aprovacao e definitiva pelos caminhos normais.
  await assert.rejects(database.query('DELETE FROM proposals WHERE id = $1', [proposalId]), /PROPOSAL_LOCKED/);

  // Sem confirmacao do numero, com movimento na obra, com o Centro fora do ar ou sem chave: nada e apagado.
  await assert.rejects(discardProposal(database, proposalId, { confirmNumber: 'PA-0000', actor }), /DISCARD_CONFIRMATION/);
  assert.equal(calls.length, 0, 'sem confirmacao nao chama o Centro');
  discardMode = 'movement';
  await assert.rejects(discardProposal(database, proposalId, { confirmNumber: number, actor }), /DISCARD_CENTER_HAS_MOVEMENT/);
  discardMode = 'down';
  await assert.rejects(discardProposal(database, proposalId, { confirmNumber: number, actor }), /DISCARD_CENTER_UNAVAILABLE/);
  const savedKey = process.env.CONSTRUTEC_INTEGRATION_KEY, savedDb = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgres://nuvem-sem-chave';
  delete process.env.CONSTRUTEC_INTEGRATION_KEY;
  await assert.rejects(discardProposal(database, proposalId, { confirmNumber: number, actor }), /DISCARD_CENTER_UNAVAILABLE/);
  if (savedDb === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = savedDb;
  if (savedKey !== undefined) process.env.CONSTRUTEC_INTEGRATION_KEY = savedKey;
  assert.deepEqual(await counts(), before, 'recusado: tudo no lugar');
  assert.ok(!calls.some(call => call.action === 'restaurar'), 'nada a desfazer no Centro');

  // Falha local depois de o Centro descartar: a obra e recuperada no Centro e nada local muda.
  discardMode = 'ok';
  calls.length = 0;
  await database.query('ALTER TABLE discarded_proposals ADD CONSTRAINT test_block CHECK (false) NOT VALID');
  await assert.rejects(discardProposal(database, proposalId, { confirmNumber: number, actor }));
  await database.query('ALTER TABLE discarded_proposals DROP CONSTRAINT test_block');
  assert.deepEqual(calls.map(call => call.action), ['descartar', 'restaurar']);
  assert.deepEqual(await counts(), before);

  // Descarte permitido: a obra sem movimento sai do Centro junto.
  calls.length = 0;
  const { discardId } = await discardProposal(database, proposalId, { confirmNumber: number.toLowerCase(), reason: 'proposta de teste', actor });
  assert.deepEqual(calls, [{ action: 'descartar', body: { actorName: 'Admin', reason: 'proposta de teste', proposalNumber: number } }]);
  assert.deepEqual(await counts(), empty);
  const stored = (await database.query<{ payload: { centerDiscards: unknown } }>('SELECT payload FROM discarded_proposals WHERE id = $1', [discardId])).rows[0];
  assert.deepEqual(stored.payload.centerDiscards, [{ contractId: CONTRACT_ID, discarded: true, costCenterCode: 'CC-7' }]);
  const listed = await listDiscardedProposals(database);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].proposal_number, number);
  assert.equal(listed[0].had_approval, true);
  assert.equal(listed[0].reason, 'proposta de teste');
  assert.equal(listed[0].restored_at, null);
  assert.ok((await database.query("SELECT 1 FROM audit_events WHERE action = 'discarded'")).rows.length);

  // Recuperar sem o Centro, ou com conflito no Centro: nada e restaurado.
  restoreMode = 'down';
  await assert.rejects(restoreProposal(database, discardId, actor), /DISCARD_CENTER_UNAVAILABLE/);
  restoreMode = 'conflict';
  await assert.rejects(restoreProposal(database, discardId, actor), /RESTORE_CENTER_CONFLICT/);
  assert.deepEqual(await counts(), empty);
  assert.equal((await listDiscardedProposals(database))[0].restored_at, null);

  // Recuperacao devolve a obra no Centro e tudo como era; as travas de aprovacao voltam a valer.
  restoreMode = 'ok';
  calls.length = 0;
  const restored = await restoreProposal(database, discardId, actor);
  assert.deepEqual(calls, [{ action: 'restaurar', body: { actorName: 'Admin' } }]);
  assert.equal(restored.proposalNumber, number);
  assert.deepEqual(await counts(), before);
  await assert.rejects(database.query('DELETE FROM proposals WHERE id = $1', [proposalId]), /PROPOSAL_LOCKED/);
  await assert.rejects(restoreProposal(database, discardId, actor), /DISCARD_ALREADY_RESTORED/);
  assert.ok((await listDiscardedProposals(database))[0].restored_at);
  await assert.rejects(database.query('DELETE FROM proposal_approval_snapshots'), /SNAPSHOT_LOCKED/);

  // Obra ja removida no Centro: descarta so aqui e a recuperacao nao chama o Centro.
  discardMode = 'gone';
  const again = await discardProposal(database, proposalId, { confirmNumber: number, actor });
  assert.deepEqual(await counts(), empty);
  calls.length = 0;
  await restoreProposal(database, again.discardId, actor);
  assert.equal(calls.length, 0);
  assert.deepEqual(await counts(), before);

  // Centro responde que a obra nao estava descartada (404): conta como recuperada.
  discardMode = 'ok';
  const third = await discardProposal(database, proposalId, { confirmNumber: number, actor });
  restoreMode = 'not_discarded';
  await restoreProposal(database, third.discardId, actor);
  assert.deepEqual(await counts(), before);
});
