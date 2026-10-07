import { Router } from 'express';
import { z } from 'zod';
import type { AuthUser } from '../../shared/contracts';
import type { LocalDatabase } from '../services/database';
import { addBlankProposalItem, addProposalItemToCatalog } from '../services/proposalCustomItems';
import { getProposalById } from '../services/proposals';

const idSchema = z.string().uuid();
const toCatalogSchema = z.object({ code: z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9][A-Za-z0-9._\-/ ]*$/), category: z.string().trim().max(80).optional() });

const actorId = (response: { locals: { authUser?: AuthUser } }) => {
  const user = response.locals.authUser;
  if (!user) throw new Error('AUTH_INVALID_CREDENTIALS');
  return user.id;
};

// Linha avulsa (fora do catalogo) e "Adicionar ao catalogo". Mesmas regras de edicao da proposta (rascunho ou revisao, ultima revisao).
export const createProposalCustomItemsRouter = (database: LocalDatabase) => {
  const router = Router();

  router.post('/:proposalId/items/blank', async (request, response, next) => {
    try {
      const proposal = await addBlankProposalItem(database, idSchema.parse(request.params.proposalId), actorId(response));
      response.status(201).json({ proposal });
    } catch (error) { next(error); }
  });

  router.post('/:proposalId/items/:itemId/to-catalog', async (request, response, next) => {
    try {
      const proposalId = idSchema.parse(request.params.proposalId);
      const itemId = idSchema.parse(request.params.itemId);
      const input = toCatalogSchema.parse(request.body);
      const productId = await addProposalItemToCatalog(database, proposalId, itemId, input, actorId(response));
      response.status(201).json({ productId, proposal: await getProposalById(database, proposalId) });
    } catch (error) { next(error); }
  });

  return router;
};
