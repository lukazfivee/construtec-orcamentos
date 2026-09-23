import { randomUUID } from 'node:crypto';
import type { AuthRole, AuthSession, AuthSetupStatus, AuthUser } from '../../shared/contracts';
import type { LocalDatabase } from './database';
import { CentroIdentityError, centroLogin, centroLogout, centroSession, type CentroUser } from './centroIdentity';

// Login e sessao sao do diretorio central (Centro de Custos). O token de
// sessao do Orcamentos e o proprio token central; cada requisicao revalida
// no diretorio, com cache de 60s, para que excluir ou desativar um login
// tenha efeito rapido nos dois produtos. O papel e resolvido aqui.

const SESSION_CACHE_MS = 60 * 1000;
const MAX_CACHE_ENTRIES = 1000;
const sessionCache = new Map<string, { user: AuthUser; until: number }>();
// Incrementado a cada mudanca de papel: verificacoes iniciadas antes nao
// repovoam o cache com o papel antigo.
let cacheGeneration = 0;

type MirrorRow = { id: string; name: string; email: string; role: AuthRole; active: boolean; centro_user_id: string | null };
type Queryable = Pick<LocalDatabase, 'query'>;

const toAuthUser = (row: Pick<MirrorRow, 'id' | 'name' | 'email' | 'role'>): AuthUser => ({
  id: String(row.id),
  name: row.name,
  email: row.email,
  role: row.role,
});

export const retireLocalUsers = async (database: Queryable, ids: string[]) => {
  if (!ids.length) return;
  await database.query(
    'UPDATE users SET deleted_at = now(), active = false, updated_at = now() WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL',
    [ids],
  );
};

// Upsert da conta central no espelho local. Admin do Centro e sempre admin
// aqui; as demais contas entram como viewer ate um admin do Orcamentos mudar.
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
    'SELECT id, name, email, role, active, centro_user_id FROM users WHERE centro_user_id = $1 AND deleted_at IS NULL LIMIT 1',
    [remote.id],
  );
  let existing: MirrorRow | undefined = byId.rows[0];
  if (!existing) {
    const byEmail = await database.query<MirrorRow>(
      'SELECT id, name, email, role, active, centro_user_id FROM users WHERE lower(email) = $1 AND deleted_at IS NULL LIMIT 1',
      [email],
    );
    existing = byEmail.rows[0];
    // E-mail de uma conta central antiga, excluida e recriada: nova linha.
    if (existing?.centro_user_id && existing.centro_user_id !== remote.id) {
      await retireLocalUsers(database, [existing.id]);
      existing = undefined;
    }
  }
  const promoted = remote.role === 'admin' ? 'admin' : null;
  if (existing) {
    // Linha local antiga (sem conta central) nao transfere o papel antigo.
    const role = existing.centro_user_id ? (promoted ?? existing.role) : (promoted ?? initialRole ?? 'viewer');
    const updated = await database.query<MirrorRow>(`
      UPDATE users SET name = $2, email = $3, active = $4, centro_user_id = $5,
        role = $6, password_hash = NULL, updated_at = now()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id, name, email, role, active, centro_user_id
    `, [existing.id, remote.name, email, remote.active !== false, remote.id, role]);
    if (updated.rows[0]) return updated.rows[0];
  }
  const inserted = await database.query<MirrorRow>(`
    INSERT INTO users (id, name, email, password_hash, role, active, centro_user_id)
    VALUES ($1, $2, $3, NULL, $4, $5, $6)
    RETURNING id, name, email, role, active, centro_user_id
  `, [randomUUID(), remote.name, email, promoted ?? initialRole ?? 'viewer', remote.active !== false, remote.id]);
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
  const user = toAuthUser(row);
  sessionCache.set(remote.sessionToken, { user, until: Date.now() + SESSION_CACHE_MS });
  return { token: remote.sessionToken, user };
};

export const verifyUserSession = async (database: LocalDatabase, token: string): Promise<AuthUser | null> => {
  if (!token) return null;
  const cached = sessionCache.get(token);
  if (cached && cached.until > Date.now()) return cached.user;
  const generation = cacheGeneration;
  try {
    const remote = await centroSession(token);
    const row = await mirrorCentroUser(database, remote.user);
    if (!row.active) return null;
    const user = toAuthUser(row);
    if (generation === cacheGeneration) {
      if (sessionCache.size >= MAX_CACHE_ENTRIES) sessionCache.clear();
      sessionCache.set(token, { user, until: Date.now() + SESSION_CACHE_MS });
    }
    return user;
  } catch (error) {
    sessionCache.delete(token);
    if (error instanceof CentroIdentityError && error.status === 401) return null;
    throw error;
  }
};

export const logoutUser = async (token: string) => {
  sessionCache.delete(token);
  if (token) await centroLogout(token).catch(() => undefined);
};

// Papel local mudou (tela de usuarios): descarta caches com o papel antigo.
export const forgetCachedSessions = () => {
  cacheGeneration += 1;
  sessionCache.clear();
};
