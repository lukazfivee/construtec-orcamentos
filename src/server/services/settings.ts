import type { AppSettings } from '../../shared/contracts';
import type { LocalDatabase } from './database';

const defaultSettings: AppSettings = {
  companyName: 'Construtec Engenharia Ltda.',
  tradeName: 'Construtec Engenharia',
  document: '',
  phone: '',
  email: 'comercial@construtec.local',
  address: '',
  defaultResponsible: 'Marcos Ribeiro',
  defaultBdi: 1.45,
  defaultStandardHours: 176,
  defaultValidityDays: 15,
};

export const getAppSettings = async (database: LocalDatabase): Promise<AppSettings> => {
  const result = await database.query<{ value: AppSettings }>(
    "SELECT value FROM app_settings WHERE key = 'general'",
  );
  if (result.rows[0]?.value) {
    return {
      ...defaultSettings,
      ...result.rows[0].value,
    };
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
