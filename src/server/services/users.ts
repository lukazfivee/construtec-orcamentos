import { randomUUID } from 'node:crypto';
import { hash } from 'bcryptjs';
import type { AuthRole, UserRecord } from '../../shared/contracts';
import type { LocalDatabase } from './database';

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
  active: boolean;
  updated_at: string;
};

const toUserRecord = (row: UserRow): UserRecord => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  active: row.active,
  updatedAt: row.updated_at,
});

export const listUsers = async (database: LocalDatabase): Promise<UserRecord[]> => {
  const result = await database.query<UserRow>(`
    SELECT id, name, email, role, active, updated_at::text AS updated_at
    FROM users
    ORDER BY active DESC, lower(name), lower(email)
  `);
  return result.rows.map(toUserRecord);
};

const assertEmailAvailable = async (database: LocalDatabase, email: string, exceptUserId?: string) => {
  const result = await database.query<{ id: string }>(`
    SELECT id FROM users
    WHERE lower(email) = lower($1) AND ($2::uuid IS NULL OR id <> $2::uuid)
    LIMIT 1
  `, [email.trim(), exceptUserId ?? null]);
  if (result.rows.length > 0) throw new Error('USER_EMAIL_DUPLICATE');
};

export const createUser = async (
  database: LocalDatabase,
  input: { name: string; email: string; password: string; role: AuthRole },
) => {
  await assertEmailAvailable(database, input.email);
  const passwordHash = await hash(input.password, 12);
  const result = await database.query<UserRow>(`
    INSERT INTO users (id, name, email, password_hash, role, active)
    VALUES ($1, $2, lower($3), $4, $5, true)
    RETURNING id, name, email, role, active, updated_at::text AS updated_at
  `, [randomUUID(), input.name.trim(), input.email.trim(), passwordHash, input.role]);
  return toUserRecord(result.rows[0]);
};

export const updateUser = async (
  database: LocalDatabase,
  actorUserId: string,
  userId: string,
  input: { name: string; email: string; role: AuthRole; active: boolean },
) => {
  const targetResult = await database.query<UserRow>(`
    SELECT id, name, email, role, active, updated_at::text AS updated_at
    FROM users WHERE id = $1 LIMIT 1
  `, [userId]);
  const target = targetResult.rows[0];
  if (!target) throw new Error('USER_NOT_FOUND');

  if (actorUserId === userId && (!input.active || input.role !== 'admin')) {
    throw new Error('USER_SELF_LOCKOUT');
  }

  if (target.role === 'admin' && target.active && (!input.active || input.role !== 'admin')) {
    const otherAdmins = await database.query<{ count: string }>(`
      SELECT count(*)::text AS count FROM users
      WHERE id <> $1 AND active = true AND role = 'admin'
    `, [userId]);
    if (Number(otherAdmins.rows[0]?.count ?? 0) === 0) throw new Error('USER_LAST_ADMIN');
  }

  await assertEmailAvailable(database, input.email, userId);
  const result = await database.query<UserRow>(`
    UPDATE users
    SET name = $2, email = lower($3), role = $4, active = $5, updated_at = now()
    WHERE id = $1
    RETURNING id, name, email, role, active, updated_at::text AS updated_at
  `, [userId, input.name.trim(), input.email.trim(), input.role, input.active]);
  return toUserRecord(result.rows[0]);
};

export const resetUserPassword = async (database: LocalDatabase, userId: string, password: string) => {
  const passwordHash = await hash(password, 12);
  const result = await database.query<{ id: string }>(`
    UPDATE users SET password_hash = $2, updated_at = now()
    WHERE id = $1
    RETURNING id
  `, [userId, passwordHash]);
  if (!result.rows[0]) throw new Error('USER_NOT_FOUND');
};
