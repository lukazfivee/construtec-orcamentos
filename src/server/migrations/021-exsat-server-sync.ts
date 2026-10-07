// Conta da Exsat guardada no servidor (senha so criptografada, AES-256-GCM) e varreduras do catalogo em segundo plano.
// exsat_credentials NAO entra no dump diario do backup (ver .github/workflows/backup-postgres.yml).
export const exsatServerSyncMigration = `
  CREATE TABLE IF NOT EXISTS exsat_credentials (
    id text PRIMARY KEY CHECK (id = 'default'),
    username_hint text NOT NULL,
    secret_payload text NOT NULL,
    configured_by uuid,
    configured_at timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz
  );

  CREATE TABLE IF NOT EXISTS exsat_sync_jobs (
    id uuid PRIMARY KEY,
    status text NOT NULL CHECK (status IN ('running', 'paused', 'done', 'failed', 'cancelled')),
    started_by uuid,
    queue jsonb NOT NULL DEFAULT '[]'::jsonb,
    visited jsonb NOT NULL DEFAULT '[]'::jsonb,
    pages_read integer NOT NULL DEFAULT 0,
    pages_failed integer NOT NULL DEFAULT 0,
    relogins integer NOT NULL DEFAULT 0,
    error_code text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uq_exsat_sync_one_running ON exsat_sync_jobs ((true)) WHERE status = 'running';

  CREATE TABLE IF NOT EXISTS exsat_sync_items (
    job_id uuid NOT NULL REFERENCES exsat_sync_jobs(id) ON DELETE CASCADE,
    code text NOT NULL,
    price numeric(14, 2) NOT NULL DEFAULT 0,
    item jsonb NOT NULL,
    PRIMARY KEY (job_id, code)
  );
`;
