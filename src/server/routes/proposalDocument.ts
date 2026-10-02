import { Router } from 'express';
import { z } from 'zod';
import { buildMobileProposalHtml, parseMobileDocumentChoices } from '../../documents/proposalMobileDocument';
import type { LocalDatabase } from '../services/database';
import { getProposalById } from '../services/proposals';
import { getAppSettings } from '../services/settings';

const idSchema = z.string().uuid();

// Documento do cliente para o celular: HTML do PDF (so precos de venda), pronto para imprimir ou compartilhar.
// Aberto a todos os perfis: custo, BDI e margem nunca entram nele.
export const createProposalDocumentRouter = (database: LocalDatabase) => {
  const router = Router();
  router.get('/:proposalId/document', async (request, response, next) => {
    try {
      const proposal = await getProposalById(database, idSchema.parse(request.params.proposalId));
      if (!proposal) {
        response.status(404).json({ error: 'Proposta não encontrada.' });
        return;
      }
      const html = buildMobileProposalHtml(proposal, await getAppSettings(database), parseMobileDocumentChoices(request.query as Record<string, unknown>));
      response.setHeader('Cache-Control', 'no-store');
      response.type('html').send(html);
    } catch (error) { next(error); }
  });
  return router;
};
