// Reserva atomica da linha da outbox: o laco de 30s e o Cron do Worker nao enviam a mesma linha ao mesmo tempo.
export const outboxClaimMigration = `
  ALTER TABLE integration_outbox ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
`;
