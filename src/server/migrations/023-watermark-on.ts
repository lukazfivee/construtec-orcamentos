// Marca d'agua e logo ligadas por padrao nos documentos (pedido do Lucas em 07/10/2026). Roda uma vez: quem quiser
// desligar volta em Configuracoes > Padroes da empresa e a escolha passa a valer. Sem configuracao salva, nada a fazer.
export const watermarkOnMigration = `
  UPDATE app_settings
  SET value = jsonb_set(jsonb_set(value, '{pdfWatermark}', 'true'::jsonb), '{pdfShowLogo}', 'true'::jsonb), updated_at = now()
  WHERE key = 'general';
`;
