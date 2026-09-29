import { Router } from 'express';
import { z } from 'zod';
import type { LocalDatabase } from '../services/database';
import { getCenterTracking } from '../services/integration/centerTracking';

const idSchema = z.string().uuid();

// Acompanhamento da obra no Centro de Custos (somente leitura, todos os perfis).
export const createProposalTrackingRouter = (database: LocalDatabase) => {
  const router = Router();
  router.get('/:proposalId/center-tracking', async (request, response, next) => {
    try {
      response.json(await getCenterTracking(database, idSchema.parse(request.params.proposalId)));
    } catch (error) { next(error); }
  });
  return router;
};
