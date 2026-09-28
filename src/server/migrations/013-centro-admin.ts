// Papel no Orcamentos separado da promocao pelo Centro: centro_admin marca
// quem e admin por ser admin no Centro; local_role guarda o papel escolhido
// aqui, que volta a valer se a conta deixar de ser admin no Centro.
export const centroAdminMigration = `
  ALTER TABLE users ADD COLUMN IF NOT EXISTS centro_admin boolean NOT NULL DEFAULT false;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS local_role text;
  UPDATE users SET local_role = role WHERE centro_user_id IS NOT NULL AND local_role IS NULL;
`;
