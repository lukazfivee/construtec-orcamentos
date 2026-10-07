import { randomUUID } from 'node:crypto';
import { DEFAULT_LETTER_PLACE } from '../../shared/proposalBody';
import type { AppSettings } from '../../shared/contracts';
import type { LocalDatabase } from './database';

export type IntegrationIdentity = {
  namespaceId: string;
  installationId: string;
};

const defaultSettings: AppSettings = {
  companyName: 'LAC CONSTRUTEC CONSTRUTORA EIRELI',
  tradeName: 'CONSTRUTEC',
  document: '32.992.946/0001-78',
  phone: '(71) 99294-1099',
  email: 'supervisao@rcconstrutec.com.br / engenharia@rcconstrutec.com.br',
  address: 'Rua Metodio Coelho, 62, EDIFICIO CIDADELLA CENTER  I, Sala 112/ PARQUE BELA VISTA/ Salvador BA /40050-450',
  defaultResponsible: 'Marcos Ribeiro',
  defaultBdi: 1.45,
  defaultStandardHours: 176,
  defaultValidityDays: 15,
  defaultTaxPercentage: 0,
  pdfShowLogo: true,
  pdfShowSignature: true,
  letterPlace: DEFAULT_LETTER_PLACE,
  pdfWatermark: true,
};

const ensureSettingsStorage = async (database: Pick<LocalDatabase, 'query' | 'exec'>): Promise<void> => {
  await database.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
};

export const getAppSettings = async (database: Pick<LocalDatabase, 'query' | 'exec'>): Promise<AppSettings> => {
  await ensureSettingsStorage(database);

  const result = await database.query<{ value: AppSettings }>(
    "SELECT value FROM app_settings WHERE key = 'general'",
  );
  if (result.rows[0]?.value) {
    const val = result.rows[0].value;
    const isOldPlaceholder = !val.address
      || val.address === 'São Paulo - SP'
      || !val.phone
      || val.companyName === 'Construtec Engenharia Ltda.'
      || val.email === 'comercial@construtec.local'
      || val.email === 'comercial@construtecengenharia.com.br';

    const resolved: AppSettings = {
      companyName: isOldPlaceholder && (val.companyName === 'Construtec Engenharia Ltda.' || !val.companyName) ? defaultSettings.companyName : (val.companyName?.trim() || defaultSettings.companyName),
      tradeName: val.tradeName?.trim() || defaultSettings.tradeName,
      document: val.document?.trim() || defaultSettings.document,
      phone: (!val.phone || isOldPlaceholder) ? defaultSettings.phone : val.phone,
      email: (!val.email || isOldPlaceholder) ? defaultSettings.email : val.email,
      address: (!val.address || val.address === 'São Paulo - SP' || isOldPlaceholder) ? defaultSettings.address : val.address,
      defaultResponsible: val.defaultResponsible?.trim() || defaultSettings.defaultResponsible,
      defaultBdi: typeof val.defaultBdi === 'number' && val.defaultBdi > 0 ? val.defaultBdi : defaultSettings.defaultBdi,
      defaultStandardHours: typeof val.defaultStandardHours === 'number' && val.defaultStandardHours > 0 ? val.defaultStandardHours : defaultSettings.defaultStandardHours,
      defaultValidityDays: typeof val.defaultValidityDays === 'number' && val.defaultValidityDays > 0 ? val.defaultValidityDays : defaultSettings.defaultValidityDays,
      defaultTaxPercentage: typeof val.defaultTaxPercentage === 'number' && val.defaultTaxPercentage >= 0 && val.defaultTaxPercentage <= 100 ? val.defaultTaxPercentage : defaultSettings.defaultTaxPercentage,
      pdfShowLogo: typeof val.pdfShowLogo === 'boolean' ? val.pdfShowLogo : defaultSettings.pdfShowLogo,
      pdfShowSignature: typeof val.pdfShowSignature === 'boolean' ? val.pdfShowSignature : defaultSettings.pdfShowSignature,
      letterPlace: val.letterPlace?.trim() || defaultSettings.letterPlace,
      pdfWatermark: typeof val.pdfWatermark === 'boolean' ? val.pdfWatermark : defaultSettings.pdfWatermark,
    };

    if (isOldPlaceholder) {
      await database.query("UPDATE app_settings SET value = $1 WHERE key = 'general'", [JSON.stringify(resolved)]);
    }

    return resolved;
  }

  await database.query(
    "INSERT INTO app_settings (key, value) VALUES ('general', $1) ON CONFLICT (key) DO NOTHING",
    [JSON.stringify(defaultSettings)],
  );
  return defaultSettings;
};

export const updateAppSettings = async (
  database: LocalDatabase,
  input: Partial<AppSettings>,
): Promise<AppSettings> => {
  const current = await getAppSettings(database);
  const updated: AppSettings = {
    ...current,
    ...input,
    defaultBdi: typeof input.defaultBdi === 'number' && input.defaultBdi > 0 ? input.defaultBdi : current.defaultBdi,
    defaultStandardHours: typeof input.defaultStandardHours === 'number' && input.defaultStandardHours > 0 ? input.defaultStandardHours : current.defaultStandardHours,
    defaultValidityDays: typeof input.defaultValidityDays === 'number' && input.defaultValidityDays > 0 ? input.defaultValidityDays : current.defaultValidityDays,
    defaultTaxPercentage: typeof input.defaultTaxPercentage === 'number' && input.defaultTaxPercentage >= 0 && input.defaultTaxPercentage <= 100 ? input.defaultTaxPercentage : current.defaultTaxPercentage,
    pdfShowLogo: typeof input.pdfShowLogo === 'boolean' ? input.pdfShowLogo : current.pdfShowLogo,
    pdfShowSignature: typeof input.pdfShowSignature === 'boolean' ? input.pdfShowSignature : current.pdfShowSignature,
    letterPlace: input.letterPlace?.trim() || current.letterPlace,
    pdfWatermark: typeof input.pdfWatermark === 'boolean' ? input.pdfWatermark : current.pdfWatermark,
  };

  await database.query(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES ('general', $1, now())
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now()
  `, [JSON.stringify(updated)]);

  // O BDI padrao so vale para propostas novas depois que alguem o confirma em "Padroes da empresa"
  // (antes disso as propostas nascem com 1,25, como sempre).
  if (typeof input.defaultBdi === 'number' && input.defaultBdi > 0) {
    await database.query(`
      INSERT INTO app_settings (key, value, updated_at) VALUES ('default_bdi_confirmed', 'true'::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb, updated_at = now()
    `);
  }

  return updated;
};

export const getNewProposalDefaults = async (database: Pick<LocalDatabase, 'query' | 'exec'>): Promise<{ bdiMultiplier: number; taxPercentage: number }> => {
  const settings = await getAppSettings(database);
  const confirmed = await database.query<{ value: boolean }>("SELECT value FROM app_settings WHERE key = 'default_bdi_confirmed'");
  return { bdiMultiplier: confirmed.rows[0]?.value === true ? settings.defaultBdi : 1.25, taxPercentage: settings.defaultTaxPercentage };
};

export const getIntegrationIdentity = async (database: Pick<LocalDatabase, 'query' | 'exec'>): Promise<IntegrationIdentity> => {
  await ensureSettingsStorage(database);
  const result = await database.query<{ value: IntegrationIdentity }>(
    "SELECT value FROM app_settings WHERE key = 'integration_identity'",
  );
  if (result.rows[0]?.value) {
    return result.rows[0].value;
  }
  const identity: IntegrationIdentity = {
    namespaceId: randomUUID(),
    installationId: randomUUID(),
  };
  await database.query(
    "INSERT INTO app_settings (key, value) VALUES ('integration_identity', $1) ON CONFLICT (key) DO NOTHING",
    [JSON.stringify(identity)],
  );
  return identity;
};

