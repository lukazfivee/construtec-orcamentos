import { randomUUID } from 'node:crypto';
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
  };

  await database.query(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES ('general', $1, now())
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now()
  `, [JSON.stringify(updated)]);

  return updated;
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

