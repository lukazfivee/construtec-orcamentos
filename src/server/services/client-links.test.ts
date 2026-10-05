import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCriticalTestDatabase } from './criticalTestDatabase';
import { signLinkToken, parseLinkToken, ClientLinkError } from './clientLinkCommon';
import { confirmClientApproval, createClientLink, disableClientLink, getClientLink } from './clientLinks';
import { adjustPublicLink, approvePublicLink, openPublicLink, publicDocumentHtml } from './clientLinksPublic';
import { createProposalRevision } from './proposalLifecycle';
import { getProposalById, updateProposalStatus } from './proposals';

const SECRET = 'segredo-de-teste-com-mais-de-32-caracteres!!';
const ctx = { secret: SECRET, ip: '203.0.113.9', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17) Safari/604.1' };
const failsWith = (code: string) => (error: unknown) => error instanceof ClientLinkError && error.code === code;

test('link publico do cliente: token, aprovacao, ajuste e confirmacao', async context => {
  const { database, userId, makeProposal, addMaterial } = await createCriticalTestDatabase();
  context.after(() => database.close());
  const createRevisionFor = (proposalId: string) => createProposalRevision(database, proposalId, userId);
  const ready = async () => {
    const id = await makeProposal();
    await addMaterial(id, '10', '100', '150');
    await updateProposalStatus(database, id, 'review', userId);
    return id;
  };

  await context.test('token assinado: aceita o proprio e recusa adulterado ou de outra chave', () => {
    const id = '11111111-2222-4333-8444-555555555555';
    const token = signLinkToken(id, SECRET);
    assert.equal(parseLinkToken(token, SECRET), id);
    assert.equal(parseLinkToken(token, `${SECRET}x`), null);
    assert.equal(parseLinkToken(`${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`, SECRET), null);
    assert.equal(parseLinkToken('curto', SECRET), null);
  });

  await context.test('gerar exige revisao fechada, passa a proposta para Enviada e e idempotente', async () => {
    const draft = await makeProposal();
    await assert.rejects(createClientLink(database, draft, { days: 30, requireIdentity: true }, userId, SECRET), failsWith('LINK_NEEDS_REVIEW'));
    const id = await ready();
    const link = await createClientLink(database, id, { days: 7, requireIdentity: false }, userId, SECRET);
    assert.equal(link.state, 'active');
    assert.equal(link.requireIdentity, false);
    assert.equal((await getProposalById(database, id))?.status, 'sent');
    const again = await createClientLink(database, id, { days: 30, requireIdentity: true }, userId, SECRET);
    assert.equal(again.id, link.id);
  });

  await context.test('abrir registra visualizacao e entrega so preco de venda', async () => {
    const id = await ready();
    const link = await createClientLink(database, id, { days: 30, requireIdentity: true }, userId, SECRET);
    const opened = await openPublicLink(database, link.token, ctx);
    assert.equal(opened.state, 'active');
    assert.equal(opened.proposal.total, 1250);
    assert.doesNotMatch(JSON.stringify(opened), /cost|bdi|margin|marginPercent/i);
    const html = await publicDocumentHtml(database, link.token, SECRET);
    assert.doesNotMatch(html, /Margem|BDI|Custo base/);
    const views = (await getClientLink(database, id, SECRET))?.views ?? [];
    assert.equal(views.length, 1);
    assert.match(views[0].device, /iPhone/);
    await assert.rejects(openPublicLink(database, 'a'.repeat(75), ctx), failsWith('LINK_INVALID'));
  });

  await context.test('aprovar: exige aceite e identidade, grava codigo e fecha o link; so p11 confirma', async () => {
    const id = await ready();
    const link = await createClientLink(database, id, { days: 30, requireIdentity: true }, userId, SECRET);
    await assert.rejects(approvePublicLink(database, link.token, { name: 'Ana', role: 'Diretora', accept: false }, ctx), failsWith('LINK_ACCEPT_REQUIRED'));
    await assert.rejects(approvePublicLink(database, link.token, { name: 'Ana', accept: true }, ctx), failsWith('LINK_IDENTITY_REQUIRED'));
    const done = await approvePublicLink(database, link.token, { name: 'Ana Souza', role: 'Diretora', accept: true }, ctx);
    assert.match(done.code, /^ACEITE-PA-\d+-REV00-[0-9A-F]{6}$/);
    await assert.rejects(approvePublicLink(database, link.token, { name: 'Ana Souza', role: 'Diretora', accept: true }, ctx), failsWith('LINK_NOT_ACTIVE'));
    assert.equal((await getProposalById(database, id))?.status, 'sent', 'a aprovacao do cliente nao aprova a proposta sozinha');
    assert.equal((await openPublicLink(database, link.token, ctx)).state, 'approved');

    const confirmed = await confirmClientApproval(database, id, userId, SECRET);
    assert.equal(confirmed.proposal.status, 'approved');
    assert.equal(confirmed.link.state, 'confirmed');
    const snapshot = await database.query<{ payload: { proposal: { approval: { evidenceReference: string } } } }>('SELECT payload FROM proposal_approval_snapshots WHERE proposal_id = $1', [id]);
    assert.equal(snapshot.rows[0].payload.proposal.approval.evidenceReference, done.code);
  });

  await context.test('selo guarda a evidencia real: aceite do cliente (quando, quem, codigo) e quem confirmou; hash segue valido', async () => {
    const { randomUUID } = await import('node:crypto');
    const { canonicalJsonStringify, computeSha256 } = await import('./integration/proposalSealing');
    const confirmerId = randomUUID();
    await database.query("INSERT INTO users (id,name,email,password_hash,role) VALUES ($1,'Confirmadora Maria','maria@example.invalid','x','admin')", [confirmerId]);
    const id = await ready();
    const link = await createClientLink(database, id, { days: 30, requireIdentity: true }, userId, SECRET);
    const done = await approvePublicLink(database, link.token, { name: 'Ana Souza', role: 'Diretora', accept: true }, ctx);
    await database.query("UPDATE proposal_client_link_events SET occurred_at = '2026-09-01T12:30:00.000Z' WHERE kind = 'approved' AND link_id = $1", [link.id]);
    await confirmClientApproval(database, id, confirmerId, SECRET);

    const row = (await database.query<{ payload: { proposal: { approval: Record<string, unknown>; responsibleName: string } }; payload_sha256: string }>(
      'SELECT payload, payload_sha256 FROM proposal_approval_snapshots WHERE proposal_id = $1', [id])).rows[0];
    const approval = row.payload.proposal.approval;
    assert.equal(approval.approvedAt, '2026-09-01T12:30:00.000Z');
    assert.notEqual(approval.recordedAt, approval.approvedAt);
    assert.equal(approval.recordedBy, 'Confirmadora Maria');
    assert.equal(approval.confirmedBy, 'Confirmadora Maria');
    assert.deepEqual(approval.clientAcceptance, { acceptedAt: '2026-09-01T12:30:00.000Z', name: 'Ana Souza', role: 'Diretora', code: done.code });
    // O Centro recalcula o SHA-256 canonico do payload inteiro: precisa bater com o campo novo dentro.
    assert.equal(computeSha256(canonicalJsonStringify(row.payload)), row.payload_sha256);
    // Contrato real do Centro (somente leitura): roda quando CENTRO_CUSTOS_REPO aponta para o repositorio dele.
    if (process.env.CENTRO_CUSTOS_REPO) {
      const { createRequire } = await import('node:module');
      const centro = createRequire(`${process.env.CENTRO_CUSTOS_REPO}/`)('./services/budgets/budgetCanonical.js') as { validateProposalEnvelope: (envelope: unknown) => unknown };
      const envelope = (payload: unknown) => ({ schemaVersion: '1.0.0', payloadSha256: computeSha256(canonicalJsonStringify(payload)), payload });
      centro.validateProposalEnvelope(envelope(row.payload));
      const { clientAcceptance: _a, confirmedBy: _c, ...legacyApproval } = approval;
      void _a; void _c;
      centro.validateProposalEnvelope(envelope({ ...row.payload, proposal: { ...row.payload.proposal, approval: legacyApproval } }));
    }

    // Aprovacao manual (sem link): sem os campos de aceite do cliente, formato anterior preservado.
    const manual = await ready();
    await updateProposalStatus(database, manual, 'approved', userId);
    const m = (await database.query<{ payload: { proposal: { approval: Record<string, unknown> } }; payload_sha256: string }>(
      'SELECT payload, payload_sha256 FROM proposal_approval_snapshots WHERE proposal_id = $1', [manual])).rows[0];
    assert.equal('clientAcceptance' in m.payload.proposal.approval, false);
    assert.equal(computeSha256(canonicalJsonStringify(m.payload)), m.payload_sha256);
  });

  await context.test('pedir ajuste cria nova revisao em edicao e encerra o link', async () => {
    const id = await ready();
    const link = await createClientLink(database, id, { days: 30, requireIdentity: false }, userId, SECRET);
    await assert.rejects(adjustPublicLink(database, link.token, { message: 'ab' }, ctx), failsWith('LINK_MESSAGE_REQUIRED'));
    await adjustPublicLink(database, link.token, { message: 'Trocar o modelo das câmeras.' }, ctx);
    const state = (await openPublicLink(database, link.token, ctx)).state;
    assert.equal(state, 'adjust');
    const revisions = await database.query<{ revision: number; status: string }>('SELECT revision, status FROM proposals WHERE series_id = (SELECT series_id FROM proposals WHERE id = $1) ORDER BY revision', [id]);
    assert.deepEqual(revisions.rows.map((row) => row.revision), [0, 1]);
    assert.equal(revisions.rows[1].status, 'draft');
    assert.equal((await getClientLink(database, id, SECRET))?.response?.message, 'Trocar o modelo das câmeras.');
  });

  await context.test('desativado e vencido nao aceitam resposta; revisao nova torna o link substituido', async () => {
    const id = await ready();
    const link = await createClientLink(database, id, { days: 30, requireIdentity: false }, userId, SECRET);
    await disableClientLink(database, id, userId, SECRET);
    assert.equal((await openPublicLink(database, link.token, ctx)).state, 'disabled');
    await assert.rejects(approvePublicLink(database, link.token, { accept: true }, ctx), failsWith('LINK_NOT_ACTIVE'));
    await assert.rejects(publicDocumentHtml(database, link.token, SECRET), failsWith('LINK_CLOSED'));

    const id2 = await ready();
    const l2 = await createClientLink(database, id2, { days: 30, requireIdentity: false }, userId, SECRET);
    await database.query("UPDATE proposal_client_links SET expires_at = now() - interval '1 minute' WHERE id = $1", [l2.id]);
    assert.equal((await openPublicLink(database, l2.token, ctx)).state, 'expired');
    await assert.rejects(approvePublicLink(database, l2.token, { accept: true }, ctx), failsWith('LINK_NOT_ACTIVE'));

    const id3 = await ready();
    const l3 = await createClientLink(database, id3, { days: 30, requireIdentity: false }, userId, SECRET);
    await createRevisionFor(id3);
    assert.equal((await openPublicLink(database, l3.token, ctx)).state, 'superseded');
  });
});


test('modo local (sem banco online): gerar link responde 409 com mensagem clara', async context => {
  const { once } = await import('node:events');
  const express = (await import('express')).default;
  const { createProposalClientLinkRouter } = await import('../routes/proposalClientLink');
  const { database } = await createCriticalTestDatabase();
  const serve = async (available: boolean) => {
    const app = express();
    app.use(express.json());
    app.use((_req, res, next) => { res.locals.authUser = { id: 'u', name: 'U', email: 'u@x.com', role: 'admin' }; next(); });
    app.use('/api/proposals', createProposalClientLinkRouter(database, SECRET, 'https://x.example', available));
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    context.after(() => new Promise<void>(resolve => server.close(() => resolve())));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    return `http://127.0.0.1:${address.port}/api/proposals/11111111-2222-4333-8444-555555555555/client-link`;
  };
  context.after(() => database.close());
  const local = await fetch(await serve(false), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(local.status, 409);
  const body = await local.json() as { error: string; code: string };
  assert.equal(body.code, 'LINK_ONLINE_ONLY');
  assert.match(body.error, /só na versão online/);
  // Online o fluxo normal segue (proposta inexistente -> 404, nao 409 de modo local).
  const online = await fetch(await serve(true), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.notEqual(online.status, 409);
});
