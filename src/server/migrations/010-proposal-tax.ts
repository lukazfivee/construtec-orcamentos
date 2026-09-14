export const proposalTaxMigration = `
  ALTER TABLE proposals ADD COLUMN IF NOT EXISTS tax_percentage numeric(5, 2) NOT NULL DEFAULT 0;
`;
