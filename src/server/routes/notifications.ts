import { Router } from 'express';
import { z } from 'zod';
import { CentroIdentityError, centroNotifications } from '../services/centroIdentity';

// Avisos do Orcamentos no celular: repasse da central do Centro com a sessao do usuario.
const readSchema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }),
]);
const prefSchema = z.object({ type: z.string().trim().min(2).max(40), enabled: z.boolean() });
const limitSchema = z.coerce.number().int().min(1).max(100).default(50);

const token = (response: { locals: { sessionToken?: string } }) => response.locals.sessionToken || '';

// A sessao ja foi conferida pelo middleware; um 401 do Centro aqui nao deve deslogar o celular.
const relay = async <T>(work: () => Promise<T>) => {
  try {
    return await work();
  } catch (error) {
    if (error instanceof CentroIdentityError && error.status === 401) {
      throw new CentroIdentityError('Não foi possível abrir as notificações agora.', 503, 'IDENTITY_UNAVAILABLE');
    }
    throw error;
  }
};

export const createNotificationsRouter = () => {
  const router = Router();

  router.get('/', async (request, response, next) => {
    try {
      const limit = limitSchema.parse(request.query.limit);
      response.json(await relay(() => centroNotifications(token(response), '/v1/notifications', 'GET', undefined, `?limit=${limit}`)));
    } catch (error) { next(error); }
  });

  router.post('/read', async (request, response, next) => {
    try {
      const body = readSchema.parse(request.body);
      response.json(await relay(() => centroNotifications(token(response), '/v1/notifications/read', 'POST', body)));
    } catch (error) { next(error); }
  });

  router.get('/prefs', async (_request, response, next) => {
    try { response.json(await relay(() => centroNotifications(token(response), '/v1/notifications/prefs'))); } catch (error) { next(error); }
  });

  router.put('/prefs', async (request, response, next) => {
    try {
      const body = prefSchema.parse(request.body);
      response.json(await relay(() => centroNotifications(token(response), '/v1/notifications/prefs', 'PUT', body)));
    } catch (error) { next(error); }
  });

  router.post('/test', async (_request, response, next) => {
    try { response.json(await relay(() => centroNotifications(token(response), '/v1/notifications/test', 'POST', {}))); } catch (error) { next(error); }
  });

  return router;
};
