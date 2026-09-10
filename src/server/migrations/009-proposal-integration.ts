export const proposalIntegrationMigration = `
  ALTER TABLE proposals ADD COLUMN IF NOT EXISTS series_id uuid;

  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'approved_proposal_guard') THEN
      ALTER TABLE proposals DISABLE TRIGGER approved_proposal_guard;
    END IF;
  END;
  $$;

  -- Backfill series_id determinístico para propostas existentes agrupadas por proposal_number
  UPDATE proposals p
  SET series_id = s.generated_series_id
  FROM (
    SELECT proposal_number, gen_random_uuid() AS generated_series_id
    FROM proposals
    WHERE series_id IS NULL
    GROUP BY proposal_number
  ) s
  WHERE p.proposal_number = s.proposal_number AND p.series_id IS NULL;

  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'approved_proposal_guard') THEN
      ALTER TABLE proposals ENABLE TRIGGER approved_proposal_guard;
    END IF;
  END;
  $$;

  ALTER TABLE proposals ALTER COLUMN series_id SET DEFAULT gen_random_uuid();
  ALTER TABLE proposals ALTER COLUMN series_id SET NOT NULL;

  CREATE TABLE IF NOT EXISTS proposal_approval_snapshots (
    id uuid PRIMARY KEY,
    proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE RESTRICT,
    series_id uuid NOT NULL,
    revision integer NOT NULL,
    payload jsonb NOT NULL,
    payload_sha256 text NOT NULL,
    sealed_at timestamptz NOT NULL DEFAULT now(),
    sealed_by uuid REFERENCES users(id),
    UNIQUE (proposal_id),
    UNIQUE (series_id, revision)
  );

  CREATE OR REPLACE FUNCTION protect_proposal_snapshot() RETURNS trigger AS $$
  BEGIN
    RAISE EXCEPTION 'SNAPSHOT_LOCKED';
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER snapshot_immutable_guard BEFORE UPDATE OR DELETE ON proposal_approval_snapshots
    FOR EACH ROW EXECUTE FUNCTION protect_proposal_snapshot();

  CREATE TABLE IF NOT EXISTS integration_outbox (
    id uuid PRIMARY KEY,
    snapshot_id uuid NOT NULL REFERENCES proposal_approval_snapshots(id) ON DELETE RESTRICT,
    destination text NOT NULL DEFAULT 'centro-de-custos',
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
    attempts integer NOT NULL DEFAULT 0,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    delivered_at timestamptz,
    UNIQUE (snapshot_id, destination)
  );

  CREATE INDEX IF NOT EXISTS idx_integration_outbox_status ON integration_outbox(status, created_at);
`;
