export const integrationOutboxResultMigration = `
  ALTER TABLE integration_outbox ADD COLUMN IF NOT EXISTS cost_center_id integer;
  ALTER TABLE integration_outbox ADD COLUMN IF NOT EXISTS contract_id text;
  ALTER TABLE integration_outbox ADD COLUMN IF NOT EXISTS center_url text;
`;
