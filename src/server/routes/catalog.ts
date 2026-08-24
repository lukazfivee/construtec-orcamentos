import { Router } from 'express';
import { z } from 'zod';
import type { LocalDatabase } from '../services/database';
import { searchCatalog } from '../services/proposals';

const searchSchema = z.object({
  q: z.string().trim().max(120).default(''),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const createCatalogRouter = (database: LocalDatabase) => {
  const router = Router();

  router.get('/', async (request, response, next) => {
    try {
      const input = searchSchema.parse(request.query);
      response.json({ products: await searchCatalog(database, input.q, input.limit) });
    } catch (error) {
      next(error);
    }
  });

  return router;
};
