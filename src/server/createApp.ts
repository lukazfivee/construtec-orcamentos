import express from 'express';
import type { LocalDatabase } from './services/database';

export const createApp = (database: LocalDatabase) => {
  const api = express();

  api.disable('x-powered-by');
  api.use(express.json({ limit: '1mb' }));

  api.get('/api/health', async (_request, response) => {
    const result = await database.query<{ now: string }>('SELECT now()::text AS now');
    response.json({ ok: true, storage: 'local', databaseTime: result.rows[0]?.now });
  });

  return api;
};
