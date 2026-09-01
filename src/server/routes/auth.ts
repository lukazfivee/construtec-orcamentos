import { Router } from 'express';
import { z } from 'zod';
import type { LocalDatabase } from '../services/database';
import { getAuthSetupStatus, loginUser, setupFirstAdmin, verifyUserSession } from '../services/auth';

const credentialsSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(10).max(128),
});

const setupSchema = credentialsSchema.extend({
  name: z.string().trim().min(2).max(120),
});

const sessionToken = (request: { headers: Record<string, unknown> }) => {
  const value = request.headers['x-construtec-session'];
  return typeof value === 'string' ? value : '';
};

export const createAuthRouter = (database: LocalDatabase, sessionSecret: string) => {
  const router = Router();

  router.get('/setup-status', async (_request, response, next) => {
    try {
      response.json(await getAuthSetupStatus(database));
    } catch (error) { next(error); }
  });

  router.post('/setup', async (request, response, next) => {
    try {
      const input = setupSchema.parse(request.body);
      response.status(201).json(await setupFirstAdmin(database, sessionSecret, input));
    } catch (error) { next(error); }
  });

  router.post('/login', async (request, response, next) => {
    try {
      const input = credentialsSchema.parse(request.body);
      response.json(await loginUser(database, sessionSecret, input.email, input.password));
    } catch (error) { next(error); }
  });

  router.get('/me', async (request, response) => {
    const user = await verifyUserSession(database, sessionSecret, sessionToken(request));
    if (!user) {
      response.status(401).json({ error: 'Sessão de usuário inválida ou expirada.' });
      return;
    }
    response.json({ user });
  });

  return router;
};
