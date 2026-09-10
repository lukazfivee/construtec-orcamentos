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
import type { LocalDatabase } from './services/database';

const getSessionToken = (request: express.Request) => {
  const value = request.headers['x-construtec-session'];
  return typeof value === 'string' ? value : '';
};

export const createApp = (database: LocalDatabase, apiToken: string, sessionSecret: string) => {
  const api = express();

  api.disable('x-powered-by');
  api.use((request, response, next) => {
    const origin = request.headers.origin;
    const isLocalOrPrivate = !origin
      || origin === 'null'
      || origin.startsWith('http://localhost:')
      || origin.startsWith('http://127.0.0.1:')
      || /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|[\w-]+\.local)(:\d+)?$/i.test(origin);
    if (origin && !isLocalOrPrivate) {
      response.status(403).json({ error: 'Origem não autorizada.' });
      return;
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
    const isLocalApiToken = request.headers.authorization === `Bearer ${apiToken}`;
    const hasUserSession = Boolean(getSessionToken(request));
    const isPublicAuth = request.path.startsWith('/api/auth');
    if (!isLocalApiToken && !hasUserSession && !isPublicAuth) {
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
  api.use('/api/auth', createAuthRouter(database, sessionSecret));

  api.use(async (request, response, next) => {
    const user = await verifyUserSession(database, sessionSecret, getSessionToken(request));
    if (!user) {
      response.status(401).json({ error: 'Sessão de usuário inválida ou expirada.' });
      return;
    }
    response.locals.authUser = user;
    if (user.role === 'viewer' && request.method !== 'GET') {
      response.status(403).json({ error: 'Seu perfil possui acesso somente para consulta.' });
      return;
    }
    if (request.path.startsWith('/api/users') && user.role !== 'admin') {
      response.status(403).json({ error: 'Apenas administradores podem gerenciar usuários.' });
      return;
    }
    if (request.path.startsWith('/api/system') && user.role !== 'admin') {
      response.status(403).json({ error: 'Apenas administradores podem executar operações de backup e restauração.' });
      return;
    }
    if (request.path.startsWith('/api/settings') && request.method !== 'GET' && user.role !== 'admin') {
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
      response.status(500).json({ error: error.message || 'Não foi possível concluir a operação local.' });
      return;
    }
    console.error(error);
    response.status(500).json({ error: 'Não foi possível concluir a operação local.' });
  });

  return api;
};
