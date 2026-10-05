// Acesso por papel da Suite nas propostas (D6). p10: ver custo, BDI e margem. p11: enviar e aprovar propostas.
// O app tambem precisa estar entre os apps da conta. Roda depois da checagem de sessao e de perfil local.
import type { NextFunction, Request, Response } from 'express';
import type { AuthUser } from '../shared/contracts';
import { hasPermission } from './services/suiteAccess';

// Campos de custo, BDI e margem. So numeros viram 0; o preco de venda nao e tocado.
export const COST_KEYS = new Set([
  'unitCost', 'totalCost', 'baseCost', 'cost', 'materials', 'labor', 'additions', 'grossResult', 'marginPercent', 'bdiMultiplier',
  'monthlyCost', 'hourlyRate', 'monthlySalary', 'monthlyFood', 'monthlyTransport', 'monthlyOtherCosts', 'catalogCurrentCost',
  'currentCost', 'totalEstimatedCost', 'defaultBdi',
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

// Campos de custo que o corpo tenta gravar. Na importacao em lote o app sempre manda unitCost: 0 quando a planilha
// nao tem custo, entao zero nao conta (nao grava custo nenhum); qualquer valor diferente de zero conta.
const costFieldsWritten = (body: unknown, ignoreZero: boolean): string[] => {
  const found = new Set<string>();
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    for (const [key, inner] of Object.entries(value)) {
      if (COST_KEYS.has(key) && inner !== undefined && !(ignoreZero && (inner === 0 || inner === null))) found.add(key);
      else visit(inner);
    }
  };
  visit(body);
  return [...found];
};

const deny = (response: Response, error: string) => response.status(403).json({ error });

const maskJson = (response: Response) => {
  const json = response.json.bind(response);
  response.json = ((body?: unknown) => json(maskCosts(body))) as Response['json'];
};

export const suiteGuard = (request: Request, response: Response, next: NextFunction) => {
  const user = response.locals.authUser as AuthUser;
  const path = request.path.toLowerCase();
  if (user.apps && !user.apps.includes('orcamentos') && !path.startsWith('/api/notifications')) {
    return deny(response, 'Seu acesso não inclui o Orçamentos.');
  }
  const canSee = hasPermission(user, 'p10');
  // Catalogo e kits carregam o custo do item. Sem p10 saem zerados e nao se grava (gravar devolveria o zero).
  if (path.startsWith('/api/catalog') || path.startsWith('/api/kits')) {
    const appliesKit = /^\/api\/kits\/[^/]+\/apply-to-proposal$/.test(path);
    if (!canSee && request.method !== 'GET' && !appliesKit) return deny(response, 'Seu papel não permite alterar catálogo e kits, que carregam o custo.');
    if (!canSee) maskJson(response);
    return next();
  }
  // BDI padrao das configuracoes: so quem ve BDI.
  if (path.startsWith('/api/settings') && !canSee && request.method === 'GET') maskJson(response);
  if (!path.startsWith('/api/proposals')) return next();

  const write = request.method !== 'GET';
  const action = /^\/api\/proposals\/[^/]+\/([^/]+)/.exec(path)?.[1] ?? '';
  const status = String((request.body as { status?: unknown } | undefined)?.status ?? '');
  const canSend = hasPermission(user, 'p11');

  if (!canSend) {
    const sends = request.method === 'POST' && (action === 'integration-export' || action === 'direct-sync' || action === 'client-link' || action === 'revisions');
    // Enviar e aprovar exigem p11 aqui; reabrir (sent/approved/rejected -> draft/review) e barrado na rota, que conhece o status atual.
    // O pedido de ajuste do cliente cria a revisao por dentro do servico, sem passar por aqui.
    const decides = request.method === 'PATCH' && action === 'status' && (status === 'approved' || status === 'sent');
    const removes = request.method === 'DELETE' && /^\/api\/proposals\/[^/]+\/?$/.test(path);
    if (sends || decides || removes) return deny(response, 'Seu papel não permite enviar, aprovar, reabrir, criar revisão ou excluir propostas.');
  }
  if (!canSee) {
    const costWrite = write && ['bdi', 'tax', 'labor', 'labor-settings'].includes(action);
    // Itens: gravar unitCost (PATCH items/:id, import-batch) revela e altera custo sem p10.
    if (write && action === 'items') {
      const batch = request.method === 'POST' && /\/items\/import-batch\/?$/.test(path);
      const written = costFieldsWritten(request.body, batch);
      if (written.length) {
        return deny(response, batch
          ? 'Seu papel não permite informar custo na importação. Remova a coluna de custo (unitCost) e importe só quantidade e preço de venda.'
          : 'Seu papel não permite alterar custo dos itens.');
      }
    }
    if (costWrite || action === 'center-tracking') return deny(response, 'Seu papel não permite ver custo, BDI e margem.');
    maskJson(response);
  }
  return next();
};
