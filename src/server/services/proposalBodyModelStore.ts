// Modelos de proposta da empresa: o corpo inteiro de uma proposta salvo com um nome, para aplicar em outras.
// Ficam em app_settings ('body_models'); so conteudo comercial (os blocos passam pelo mesmo esquema do corpo).
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { BODY_LIMITS, cleanBodyText, type BodyBlock } from '../../shared/proposalBody';
import type { CompanyBodyModel } from '../../shared/proposalBodyModels';
import type { DatabaseQueries, LocalDatabase } from './database';
import { bodyBlocksSchema } from './proposalBody';

const nameSchema = z.string().max(BODY_LIMITS.templateName).transform((value) => cleanBodyText(value, false)).pipe(z.string().min(1));
export const newBodyModelSchema = z.strictObject({ name: nameSchema, blocks: bodyBlocksSchema });
export const renameBodyModelSchema = z.strictObject({ name: nameSchema });

export const MAX_COMPANY_MODELS = 20;
const KEY = 'body_models';

export const getCompanyBodyModels = async (database: Pick<DatabaseQueries, 'query'>): Promise<CompanyBodyModel[]> => {
  const result = await database.query<{ value: CompanyBodyModel[] }>('SELECT value FROM app_settings WHERE key = $1', [KEY]).catch(() => ({ rows: [] as Array<{ value: CompanyBodyModel[] }> }));
  const stored = result.rows[0]?.value;
  return Array.isArray(stored) ? stored : [];
};

const write = (database: Pick<DatabaseQueries, 'query'>, models: CompanyBodyModel[]) => database.query(`
  INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2::jsonb, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [KEY, JSON.stringify(models)]);

// Mesmo nome (sem diferenciar maiusculas) substitui o modelo anterior: e assim que se atualiza um modelo.
export const saveCompanyBodyModel = async (database: LocalDatabase, name: string, blocks: BodyBlock[]): Promise<CompanyBodyModel[]> =>
  database.transaction(async (transaction) => {
    const current = await getCompanyBodyModels(transaction);
    const at = current.findIndex((model) => model.name.toLowerCase() === name.toLowerCase());
    if (at < 0 && current.length >= MAX_COMPANY_MODELS) throw new Error('BODY_MODELS_FULL');
    const entry: CompanyBodyModel = { id: at >= 0 ? current[at].id : `c${randomUUID().replaceAll('-', '').slice(0, 16)}`, name, blocks: blocks.map((block) => { const copy: Partial<BodyBlock> = { ...block }; delete copy.id; return copy as CompanyBodyModel['blocks'][number]; }) };
    const next = at >= 0 ? current.map((model, index) => (index === at ? entry : model)) : [...current, entry];
    await write(transaction, next);
    return next;
  });

export const renameCompanyBodyModel = async (database: LocalDatabase, id: string, name: string): Promise<CompanyBodyModel[]> =>
  database.transaction(async (transaction) => {
    const current = await getCompanyBodyModels(transaction);
    if (!current.some((model) => model.id === id)) throw new Error('BODY_MODEL_NOT_FOUND');
    if (current.some((model) => model.id !== id && model.name.toLowerCase() === name.toLowerCase())) throw new Error('BODY_MODEL_NAME_TAKEN');
    const next = current.map((model) => (model.id === id ? { ...model, name } : model));
    await write(transaction, next);
    return next;
  });

export const deleteCompanyBodyModel = async (database: LocalDatabase, id: string): Promise<CompanyBodyModel[]> =>
  database.transaction(async (transaction) => {
    const next = (await getCompanyBodyModels(transaction)).filter((model) => model.id !== id);
    await write(transaction, next);
    return next;
  });
