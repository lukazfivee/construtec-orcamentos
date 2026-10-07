import { randomUUID } from 'node:crypto';
import type { LocalDatabase } from './database';
import { decryptSecret, encryptSecret, ExsatCryptoError, loadCredentialKey, maskUsername } from './exsatCrypto';
import { ExsatServerError } from './exsatErrors';

// Id fixo para a trilha de auditoria da conta (o audit_events exige um uuid). O registro da auditoria so diz o que
// aconteceu e o usuario mascarado; nunca a senha, o texto cifrado nem o e-mail inteiro.
const AUDIT_ID = '00000000-0000-4000-8000-0000000e5a70';

type Row = { username_hint: string; configured_at: string; last_login_at: string | null };

export type StoredCredentialInfo = { usernameHint: string; configuredAt: string; lastLoginAt: string | null };

// Chave ausente ou invalida: falha fechado, sem gravar nem ler nada.
export const requireKey = (env: NodeJS.ProcessEnv = process.env): Buffer => {
  try { return loadCredentialKey(env); } catch (error) {
    if (error instanceof ExsatCryptoError && (error.code === 'EXSAT_KEY_MISSING' || error.code === 'EXSAT_KEY_INVALID')) throw new ExsatServerError(error.code);
    throw new ExsatServerError('EXSAT_KEY_INVALID');
  }
};

export const getStoredCredentialInfo = async (database: LocalDatabase): Promise<StoredCredentialInfo | null> => {
  const result = await database.query<Row>(
    "SELECT username_hint, configured_at::text, last_login_at::text FROM exsat_credentials WHERE id = 'default'",
  );
  const row = result.rows[0];
  return row ? { usernameHint: row.username_hint, configuredAt: row.configured_at, lastLoginAt: row.last_login_at } : null;
};

const audit = (database: LocalDatabase, userId: string, action: string, hint: string | null) => database.query(
  'INSERT INTO audit_events (id, user_id, entity_type, entity_id, action, after_data) VALUES ($1, $2, $3, $4, $5, $6::jsonb)',
  [randomUUID(), userId, 'exsat_credential', AUDIT_ID, action, JSON.stringify({ usernameHint: hint })],
);

export const saveCredential = async (database: LocalDatabase, userId: string, username: string, password: string, key: Buffer) => {
  const payload = encryptSecret(JSON.stringify({ u: username, p: password }), key);
  const hint = maskUsername(username);
  await database.transaction(async (transaction) => {
    await transaction.query(`
      INSERT INTO exsat_credentials (id, username_hint, secret_payload, configured_by, configured_at, last_login_at)
      VALUES ('default', $1, $2, $3, now(), now())
      ON CONFLICT (id) DO UPDATE SET username_hint = EXCLUDED.username_hint, secret_payload = EXCLUDED.secret_payload,
        configured_by = EXCLUDED.configured_by, configured_at = now(), last_login_at = now()
    `, [hint, payload, userId]);
    await transaction.query(
      'INSERT INTO audit_events (id, user_id, entity_type, entity_id, action, after_data) VALUES ($1, $2, $3, $4, $5, $6::jsonb)',
      [randomUUID(), userId, 'exsat_credential', AUDIT_ID, 'saved', JSON.stringify({ usernameHint: hint })],
    );
  });
};

export const removeCredential = async (database: LocalDatabase, userId: string) => {
  const info = await getStoredCredentialInfo(database);
  await database.query("DELETE FROM exsat_credentials WHERE id = 'default'");
  if (info) await audit(database, userId, 'removed', info.usernameHint);
};

export const loadCredential = async (database: LocalDatabase, key: Buffer): Promise<{ username: string; password: string }> => {
  const result = await database.query<{ secret_payload: string }>("SELECT secret_payload FROM exsat_credentials WHERE id = 'default'");
  const row = result.rows[0];
  if (!row) throw new ExsatServerError('EXSAT_NOT_CONFIGURED');
  try {
    const parsed = JSON.parse(decryptSecret(row.secret_payload, key)) as { u?: unknown; p?: unknown };
    if (typeof parsed.u !== 'string' || typeof parsed.p !== 'string' || !parsed.u || !parsed.p) throw new Error('shape');
    return { username: parsed.u, password: parsed.p };
  } catch {
    throw new ExsatServerError('EXSAT_CREDENTIAL_UNREADABLE');
  }
};

export const touchLastLogin = (database: LocalDatabase) => database.query("UPDATE exsat_credentials SET last_login_at = now() WHERE id = 'default'");
