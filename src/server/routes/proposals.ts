import { Router } from 'express';
import { z } from 'zod';
import type { LocalDatabase } from '../services/database';
import {
  addProductToProposal,
  createProposalRevision,
  getCurrentProposal,
  getProposalById,
  listProposalHistory,
  removeProposalItems,
  updateProposalBdi,
  updateProposalItemQuantity,
} from '../services/proposals';

const idSchema = z.string().uuid();
const addItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive().max(1_000_000).default(1),
});
const removeItemsSchema = z.object({ itemIds: z.array(z.string().uuid()).min(1).max(500) });
const updateQuantitySchema = z.object({ quantity: z.number().positive().max(1_000_000) });
const updateBdiSchema = z.object({ bdiMultiplier: z.number().positive().max(100) });

export const createProposalsRouter = (database: LocalDatabase) => {
  const router = Router();

  router.get('/current', async (_request, response, next) => {
    try {
      const proposal = await getCurrentProposal(database);
      if (!proposal) {
        response.status(404).json({ error: 'Nenhuma proposta disponível.' });
        return;
      }
      response.json({ proposal });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:proposalId/history', async (request, response, next) => {
    try {
      const proposalId = idSchema.parse(request.params.proposalId);
      response.json({ revisions: await listProposalHistory(database, proposalId) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:proposalId', async (request, response, next) => {
    try {
      const proposalId = idSchema.parse(request.params.proposalId);
      const proposal = await getProposalById(database, proposalId);
      if (!proposal) {
        response.status(404).json({ error: 'Proposta não encontrada.' });
        return;
      }
      response.json({ proposal });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:proposalId/revisions', async (request, response, next) => {
    try {
      const proposalId = idSchema.parse(request.params.proposalId);
      const newProposalId = await createProposalRevision(database, proposalId);
      response.status(201).json({ proposal: await getProposalById(database, newProposalId) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:proposalId/items', async (request, response, next) => {
    try {
      const proposalId = idSchema.parse(request.params.proposalId);
      const input = addItemSchema.parse(request.body);
      await addProductToProposal(database, proposalId, input.productId, input.quantity);
      response.status(201).json({ proposal: await getCurrentProposal(database) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:proposalId/items/remove', async (request, response, next) => {
    try {
      const proposalId = idSchema.parse(request.params.proposalId);
      const input = removeItemsSchema.parse(request.body);
      await removeProposalItems(database, proposalId, input.itemIds);
      response.json({ proposal: await getCurrentProposal(database) });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:proposalId/items/:itemId', async (request, response, next) => {
    try {
      const proposalId = idSchema.parse(request.params.proposalId);
      const itemId = idSchema.parse(request.params.itemId);
      const input = updateQuantitySchema.parse(request.body);
      await updateProposalItemQuantity(database, proposalId, itemId, input.quantity);
      response.json({ proposal: await getCurrentProposal(database) });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:proposalId/bdi', async (request, response, next) => {
    try {
      const proposalId = idSchema.parse(request.params.proposalId);
      const input = updateBdiSchema.parse(request.body);
      await updateProposalBdi(database, proposalId, input.bdiMultiplier);
      response.json({ proposal: await getCurrentProposal(database) });
    } catch (error) {
      next(error);
    }
  });

  return router;
};
