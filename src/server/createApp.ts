import express from 'express';
import { ZodError } from 'zod';
import { createCatalogRouter } from './routes/catalog';
import { createClientsRouter } from './routes/clients';
import { createDashboardRouter } from './routes/dashboard';
import { createKitsRouter } from './routes/kits';
import { createProposalsRouter } from './routes/proposals';
import { createSettingsRouter } from './routes/settings';
import type { LocalDatabase } from './services/database';

export const createApp = (database: LocalDatabase, apiToken: string) => {
  const api = express();

  api.disable('x-powered-by');
  api.use((request, response, next) => {
    const origin = request.headers.origin;
    const allowedOrigin = origin === 'null' || origin?.startsWith('http://localhost:');
    if (origin && !allowedOrigin) {
      response.status(403).json({ error: 'Origem não autorizada.' });
      return;
    }
    if (origin) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
    }
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    if (request.method === 'OPTIONS') {
      response.sendStatus(204);
      return;
    }
    next();
  });
  api.use((request, response, next) => {
    if (request.headers.authorization !== `Bearer ${apiToken}`) {
      response.status(401).json({ error: 'Sessão local inválida.' });
      return;
    }
    next();
  });
  api.use(express.json({ limit: '1mb' }));

  api.get('/api/health', async (_request, response) => {
    const result = await database.query<{ now: string }>('SELECT now()::text AS now');
    response.json({ ok: true, storage: 'local', databaseTime: result.rows[0]?.now });
  });

  api.use('/api/catalog', createCatalogRouter(database));
  api.use('/api/clients', createClientsRouter(database));
  api.use('/api/proposals', createProposalsRouter(database));
  api.use('/api/kits', createKitsRouter(database));
  api.use('/api/settings', createSettingsRouter(database));
  api.use('/api/dashboard', createDashboardRouter(database));

  api.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    void _next;
    if (error instanceof ZodError) {
      response.status(400).json({ error: 'Dados inválidos.', details: error.flatten() });
      return;
    }
    if (error instanceof Error && error.message.endsWith('_NOT_FOUND')) {
      response.status(404).json({ error: 'Registro não encontrado.' });
      return;
    }
    if (error instanceof Error && error.message === 'PROPOSAL_LOCKED') {
      response.status(409).json({ error: 'Esta revisão está bloqueada para alterações.' });
      return;
    }
    if (error instanceof Error && error.message === 'WORK_DUPLICATE') {
      response.status(409).json({ error: 'Já existe uma obra com esse nome para o cliente.' });
      return;
    }
    if (error instanceof Error && error.message === 'PRODUCT_DUPLICATE') {
      response.status(409).json({ error: 'Já existe um item com esse código no catálogo.' });
      return;
    }
    if (error instanceof Error && error.message === 'KIT_NAME_DUPLICATE') {
      response.status(409).json({ error: 'Já existe um kit com esse nome.' });
      return;
    }
    if (error instanceof Error && error.message === 'KIT_EMPTY') {
      response.status(422).json({ error: 'O kit selecionado não possui itens.' });
      return;
    }
    if (error instanceof Error && error.message === 'EXSAT_URL_INVALID') {
      response.status(400).json({ error: 'Use um endereço HTTPS do site exsat.com.br.' });
      return;
    }
    if (error instanceof Error && error.message === 'EXSAT_NO_PRODUCTS') {
      response.status(422).json({ error: 'Nenhum produto foi identificado nessa página da Exsat.' });
      return;
    }
    if (error instanceof Error && error.message === 'EXSAT_UNAVAILABLE') {
      response.status(502).json({ error: 'Não foi possível consultar a Exsat agora.' });
      return;
    }
    console.error(error);
    response.status(500).json({ error: 'Não foi possível concluir a operação local.' });
  });

  return api;
};
