import { Router } from 'express';
import type { Response } from 'express';
import { z } from 'zod';
import type { AuthUser } from '../../shared/contracts';
import type { LocalDatabase } from '../services/database';
import { discardProposal, listDiscardedProposals, restoreProposal } from '../services/proposalDiscard';

const idSchema = z.string().uuid();
const discardSchema = z.object({ confirmNumber: z.string().trim().min(1).max(40), reason: z.string().trim().max(300).optional() });

// Descartar e recuperar propostas (inclusive aprovadas): so administrador. Montado antes do roteador de propostas.
export const createProposalDiscardRouter = (database: LocalDatabase) => {
  const router = Router();
  const admin = (response: Response): AuthUser | null => {
    const user = response.locals.authUser as AuthUser;
    if (user.role !== 'admin') { response.status(403).json({ error: 'Apenas administradores podem descartar ou restaurar propostas.' }); return null; }
    return user;
  };

  router.get('/discarded', async (_request, response, next) => {
    try {
      if (!admin(response)) return;
      response.json({ discarded: await listDiscardedProposals(database) });
    } catch (error) { next(error); }
  });

  router.post('/discarded/:discardId/restore', async (request, response, next) => {
    try {
      const user = admin(response);
      if (!user) return;
      response.json(await restoreProposal(database, idSchema.parse(request.params.discardId), { id: user.id, name: user.name }));
    } catch (error) { next(error); }
  });

  router.post('/:proposalId/discard', async (request, response, next) => {
    try {
      const user = admin(response);
      if (!user) return;
      const input = discardSchema.parse(request.body);
      response.json(await discardProposal(database, idSchema.parse(request.params.proposalId), { ...input, actor: { id: user.id, name: user.name } }));
    } catch (error) { next(error); }
  });

  return router;
};
