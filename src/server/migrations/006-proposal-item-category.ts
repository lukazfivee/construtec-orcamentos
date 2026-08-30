export const proposalItemCategoryMigration = `
  ALTER TABLE proposal_items
    ADD COLUMN IF NOT EXISTS snapshot_category text NOT NULL DEFAULT 'Outros';
`;
