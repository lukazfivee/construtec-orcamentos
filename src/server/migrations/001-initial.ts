export const initialMigration = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version integer PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    role text NOT NULL CHECK (role IN ('admin', 'commercial', 'viewer')),
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS clients (
    id uuid PRIMARY KEY,
    legal_name text NOT NULL,
    trade_name text,
    document text,
    revision integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS products (
    id uuid PRIMARY KEY,
    code text NOT NULL UNIQUE,
    manufacturer text,
    model text,
    description text NOT NULL,
    category text NOT NULL,
    unit text NOT NULL,
    current_cost numeric(14, 2) NOT NULL CHECK (current_cost >= 0),
    source text NOT NULL DEFAULT 'CONSTRUTEC',
    source_updated_at timestamptz,
    revision integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS proposals (
    id uuid PRIMARY KEY,
    proposal_number text NOT NULL,
    revision integer NOT NULL DEFAULT 0,
    client_id uuid NOT NULL REFERENCES clients(id),
    work_name text NOT NULL,
    scope text NOT NULL,
    status text NOT NULL CHECK (status IN ('draft', 'review', 'sent', 'approved', 'rejected')),
    bdi_multiplier numeric(8, 4) NOT NULL DEFAULT 1,
    valid_until date,
    created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (proposal_number, revision)
  );

  CREATE TABLE IF NOT EXISTS proposal_items (
    id uuid PRIMARY KEY,
    proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
    catalog_product_id uuid REFERENCES products(id),
    position integer NOT NULL,
    snapshot_code text NOT NULL,
    snapshot_manufacturer text,
    snapshot_model text,
    snapshot_description text NOT NULL,
    snapshot_unit text NOT NULL,
    snapshot_unit_cost numeric(14, 2) NOT NULL CHECK (snapshot_unit_cost >= 0),
    quantity numeric(14, 4) NOT NULL CHECK (quantity > 0),
    sale_unit_price numeric(14, 2) NOT NULL CHECK (sale_unit_price >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (proposal_id, position)
  );

  CREATE TABLE IF NOT EXISTS audit_events (
    id uuid PRIMARY KEY,
    user_id uuid REFERENCES users(id),
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    action text NOT NULL,
    before_data jsonb,
    after_data jsonb,
    occurred_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_products_search
    ON products (category, manufacturer, model);
  CREATE INDEX IF NOT EXISTS idx_proposal_items_proposal
    ON proposal_items (proposal_id, position);
`;
