import { Router } from 'express';
import { z } from 'zod';
import type { AuthUser } from '../../shared/contracts';
import type { LocalDatabase } from '../services/database';
import { attributeAuditEvent } from '../services/auditAttribution';
import {
  addBodyTemplate, bodyBlocksSchema, bodyInputSchema, getBodyTemplates, getDefaultBody, newTemplateSchema,
  saveBodyTemplates, saveDefaultBody, templateListSchema, updateProposalBody,
} from '../services/proposalBody';
import {
  deleteCompanyBodyModel, getCompanyBodyModels, newBodyModelSchema, renameBodyModelSchema, renameCompanyBodyModel, saveCompanyBodyModel,
} from '../services/proposalBodyModelStore';
import { getProposalById } from '../services/proposals';

const idSchema = z.string().uuid();

// Corpo montado de uma proposta e biblioteca de modelos. Editar o corpo segue as regras da proposta (em edicao,
// ultima revisao, perfil que nao e somente consulta); salvar um modelo novo e aberto a quem edita propostas.
export const createProposalBodyRouter = (database: LocalDatabase) => {
  const router = Router();

  router.get('/body-templates', async (_request, response, next) => {
    try { response.json({ templates: await getBodyTemplates(database) }); } catch (error) { next(error); }
  });

  router.post('/body-templates', async (request, response, next) => {
    try {
      const input = newTemplateSchema.parse(request.body);
      try { response.status(201).json({ templates: await addBodyTemplate(database, input) }); }
      catch (error) {
        if (error instanceof Error && error.message === 'BODY_TEMPLATES_FULL') { response.status(422).json({ error: 'A biblioteca já tem o máximo de modelos. Remova algum em Configurações.' }); return; }
        throw error;
      }
    } catch (error) { next(error); }
  });

  router.get('/body-models', async (_request, response, next) => {
    try { response.json({ models: await getCompanyBodyModels(database) }); } catch (error) { next(error); }
  });

  // Salvar o corpo atual como modelo da empresa e aberto a quem edita propostas; renomear e excluir ficam em /api/settings.
  router.post('/body-models', async (request, response, next) => {
    try {
      const input = newBodyModelSchema.parse(request.body);
      try { response.status(201).json({ models: await saveCompanyBodyModel(database, input.name, input.blocks) }); }
      catch (error) {
        if (error instanceof Error && error.message === 'BODY_MODELS_FULL') { response.status(422).json({ error: 'A empresa já tem o máximo de modelos de proposta. Exclua algum em Configurações.' }); return; }
        throw error;
      }
    } catch (error) { next(error); }
  });

  router.put('/:proposalId/body', async (request, response, next) => {
    try {
      const proposalId = idSchema.parse(request.params.proposalId);
      const input = bodyInputSchema.parse(request.body);
      await updateProposalBody(database, proposalId, input.blocks);
      const user = response.locals.authUser as AuthUser | undefined;
      if (user) await attributeAuditEvent(database, user.id, 'proposal', proposalId, 'body_updated');
      response.json({ proposal: await getProposalById(database, proposalId) });
    } catch (error) { next(error); }
  });

  return router;
};

// Padroes da empresa (escrita so de administrador, regra geral de /api/settings): modelos e corpo padrao das propostas novas.
export const createBodySettingsRouter = (database: LocalDatabase) => {
  const router = Router();
  router.get('/body-templates', async (_request, response, next) => {
    try { response.json({ templates: await getBodyTemplates(database) }); } catch (error) { next(error); }
  });
  router.put('/body-templates', async (request, response, next) => {
    try { response.json({ templates: await saveBodyTemplates(database, templateListSchema.parse(request.body).templates) }); } catch (error) { next(error); }
  });
  router.get('/body-models', async (_request, response, next) => {
    try { response.json({ models: await getCompanyBodyModels(database) }); } catch (error) { next(error); }
  });
  router.patch('/body-models/:modelId', async (request, response, next) => {
    try {
      const id = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/).parse(request.params.modelId);
      try { response.json({ models: await renameCompanyBodyModel(database, id, renameBodyModelSchema.parse(request.body).name) }); }
      catch (error) {
        const code = error instanceof Error ? error.message : '';
        if (code === 'BODY_MODEL_NOT_FOUND') { response.status(404).json({ error: 'Modelo não encontrado.' }); return; }
        if (code === 'BODY_MODEL_NAME_TAKEN') { response.status(422).json({ error: 'Já existe um modelo com esse nome.' }); return; }
        throw error;
      }
    } catch (error) { next(error); }
  });
  router.delete('/body-models/:modelId', async (request, response, next) => {
    try { response.json({ models: await deleteCompanyBodyModel(database, z.string().regex(/^[A-Za-z0-9_-]{1,40}$/).parse(request.params.modelId)) }); } catch (error) { next(error); }
  });
  router.get('/default-body', async (_request, response, next) => {
    try { response.json({ blocks: await getDefaultBody(database) }); } catch (error) { next(error); }
  });
  router.put('/default-body', async (request, response, next) => {
    try { response.json({ blocks: await saveDefaultBody(database, z.strictObject({ blocks: bodyBlocksSchema.nullable() }).parse(request.body).blocks) }); } catch (error) { next(error); }
  });
  return router;
};
