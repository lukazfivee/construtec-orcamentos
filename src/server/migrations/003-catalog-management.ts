export const catalogManagementMigration = `
  ALTER TABLE products ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
  CREATE INDEX IF NOT EXISTS idx_products_active_search
    ON products (active, category, code);
`;
