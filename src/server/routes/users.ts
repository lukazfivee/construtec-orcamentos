import { Router } from 'express';
import { z } from 'zod';
import type { AuthUser } from '../../shared/contracts';
import type { LocalDatabase } from '../services/database';
import { createUser, listUsers, resetUserPassword, updateUser } from '../services/users';

const roleSchema = z.enum(['admin', 'commercial', 'viewer']);
const userSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  role: roleSchema,
});
const createSchema = userSchema.extend({
  password: z.string().min(10).max(128),
});
const updateSchema = userSchema.extend({
  active: z.boolean(),
});
const passwordSchema = z.object({
  password: z.string().min(10).max(128),
});

const actor = (response: { locals: { authUser?: AuthUser } }) => {
  const user = response.locals.authUser;
  if (!user) throw new Error('AUTH_INVALID_CREDENTIALS');
  return user;
};

export const createUsersRouter = (database: LocalDatabase) => {
  const router = Router();

  router.get('/', async (_request, response, next) => {
    try {
      response.json({ users: await listUsers(database) });
    } catch (error) { next(error); }
  });

  router.post('/', async (request, response, next) => {
    try {
      const input = createSchema.parse(request.body);
      const user = await createUser(database, input);
      response.status(201).json({ user, users: await listUsers(database) });
    } catch (error) { next(error); }
  });

  router.patch('/:userId', async (request, response, next) => {
    try {
      const input = updateSchema.parse(request.body);
      const user = await updateUser(database, actor(response).id, request.params.userId, input);
      response.json({ user, users: await listUsers(database) });
    } catch (error) { next(error); }
  });

  router.post('/:userId/password', async (request, response, next) => {
    try {
      const input = passwordSchema.parse(request.body);
      await resetUserPassword(database, request.params.userId, input.password);
      response.json({ success: true });
    } catch (error) { next(error); }
  });

  return router;
};
