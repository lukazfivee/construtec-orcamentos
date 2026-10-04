import { Router, type Response } from 'express';
import { z } from 'zod';
import type { AuthUser } from '../../shared/contracts';
import { ClientLinkError } from '../services/clientLinkCommon';
import { confirmClientApproval, createClientLink, disableClientLink, getClientLink, type ClientLinkView } from '../services/clientLinks';
import type { LocalDatabase } from '../services/database';

const idSchema = z.string().uuid();
const createSchema = z.object({ days: z.number().int().min(1).max(90).default(30), requireIdentity: z.boolean().default(true) });

// Link para o cliente ver e aprovar (Rodada 27), lado da equipe. Gerar, desativar e confirmar exigem p11 (suiteGuard).
export const clientLinkUrl = (base: string, token: string) => `${base.replace(/\/$/, '')}/c/#${token}`;

export const sendClientLinkError = (error: unknown, response: Response, next: (error: unknown) => void) => {
  if (error instanceof ClientLinkError) { response.status(error.status).json({ error: error.message, code: error.code }); return; }
  next(error);
};

export const createProposalClientLinkRouter = (database: LocalDatabase, secret: string, publicBase: string) => {
  const router = Router();
  const user = (response: Response) => response.locals.authUser as AuthUser;
  const body = (link: ClientLinkView | null) => ({ link: link ? { ...link, url: clientLinkUrl(publicBase, link.token) } : null });

  router.get('/:proposalId/client-link', async (request, response, next) => {
    try { response.json(body(await getClientLink(database, idSchema.parse(request.params.proposalId), secret))); }
    catch (error) { sendClientLinkError(error, response, next); }
  });

  router.post('/:proposalId/client-link', async (request, response, next) => {
    try {
      const input = createSchema.parse(request.body ?? {});
      response.status(201).json(body(await createClientLink(database, idSchema.parse(request.params.proposalId), input, user(response).id, secret)));
    } catch (error) { sendClientLinkError(error, response, next); }
  });

  router.post('/:proposalId/client-link/disable', async (request, response, next) => {
    try { response.json(body(await disableClientLink(database, idSchema.parse(request.params.proposalId), user(response).id, secret))); }
    catch (error) { sendClientLinkError(error, response, next); }
  });

  router.post('/:proposalId/client-link/confirm', async (request, response, next) => {
    try {
      const result = await confirmClientApproval(database, idSchema.parse(request.params.proposalId), user(response).id, secret);
      response.json({ proposal: result.proposal, ...body(result.link) });
    } catch (error) { sendClientLinkError(error, response, next); }
  });

  return router;
};
