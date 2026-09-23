import express from 'express';
import { ZodError } from 'zod';
import { createAuthRouter } from './routes/auth';
import { createCatalogRouter } from './routes/catalog';
import { createClientsRouter } from './routes/clients';
import { createDashboardRouter } from './routes/dashboard';
import { createKitsRouter } from './routes/kits';
import { createProposalsRouter } from './routes/proposals';
import { createSettingsRouter } from './routes/settings';
import { createSystemRouter } from './routes/system';
import { createUsersRouter } from './routes/users';
import { verifyUserSession } from './services/auth';
import { CentroIdentityError } from './services/centroIdentity';
import type { LocalDatabase } from './services/database';

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

export const createApp = (database: LocalDatabase, apiToken: string) => {
  const api = express();
  const cloud = getCloudSecurity();

  api.disable('x-powered-by');
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
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Construtec-Session');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    if (request.method === 'OPTIONS') {
      response.sendStatus(204);
      return;
    }
    next();
  });
  api.use((request, response, next) => {
    if (cloud && CLOUD_SETUP_PATH.test(request.path) && request.headers.authorization !== `Bearer ${cloud.setupToken}`) {
      response.status(403).json({ error: 'Configuração inicial protegida.' });
      return;
    }
    next();
  });
  api.get('/health', async (_request, response) => {
    try {
      await database.query('SELECT now()::text AS now');
      response.json({ ok: true, storage: cloud ? 'postgresql' : 'local' });
    } catch {
      response.status(503).json({ ok: false, error: 'Banco de dados indisponível.' });
    }
  });
  api.use((request, response, next) => {
    // Token local so existe no desktop (processo Electron); na web vale a sessao.
    const isLocalApiToken = request.headers.authorization === `Bearer ${apiToken}`;
    const hasUserSession = Boolean(getSessionToken(request));
    const isPublicAuth = request.path.toLowerCase().startsWith('/api/auth');
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
    if (user.role === 'viewer' && request.method !== 'GET') {
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
    next();
  });

  api.use('/api/catalog', createCatalogRouter(database));
  api.use('/api/clients', createClientsRouter(database));
  api.use('/api/proposals', createProposalsRouter(database));
  api.use('/api/kits', createKitsRouter(database));
  api.use('/api/settings', createSettingsRouter(database));
  api.use('/api/users', createUsersRouter(database));
  api.use('/api/system', createSystemRouter(database));
  api.use('/api/dashboard', createDashboardRouter(database));

  api.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    void _next;
    if (error instanceof ZodError || (error as { name?: string })?.name === 'ZodError' || Array.isArray((error as { issues?: unknown })?.issues)) {
      const issues = (error as { issues?: Array<{ message: string; path: (string | number)[] }> }).issues;
      const details = issues && issues.length > 0
        ? issues.map((i) => `${i.path.length ? i.path.join('.') + ': ' : ''}${i.message}`).join(', ')
        : 'Dados inválidos.';
      response.status(400).json({ error: `Dados inválidos: ${details}` });
      return;
    }
    if (error instanceof CentroIdentityError) {
      const messages: Record<string, string> = {
        EMAIL_NOT_AUTHORIZED: 'E-mail não autorizado. Autorize o e-mail externo antes de criar a conta.',
        IDENTITY_UNAVAILABLE: error.message,
        IDENTITY_NOT_CONFIGURED: error.message,
      };
      const status = [400, 401, 403, 404, 409, 429].includes(error.status) ? error.status : 503;
      response.status(status).json({ error: messages[error.code] || error.message });
      return;
    }
    if (error instanceof Error && error.message === 'AUTH_INVALID_CREDENTIALS') {
      response.status(401).json({ error: 'E-mail ou senha inválidos.' });
      return;
    }
    if (error instanceof Error && error.message === 'AUTH_SETUP_COMPLETE') {
      response.status(409).json({ error: 'O administrador inicial já foi configurado.' });
      return;
    }
    if (error instanceof Error && error.message === 'USER_EMAIL_DUPLICATE') {
      response.status(409).json({ error: 'Já existe um usuário com esse e-mail.' });
      return;
    }
    if (error instanceof Error && error.message === 'USER_SELF_LOCKOUT') {
      response.status(409).json({ error: 'Você não pode desativar ou remover o perfil administrativo da própria conta.' });
      return;
    }
    if (error instanceof Error && error.message === 'USER_LAST_ADMIN') {
      response.status(409).json({ error: 'É necessário manter pelo menos um administrador ativo.' });
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
    if (error instanceof Error && error.message.startsWith('FINANCIAL_')) {
      response.status(422).json({ error: 'Valor financeiro inválido ou acima do limite suportado.' });
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
    if (error instanceof Error && (error.message === 'KIT_NAME_DUPLICATE' || /unique constraint.*(?:kits_name|name)/i.test(error.message))) {
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
    if (error instanceof Error) {
      if (/violates not-null constraint/i.test(error.message)) {
        response.status(422).json({ error: 'Preencha todos os campos obrigatórios.' });
        return;
      }
      if (/violates foreign key constraint/i.test(error.message)) {
        response.status(422).json({ error: 'Um dos produtos vinculados não foi encontrado no catálogo.' });
        return;
      }
      if (/duplicate key/i.test(error.message)) {
        response.status(409).json({ error: 'Registro já cadastrado com os mesmos dados.' });
        return;
      }
      console.error(error);
      response.status(500).json({ error: cloud ? 'Não foi possível concluir a operação.' : (error.message || 'Não foi possível concluir a operação local.') });
      return;
    }
    console.error(error);
    response.status(500).json({ error: cloud ? 'Não foi possível concluir a operação.' : 'Não foi possível concluir a operação local.' });
  });

  return api;
};
