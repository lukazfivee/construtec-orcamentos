import { Router } from 'express';
import { z } from 'zod';
import type { AuthUser } from '../../shared/contracts';
import { attributeAuditEvent } from '../services/auditAttribution';
import type { LocalDatabase } from '../services/database';
import { applyProposalPriceDrift, getProposalPriceDrift, listPriceDriftProposals } from '../services/priceDrift';
import { getProposalById } from '../services/proposals';
import { hasPermission } from '../services/suiteAccess';

const idSchema = z.string().uuid();
const applySchema = z.object({ itemIds: z.array(z.string().uuid()).max(500).optional() });

// Preco do catalogo que mudou depois que o item entrou na proposta (aviso do celular).
// Sem p10 o custo nao sai, so o efeito no valor final; atualizar segue liberado (so papeis que editam: viewer e barrado antes).
export const createProposalPriceDriftRouter = (database: LocalDatabase) => {
  const router = Router();
  const user = (response: { locals: { authUser?: AuthUser } }) => {
    const authUser = response.locals.authUser;
    if (!authUser) throw new Error('AUTH_INVALID_CREDENTIALS');
    return authUser;
  };

  router.get('/price-drift', async (_request, response, next) => {
    try { response.json({ proposals: await listPriceDriftProposals(database, hasPermission(user(response), 'p10')) }); }
    catch (error) { next(error); }
  });

  router.get('/:proposalId/price-drift', async (request, response, next) => {
    try {
      const drift = await getProposalPriceDrift(database, idSchema.parse(request.params.proposalId), hasPermission(user(response), 'p10'));
      if (!drift) { response.status(404).json({ error: 'Proposta não encontrada.' }); return; }
      response.json({ drift });
    } catch (error) { next(error); }
  });

  router.post('/:proposalId/price-drift/apply', async (request, response, next) => {
    try {
      const proposalId = idSchema.parse(request.params.proposalId);
      const input = applySchema.parse(request.body ?? {});
      const updated = await applyProposalPriceDrift(database, proposalId, input.itemIds);
      await attributeAuditEvent(database, user(response).id, 'proposal', proposalId, 'price_drift_applied');
      response.json({ updated, proposal: await getProposalById(database, proposalId) });
    } catch (error) { next(error); }
  });

  return router;
};
