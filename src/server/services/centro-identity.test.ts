import assert from 'node:assert/strict';
import { createServer, type IncomingMessage } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { initialMigration } from '../migrations/001-initial';
import { sharedIdentityMigration } from '../migrations/012-shared-identity';
import { createApp } from '../createApp';
import { createCriticalTestDatabase } from './criticalTestDatabase';
import { consumeHandoff, expireSessionCacheForTests as forgetSessionCacheOnlyForTest, forgetCachedSessions, loginUser, verifyUserSession } from './auth';
import { createUser, deleteUser, listUsers, updateUser } from './users';

type StubUser = { id: string; name: string; email: string; role: 'admin' | 'gestor' | 'supervisor'; active: boolean; password: string };

const SERVICE_KEY = 'k'.repeat(40);

// Centro de Custos de mentira: mesmos contratos /v1 do diretorio central.
const startStubCentro = async () => {
  const users: StubUser[] = [
    { id: 'c-admin', name: 'Admin Centro', email: 'admin@rcconstrutec.com.br', role: 'admin', active: true, password: 'senha-adm1' },
    { id: 'c-gestor', name: 'Gestor', email: 'gestor@rcconstrutec.com.br', role: 'gestor', active: true, password: 'senha-ges1' },
    { id: 'c-legado', name: 'Legado', email: 'legado@rcconstrutec.com.br', role: 'supervisor', active: true, password: 'senha-leg1' },
  ];
  const sessions = new Map<string, string>();
  const handoffs = new Map<string, string>();
  let created = 0;
  const seen: { path: string; serviceKey: string | undefined; clientIp: string | undefined }[] = [];
  const publicUser = ({ password: _password, ...user }: StubUser) => { void _password; return user; };
  const read = async (request: IncomingMessage) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk as Buffer);
    return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
  };
  const server = createServer(async (request, response) => {
    const send = (status: number, body: unknown) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(body)); };
    const path = request.url || '';
    seen.push({ path, serviceKey: request.headers['x-construtec-identity-key'] as string | undefined, clientIp: request.headers['x-construtec-client-ip'] as string | undefined });
    const token = String(request.headers.authorization || '').replace(/^Bearer /, '');
    const actor = users.find(user => user.id === sessions.get(token) && user.active);
    const body = await read(request);
    if (path === '/v1/auth/login') {
      const user = users.find(item => item.email === body.email && item.password === body.password && item.active);
      if (!user) return send(401, { error: 'E-mail ou senha invalidos.' });
      const sessionToken = `tok-${user.id}-${sessions.size}`;
      sessions.set(sessionToken, user.id);
      return send(200, { sessionToken, expiresAt: 0, user: publicUser(user) });
    }
    if (path === '/v1/auth/handoff/consume') {
      if (request.headers['x-construtec-identity-key'] !== SERVICE_KEY) return send(403, { code: 'FORBIDDEN', error: 'Sem permissao.' });
      const userId = body.target === 'orcamentos' ? handoffs.get(body.code) : undefined;
      const user = users.find(item => item.id === userId && item.active);
      if (!user) return send(400, { code: 'HANDOFF_INVALID', error: 'Codigo invalido ou expirado.' });
      handoffs.delete(body.code);
      const sessionToken = `tok-handoff-${user.id}-${sessions.size}`;
      sessions.set(sessionToken, user.id);
      return send(200, { ok: true, sessionToken, expiresAt: 0, user: publicUser(user) });
    }
    if (!actor) return send(401, { error: 'Sessao invalida ou expirada.' });
    if (path === '/v1/auth/session') return send(200, { user: publicUser(actor) });
    // Central de notificacoes (Fase 4): so a sessao do usuario, sem chave de servico.
    if (path.startsWith('/v1/notifications')) {
      if (path === '/v1/notifications?limit=7') return send(401, { error: 'Sessao invalida.' });
      const items = [{ id: '00000000-0000-4000-8000-000000000001', type: 'proposta_aprovada', app: 'orcamentos', title: 'Proposta aprovada', body: 'PA-1', link: 'orcamentos?proposta=x', createdAt: '2026-09-28T10:00:00Z', read: path === '/v1/notifications/read' }];
      if (path.startsWith('/v1/notifications?')) return send(200, { ok: true, unread: 1, items, user: actor.id });
      if (path === '/v1/notifications/read') return send(200, { ok: true, unread: 0, items, body });
      if (path === '/v1/notifications/prefs') return send(200, { ok: true, prefs: { proposta_aprovada: request.method === 'PUT' ? body.enabled : true } });
      return send(404, { error: 'Rota nao encontrada.' });
    }
    if (request.headers['x-construtec-identity-key'] !== SERVICE_KEY) return send(403, { error: 'Sem permissao.' });
    if (path === '/v1/users' && request.method === 'GET') return send(200, { users: users.map(publicUser) });
    if (path === '/v1/users' && request.method === 'POST') {
      const user: StubUser = { id: `c-${++created}`, name: body.name, email: body.email, role: 'supervisor', active: true, password: body.password };
      users.push(user);
      return send(201, { user: publicUser(user) });
    }
    if (path === '/v1/users/delete') {
      const index = users.findIndex(user => user.email === body.email && (!body.id || user.id === body.id));
      if (index < 0) return send(404, { error: 'Usuario nao encontrado.' });
      users.splice(index, 1);
      for (const [key, id] of sessions) if (id === body.id) sessions.delete(key);
      return send(200, { ok: true });
    }
    if (path === '/v1/users/status') {
      const user = users.find(item => item.email === body.email);
      if (!user) return send(404, { error: 'Usuario nao encontrado.' });
      user.active = body.active;
      return send(200, { ok: true });
    }
    return send(404, { error: 'Rota nao encontrada.' });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return { url: `http://127.0.0.1:${address.port}`, users, seen, handoffs, close: () => new Promise<void>(resolve => server.close(() => resolve())) };
};

test('identidade delegada ao Centro de Custos', async context => {
  const stub = await startStubCentro();
  const fixture = await createCriticalTestDatabase();
  const saved = { url: process.env.CENTRO_CUSTOS_IDENTITY_URL, key: process.env.CONSTRUTEC_IDENTITY_KEY };
  process.env.CENTRO_CUSTOS_IDENTITY_URL = stub.url;
  process.env.CONSTRUTEC_IDENTITY_KEY = SERVICE_KEY;
  context.after(async () => {
    if (saved.url === undefined) delete process.env.CENTRO_CUSTOS_IDENTITY_URL; else process.env.CENTRO_CUSTOS_IDENTITY_URL = saved.url;
    if (saved.key === undefined) delete process.env.CONSTRUTEC_IDENTITY_KEY; else process.env.CONSTRUTEC_IDENTITY_KEY = saved.key;
    forgetCachedSessions();
    await fixture.database.close();
    await stub.close();
  });
  const { database } = fixture;
  const stubUser = (id: string) => {
    const user = stub.users.find(item => item.id === id);
    assert.ok(user);
    return user;
  };

  await context.test('admin do Centro entra como admin; demais como viewer', async () => {
    const admin = await loginUser(database, 'admin@rcconstrutec.com.br', 'senha-adm1', '198.51.100.7');
    assert.equal(admin.user.role, 'admin');
    const login = stub.seen.find(entry => entry.path === '/v1/auth/login');
    assert.equal(login?.clientIp, '198.51.100.7');
    assert.equal(login?.serviceKey, SERVICE_KEY);
    const gestor = await loginUser(database, 'gestor@rcconstrutec.com.br', 'senha-ges1');
    assert.equal(gestor.user.role, 'viewer');
    // Sem IP o login ainda se identifica pela chave de servico (o Centro nao o confunde com o login do proprio Centro).
    const semIp = stub.seen.filter(entry => entry.path === '/v1/auth/login').at(-1);
    assert.equal(semIp?.serviceKey, SERVICE_KEY);
    assert.equal(semIp?.clientIp, undefined);
    await assert.rejects(loginUser(database, 'gestor@rcconstrutec.com.br', 'errada-123456'), /AUTH_INVALID_CREDENTIALS/);
  });

  await context.test('linha local antiga nao transfere papel de admin', async () => {
    await database.query("INSERT INTO users (id,name,email,password_hash,role,active) VALUES (gen_random_uuid(),'Legado','legado@rcconstrutec.com.br','x','admin',true)");
    const legado = await loginUser(database, 'legado@rcconstrutec.com.br', 'senha-leg1');
    assert.equal(legado.user.role, 'viewer');
  });

  await context.test('senha local antiga nunca autentica', async () => {
    const row = (await database.query<{ password_hash: string | null; active: boolean }>(
      "SELECT password_hash, active FROM users WHERE email = 'fixture@example.invalid'",
    )).rows[0];
    assert.equal(row.active, true);
    await assert.rejects(loginUser(database, 'fixture@example.invalid', 'not-a-password'), /AUTH_INVALID_CREDENTIALS/);
  });

  await context.test('sessao revalidada e conta excluida perde o acesso', async () => {
    const admin = await loginUser(database, 'admin@rcconstrutec.com.br', 'senha-adm1');
    const created = await createUser(database, admin.token, { name: 'Vendedor', email: 'vendedor@rcconstrutec.com.br', password: 'senha-vd1', role: 'commercial' });
    assert.equal(created.role, 'commercial');
    const vendedor = await loginUser(database, 'vendedor@rcconstrutec.com.br', 'senha-vd1');
    assert.equal(vendedor.user.role, 'commercial');
    assert.ok(stub.seen.filter(entry => entry.path === '/v1/users').every(entry => entry.serviceKey === SERVICE_KEY));

    await deleteUser(database, admin.token, admin.user.id, created.id);
    forgetCachedSessions();
    assert.equal(await verifyUserSession(database, vendedor.token), null);
    const listed = await listUsers(database, admin.token);
    assert.equal(listed.some(user => user.email === 'vendedor@rcconstrutec.com.br'), false);

    const again = await createUser(database, admin.token, { name: 'Vendedor 2', email: 'vendedor@rcconstrutec.com.br', password: 'senha-vd2', role: 'viewer' });
    assert.notEqual(again.id, created.id);
    const rows = (await database.query<{ deleted_at: string | null }>("SELECT deleted_at FROM users WHERE email = 'vendedor@rcconstrutec.com.br'")).rows;
    assert.equal(rows.length, 2);
    assert.equal(rows.filter(row => row.deleted_at).length, 1);
  });

  await context.test('desativar nao exclui: conta segue listada e pode ser reativada', async () => {
    const admin = await loginUser(database, 'admin@rcconstrutec.com.br', 'senha-adm1');
    const target = (await listUsers(database, admin.token)).find(user => user.email === 'gestor@rcconstrutec.com.br');
    assert.ok(target);
    await updateUser(database, admin.token, admin.user.id, target.id, { role: 'commercial', active: false });
    const after = (await listUsers(database, admin.token)).find(user => user.email === 'gestor@rcconstrutec.com.br');
    assert.equal(after?.id, target.id);
    assert.equal(after?.active, false);
    await updateUser(database, admin.token, admin.user.id, target.id, { role: 'commercial', active: true });
    const back = (await listUsers(database, admin.token)).find(user => user.email === 'gestor@rcconstrutec.com.br');
    assert.equal(back?.id, target.id);
    assert.equal(back?.role, 'commercial');
  });

  await context.test('quem deixa de ser admin no Centro volta ao papel escolhido aqui', async () => {
    const admin = await loginUser(database, 'admin@rcconstrutec.com.br', 'senha-adm1');
    stub.users.push({ id: 'c-promo', name: 'Promovido', email: 'promo@rcconstrutec.com.br', role: 'supervisor', active: true, password: 'senha-pro1' });
    const promo = await loginUser(database, 'promo@rcconstrutec.com.br', 'senha-pro1');
    assert.equal(promo.user.role, 'viewer');
    await updateUser(database, admin.token, admin.user.id, promo.user.id, { role: 'commercial', active: true });

    stubUser('c-promo').role = 'admin';
    forgetSessionCacheOnlyForTest();
    assert.equal((await verifyUserSession(database, promo.token))?.role, 'admin');
    await assert.rejects(updateUser(database, admin.token, admin.user.id, promo.user.id, { role: 'viewer', active: true }), /USER_ROLE_FROM_CENTRO/);
    // Salvar com o papel admin (ex.: so mudar "Ativo") nao grava admin como papel local.
    await updateUser(database, admin.token, admin.user.id, promo.user.id, { role: 'admin', active: true });

    stubUser('c-promo').role = 'gestor';
    forgetSessionCacheOnlyForTest();
    assert.equal((await verifyUserSession(database, promo.token))?.role, 'commercial');
  });

  await context.test('e-mail trocado no Centro para o de uma linha antiga', async () => {
    await database.query("INSERT INTO users (id,name,email,password_hash,role,active) VALUES (gen_random_uuid(),'Antigo','novo.email@rcconstrutec.com.br',NULL,'viewer',false)");
    stub.users.push({ id: 'c-troca', name: 'Troca', email: 'troca@rcconstrutec.com.br', role: 'supervisor', active: true, password: 'senha-tro1' });
    const troca = await loginUser(database, 'troca@rcconstrutec.com.br', 'senha-tro1');
    stubUser('c-troca').email = 'novo.email@rcconstrutec.com.br';
    forgetSessionCacheOnlyForTest();
    const user = await verifyUserSession(database, troca.token);
    assert.equal(user?.email, 'novo.email@rcconstrutec.com.br');
    assert.equal(user?.id, troca.user.id);
    const live = (await database.query("SELECT id FROM users WHERE email = 'novo.email@rcconstrutec.com.br' AND deleted_at IS NULL")).rows;
    assert.equal(live.length, 1);
  });

  await context.test('codigo do app vira sessao uma unica vez', async () => {
    const code = 'a'.repeat(43);
    stub.handoffs.set(code, 'c-gestor');
    const session = await consumeHandoff(database, code);
    assert.equal(session.user.email, 'gestor@rcconstrutec.com.br');
    const seenConsume = stub.seen.find(entry => entry.path === '/v1/auth/handoff/consume');
    assert.equal(seenConsume?.serviceKey, SERVICE_KEY);
    forgetSessionCacheOnlyForTest();
    assert.equal((await verifyUserSession(database, session.token))?.email, 'gestor@rcconstrutec.com.br');
    await assert.rejects(consumeHandoff(database, code), /AUTH_HANDOFF_INVALID/);
  });

  await context.test('desktop sem internet aceita sessao ja confirmada; nuvem nao', async () => {
    const gestor = await loginUser(database, 'gestor@rcconstrutec.com.br', 'senha-ges1');
    const savedUrl = process.env.CENTRO_CUSTOS_IDENTITY_URL;
    process.env.CENTRO_CUSTOS_IDENTITY_URL = 'http://127.0.0.1:9';
    const savedDb = process.env.DATABASE_URL;
    try {
      delete process.env.DATABASE_URL;
      await new Promise(resolve => setTimeout(resolve, 5));
      forgetSessionCacheOnlyForTest();
      assert.equal((await verifyUserSession(database, gestor.token))?.email, 'gestor@rcconstrutec.com.br');
      process.env.DATABASE_URL = 'postgres://nuvem';
      forgetSessionCacheOnlyForTest();
      await assert.rejects(verifyUserSession(database, gestor.token), /conectar/);
    } finally {
      process.env.CENTRO_CUSTOS_IDENTITY_URL = savedUrl;
      if (savedDb === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = savedDb;
    }
  });

  await context.test('admin nao remove o proprio acesso', async () => {
    const admin = await loginUser(database, 'admin@rcconstrutec.com.br', 'senha-adm1');
    await assert.rejects(updateUser(database, admin.token, admin.user.id, admin.user.id, { role: 'viewer', active: true }), /USER_SELF_LOCKOUT/);
    await assert.rejects(deleteUser(database, admin.token, admin.user.id, admin.user.id), /USER_SELF_LOCKOUT/);
  });
});

test('avisos do celular repassam a sessao central', async context => {
  const stub = await startStubCentro();
  const fixture = await createCriticalTestDatabase();
  const saved = process.env.CENTRO_CUSTOS_IDENTITY_URL;
  process.env.CENTRO_CUSTOS_IDENTITY_URL = stub.url;
  const server = createApp(fixture.database, 'local-token').listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(async () => {
    if (saved === undefined) delete process.env.CENTRO_CUSTOS_IDENTITY_URL; else process.env.CENTRO_CUSTOS_IDENTITY_URL = saved;
    forgetCachedSessions();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await fixture.database.close();
    await stub.close();
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  const gestor = await loginUser(fixture.database, 'gestor@rcconstrutec.com.br', 'senha-ges1');
  assert.equal(gestor.user.role, 'viewer');
  const call = (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, { ...init, headers: { 'Content-Type': 'application/json', 'X-Construtec-Session': gestor.token } });

  const list = await call('/notifications?limit=5');
  assert.equal(list.status, 200);
  const data = await list.json() as { unread: number; items: unknown[]; user: string };
  assert.equal(data.unread, 1);
  assert.equal(data.user, 'c-gestor');
  // Consulta (viewer) tambem marca como lida: o aviso e da conta.
  const read = await call('/notifications/read', { method: 'POST', body: JSON.stringify({ ids: ['00000000-0000-4000-8000-000000000001'] }) });
  assert.equal(read.status, 200);
  assert.deepEqual(((await read.json()) as { body: unknown }).body, { ids: ['00000000-0000-4000-8000-000000000001'] });
  assert.equal((await call('/notifications/read', { method: 'POST', body: JSON.stringify({ ids: ['nao-e-uuid'] }) })).status, 400);
  const pref = await call('/notifications/prefs', { method: 'PUT', body: JSON.stringify({ type: 'proposta_aprovada', enabled: false }) });
  assert.equal(((await pref.json()) as { prefs: Record<string, boolean> }).prefs.proposta_aprovada, false);
  // 401 do Centro nesta rota nao pode deslogar o celular.
  assert.equal((await call('/notifications?limit=7')).status, 503);
});

test('migracao 012 sobre dados existentes', async context => {
  const database = new PGlite();
  context.after(() => database.close());
  await database.exec(initialMigration);
  await database.query("INSERT INTO users (id,name,email,password_hash,role) VALUES ('00000000-0000-4000-8000-000000000001','Antigo','antigo@example.invalid','hash-antigo','admin')");
  await database.exec(sharedIdentityMigration);
  await database.exec(sharedIdentityMigration);
  const legacy = (await database.query<{ password_hash: string | null; active: boolean }>('SELECT password_hash, active FROM users')).rows[0];
  assert.equal(legacy.password_hash, null);
  assert.equal(legacy.active, false);
  await assert.rejects(database.query("INSERT INTO users (id,name,email,role) VALUES (gen_random_uuid(),'Dup','antigo@example.invalid','viewer')"));
  await database.query("UPDATE users SET deleted_at = now() WHERE email = 'antigo@example.invalid'");
  await database.query("INSERT INTO users (id,name,email,role,centro_user_id) VALUES (gen_random_uuid(),'Novo','antigo@example.invalid','viewer','c-1')");
  assert.equal((await database.query('SELECT id FROM users')).rows.length, 2);
});
