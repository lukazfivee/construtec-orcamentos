// Ultima copia do acompanhamento da obra no Centro de Custos por proposta
// integrada (somente leitura; ver spec 2026-09-22-sincronizacao-orcamentos).
export const proposalCenterSnapshotsMigration = `
  CREATE TABLE IF NOT EXISTS proposal_center_snapshots (
    proposal_id uuid PRIMARY KEY REFERENCES proposals(id) ON DELETE CASCADE,
    contract_id text NOT NULL,
    payload jsonb NOT NULL,
    fetched_at timestamptz NOT NULL DEFAULT now()
  );
`;
