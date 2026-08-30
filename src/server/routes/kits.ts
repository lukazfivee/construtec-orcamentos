import { Router } from 'express';
import { z } from 'zod';
import type { LocalDatabase } from '../services/database';
import { applyKitToProposal, createKit, deleteKit, getKitById, listKits, updateKit } from '../services/kits';

const idSchema = z.string().uuid();

const kitItemInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive().max(999999),
});

const kitInputSchema = z.object({
  name: z.string().trim().min(2).max(180),
  description: z.string().trim().max(500).nullable().optional(),
  category: z.string().trim().min(1).max(120).default('Geral'),
  active: z.boolean().optional(),
  items: z.array(kitItemInputSchema).default([]),
});

export const createKitsRouter = (database: LocalDatabase) => {
  const router = Router();

  router.get('/', async (request, response, next) => {
    try {
      const query = z.string().max(120).catch('').parse(request.query.q);
      const kits = await listKits(database, query);
      response.json({ kits });
    } catch (error) { next(error); }
  });

  router.get('/:kitId', async (request, response, next) => {
    try {
      const kitId = idSchema.parse(request.params.kitId);
      const kit = await getKitById(database, kitId);
      response.json({ kit });
    } catch (error) { next(error); }
  });

  router.post('/', async (request, response, next) => {
    try {
      const input = kitInputSchema.parse(request.body);
      const kit = await createKit(database, input);
      const kits = await listKits(database);
      response.status(201).json({ kit, kits });
    } catch (error) { next(error); }
  });

  router.put('/:kitId', async (request, response, next) => {
    try {
      const kitId = idSchema.parse(request.params.kitId);
      const input = kitInputSchema.parse(request.body);
      const kit = await updateKit(database, kitId, input);
      const kits = await listKits(database);
      response.json({ kit, kits });
    } catch (error) { next(error); }
  });

  router.delete('/:kitId', async (request, response, next) => {
    try {
      const kitId = idSchema.parse(request.params.kitId);
      await deleteKit(database, kitId);
      const kits = await listKits(database);
      response.json({ success: true, kits });
    } catch (error) { next(error); }
  });

  router.post('/:kitId/apply-to-proposal', async (request, response, next) => {
    try {
      const kitId = idSchema.parse(request.params.kitId);
      const { proposalId } = z.object({ proposalId: z.string().uuid() }).parse(request.body);
      const proposal = await applyKitToProposal(database, kitId, proposalId);
      response.json({ proposal });
    } catch (error) { next(error); }
  });

  return router;
};
