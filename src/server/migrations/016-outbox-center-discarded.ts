// Obra descartada no Centro de Custos: o envio fica 'center_discarded' para a proposta voltar a
// "Aprovada sem Centro de Custo" (reenvio liberado) e voltar a 'delivered' se a obra for recuperada.
export const outboxCenterDiscardedMigration = `
  ALTER TABLE integration_outbox DROP CONSTRAINT IF EXISTS integration_outbox_status_check;
  ALTER TABLE integration_outbox ADD CONSTRAINT integration_outbox_status_check
    CHECK (status IN ('pending', 'delivered', 'failed', 'center_discarded'));
`;
