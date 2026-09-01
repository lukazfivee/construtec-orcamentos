import { randomUUID } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import { sign, verify, type JwtPayload } from 'jsonwebtoken';
import type { AuthRole, AuthSession, AuthSetupStatus, AuthUser } from '../../shared/contracts';
import type { LocalDatabase } from './database';

const DEMO_EMAIL = 'marcos.demo@construtec.local';
const JWT_ISSUER = 'construtec-orcamentos';
const JWT_AUDIENCE = 'local-api';
const SESSION_TTL_SECONDS = 8 * 60 * 60;

type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: AuthRole;
  active: boolean;
};

const toAuthUser = (row: Pick<UserRow, 'id' | 'name' | 'email' | 'role'>): AuthUser => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
});

const createSession = (user: AuthUser, secret: string): AuthSession => ({
  token: sign(
    { name: user.name, email: user.email, role: user.role },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: SESSION_TTL_SECONDS,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      subject: user.id,
      jwtid: randomUUID(),
    },
  ),
  user,
});

export const getAuthSetupStatus = async (database: LocalDatabase): Promise<AuthSetupStatus> => {
  const result = await database.query<{ count: string }>(`
    SELECT count(*)::text AS count
    FROM users
    WHERE active = true AND lower(email) <> lower($1)
  `, [DEMO_EMAIL]);
  return { requiresSetup: Number(result.rows[0]?.count ?? 0) === 0 };
};

export const setupFirstAdmin = async (
  database: LocalDatabase,
  secret: string,
  input: { name: string; email: string; password: string },
): Promise<AuthSession> => {
  const userId = randomUUID();
  const passwordHash = await hash(input.password, 12);
  const user = await database.transaction(async (transaction) => {
    const existing = await transaction.query<{ count: string }>(`
      SELECT count(*)::text AS count
      FROM users
      WHERE active = true AND lower(email) <> lower($1)
      FOR UPDATE
    `, [DEMO_EMAIL]);
    if (Number(existing.rows[0]?.count ?? 0) > 0) throw new Error('AUTH_SETUP_COMPLETE');

    await transaction.query('UPDATE users SET active = false, updated_at = now() WHERE lower(email) = lower($1)', [DEMO_EMAIL]);
    const inserted = await transaction.query<UserRow>(`
      INSERT INTO users (id, name, email, password_hash, role, active)
      VALUES ($1, $2, lower($3), $4, 'admin', true)
      RETURNING id, name, email, password_hash, role, active
    `, [userId, input.name.trim(), input.email.trim(), passwordHash]);
    return toAuthUser(inserted.rows[0]);
  });
  return createSession(user, secret);
};

export const loginUser = async (
  database: LocalDatabase,
  secret: string,
  email: string,
  password: string,
): Promise<AuthSession> => {
  const result = await database.query<UserRow>(`
    SELECT id, name, email, password_hash, role, active
    FROM users
    WHERE lower(email) = lower($1) AND active = true
    LIMIT 1
  `, [email.trim()]);
  const row = result.rows[0];
  if (!row || !(await compare(password, row.password_hash))) throw new Error('AUTH_INVALID_CREDENTIALS');
  return createSession(toAuthUser(row), secret);
};

export const verifyUserSession = async (
  database: LocalDatabase,
  secret: string,
  token: string,
): Promise<AuthUser | null> => {
  try {
    const payload = verify(token, secret, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as JwtPayload;
    if (typeof payload.sub !== 'string') return null;

    const result = await database.query<UserRow>(`
      SELECT id, name, email, password_hash, role, active
      FROM users
      WHERE id = $1 AND active = true
      LIMIT 1
    `, [payload.sub]);
    return result.rows[0] ? toAuthUser(result.rows[0]) : null;
  } catch {
    return null;
  }
};
