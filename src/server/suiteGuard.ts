// Acesso por papel da Suite nas propostas (D6). p10: ver custo, BDI e margem. p11: enviar e aprovar propostas.
// O app tambem precisa estar entre os apps da conta. Roda depois da checagem de sessao e de perfil local.
import type { NextFunction, Request, Response } from 'express';
import type { AuthUser } from '../shared/contracts';
import { hasPermission } from './services/suiteAccess';

// Campos de custo, BDI e margem. So numeros viram 0; o preco de venda nao e tocado.
const COST_KEYS = new Set([
  'unitCost', 'totalCost', 'baseCost', 'cost', 'materials', 'labor', 'additions', 'grossResult', 'marginPercent', 'bdiMultiplier',
  'monthlyCost', 'hourlyRate', 'monthlySalary', 'monthlyFood', 'monthlyTransport', 'monthlyOtherCosts', 'catalogCurrentCost',
]);

export const maskCosts = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(maskCosts);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      out[key] = COST_KEYS.has(key) && (typeof inner === 'number' || inner === null) ? (inner === null ? null : 0) : maskCosts(inner);
    }
    return out;
  }
  return value;
};

const deny = (response: Response, error: string) => response.status(403).json({ error });

export const suiteGuard = (request: Request, response: Response, next: NextFunction) => {
  const user = response.locals.authUser as AuthUser;
  const path = request.path.toLowerCase();
  if (user.apps && !user.apps.includes('orcamentos') && !path.startsWith('/api/notifications')) {
    return deny(response, 'Seu acesso não inclui o Orçamentos.');
  }
  if (!path.startsWith('/api/proposals')) return next();

  const write = request.method !== 'GET';
  const action = /^\/api\/proposals\/[^/]+\/([^/]+)/.exec(path)?.[1] ?? '';
  const status = String((request.body as { status?: unknown } | undefined)?.status ?? '');
  const canSee = hasPermission(user, 'p10');
  const canSend = hasPermission(user, 'p11');

  if (!canSend) {
    const sends = request.method === 'POST' && (action === 'integration-export' || action === 'direct-sync');
    const decides = request.method === 'PATCH' && action === 'status' && (status === 'approved' || status === 'sent');
    if (sends || decides) return deny(response, 'Seu papel não permite enviar ou aprovar propostas.');
  }
  if (!canSee) {
    const costWrite = write && ['bdi', 'tax', 'labor', 'labor-settings'].includes(action);
    if (costWrite || action === 'center-tracking') return deny(response, 'Seu papel não permite ver custo, BDI e margem.');
    const json = response.json.bind(response);
    response.json = ((body?: unknown) => json(maskCosts(body))) as Response['json'];
  }
  return next();
};
