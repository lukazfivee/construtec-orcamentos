import { Router } from 'express';
import { z } from 'zod';
import type { LocalDatabase } from '../services/database';
import { getAuthSetupStatus, loginUser, logoutUser, verifyUserSession } from '../services/auth';

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
  rememberMe: z.boolean().optional(),
});

const sessionToken = (request: { headers: Record<string, unknown> }) => {
  const value = request.headers['x-construtec-session'];
  return typeof value === 'string' ? value : '';
};

// IP real do usuario (repassado pela borda da Cloudflare) para o limite de
// tentativas de login do diretorio central nao ser compartilhado por todos.
const clientIp = (request: { headers: Record<string, unknown>; ip?: string }) => {
  if (!process.env.DATABASE_URL) return undefined;
  const value = request.headers['cf-connecting-ip'];
  return typeof value === 'string' && value ? value : undefined;
};

export const createAuthRouter = (database: LocalDatabase) => {
  const router = Router();

  router.get('/setup-status', async (_request, response, next) => {
    try {
      response.json(await getAuthSetupStatus());
    } catch (error) { next(error); }
  });

  // O primeiro acesso agora e uma conta do Centro de Custos.
  router.post('/setup', (_request, response) => {
    response.status(410).json({ error: 'Entre com uma conta do Centro de Custos ou peça a um administrador para criar a sua.' });
  });

  router.post('/login', async (request, response, next) => {
    try {
      const input = credentialsSchema.parse(request.body);
      response.json(await loginUser(database, input.email, input.password, clientIp(request)));
    } catch (error) { next(error); }
  });

  router.post('/logout', async (request, response, next) => {
    try {
      await logoutUser(sessionToken(request));
      response.json({ success: true });
    } catch (error) { next(error); }
  });

  router.get('/me', async (request, response, next) => {
    try {
      const user = await verifyUserSession(database, sessionToken(request));
      if (!user) {
        response.status(401).json({ error: 'Sessão de usuário inválida ou expirada.' });
        return;
      }
      response.json({ user });
    } catch (error) { next(error); }
  });

  return router;
};
