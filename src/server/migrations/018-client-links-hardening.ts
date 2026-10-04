// Endurecimento do link do cliente (revisao de seguranca): chaves com ON DELETE CASCADE (excluir proposta com link
// nao falha mais por FK), amarra do aceite ao conteudo (valor e hash dos itens no evento) e um unico link ativo por proposta.
export const clientLinksHardeningMigration = `
  ALTER TABLE proposal_client_links DROP CONSTRAINT IF EXISTS proposal_client_links_proposal_id_fkey;
  ALTER TABLE proposal_client_links ADD CONSTRAINT proposal_client_links_proposal_id_fkey
    FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE;
  ALTER TABLE proposal_client_link_events DROP CONSTRAINT IF EXISTS proposal_client_link_events_link_id_fkey;
  ALTER TABLE proposal_client_link_events ADD CONSTRAINT proposal_client_link_events_link_id_fkey
    FOREIGN KEY (link_id) REFERENCES proposal_client_links(id) ON DELETE CASCADE;
  ALTER TABLE proposal_client_link_events ADD COLUMN IF NOT EXISTS final_value numeric(14,2);
  ALTER TABLE proposal_client_link_events ADD COLUMN IF NOT EXISTS content_hash text;
  -- Dados existentes: se uma proposta tem mais de um link ativo, so o mais recente continua ativo.
  UPDATE proposal_client_links SET status = 'disabled', closed_at = now()
  WHERE status = 'active' AND id NOT IN (
    SELECT DISTINCT ON (proposal_id) id FROM proposal_client_links WHERE status = 'active' ORDER BY proposal_id, created_at DESC, id DESC
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uq_proposal_client_links_active ON proposal_client_links(proposal_id) WHERE status = 'active';
`;
