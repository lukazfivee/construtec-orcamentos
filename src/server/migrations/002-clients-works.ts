export const clientsAndWorksMigration = `
  CREATE TABLE IF NOT EXISTS works (
    id uuid PRIMARY KEY,
    client_id uuid NOT NULL REFERENCES clients(id),
    name text NOT NULL,
    address text,
    active boolean NOT NULL DEFAULT true,
    revision integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (client_id, name)
  );

  ALTER TABLE proposals ADD COLUMN IF NOT EXISTS work_id uuid REFERENCES works(id);
  ALTER TABLE proposals ADD COLUMN IF NOT EXISTS snapshot_client_name text;
  ALTER TABLE proposals ADD COLUMN IF NOT EXISTS snapshot_work_name text;

  UPDATE proposals p
  SET snapshot_client_name = COALESCE(c.trade_name, c.legal_name),
      snapshot_work_name = p.work_name
  FROM clients c
  WHERE c.id = p.client_id
    AND (p.snapshot_client_name IS NULL OR p.snapshot_work_name IS NULL);

  CREATE INDEX IF NOT EXISTS idx_works_client ON works (client_id, active, name);
`;
