import { Router } from 'express';
import type { LocalDatabase } from '../services/database';

export const createSystemRouter = (database: LocalDatabase) => {
  const router = Router();

  router.get('/backup', async (_request, response, next) => {
    try {
      const dump = await database.dumpDataDir('gzip');
      const bytes = Buffer.from(await dump.arrayBuffer());
      response.setHeader('Content-Type', 'application/gzip');
      response.setHeader('Content-Length', String(bytes.byteLength));
      response.setHeader('Cache-Control', 'no-store');
      response.send(bytes);
    } catch (error) {
      next(error);
    }
  });

  return router;
};
