export const proposalLaborMigration = `
  ALTER TABLE proposals
    ADD COLUMN IF NOT EXISTS standard_monthly_hours numeric(10,2) NOT NULL DEFAULT 176;

  CREATE TABLE IF NOT EXISTS proposal_labor_items (
    id uuid PRIMARY KEY,
    proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
    position integer NOT NULL,
    description text NOT NULL,
    professional_count numeric(10,2) NOT NULL CHECK (professional_count > 0),
    monthly_salary numeric(14,2) NOT NULL DEFAULT 0 CHECK (monthly_salary >= 0),
    monthly_food numeric(14,2) NOT NULL DEFAULT 0 CHECK (monthly_food >= 0),
    monthly_transport numeric(14,2) NOT NULL DEFAULT 0 CHECK (monthly_transport >= 0),
    monthly_other_costs numeric(14,2) NOT NULL DEFAULT 0 CHECK (monthly_other_costs >= 0),
    standard_monthly_hours numeric(10,2) NOT NULL CHECK (standard_monthly_hours > 0),
    planned_hours numeric(12,2) NOT NULL CHECK (planned_hours >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS proposal_labor_items_proposal_idx
    ON proposal_labor_items(proposal_id, position);
`;
