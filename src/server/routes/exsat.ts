import { randomUUID } from 'node:crypto';
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import type { AuthUser } from '../../shared/contracts';
import type { ExsatAccountStatus } from '../../shared/exsatServer';
import type { LocalDatabase } from '../services/database';
import { getStoredCredentialInfo, removeCredential, requireKey } from '../services/exsatCredentials';
import { hasCredentialKey } from '../services/exsatCrypto';
import { ExsatServerError, exsatHttpStatus, exsatMessage } from '../services/exsatErrors';
import { connectAndSave, ensureSession, sharedExsatRuntime, type ExsatRuntime } from '../services/exsatRuntime';
import { createJob, latestJob, listPricedItems, loadJob, reconcileInterrupted, reopenJob, setJobStatus, toJobView } from '../services/exsatSyncJobs';
import { runSyncJob } from '../services/exsatSyncRunner';
import { hasPermission } from '../services/suiteAccess';

const credentialSchema = z.object({
  username: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
});
const itemsSchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(500).default(500),
});
const idSchema = z.string().uuid();

const actor = (response: Response) => response.locals.authUser as AuthUser;
// So administrador cadastra, troca e remove a conta da Exsat (alem do p10 que vale para toda a rota).
const isAdmin = (user: AuthUser) => user.role === 'admin' && hasPermission(user, 'p10');

export const buildExsatStatus = async (database: LocalDatabase, runtime: ExsatRuntime, user: AuthUser): Promise<ExsatAccountStatus> => {
  await reconcileInterrupted(database, runtime);
  const [info, jobRow] = await Promise.all([getStoredCredentialInfo(database), latestJob(database)]);
  const failure = runtime.lastFailure;
  return {
    keyConfigured: hasCredentialKey(runtime.env),
    configured: Boolean(info),
    usernameHint: info?.usernameHint ?? null,
    configuredAt: info?.configuredAt ?? null,
    lastLoginAt: info?.lastLoginAt ?? null,
    connected: runtime.session.connected,
    lastFailure: failure ? { code: failure.code, message: exsatMessage(failure.code) ?? '', at: failure.at.toISOString() } : null,
    retryAfterSeconds: runtime.gate.remainingSeconds(),
    canManage: isAdmin(user),
    job: jobRow ? await toJobView(database, jobRow) : null,
  };
};

export const createExsatRouter = (database: LocalDatabase, runtime: ExsatRuntime = sharedExsatRuntime()) => {
  const router = Router();

  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    if (!hasPermission(actor(response), 'p10')) {
      response.status(403).json({ error: 'Seu papel não permite usar a integração com a Exsat, que carrega custo.' });
      return;
    }
    next();
  });

  const handle = (fn: (request: Request, response: Response) => Promise<void>): RequestHandler => (request, response, next: NextFunction) => {
    fn(request, response).catch((error: unknown) => {
      if (error instanceof ExsatServerError) {
        response.status(exsatHttpStatus(error.code)).json({ error: exsatMessage(error.code), code: error.code, retryAfterSeconds: error.retryAfterSeconds });
        return;
      }
      next(error);
    });
  };
  const requireAdmin = (response: Response) => {
    if (isAdmin(actor(response))) return true;
    response.status(403).json({ error: 'Apenas administradores cadastram, trocam ou removem a conta da Exsat.' });
    return false;
  };
  const jobId = (request: Request) => idSchema.parse(request.params.id);
  const startRun = (id: string) => { void runSyncJob(database, runtime, id); };
  const view = async (id: string) => {
    const row = await loadJob(database, id);
    if (!row) throw new Error('EXSAT_JOB_NOT_FOUND');
    return toJobView(database, row);
  };

  router.get('/status', handle(async (_request, response) => {
    response.json({ status: await buildExsatStatus(database, runtime, actor(response)) });
  }));

  // Salvar e conectar: uma tentativa de login por clique; a conta so e gravada (criptografada) se a Exsat aceitar.
  router.put('/credential', handle(async (request, response) => {
    if (!requireAdmin(response)) return;
    const input = credentialSchema.parse(request.body);
    await connectAndSave(database, runtime, actor(response).id, input.username, input.password);
    response.json({ status: await buildExsatStatus(database, runtime, actor(response)) });
  }));

  router.delete('/credential', handle(async (_request, response) => {
    if (!requireAdmin(response)) return;
    for (const control of runtime.runs.values()) control.cancelled = true;
    await database.query("UPDATE exsat_sync_jobs SET status = 'cancelled', finished_at = now(), updated_at = now() WHERE status IN ('running', 'paused')");
    runtime.session.clear();
    await removeCredential(database, actor(response).id);
    response.json({ status: await buildExsatStatus(database, runtime, actor(response)) });
  }));

  router.post('/sync', handle(async (_request, response) => {
    requireKey(runtime.env);
    if (!await getStoredCredentialInfo(database)) throw new ExsatServerError('EXSAT_NOT_CONFIGURED');
    await reconcileInterrupted(database, runtime);
    const running = (await database.query<{ id: string }>("SELECT id FROM exsat_sync_jobs WHERE status = 'running' LIMIT 1")).rows[0];
    if (running) { response.json({ job: await view(running.id), alreadyRunning: true }); return; }
    await ensureSession(database, runtime);
    const id = randomUUID();
    runtime.runs.set(id, { cancelled: false });
    try { await createJob(database, actor(response).id, id); } catch (error) { runtime.runs.delete(id); throw error; }
    startRun(id);
    response.status(202).json({ job: await view(id) });
  }));

  router.post('/sync/:id/resume', handle(async (request, response) => {
    const id = jobId(request);
    const row = await loadJob(database, id);
    if (!row) throw new Error('EXSAT_JOB_NOT_FOUND');
    await reconcileInterrupted(database, runtime);
    if (row.status === 'running' && runtime.runs.has(id)) { response.json({ job: await view(id) }); return; }
    if (row.status !== 'paused' && row.status !== 'running') {
      response.status(409).json({ error: 'Esta varredura já terminou. Comece uma nova.' });
      return;
    }
    requireKey(runtime.env);
    await ensureSession(database, runtime);
    runtime.runs.set(id, { cancelled: false });
    try { await reopenJob(database, id); } catch (error) { runtime.runs.delete(id); throw error; }
    startRun(id);
    response.status(202).json({ job: await view(id) });
  }));

  router.post('/sync/:id/cancel', handle(async (request, response) => {
    const id = jobId(request);
    const control = runtime.runs.get(id);
    if (control) control.cancelled = true;
    await setJobStatus(database, id, 'cancelled');
    response.json({ job: await view(id) });
  }));

  router.get('/sync/:id', handle(async (request, response) => {
    await reconcileInterrupted(database, runtime);
    response.json({ job: await view(jobId(request)) });
  }));

  router.get('/sync/:id/items', handle(async (request, response) => {
    const id = jobId(request);
    const input = itemsSchema.parse(request.query);
    const row = await loadJob(database, id);
    if (!row) throw new Error('EXSAT_JOB_NOT_FOUND');
    if (row.status !== 'done') { response.status(409).json({ error: 'A varredura ainda não terminou.' }); return; }
    response.json(await listPricedItems(database, id, input.offset, input.limit));
  }));

  return router;
};
