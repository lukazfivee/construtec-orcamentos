// Link publico assinado para o cliente ver e aprovar a proposta (Rodada 27). O token nao e guardado:
// ele e derivado do id do link com uma chave do servidor, entao so quem tem a chave o reconstroi.
// Os eventos sao permanentes (gerado, aberto, aprovado, ajuste, confirmado, desativado).
export const clientLinksMigration = `
  CREATE TABLE IF NOT EXISTS proposal_client_links (
    id uuid PRIMARY KEY,
    proposal_id uuid NOT NULL REFERENCES proposals(id),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'approved', 'adjust', 'confirmed')),
    require_identity boolean NOT NULL DEFAULT true,
    expires_at timestamptz NOT NULL,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    closed_at timestamptz
  );
  CREATE INDEX IF NOT EXISTS idx_proposal_client_links_proposal ON proposal_client_links(proposal_id, created_at DESC);
  CREATE TABLE IF NOT EXISTS proposal_client_link_events (
    id uuid PRIMARY KEY,
    link_id uuid NOT NULL REFERENCES proposal_client_links(id),
    kind text NOT NULL CHECK (kind IN ('generated', 'opened', 'approved', 'adjust', 'confirmed', 'disabled')),
    occurred_at timestamptz NOT NULL DEFAULT now(),
    actor_name text,
    actor_role text,
    message text,
    code text,
    device text,
    ip_hash text
  );
  CREATE INDEX IF NOT EXISTS idx_proposal_client_link_events_link ON proposal_client_link_events(link_id, occurred_at DESC);
`;
