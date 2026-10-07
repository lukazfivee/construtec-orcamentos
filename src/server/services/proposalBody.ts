// Corpo da proposta no servidor: validacao dos blocos, gravacao na proposta (so em edicao e na ultima revisao),
// modelos de texto da empresa e corpo padrao das propostas novas. Tudo e conteudo comercial: sem custo, BDI ou margem.
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  BODY_BLOCK_TYPES, BODY_LIMITS, BUILTIN_BODY_TEMPLATES, bodyBlocksError, cleanBodyText, normalizeBodyBlocks,
  type BodyBlock, type BodyTemplate,
} from '../../shared/proposalBody';
import type { DatabaseQueries, LocalDatabase } from './database';
import { logEvent } from './logger';
import { getEditableProposal } from './proposalCommon';

const blockSchema = z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  type: z.enum(BODY_BLOCK_TYPES as unknown as [string, ...string[]]),
  title: z.string().max(BODY_LIMITS.title).optional(),
  text: z.string().max(BODY_LIMITS.text).optional(),
  enabled: z.boolean(),
});

export const bodyBlocksSchema = z.array(blockSchema).max(BODY_LIMITS.blocks)
  .transform((blocks) => normalizeBodyBlocks(blocks as BodyBlock[]))
  .superRefine((blocks, context) => {
    const error = bodyBlocksError(blocks);
    if (error) context.addIssue({ code: 'custom', message: error });
  });

// blocks: null devolve a proposta ao documento no layout fixo de sempre.
export const bodyInputSchema = z.strictObject({ blocks: bodyBlocksSchema.nullable() });

const templateFields = {
  name: z.string().max(BODY_LIMITS.templateName).transform((value) => cleanBodyText(value, false)).pipe(z.string().min(1)),
  type: z.enum(['paragrafo', 'lista']),
  title: z.string().max(BODY_LIMITS.title).optional().transform((value) => cleanBodyText(value ?? '', false) || undefined),
  text: z.string().max(BODY_LIMITS.text).transform((value) => cleanBodyText(value, true)).pipe(z.string().min(1)),
};
export const newTemplateSchema = z.strictObject(templateFields);
export const templateListSchema = z.object({
  templates: z.array(z.strictObject({ id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/), ...templateFields })).max(BODY_LIMITS.templates),
}).strict();

export const updateProposalBody = async (database: LocalDatabase, proposalId: string, blocks: BodyBlock[] | null) => {
  await database.transaction(async (transaction) => {
    await getEditableProposal(transaction, proposalId);
    await transaction.query('UPDATE proposals SET body_blocks = $2::jsonb, updated_at = now() WHERE id = $1', [proposalId, blocks ? JSON.stringify(blocks) : null]);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, after_data)
      VALUES ($1, 'proposal', $2, 'body_updated', $3::jsonb)
    `, [randomUUID(), proposalId, JSON.stringify({ blockCount: blocks?.length ?? null })]);
    logEvent('info', 'proposal.body_updated', { proposalId, blockCount: blocks?.length ?? 0 });
  });
};

const readSetting = async <T>(database: Pick<DatabaseQueries, 'query'>, key: string): Promise<T | null> => {
  const result = await database.query<{ value: T }>('SELECT value FROM app_settings WHERE key = $1', [key]).catch(() => ({ rows: [] as Array<{ value: T }> }));
  return result.rows[0]?.value ?? null;
};
const writeSetting = (database: Pick<DatabaseQueries, 'query'>, key: string, value: unknown) => database.query(`
  INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2::jsonb, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [key, JSON.stringify(value)]);

// Sem lista salva, valem os modelos sugeridos; ao salvar o primeiro, a lista passa a ser da empresa e e editavel.
export const getBodyTemplates = async (database: Pick<DatabaseQueries, 'query'>): Promise<BodyTemplate[]> => {
  const stored = await readSetting<BodyTemplate[]>(database, 'body_templates');
  return Array.isArray(stored) ? stored : BUILTIN_BODY_TEMPLATES;
};

export const saveBodyTemplates = async (database: LocalDatabase, templates: BodyTemplate[]) => {
  await writeSetting(database, 'body_templates', templates.map(({ id, name, type, title, text }) => ({ id, name, type, ...(title ? { title } : {}), text })));
  return getBodyTemplates(database);
};

export const addBodyTemplate = async (database: LocalDatabase, input: Omit<BodyTemplate, 'id' | 'builtin'>) => {
  const current = await getBodyTemplates(database);
  if (current.length >= BODY_LIMITS.templates) throw new Error('BODY_TEMPLATES_FULL');
  return saveBodyTemplates(database, [...current, { ...input, id: `m${randomUUID().replaceAll('-', '').slice(0, 16)}` }]);
};

export const getDefaultBody = async (database: Pick<DatabaseQueries, 'query'>): Promise<BodyBlock[] | null> => {
  const stored = await readSetting<BodyBlock[]>(database, 'default_body_blocks');
  return Array.isArray(stored) ? stored : null;
};

export const saveDefaultBody = async (database: LocalDatabase, blocks: BodyBlock[] | null) => {
  if (blocks) await writeSetting(database, 'default_body_blocks', blocks);
  else await database.query("DELETE FROM app_settings WHERE key = 'default_body_blocks'");
  return getDefaultBody(database);
};
