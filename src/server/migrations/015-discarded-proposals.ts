// Propostas descartadas por um administrador (inclusive aprovadas). O conteudo inteiro fica em JSON para
// a proposta poder ser restaurada; o registro de quem descartou, quando e por que e permanente.
export const discardedProposalsMigration = `
  CREATE TABLE IF NOT EXISTS discarded_proposals (
    id uuid PRIMARY KEY,
    proposal_number text NOT NULL,
    client_name text,
    work_name text,
    revision_count integer NOT NULL DEFAULT 1,
    had_approval boolean NOT NULL DEFAULT false,
    reason text,
    payload jsonb NOT NULL,
    discarded_by uuid,
    discarded_by_name text,
    discarded_at timestamptz NOT NULL DEFAULT now(),
    restored_at timestamptz,
    restored_by_name text
  );
  CREATE INDEX IF NOT EXISTS idx_discarded_proposals_number ON discarded_proposals(proposal_number);
`;
