import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { defaultSuiteMatrix } from '../../shared/suitePermissions';
import type { BodyBlock } from '../../shared/proposalBody';
import { createApp } from '../createApp';
import { proposalBodyBlocksMigration } from '../migrations/020-proposal-body-blocks';
import { forgetCachedSessions } from './auth';
import { contentFingerprint } from './clientLinkCommon';
import { createClientLink } from './clientLinks';
import { approvePublicLink, publicDocumentHtml } from './clientLinksPublic';
import { createCriticalTestDatabase } from './criticalTestDatabase';
import { cloneProposal, createProposalRevision, getProposalById, updateProposalStatus } from './proposals';
import { saveDefaultBody, updateProposalBody } from './proposalBody';

const SECRET = 'segredo-de-teste-com-mais-de-32-caracteres!!';
const body = (...extra: BodyBlock[]): BodyBlock[] => [
  ...extra, { id: 'itens', type: 'itens', enabled: true }, { id: 'cond', type: 'condicoes', enabled: true },
];
const paragraph = (id: string, text: string): BodyBlock => ({ id, type: 'paragrafo', text, enabled: true });

test('corpo da proposta: banco, revisao, clonagem, corpo padrao e aceite do cliente', async context => {
  const { database, userId, makeProposal, addMaterial } = await createCriticalTestDatabase();
  context.after(() => database.close());

  await context.test('migracao 020 e aditiva e idempotente; propostas antigas ficam sem corpo (NULL)', async () => {
    const id = await makeProposal();
    assert.equal((await getProposalById(database, id))?.bodyBlocks, null);
    await database.exec(proposalBodyBlocksMigration);
    await database.exec(proposalBodyBlocksMigration);
    const column = await database.query<{ data_type: string }>("SELECT data_type FROM information_schema.columns WHERE table_name='proposals' AND column_name='body_blocks'");
    assert.equal(column.rows[0].data_type, 'jsonb');
  });

  await context.test('gravar o corpo so em edicao: aprovada trava e NULL volta ao layout antigo', async () => {
    const id = await makeProposal();
    await addMaterial(id);
    await updateProposalBody(database, id, body(paragraph('a', 'primeiro')));
    assert.deepEqual((await getProposalById(database, id))?.bodyBlocks?.map((item) => item.id), ['a', 'itens', 'cond']);
    await updateProposalBody(database, id, null);
    assert.equal((await getProposalById(database, id))?.bodyBlocks, null);
    await updateProposalBody(database, id, body(paragraph('a', 'primeiro')));
    await updateProposalStatus(database, id, 'approved', userId);
    await assert.rejects(updateProposalBody(database, id, body()), /PROPOSAL_LOCKED/);
  });

  await context.test('nova revisao e clonagem copiam o corpo; revisao antiga fica travada', async () => {
    const id = await makeProposal();
    await addMaterial(id);
    await updateProposalBody(database, id, body(paragraph('a', 'texto da v0')));
    await updateProposalStatus(database, id, 'review', userId);
    const revisionId = await createProposalRevision(database, id, userId);
    assert.equal((await getProposalById(database, revisionId))?.bodyBlocks?.[0].text, 'texto da v0');
    await assert.rejects(updateProposalBody(database, id, body()), /PROPOSAL_LOCKED/);
    await updateProposalBody(database, revisionId, body(paragraph('a', 'texto da v1')));
    assert.equal((await getProposalById(database, id))?.bodyBlocks?.[0].text, 'texto da v0');
    const cloneId = await cloneProposal(database, revisionId);
    assert.equal((await getProposalById(database, cloneId))?.bodyBlocks?.[0].text, 'texto da v1');
    const plain = await makeProposal();
    assert.equal((await getProposalById(database, await cloneProposal(database, plain)))?.bodyBlocks, null);
  });

  await context.test('corpo padrao da empresa vale so para propostas novas e leva o escopo digitado', async () => {
    const before = await makeProposal();
    await saveDefaultBody(database, body(paragraph('padrao', 'Apresentacao da empresa')));
    const created = await getProposalById(database, await makeProposal());
    assert.deepEqual(created?.bodyBlocks?.map((item) => item.type), ['paragrafo', 'paragrafo', 'itens', 'condicoes']);
    assert.equal(created?.bodyBlocks?.[0].text, 'Apresentacao da empresa');
    assert.equal(created?.bodyBlocks?.[1].text, 'Escopo fictício');
    assert.notEqual(created?.bodyBlocks?.[0].id, 'padrao');
    assert.equal((await getProposalById(database, before))?.bodyBlocks, null);
    await saveDefaultBody(database, null);
    assert.equal((await getProposalById(database, await makeProposal()))?.bodyBlocks, null);
  });

  await context.test('aceite do cliente amarra ao texto do corpo, sem mudar o hash de quem nao tem corpo', async () => {
    const id = await makeProposal();
    await addMaterial(id, '10', '100', '150');
    const legacy = (await getProposalById(database, id))!;
    assert.equal(contentFingerprint(legacy).hash, contentFingerprint({ ...legacy, bodyBlocks: null }).hash);
    await updateProposalBody(database, id, body(paragraph('a', 'Garantia de 90 dias')));
    await updateProposalStatus(database, id, 'review', userId);
    const withBody = (await getProposalById(database, id))!;
    assert.notEqual(contentFingerprint(withBody).hash, contentFingerprint(legacy).hash);
    const link = await createClientLink(database, id, { days: 30, requireIdentity: false }, userId, SECRET);
    const html = await publicDocumentHtml(database, link.token, SECRET);
    assert.match(html, /Garantia de 90 dias/);
    const visible = html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/data:image\/png;base64,[A-Za-z0-9+/=]+/g, '');
    for (const leak of [/BDI/, /[Mm]argem/, /Custo/, /R\$\s100,00/]) assert.doesNotMatch(visible, leak, String(leak));
    await approvePublicLink(database, link.token, { accept: true }, { secret: SECRET, ip: '203.0.113.9', userAgent: 'Mozilla/5.0' });
    const seen = await database.query<{ content_hash: string }>("SELECT content_hash FROM proposal_client_link_events WHERE link_id=$1 AND kind='approved'", [link.id]);
    assert.equal(seen.rows[0].content_hash, contentFingerprint(withBody).hash);
  });

  await context.test('HTTP: validacao estrita, limites, texto sanitizado, permissoes e modelos', async () => {
    const centroUsers: Record<string, { id: string; name: string; email: string; role: string; active: boolean }> = {
      'tok-admin': { id: 'c-fixture', name: 'Teste', email: 'fixture@example.invalid', role: 'admin', active: true },
      'tok-viewer': { id: 'c-viewer', name: 'Leitor', email: 'reader@example.invalid', role: 'gestor', active: true },
    };
    const centro = createServer((incoming, outgoing) => {
      if (incoming.url === '/v1/permissions') {
        outgoing.writeHead(200, { 'Content-Type': 'application/json' });
        outgoing.end(JSON.stringify({ ok: true, matrix: defaultSuiteMatrix() }));
        return;
      }
      const user = centroUsers[String(incoming.headers.authorization || '').replace(/^Bearer /, '')];
      outgoing.writeHead(user ? 200 : 401, { 'Content-Type': 'application/json' });
      outgoing.end(JSON.stringify(user ? { user } : { error: 'Sessao invalida.' }));
    }).listen(0, '127.0.0.1');
    await new Promise<void>(resolve => centro.once('listening', resolve));
    const centroAddress = centro.address();
    assert.ok(centroAddress && typeof centroAddress !== 'string');
    const previous = process.env.CENTRO_CUSTOS_IDENTITY_URL;
    process.env.CENTRO_CUSTOS_IDENTITY_URL = `http://127.0.0.1:${centroAddress.port}`;
    forgetCachedSessions();
    const server = createApp(database, 'test-only-local-token').listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const call = (path: string, token: string, method: string, payload?: unknown) => fetch(`http://127.0.0.1:${address.port}/api${path}`, {
      method, headers: { 'Content-Type': 'application/json', 'X-Construtec-Session': token }, body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    try {
      await database.query("INSERT INTO users (id,name,email,password_hash,role) VALUES ($1,'Leitor','reader@example.invalid','x','viewer')", [randomUUID()]);
      const id = await makeProposal();
      const put = (blocks: unknown, token = 'tok-admin') => call(`/proposals/${id}/body`, token, 'PUT', { blocks });

      const ok = await put(body({ id: 'a', type: 'paragrafo', title: ' Titulo‮ ', text: 'Oi​ mundo\u0007', enabled: true }));
      assert.equal(ok.status, 200);
      const saved = (await ok.json()).proposal.bodyBlocks;
      assert.deepEqual(saved[0], { id: 'a', type: 'paragrafo', enabled: true, title: 'Titulo', text: 'Oi mundo' });

      assert.equal((await put([{ id: 'itens', type: 'itens', enabled: true, extra: 1 }, { id: 'c', type: 'condicoes', enabled: true }])).status, 400, 'campo desconhecido');
      assert.equal((await call(`/proposals/${id}/body`, 'tok-admin', 'PUT', { blocks: body(), outro: true })).status, 400, 'envelope estrito');
      assert.equal((await put([{ id: 'c', type: 'condicoes', enabled: true }])).status, 400, 'sem tabela de itens');
      assert.equal((await put(body({ id: 'x', type: 'imagem', enabled: true } as unknown as BodyBlock))).status, 400, 'tipo invalido');
      assert.equal((await put(body(paragraph('t', 'a'.repeat(5001))))).status, 400, 'texto acima de 5000');
      assert.equal((await put(body(paragraph('t', 'a'.repeat(5000))))).status, 200, 'texto de 5000 passa');
      assert.equal((await put([...Array.from({ length: 59 }, (_, i) => paragraph(`p${i}`, 'x')), ...body()])).status, 400, 'mais de 60 blocos');
      assert.equal((await put(body(paragraph('r', 'x'), paragraph('r', 'y')))).status, 400, 'id repetido');
      assert.equal((await call('/proposals/nao-e-uuid/body', 'tok-admin', 'PUT', { blocks: body() })).status, 400);

      assert.equal((await put(body(), 'tok-viewer')).status, 403, 'somente consulta nao grava');
      await updateProposalStatus(database, id, 'approved', userId);
      assert.equal((await put(body())).status, 409, 'aprovada trava');
      const revision = await createProposalRevision(database, id, userId);
      assert.equal((await call(`/proposals/${revision}/body`, 'tok-admin', 'PUT', { blocks: body(paragraph('n', 'nova revisao')) })).status, 200);
      assert.equal((await put(body())).status, 409, 'revisao antiga nao edita');

      const added = await call('/proposals/body-templates', 'tok-viewer', 'POST', { name: 'Meu modelo', type: 'lista', text: '- um\n- dois' });
      assert.equal(added.status, 403, 'viewer nao cria modelo');
      const created = await call('/proposals/body-templates', 'tok-admin', 'POST', { name: ' Meu modelo ', type: 'lista', text: '- um\n- dois' });
      assert.equal(created.status, 201);
      const { templates } = await created.json();
      assert.equal(templates.length, 7, 'sugeridos mais o novo');
      assert.equal(templates[6].name, 'Meu modelo');
      assert.equal((await call('/proposals/body-templates', 'tok-admin', 'POST', { name: 'x', type: 'titulo', text: 'y' })).status, 400);
      assert.equal((await call('/proposals/body-templates', 'tok-admin', 'POST', { name: '', type: 'lista', text: 'y' })).status, 400);
      assert.equal((await (await call('/proposals/body-templates', 'tok-viewer', 'GET')).json()).templates.length, 7);

      assert.equal((await call('/settings/default-body', 'tok-viewer', 'PUT', { blocks: body() })).status, 403, 'padrao da empresa e do administrador');
      assert.equal((await call('/settings/default-body', 'tok-admin', 'PUT', { blocks: body(paragraph('d', 'padrao')) })).status, 200);
      assert.equal((await (await call('/settings/default-body', 'tok-viewer', 'GET')).json()).blocks.length, 3);
      assert.equal((await call('/settings/default-body', 'tok-admin', 'PUT', { blocks: [paragraph('d', 'sem itens')] })).status, 400);
      assert.equal((await call('/settings/body-templates', 'tok-admin', 'PUT', { templates: [] })).status, 200);
      assert.equal((await (await call('/proposals/body-templates', 'tok-admin', 'GET')).json()).templates.length, 0);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      await new Promise<void>(resolve => centro.close(() => resolve()));
      if (previous === undefined) delete process.env.CENTRO_CUSTOS_IDENTITY_URL;
      else process.env.CENTRO_CUSTOS_IDENTITY_URL = previous;
      forgetCachedSessions();
    }
  });
});
