import { randomBytes, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import express from 'express';
import { z } from 'zod';
import { createDatabase } from '../src/server/services/database';
import { setupFirstAdmin } from '../src/server/services/auth';

const destination = 'https://construtec-orcamentos-cloud.construtec-reports.workers.dev/';
const successPage = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Cadastro concluído</title><h1>Administrador criado</h1><p>Entre com o e-mail e a senha que você acabou de definir.</p><a href="${destination}">Abrir Orçamentos e entrar</a></html>`;
const schema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(200),
  password: z.string().min(10).max(128), confirm: z.string() }).refine(v => v.password === v.confirm);

async function serve(submit: (input: z.infer<typeof schema>) => Promise<void>, selfTest = false) {
  const app = express();
  const csrf = randomBytes(32).toString('hex');
  let origin = '';
  let completed = false;
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'");
    if (req.headers.host !== new URL(origin).host) { res.sendStatus(403); return; }
    next();
  });
  app.get('/', (_req, res) => res.type('html').send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8">
    <title>Primeiro acesso Construtec</title><style>body{font:18px system-ui;max-width:480px;margin:60px auto;padding:20px}input,button{display:block;box-sizing:border-box;width:100%;padding:12px;margin:8px 0 20px}button{background:#075bea;color:white;border:0;border-radius:8px}</style>
    <h1>Administrador do Orçamentos</h1><p>Defina seu acesso à versão na nuvem. A senha será armazenada como hash no Neon.</p>
    <form method="post" action="/setup"><input type="hidden" name="csrf" value="${csrf}">
    <label>Nome completo<input name="name" required minlength="2" maxlength="120" autocomplete="name"></label>
    <label>E-mail<input name="email" type="email" required maxlength="200" autocomplete="username"></label>
    <label>Senha (mínimo 10 caracteres)<input name="password" type="password" required minlength="10" maxlength="128" autocomplete="new-password"></label>
    <label>Confirmar senha<input name="confirm" type="password" required autocomplete="new-password"></label>
    <button>Criar administrador</button></form></html>`));
  app.post('/setup', express.urlencoded({ extended: false, limit: '8kb' }), async (req, res) => {
    if (req.headers.origin !== origin || req.body?.csrf !== csrf) { res.sendStatus(403); return; }
    if (completed) { res.type('html').send(successPage); return; }
    const input = schema.safeParse(req.body);
    if (!input.success) { res.status(400).send('Confira os campos e a confirmação da senha. Volte para tentar novamente.'); return; }
    try {
      await submit(input.data);
      completed = true;
      res.type('html').send(successPage);
      console.log('ADMIN_CREATED');
      if (!selfTest) setTimeout(() => server.close(), 1000);
    } catch { res.status(409).send('Não foi possível criar o administrador. Verifique se já existe um acesso configurado.'); }
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('LOCAL_SETUP_FAILED');
  origin = `http://127.0.0.1:${address.port}`;
  if (selfTest) {
    const body = new URLSearchParams({ csrf, name: 'Teste', email: 'test@example.invalid', password: 'test-password-123', confirm: 'test-password-123' });
    assert.equal((await fetch(`${origin}/setup`, { method: 'POST', body })).status, 403);
    assert.equal((await fetch(`${origin}/setup`, { method: 'POST', body, headers: { Origin: origin } })).status, 200);
    assert.equal((await fetch(`${origin}/setup`, { method: 'POST', body, headers: { Origin: origin } })).status, 200);
    server.close();
    console.log('LOCAL_SETUP_TEST_OK');
  } else console.log(`LOCAL_SETUP_URL=${origin}`);
}

if (process.argv.includes('--self-test')) {
  void serve(async () => undefined, true);
} else {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL_REQUIRED');
  void serve(async input => {
    const database = await createDatabase('unused-cloud');
    try { await setupFirstAdmin(database, randomUUID(), input); }
    finally { await database.close(); }
  });
}
