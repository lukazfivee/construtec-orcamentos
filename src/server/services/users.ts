import type { AuthRole, UserRecord } from '../../shared/contracts';
import type { LocalDatabase } from './database';
import { forgetCachedSessions, mirrorCentroUser, retireLocalUsers } from './auth';
import {
  CentroIdentityError, centroAuthorizeEmail, centroCreateUser, centroDeleteUser, centroListAuthorizedEmails,
  centroListUsers, centroRevokeEmail, centroSetUserStatus,
} from './centroIdentity';

// Contas vivem no diretorio central (Centro de Custos). Aqui o admin do
// Orcamentos cria, desativa e exclui contas por ele, e decide o papel da
// conta dentro do Orcamentos. Nome, e-mail e senha pertencem a conta central.

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
  active: boolean;
  updated_at: string;
  centro_user_id: string | null;
};

const toUserRecord = (row: UserRow): UserRecord => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  active: row.active,
  updatedAt: row.updated_at,
});

const liveUsers = async (database: LocalDatabase) => (await database.query<UserRow>(`
  SELECT id, name, email, role, active, updated_at::text AS updated_at, centro_user_id
  FROM users
  WHERE deleted_at IS NULL AND centro_user_id IS NOT NULL
  ORDER BY active DESC, lower(name), lower(email)
`)).rows;

// Traz as contas do diretorio para o espelho local antes de listar, para que
// contas recem-criadas no Centro ja aparecam aqui.
export const listUsers = async (database: LocalDatabase, token: string): Promise<UserRecord[]> => {
  const remote = await centroListUsers(token);
  for (const user of remote.users) await mirrorCentroUser(database, user);
  // Contas excluidas no diretorio (por qualquer produto) saem daqui tambem.
  const remoteIds = new Set(remote.users.map((user) => user.id));
  const gone = (await liveUsers(database)).filter((row) => row.centro_user_id && !remoteIds.has(row.centro_user_id));
  await retireLocalUsers(database, gone.map((row) => row.id));
  return (await liveUsers(database)).map(toUserRecord);
};

const findTarget = async (database: LocalDatabase, userId: string) => {
  const result = await database.query<UserRow>(`
    SELECT id, name, email, role, active, updated_at::text AS updated_at, centro_user_id
    FROM users WHERE id::text = $1 AND deleted_at IS NULL LIMIT 1
  `, [userId]);
  const target = result.rows[0];
  if (!target) throw new Error('USER_NOT_FOUND');
  return target;
};

const assertKeepsAdmin = async (database: LocalDatabase, target: UserRow) => {
  if (target.role !== 'admin' || !target.active) return;
  const otherAdmins = await database.query<{ count: string }>(`
    SELECT count(*)::text AS count FROM users
    WHERE id <> $1 AND active = true AND role = 'admin' AND deleted_at IS NULL
  `, [target.id]);
  if (Number(otherAdmins.rows[0]?.count ?? 0) === 0) throw new Error('USER_LAST_ADMIN');
};

export const createUser = async (
  database: LocalDatabase,
  token: string,
  input: { name: string; email: string; password: string; role: AuthRole },
) => {
  const created = await centroCreateUser(token, { name: input.name.trim(), email: input.email.trim().toLowerCase(), password: input.password });
  const row = await mirrorCentroUser(database, created.user, input.role);
  return toUserRecord({ ...row, updated_at: new Date().toISOString() });
};

export const updateUser = async (
  database: LocalDatabase,
  token: string,
  actorUserId: string,
  userId: string,
  input: { role: AuthRole; active: boolean },
) => {
  const target = await findTarget(database, userId);
  if (actorUserId === userId && (!input.active || input.role !== 'admin')) throw new Error('USER_SELF_LOCKOUT');
  if (!input.active || input.role !== 'admin') await assertKeepsAdmin(database, target);
  if (input.active !== target.active) await centroSetUserStatus(token, target.email, input.active, target.centro_user_id);
  const result = await database.query<UserRow>(`
    UPDATE users SET role = $2, active = $3, updated_at = now()
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING id, name, email, role, active, updated_at::text AS updated_at, centro_user_id
  `, [target.id, input.role, input.active]);
  forgetCachedSessions();
  return toUserRecord(result.rows[0]);
};

// Excluir login: some dos dois produtos e libera o e-mail; o historico
// (propostas, selos) continua apontando para a linha antiga.
export const deleteUser = async (database: LocalDatabase, token: string, actorUserId: string, userId: string) => {
  const target = await findTarget(database, userId);
  if (actorUserId === userId) throw new Error('USER_SELF_LOCKOUT');
  await assertKeepsAdmin(database, target);
  try {
    await centroDeleteUser(token, target.email, target.centro_user_id);
  } catch (error) {
    if (!(error instanceof CentroIdentityError && error.status === 404)) throw error;
  }
  await retireLocalUsers(database, [target.id]);
  forgetCachedSessions();
};

export const listAuthorizedEmails = async (token: string) => (await centroListAuthorizedEmails(token)).emails;
export const authorizeEmail = (token: string, email: string, note: string) => centroAuthorizeEmail(token, email, note);
export const revokeEmail = (token: string, email: string) => centroRevokeEmail(token, email);
