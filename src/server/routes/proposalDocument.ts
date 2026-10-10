import { Router } from 'express';
import { z } from 'zod';
import { proposalFileBaseName } from '../../documents/proposalDocumentCommon';
import { buildProposalDocx } from '../../documents/proposalDocx';
import { buildMobileProposalHtml, mobileExportOptions, parseMobileDocumentChoices } from '../../documents/proposalMobileDocument';
import type { LocalDatabase } from '../services/database';
import { getProposalById } from '../services/proposals';
import { getAppSettings } from '../services/settings';

const idSchema = z.string().uuid();
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Documento do cliente para o celular: HTML do PDF (so precos de venda), pronto para imprimir ou compartilhar,
// e o mesmo documento em Word (.docx, gerador do computador). Aberto a todos os perfis: custo, BDI e margem nunca entram.
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
  router.get('/:proposalId/document.docx', async (request, response, next) => {
    try {
      const proposal = await getProposalById(database, idSchema.parse(request.params.proposalId));
      if (!proposal) {
        response.status(404).json({ error: 'Proposta não encontrada.' });
        return;
      }
      const options = { ...mobileExportOptions(parseMobileDocumentChoices(request.query as Record<string, unknown>)), format: 'docx' as const };
      const buffer = await buildProposalDocx(proposal, await getAppSettings(database), options);
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`${proposalFileBaseName(proposal)}.docx`)}`);
      response.type(DOCX).send(buffer);
    } catch (error) { next(error); }
  });
  return router;
};
