import { timingSafeEqual } from 'node:crypto';
import express from 'express';
import { createErrorHandler } from './errorHandler';
import { createAuthRouter } from './routes/auth';
import { createCatalogRouter } from './routes/catalog';
import { createClientsRouter } from './routes/clients';
import { createDashboardRouter } from './routes/dashboard';
import { createExsatRouter } from './routes/exsat';
import { createNotificationsRouter } from './routes/notifications';
import { createKitsRouter } from './routes/kits';
import { createProposalsRouter } from './routes/proposals';
import { createReportsRouter } from './routes/reports';
import { createProposalTrackingRouter } from './routes/proposalTracking';
import { createProposalPriceDriftRouter } from './routes/proposalPriceDrift';
import { createProposalDocumentRouter } from './routes/proposalDocument';
import { createProposalClientLinkRouter } from './routes/proposalClientLink';
import { createPublicClientLinkRouter } from './routes/publicClientLink';
import { createProposalDiscardRouter } from './routes/proposalDiscard';
import { createSettingsRouter } from './routes/settings';
import { createBodySettingsRouter, createProposalBodyRouter } from './routes/proposalBody';
import { requestTiming, withQueryTiming } from './requestTiming';
import { securityHeaders } from './securityHeaders';
import { createProposalCustomItemsRouter } from './routes/proposalCustomItems';
import { createSystemRouter } from './routes/system';
import { createUsersRouter } from './routes/users';
import { verifyUserSession } from './services/auth';
import { suiteGuard } from './suiteGuard';
import { identityHealStatus } from './services/database';
import type { LocalDatabase } from './services/database';
import { resolveIntegrationKey } from './services/integration/proposalSync';
import { CRON_MAX_ATTEMPTS, runScheduledIntegrationPass } from './services/outboxRetryWorker';

const getSessionToken = (request: express.Request) => {
  const value = request.headers['x-construtec-session'];
  return typeof value === 'string' ? value : '';
};

export interface CloudSecurity {
  sessionSecret: string;
  setupToken: string;
  allowedOrigins: string[];
}

const MIN_SECRET_LENGTH = 32;
const ALLOWED_ORIGINS_ERROR = 'CONSTRUTEC_ALLOWED_ORIGINS deve ser uma ou mais origens HTTPS válidas, separadas por vírgula, sem caminho ou credenciais.';

export const getCloudSecurity = (env: NodeJS.ProcessEnv = process.env): CloudSecurity | undefined => {
  if (!env.DATABASE_URL) return undefined;
  const sessionSecret = env.SESSION_SECRET || '';
  if (sessionSecret.length < MIN_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET é obrigatório e deve ter ao menos ${MIN_SECRET_LENGTH} caracteres no modo cloud.`);
  }
  const setupToken = env.CONSTRUTEC_SETUP_TOKEN || '';
  if (setupToken.length < MIN_SECRET_LENGTH) {
    throw new Error(`CONSTRUTEC_SETUP_TOKEN é obrigatório e deve ter ao menos ${MIN_SECRET_LENGTH} caracteres no modo cloud.`);
  }
  const rawOrigins = (env.CONSTRUTEC_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (rawOrigins.length === 0) throw new Error(ALLOWED_ORIGINS_ERROR);
  const allowedOrigins = rawOrigins.map(raw => {
    let origin: URL;
    try {
      origin = new URL(raw);
    } catch {
      throw new Error(ALLOWED_ORIGINS_ERROR);
    }
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
      throw new Error(ALLOWED_ORIGINS_ERROR);
    }
    return origin.origin;
  });
  return { sessionSecret, setupToken, allowedOrigins };
};

const CLOUD_SETUP_PATH = /^\/api\/auth\/setup\/?$/i;

// Comparacao em tempo constante: o tempo de resposta nao revela quanto do segredo confere.
const sameSecret = (provided: unknown, expected: string | null | undefined) => {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  const given = Buffer.from(provided);
  const wanted = Buffer.from(expected);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
};

export const createApp = (rawDatabase: LocalDatabase, apiToken: string) => {
  const database = withQueryTiming(rawDatabase);
  const api = express();
  const cloud = getCloudSecurity();

  api.disable('x-powered-by');
  api.use(requestTiming);
  api.use(securityHeaders);
  api.use((request, response, next) => {
    const origin = request.headers.origin;
    if (cloud) {
      if (origin && !cloud.allowedOrigins.includes(origin)) {
        response.status(403).json({ error: 'Origem não autorizada.' });
        return;
      }
    } else {
      const isLocalOrPrivate = !origin
        || origin === 'null'
        || origin.startsWith('http://localhost:')
        || origin.startsWith('http://127.0.0.1:')
        || /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|[\w-]+\.local)(:\d+)?$/i.test(origin);
      if (origin && !isLocalOrPrivate) {
        response.status(403).json({ error: 'Origem não autorizada.' });
        return;
      }
    }
    if (origin) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
    }
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Construtec-Session, X-Link-Token');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    if (request.method === 'OPTIONS') {
      response.sendStatus(204);
      return;
    }
    next();
  });
  api.use((request, response, next) => {
    if (cloud && CLOUD_SETUP_PATH.test(request.path) && !sameSecret(request.headers.authorization, `Bearer ${cloud.setupToken}`)) {
      response.status(403).json({ error: 'Configuração inicial protegida.' });
      return;
    }
    next();
  });
  api.get('/health', async (_request, response) => {
    try {
      await database.query('SELECT now()::text AS now');
      response.json({ ok: true, storage: cloud ? 'postgresql' : 'local', identity: identityHealStatus === 'ok' || identityHealStatus === 'pending' ? identityHealStatus : identityHealStatus.startsWith('healed') ? 'healed' : 'error' });
    } catch {
      response.status(503).json({ ok: false, error: 'Banco de dados indisponível.' });
    }
  });
  // Disparado pelo Cron do Worker (nao ha rota publica: o Worker so encaminha
  // /api/* e /health). Protegido tambem pela chave de integracao.
  api.post('/internal/outbox/retry', async (request, response) => {
    const expected = cloud ? resolveIntegrationKey() : null;
    if (!sameSecret(request.headers['x-construtec-integration-key'], expected)) {
      response.status(404).end();
      return;
    }
    try {
      response.json(await runScheduledIntegrationPass(database, CRON_MAX_ATTEMPTS));
    } catch {
      response.status(503).json({ error: 'Reenvio indisponível.' });
    }
  });
  api.use((request, response, next) => {
    // Token local so existe no desktop (processo Electron); na web vale a sessao.
    const isLocalApiToken = sameSecret(request.headers.authorization, `Bearer ${apiToken}`);
    const hasUserSession = Boolean(getSessionToken(request));
    const isPublicAuth = /^\/api\/(auth|public\/c)(\/|$)/i.test(request.path);
    if (!isLocalApiToken && !hasUserSession && !isPublicAuth) {
      response.status(401).json({ error: 'Sessão local inválida.' });
      return;
    }
    next();
  });
  api.use(express.json({ limit: '1mb' }));

  api.get('/api/health', async (_request, response) => {
    const result = await database.query<{ now: string }>('SELECT now()::text AS now');
    response.json({ ok: true, storage: cloud ? 'postgresql' : 'local', databaseTime: result.rows[0]?.now });
  });
  api.use('/api/auth', createAuthRouter(database));
  // Pagina publica do cliente: sem login, com token assinado (vem antes da checagem de sessao).
  const linkSecret = cloud?.sessionSecret ?? apiToken;
  api.use('/api/public/c', express.json({ limit: '16kb' }), createPublicClientLinkRouter(database, linkSecret));

  api.use(async (request, response, next) => {
    let user;
    try {
      user = await verifyUserSession(database, getSessionToken(request));
    } catch (error) {
      next(error);
      return;
    }
    if (!user) {
      response.status(401).json({ error: 'Sessão de usuário inválida ou expirada.' });
      return;
    }
    response.locals.authUser = user;
    const path = request.path.toLowerCase();
    response.locals.sessionToken = getSessionToken(request);
    // Avisos e reports sao da conta, nao dos dados do Orcamentos.
    if (user.role === 'viewer' && request.method !== 'GET' && !path.startsWith('/api/notifications') && !path.startsWith('/api/reports')) {
      response.status(403).json({ error: 'Seu perfil possui acesso somente para consulta.' });
      return;
    }
    if (path.startsWith('/api/users') && user.role !== 'admin') {
      response.status(403).json({ error: 'Apenas administradores podem gerenciar usuários.' });
      return;
    }
    if (path.startsWith('/api/system') && user.role !== 'admin') {
      response.status(403).json({ error: 'Apenas administradores podem executar operações de backup e restauração.' });
      return;
    }
    if (path.startsWith('/api/settings') && request.method !== 'GET' && user.role !== 'admin') {
      response.status(403).json({ error: 'Apenas administradores podem alterar as configurações.' });
      return;
    }
    suiteGuard(request, response, next);
  });

  api.use('/api/catalog', createCatalogRouter(database));
  api.use('/api/exsat', createExsatRouter(database));
  api.use('/api/clients', createClientsRouter(database));
  api.use('/api/proposals', createProposalDiscardRouter(database));
  api.use('/api/proposals', createProposalTrackingRouter(database));
  api.use('/api/proposals', createProposalPriceDriftRouter(database));
  api.use('/api/proposals', createProposalDocumentRouter(database));
  api.use('/api/proposals', createProposalClientLinkRouter(database, linkSecret, process.env.CONSTRUTEC_PUBLIC_URL || cloud?.allowedOrigins[0] || '', Boolean(cloud)));
  api.use('/api/proposals', createProposalBodyRouter(database));
  api.use('/api/proposals', createProposalCustomItemsRouter(database));
  api.use('/api/proposals', createProposalsRouter(database));
  api.use('/api/kits', createKitsRouter(database));
  api.use('/api/settings', createBodySettingsRouter(database));
  api.use('/api/settings', createSettingsRouter(database));
  api.use('/api/users', createUsersRouter(database));
  api.use('/api/system', createSystemRouter(database));
  api.use('/api/dashboard', createDashboardRouter(database));
  api.use('/api/notifications', createNotificationsRouter());
  api.use('/api/reports', createReportsRouter());

  api.use(createErrorHandler(Boolean(cloud)));

  return api;
};
