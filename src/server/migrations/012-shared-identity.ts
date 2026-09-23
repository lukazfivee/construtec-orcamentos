// Identidade compartilhada com o Centro de Custos: a conta e a senha vivem no
// diretorio central; aqui fica so o espelho da conta (casado por
// centro_user_id) e o papel dentro do Orcamentos. Contas locais antigas eram
// de teste (decisao de 22/09/2026): perdem a senha e o acesso, mas a linha
// fica para o historico de propostas continuar apontando para ela.
export const sharedIdentityMigration = `
  ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS centro_user_id text;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
  CREATE UNIQUE INDEX IF NOT EXISTS users_email_live_unique ON users (lower(email)) WHERE deleted_at IS NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS users_centro_user_id_unique ON users (centro_user_id) WHERE centro_user_id IS NOT NULL AND deleted_at IS NULL;
  UPDATE users SET password_hash = NULL, active = false, updated_at = now() WHERE centro_user_id IS NULL;
`;
