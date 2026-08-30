export const kitsAndSettingsMigration = `
  CREATE TABLE IF NOT EXISTS kits (
    id uuid PRIMARY KEY,
    name text NOT NULL UNIQUE,
    description text,
    category text NOT NULL DEFAULT 'Geral',
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS kit_items (
    id uuid PRIMARY KEY,
    kit_id uuid NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity numeric(14, 4) NOT NULL CHECK (quantity > 0),
    position integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (kit_id, position)
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_kits_category ON kits (category, active, name);
  CREATE INDEX IF NOT EXISTS idx_kit_items_kit ON kit_items (kit_id, position);
`;
