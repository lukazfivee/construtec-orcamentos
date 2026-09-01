import { Router } from 'express';
import { z } from 'zod';
import type { AuthUser } from '../../shared/contracts';
import { createClient, createWork, listClients, updateClient, updateWork } from '../services/clients';
import { attributeAuditEvent } from '../services/auditAttribution';
import type { LocalDatabase } from '../services/database';

const idSchema = z.string().uuid();
const clientSchema = z.object({
  legalName: z.string().trim().min(2).max(180),
  tradeName: z.string().trim().max(180).nullable().optional(),
  document: z.string().trim().max(30).nullable().optional(),
});
const workSchema = z.object({
  name: z.string().trim().min(2).max(180),
  address: z.string().trim().max(300).nullable().optional(),
});
const updateWorkSchema = workSchema.extend({ active: z.boolean() });

const actor = (response: { locals: { authUser?: AuthUser } }) => {
  const user = response.locals.authUser;
  if (!user) throw new Error('AUTH_INVALID_CREDENTIALS');
  return user;
};

export const createClientsRouter = (database: LocalDatabase) => {
  const router = Router();

  router.get('/', async (request, response, next) => {
    try {
      const query = z.string().max(120).catch('').parse(request.query.q);
      response.json({ clients: await listClients(database, query) });
    } catch (error) { next(error); }
  });

  router.post('/', async (request, response, next) => {
    try {
      const input = clientSchema.parse(request.body);
      const clientId = await createClient(database, input);
      await attributeAuditEvent(database, actor(response).id, 'client', clientId, 'created');
      response.status(201).json({ clientId, clients: await listClients(database) });
    } catch (error) { next(error); }
  });

  router.patch('/:clientId', async (request, response, next) => {
    try {
      const clientId = idSchema.parse(request.params.clientId);
      await updateClient(database, clientId, clientSchema.parse(request.body));
      await attributeAuditEvent(database, actor(response).id, 'client', clientId, 'updated');
      response.json({ clients: await listClients(database) });
    } catch (error) { next(error); }
  });

  router.post('/:clientId/works', async (request, response, next) => {
    try {
      const clientId = idSchema.parse(request.params.clientId);
      const workId = await createWork(database, clientId, workSchema.parse(request.body));
      await attributeAuditEvent(database, actor(response).id, 'work', workId, 'created');
      response.status(201).json({ workId, clients: await listClients(database) });
    } catch (error) { next(error); }
  });

  router.patch('/:clientId/works/:workId', async (request, response, next) => {
    try {
      const clientId = idSchema.parse(request.params.clientId);
      const workId = idSchema.parse(request.params.workId);
      await updateWork(database, clientId, workId, updateWorkSchema.parse(request.body));
      await attributeAuditEvent(database, actor(response).id, 'work', workId, 'updated');
      response.json({ clients: await listClients(database) });
    } catch (error) { next(error); }
  });

  return router;
};
