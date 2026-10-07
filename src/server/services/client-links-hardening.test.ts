import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { test } from 'node:test';
import express from 'express';
import { createPublicClientLinkRouter } from '../routes/publicClientLink';
import { createCriticalTestDatabase } from './criticalTestDatabase';
import { ClientLinkError, cleanPublicText } from './clientLinkCommon';
import { confirmClientApproval, createClientLink, getClientLink } from './clientLinks';
import { adjustPublicLink, approvePublicLink, openPublicLink, publicDocumentHtml } from './clientLinksPublic';
import { deleteProposal, getProposalById, updateProposalStatus } from './proposals';
import { fetchExsatBody } from './exsatFetch';

const SECRET = 'segredo-de-teste-com-mais-de-32-caracteres!!';
const ctx = { secret: SECRET, ip: '203.0.113.9', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17) Safari/604.1' };
const failsWith = (code: string) => (error: unknown) => error instanceof ClientLinkError && error.code === code;

test('link do cliente: endurecimento da revisao de seguranca', async context => {
  const { database, userId, makeProposal, addMaterial, addLabor } = await createCriticalTestDatabase();
  context.after(() => database.close());
  const ready = async () => {
    const id = await makeProposal();
    await addMaterial(id, '10', '100', '150');
    await updateProposalStatus(database, id, 'review', userId);
    return id;
  };
  const newLink = async (id: string, requireIdentity = false) => createClientLink(database, id, { days: 30, requireIdentity }, userId, SECRET);

  await context.test('excluir proposta que teve link nao falha por chave estrangeira', async () => {
    const id = await ready();
    const link = await newLink(id);
    await openPublicLink(database, link.token, ctx);
    await deleteProposal(database, id, 'all');
    assert.equal((await database.query('SELECT 1 FROM proposal_client_links WHERE id = $1', [link.id])).rows.length, 0);
    assert.equal((await database.query('SELECT 1 FROM proposal_client_link_events WHERE link_id = $1', [link.id])).rows.length, 0);
  });

  await context.test('link fechado devolve so numero e empresa; aprovado vale 30 dias', async () => {
    const id = await ready();
    const link = await newLink(id);
    await database.query("UPDATE proposal_client_links SET expires_at = now() - interval '1 minute' WHERE id = $1", [link.id]);
    const expired = await openPublicLink(database, link.token, ctx);
    assert.equal(expired.state, 'expired');
    assert.deepEqual(Object.keys(expired).sort(), ['company', 'proposal', 'state']);
    assert.deepEqual(Object.keys(expired.proposal), ['number']);
    await assert.rejects(publicDocumentHtml(database, link.token, SECRET), failsWith('LINK_CLOSED'));

    const id2 = await ready();
    const l2 = await newLink(id2);
    await approvePublicLink(database, l2.token, { accept: true }, ctx);
    assert.equal((await openPublicLink(database, l2.token, ctx)).proposal.total, 1250);
    assert.match(await publicDocumentHtml(database, l2.token, SECRET), /<html/i);
    await database.query("UPDATE proposal_client_links SET closed_at = now() - interval '31 days' WHERE id = $1", [l2.id]);
    const old = await openPublicLink(database, l2.token, ctx);
    assert.equal(old.state, 'approved');
    assert.deepEqual(Object.keys(old.proposal), ['number']);
    await assert.rejects(publicDocumentHtml(database, l2.token, SECRET), failsWith('LINK_CLOSED'));
  });

  await context.test('confirmar recusa se valor ou itens mudaram depois do aceite', async () => {
    const id = await ready();
    const link = await newLink(id);
    await approvePublicLink(database, link.token, { accept: true }, ctx);
    const event = (await database.query<{ final_value: string; content_hash: string }>("SELECT final_value::text, content_hash FROM proposal_client_link_events WHERE link_id = $1 AND kind = 'approved'", [link.id])).rows[0];
    assert.equal(Number(event.final_value), 1250);
    assert.match(event.content_hash, /^[0-9a-f]{64}$/);
    await database.query('UPDATE proposal_items SET quantity = 11 WHERE proposal_id = $1', [id]);
    await assert.rejects(confirmClientApproval(database, id, userId, SECRET), failsWith('LINK_CONTENT_CHANGED'));
    await database.query('UPDATE proposal_items SET quantity = 10 WHERE proposal_id = $1', [id]);
    assert.equal((await confirmClientApproval(database, id, userId, SECRET)).proposal.status, 'approved');
  });

  await context.test('so responde com a proposta em revisao ou enviada', async () => {
    const id = await ready();
    const link = await newLink(id);
    await database.query("UPDATE proposals SET status = 'rejected' WHERE id = $1", [id]);
    await assert.rejects(approvePublicLink(database, link.token, { accept: true }, ctx), failsWith('LINK_NOT_ACTIVE'));
    await assert.rejects(adjustPublicLink(database, link.token, { message: 'ajustar algo' }, ctx), failsWith('LINK_NOT_ACTIVE'));
    await database.query("UPDATE proposals SET status = 'draft' WHERE id = $1", [id]);
    await assert.rejects(approvePublicLink(database, link.token, { accept: true }, ctx), failsWith('LINK_NOT_ACTIVE'));
  });

  await context.test('pedido de ajuste e transacional: falha na revisao nao fecha o link', async () => {
    const id = await ready();
    await addLabor(id);
    const link = await newLink(id);
    await database.exec(`
      CREATE FUNCTION fail_labor_copy() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'TEST_LABOR_COPY_FAILURE'; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER test_labor_failure BEFORE INSERT ON proposal_labor_items FOR EACH ROW EXECUTE FUNCTION fail_labor_copy();`);
    try {
      await assert.rejects(adjustPublicLink(database, link.token, { message: 'Trocar o modelo.' }, ctx), /TEST_LABOR_COPY_FAILURE/);
    } finally {
      await database.exec('DROP TRIGGER test_labor_failure ON proposal_labor_items; DROP FUNCTION fail_labor_copy();');
    }
    assert.equal((await getClientLink(database, id, SECRET))?.state, 'active');
    assert.equal((await database.query("SELECT 1 FROM proposal_client_link_events WHERE link_id = $1 AND kind = 'adjust'", [link.id])).rows.length, 0);
    await adjustPublicLink(database, link.token, { message: 'Trocar o modelo.' }, ctx);
    assert.equal((await getClientLink(database, id, SECRET))?.state, 'adjust');
  });

  await context.test('um unico link ativo por proposta, mesmo com geracao simultanea; vencido libera a vaga', async () => {
    const id = await ready();
    const [a, b] = await Promise.all([newLink(id), newLink(id)]);
    assert.equal(a.id, b.id);
    assert.equal((await database.query("SELECT 1 FROM proposal_client_links WHERE proposal_id = $1 AND status = 'active'", [id])).rows.length, 1);
    await database.query("UPDATE proposal_client_links SET expires_at = now() - interval '1 minute' WHERE id = $1", [a.id]);
    const fresh = await newLink(id);
    assert.notEqual(fresh.id, a.id);
    assert.equal(fresh.state, 'active');
  });

  await context.test('abertura repetida da mesma origem em 10 min conta uma vez', async () => {
    const id = await ready();
    const link = await newLink(id);
    await openPublicLink(database, link.token, ctx);
    await openPublicLink(database, link.token, ctx);
    await openPublicLink(database, link.token, { ...ctx, ip: '198.51.100.7' });
    assert.equal((await getClientLink(database, id, SECRET))?.views.length, 2);
  });

  await context.test('entrada publica: campos extras sao recusados e caracteres invisiveis saem do texto', async () => {
    const id = await ready();
    const link = await newLink(id, true);
    await assert.rejects(approvePublicLink(database, link.token, { name: 'Ana Souza', role: 'Diretora', accept: true, extra: 1 }, ctx), failsWith('LINK_BAD_INPUT'));
    await assert.rejects(approvePublicLink(database, link.token, { name: { a: 1 }, role: 'Diretora', accept: true }, ctx), failsWith('LINK_BAD_INPUT'));
    await approvePublicLink(database, link.token, { name: 'Ana‮ Souza​', role: 'Dire\u0000tora', accept: true }, ctx);
    const reply = (await getClientLink(database, id, SECRET))?.response;
    assert.equal(reply?.name, 'Ana Souza');
    assert.equal(reply?.role, 'Diretora');
    assert.equal(cleanPublicText('a‮b\nc', 50, true), 'ab\nc');
    assert.equal(cleanPublicText('a‮b\nc', 50, false), 'abc');
  });

  await context.test('rota publica: token em cabecalho, CSP no documento, sem confiar em X-Forwarded-For', async () => {
    const id = await ready();
    const link = await newLink(id);
    const app = express();
    app.use('/api/public/c', express.json(), createPublicClientLinkRouter(database, SECRET));
    const server = createServer(app);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}/api/public/c`;
    try {
      const header = { 'X-Link-Token': link.token };
      const viewed = await fetch(base, { headers: header });
      assert.equal(viewed.status, 200);
      assert.equal(((await viewed.json()) as { state: string }).state, 'active');
      assert.equal((await fetch(base)).status, 404, 'sem cabecalho nao ha token');
      const legacy = await fetch(`${base}/${link.token}`);
      assert.equal(legacy.status, 200, 'rota antiga continua');
      const doc = await fetch(`${base}/document`, { headers: header });
      assert.equal(doc.headers.get('content-security-policy'), "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:");
      assert.equal(doc.headers.get('x-content-type-options'), 'nosniff');
      // X-Forwarded-For forjado nao muda o balde: todos sem cf-connecting-ip dividem o mesmo.
      const hashes = async () => (await database.query<{ n: string }>("SELECT COUNT(DISTINCT ip_hash)::text AS n FROM proposal_client_link_events WHERE kind = 'opened' AND link_id = $1", [link.id])).rows[0].n;
      await fetch(base, { headers: { ...header, 'X-Forwarded-For': '1.1.1.1' } });
      await fetch(base, { headers: { ...header, 'X-Forwarded-For': '2.2.2.2' } });
      assert.equal(await hashes(), '1');
      await fetch(base, { headers: { ...header, 'CF-Connecting-IP': '9.9.9.9' } });
      assert.equal(await hashes(), '2');
      const bad = await fetch(`${base}/approve`, { method: 'POST', headers: { ...header, 'Content-Type': 'application/json' }, body: JSON.stringify({ accept: true, x: 1 }) });
      assert.equal(bad.status, 400);
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });

  await context.test('estaticos: /c/ nao pode ser embutida em outro site', () => {
    const headers = readFileSync(path.join(process.cwd(), 'public', '_headers'), 'utf8');
    assert.match(headers, /\/c\/\*\s+Content-Security-Policy: frame-ancestors 'self'/);
  });

  assert.ok(await getProposalById(database, await ready()));
});

test('EXSAT: redirecionamento manual so para o proprio dominio e corpo com limite', async () => {
  const reply = (status: number, body: string, headers: Record<string, string> = {}) => new Response(body, { status, headers });
  const ok = await fetchExsatBody('https://www.exsat.com.br/a', async url => url.pathname === '/a' ? reply(302, '', { location: '/b' }) : reply(200, 'oi'));
  assert.equal(ok.body.toString(), 'oi');
  assert.equal(ok.finalUrl, 'https://www.exsat.com.br/b');
  await assert.rejects(fetchExsatBody('https://www.exsat.com.br/a', async () => reply(302, '', { location: 'https://evil.example/x' })), /EXSAT_URL_INVALID/);
  await assert.rejects(fetchExsatBody('https://www.exsat.com.br/a', async () => reply(302, '', { location: 'http://www.exsat.com.br/x' })), /EXSAT_URL_INVALID/);
  await assert.rejects(fetchExsatBody('https://www.exsat.com.br/a', async () => reply(302, '', { location: '/a' })), /EXSAT_TOO_MANY_REDIRECTS/);
  await assert.rejects(fetchExsatBody('https://www.exsat.com.br/a', async () => reply(200, 'x'.repeat(100)), 50), /EXSAT_RESPONSE_TOO_LARGE/);
});
