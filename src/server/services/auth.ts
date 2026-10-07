import { randomUUID } from 'node:crypto';
import type { AuthRole, AuthSession, AuthSetupStatus, AuthUser } from '../../shared/contracts';
import type { LocalDatabase } from './database';
import { CentroIdentityError, centroConsumeHandoff, centroLogin, centroLogout, centroSession, type CentroUser } from './centroIdentity';
import { resolveSuiteAccess } from './suiteAccess';

// Login e sessao sao do diretorio central (Centro de Custos). O token de
// sessao do Orcamentos e o proprio token central; cada requisicao revalida
// no diretorio, com cache de 60s, para que excluir ou desativar um login
// tenha efeito rapido nos dois produtos. O papel e resolvido aqui.

const SESSION_CACHE_MS = 60 * 1000;
// Depois dos 60s a sessao confirmada ainda vale ate este limite enquanto o diretorio e consultado em segundo plano:
// quem esta usando o app nao espera o Centro (0,5 s com ele acordado, ate 5 s dormindo) a cada minuto.
// Excluir ou desativar um login tem efeito na proxima consulta; sessao parada alem do limite revalida antes de responder.
const SESSION_STALE_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 1000;
const sessionCache = new Map<string, { user: AuthUser; until: number; staleUntil: number }>();
const refreshing = new Map<string, Promise<AuthUser | null>>();
const cacheEntry = (user: AuthUser) => ({ user, until: Date.now() + SESSION_CACHE_MS, staleUntil: Date.now() + SESSION_STALE_MS });
// Incrementado a cada mudanca de papel: verificacoes iniciadas antes nao
// repovoam o cache com o papel antigo.
let cacheGeneration = 0;
// Desktop sem internet: sessao ja confirmada pelo diretorio continua valida
// por um tempo limitado. Nunca na nuvem, e nunca depois de um 401.
const OFFLINE_GRACE_MS = 12 * 60 * 60 * 1000;
const lastConfirmed = new Map<string, { user: AuthUser; at: number }>();

type MirrorRow = {
  id: string; name: string; email: string; role: AuthRole; active: boolean;
  centro_user_id: string | null; centro_admin: boolean; local_role: AuthRole | null; no_password?: boolean;
};
const MIRROR_COLUMNS = 'id, name, email, role, active, centro_user_id, centro_admin, local_role';
const MIRROR_SELECT = `${MIRROR_COLUMNS}, (password_hash IS NULL) AS no_password`;
type Queryable = Pick<LocalDatabase, 'query'>;

const toAuthUser = (row: Pick<MirrorRow, 'id' | 'name' | 'email' | 'role'>, access: Pick<AuthUser, 'suiteRole' | 'apps' | 'permissions'> = {}): AuthUser => ({
  id: String(row.id),
  name: row.name,
  email: row.email,
  role: row.role,
  ...access,
});

export const retireLocalUsers = async (database: Queryable, ids: string[]) => {
  if (!ids.length) return;
  await database.query(
    'UPDATE users SET deleted_at = now(), active = false, updated_at = now() WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL',
    [ids],
  );
};

// Upsert da conta central no espelho local. Admin do Centro e sempre admin
// aqui (centro_admin); as demais contas usam o papel escolhido no Orcamentos
// (local_role), viewer ate um admin mudar. Quem deixa de ser admin no Centro
// volta para o local_role.
// Dois primeiros acessos simultaneos podem disputar o indice unico; a segunda
// tentativa encontra a linha criada pela primeira.
export const mirrorCentroUser = async (database: Queryable, remote: CentroUser, initialRole?: AuthRole): Promise<MirrorRow> => {
  try {
    return await mirrorOnce(database, remote, initialRole);
  } catch (error) {
    if (!/duplicate key|unique constraint/i.test(String((error as Error)?.message))) throw error;
    return mirrorOnce(database, remote, initialRole);
  }
};

const mirrorOnce = async (database: Queryable, remote: CentroUser, initialRole?: AuthRole): Promise<MirrorRow> => {
  const email = remote.email.trim().toLowerCase();
  const byId = await database.query<MirrorRow>(
    `SELECT ${MIRROR_SELECT} FROM users WHERE centro_user_id = $1 AND deleted_at IS NULL LIMIT 1`,
    [remote.id],
  );
  let existing: MirrorRow | undefined = byId.rows[0];
  if (!existing) {
    const byEmail = await database.query<MirrorRow>(
      `SELECT ${MIRROR_SELECT} FROM users WHERE lower(email) = $1 AND deleted_at IS NULL LIMIT 1`,
      [email],
    );
    existing = byEmail.rows[0];
    // E-mail de uma conta central antiga, excluida e recriada: nova linha.
    if (existing?.centro_user_id && existing.centro_user_id !== remote.id) {
      await retireLocalUsers(database, [existing.id]);
      existing = undefined;
    }
  }
  const centroAdmin = remote.role === 'admin';
  if (existing) {
    // Linha local antiga (sem conta central) nao transfere o papel antigo.
    const localRole = existing.centro_user_id ? existing.local_role : (initialRole ?? null);
    // E-mail trocado no Centro para um que ainda esta numa linha antiga:
    // aposenta a linha antiga para liberar o indice unico.
    if (existing.email.toLowerCase() !== email) {
      await database.query(
        'UPDATE users SET deleted_at = now(), active = false, updated_at = now() WHERE lower(email) = $1 AND id <> $2 AND deleted_at IS NULL',
        [email, existing.id],
      );
    }
    const nextRole = centroAdmin ? 'admin' : (localRole ?? 'viewer');
    // Nada mudou desde a ultima consulta: sem gravar (a cada minuto de uso isso seria uma escrita no banco por pedido).
    if (existing.no_password && existing.name === remote.name && existing.email === email && existing.active === (remote.active !== false)
      && existing.centro_user_id === remote.id && existing.role === nextRole && existing.centro_admin === centroAdmin && existing.local_role === localRole) return existing;
    const updated = await database.query<MirrorRow>(`
      UPDATE users SET name = $2, email = $3, active = $4, centro_user_id = $5,
        role = $6, centro_admin = $7, local_role = $8, password_hash = NULL, updated_at = now()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING ${MIRROR_COLUMNS}
    `, [existing.id, remote.name, email, remote.active !== false, remote.id, centroAdmin ? 'admin' : (localRole ?? 'viewer'), centroAdmin, localRole]);
    if (updated.rows[0]) return updated.rows[0];
  }
  const inserted = await database.query<MirrorRow>(`
    INSERT INTO users (id, name, email, password_hash, role, active, centro_user_id, centro_admin, local_role)
    VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8)
    RETURNING ${MIRROR_COLUMNS}
  `, [randomUUID(), remote.name, email, centroAdmin ? 'admin' : (initialRole ?? 'viewer'), remote.active !== false, remote.id, centroAdmin, initialRole ?? null]);
  return inserted.rows[0];
};

export const getAuthSetupStatus = async (): Promise<AuthSetupStatus> => ({ requiresSetup: false });

export const loginUser = async (
  database: LocalDatabase,
  email: string,
  password: string,
  clientIp?: string,
): Promise<AuthSession> => {
  let remote: Awaited<ReturnType<typeof centroLogin>>;
  try {
    remote = await centroLogin(email.trim().toLowerCase(), password, clientIp);
  } catch (error) {
    if (error instanceof CentroIdentityError && [400, 401].includes(error.status)) throw new Error('AUTH_INVALID_CREDENTIALS');
    throw error;
  }
  const row = await mirrorCentroUser(database, remote.user);
  if (!row.active) throw new Error('AUTH_INVALID_CREDENTIALS');
  const user = toAuthUser(row, await resolveSuiteAccess(remote.user, remote.sessionToken));
  sessionCache.set(remote.sessionToken, cacheEntry(user));
  lastConfirmed.set(remote.sessionToken, { user, at: Date.now() });
  return { token: remote.sessionToken, user };
};

// Entrada pelo app Suite Construtec: o codigo de uso unico vira a sessao.
export const consumeHandoff = async (database: LocalDatabase, code: string): Promise<AuthSession> => {
  let remote: Awaited<ReturnType<typeof centroConsumeHandoff>>;
  try {
    remote = await centroConsumeHandoff(code);
  } catch (error) {
    if (error instanceof CentroIdentityError && error.status === 400) throw new Error('AUTH_HANDOFF_INVALID');
    throw error;
  }
  const row = await mirrorCentroUser(database, remote.user);
  if (!row.active) throw new Error('AUTH_INVALID_CREDENTIALS');
  const user = toAuthUser(row, await resolveSuiteAccess(remote.user, remote.sessionToken));
  sessionCache.set(remote.sessionToken, cacheEntry(user));
  lastConfirmed.set(remote.sessionToken, { user, at: Date.now() });
  return { token: remote.sessionToken, user };
};

const revalidateSession = async (database: LocalDatabase, token: string): Promise<AuthUser | null> => {
  const generation = cacheGeneration;
  try {
    const remote = await centroSession(token);
    const row = await mirrorCentroUser(database, remote.user);
    if (!row.active) { sessionCache.delete(token); lastConfirmed.delete(token); return null; }
    const user = toAuthUser(row, await resolveSuiteAccess(remote.user, token));
    if (generation === cacheGeneration) {
      if (sessionCache.size >= MAX_CACHE_ENTRIES) sessionCache.clear();
      sessionCache.set(token, cacheEntry(user));
      if (lastConfirmed.size >= MAX_CACHE_ENTRIES) lastConfirmed.clear();
      lastConfirmed.set(token, { user, at: Date.now() });
    }
    return user;
  } catch (error) {
    sessionCache.delete(token);
    if (error instanceof CentroIdentityError && error.status === 401) {
      lastConfirmed.delete(token);
      return null;
    }
    const confirmed = lastConfirmed.get(token);
    const offlineDesktop = !process.env.DATABASE_URL && error instanceof CentroIdentityError && error.code === 'IDENTITY_UNAVAILABLE';
    if (offlineDesktop && confirmed && Date.now() - confirmed.at < OFFLINE_GRACE_MS && generation === cacheGeneration) return confirmed.user;
    throw error;
  }
};

// Uma revalidacao por token de cada vez (chamadas simultaneas dividem a mesma consulta).
const revalidateOnce = (database: LocalDatabase, token: string): Promise<AuthUser | null> => {
  const running = refreshing.get(token);
  if (running) return running;
  const task = revalidateSession(database, token).finally(() => { refreshing.delete(token); });
  refreshing.set(token, task);
  return task;
};

export const verifyUserSession = async (database: LocalDatabase, token: string): Promise<AuthUser | null> => {
  if (!token) return null;
  const cached = sessionCache.get(token);
  if (cached && cached.until > Date.now()) return cached.user;
  if (cached && cached.staleUntil > Date.now()) {
    // Responde na hora com a sessao ja confirmada e atualiza em segundo plano; se o diretorio recusar, o proximo pedido cai fora.
    void revalidateOnce(database, token).catch(() => undefined);
    return cached.user;
  }
  return revalidateOnce(database, token);
};

export const logoutUser = async (token: string) => {
  sessionCache.delete(token);
  lastConfirmed.delete(token);
  if (token) await centroLogout(token).catch(() => undefined);
};

// Papel local mudou (tela de usuarios): descarta caches com o papel antigo.
export const forgetCachedSessions = () => {
  cacheGeneration += 1;
  sessionCache.clear();
  lastConfirmed.clear();
};

// Testes: expira o cache de 60s sem descartar as sessoes ja confirmadas.
export const expireSessionCacheForTests = () => sessionCache.clear();
// Testes: passa dos 60s mas ainda dentro do limite de revalidacao em segundo plano.
export const ageSessionCacheForTests = () => { for (const entry of sessionCache.values()) entry.until = Date.now() - 1; };
export const settleSessionRefreshForTests = () => Promise.allSettled([...refreshing.values()]);
