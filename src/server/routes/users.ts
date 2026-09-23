import { Router } from 'express';
import { z } from 'zod';
import type { AuthUser } from '../../shared/contracts';
import type { LocalDatabase } from '../services/database';
import {
  authorizeEmail, createUser, deleteUser, listAuthorizedEmails, listUsers, revokeEmail, updateUser,
} from '../services/users';

const roleSchema = z.enum(['admin', 'commercial', 'viewer']);
const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  role: roleSchema,
  password: z.string().min(10).max(128),
});
const updateSchema = z.object({
  role: roleSchema,
  active: z.boolean(),
});
const emailSchema = z.object({
  email: z.string().trim().email().max(254),
  note: z.string().trim().max(200).optional(),
});

type Locals = { locals: { authUser?: AuthUser; sessionToken?: string } };

const actor = (response: Locals) => {
  const user = response.locals.authUser;
  if (!user) throw new Error('AUTH_INVALID_CREDENTIALS');
  return user;
};

const token = (response: Locals) => response.locals.sessionToken || '';

export const createUsersRouter = (database: LocalDatabase) => {
  const router = Router();

  router.get('/', async (_request, response, next) => {
    try {
      response.json({ users: await listUsers(database, token(response)) });
    } catch (error) { next(error); }
  });

  router.post('/', async (request, response, next) => {
    try {
      const input = createSchema.parse(request.body);
      const user = await createUser(database, token(response), input);
      response.status(201).json({ user, users: await listUsers(database, token(response)) });
    } catch (error) { next(error); }
  });

  router.patch('/:userId', async (request, response, next) => {
    try {
      const input = updateSchema.parse(request.body);
      const user = await updateUser(database, token(response), actor(response).id, request.params.userId, input);
      response.json({ user, users: await listUsers(database, token(response)) });
    } catch (error) { next(error); }
  });

  router.delete('/:userId', async (request, response, next) => {
    try {
      await deleteUser(database, token(response), actor(response).id, request.params.userId);
      response.json({ users: await listUsers(database, token(response)) });
    } catch (error) { next(error); }
  });

  router.get('/authorized-emails/list', async (_request, response, next) => {
    try {
      response.json({ emails: await listAuthorizedEmails(token(response)) });
    } catch (error) { next(error); }
  });

  router.post('/authorized-emails', async (request, response, next) => {
    try {
      const input = emailSchema.parse(request.body);
      await authorizeEmail(token(response), input.email.toLowerCase(), input.note || '');
      response.status(201).json({ emails: await listAuthorizedEmails(token(response)) });
    } catch (error) { next(error); }
  });

  router.post('/authorized-emails/revoke', async (request, response, next) => {
    try {
      const input = emailSchema.parse(request.body);
      await revokeEmail(token(response), input.email.toLowerCase());
      response.json({ emails: await listAuthorizedEmails(token(response)) });
    } catch (error) { next(error); }
  });

  return router;
};
