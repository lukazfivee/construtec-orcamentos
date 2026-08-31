import { Router } from 'express';
import type { LocalDatabase } from '../services/database';
import { getDashboardSummary } from '../services/dashboard';

export const createDashboardRouter = (database: LocalDatabase) => {
  const router = Router();

  router.get('/', async (_request, response, next) => {
    try {
      const summary = await getDashboardSummary(database);
      response.json({ summary });
    } catch (error) { next(error); }
  });

  return router;
};
