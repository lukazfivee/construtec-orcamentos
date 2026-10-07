// Contato de quem recebe a proposta (linha A/C da carta), no cadastro do cliente. Aditiva e idempotente; todos os
// campos sao opcionais, entao clientes e propostas existentes nao mudam.
export const clientContactMigration = `
  ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_name text;
  ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_role text;
  ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_department text;
  ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_email text;
  ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_phone text;
`;
