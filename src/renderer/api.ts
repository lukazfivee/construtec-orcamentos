import type {
  ApiErrorPayload,
  AppSettings,
  AuthRole,
  AuthSession,
  AuthUser,
  CatalogImportItem,
  CatalogImportPreview,
  CatalogOverview,
  CatalogProduct,
  ClientRecord,
  DashboardMetrics,
  DirectSyncResult,
  KitDetail,
  KitInput,
  KitSummary,
  PriceDriftProposal,
  ProposalDetail,
  ProposalLaborInput,
  ProposalLaborItem,
  ProposalLine,
  ProposalRevisionSummary,
  ProposalSummary,
  UserRecord,
  CenterTracking,
  ClientLinkInfo,
  AuthorizedEmailRecord,
} from '../shared/contracts';
import type { BodyBlock, BodyTemplate } from '../shared/proposalBody';

let runtimePromise: Promise<{ apiUrl: string; apiToken: string; centroCustosUrl: string }> | undefined;
let authSessionToken = '';

export const setAuthSessionToken = (token: string | null) => {
  authSessionToken = token ?? '';
};

const getRuntime = async () => {
  if (runtimePromise) return runtimePromise;
  if (window.construtec?.runtime) {
    runtimePromise = window.construtec.runtime().then((runtime) => {
      if (!runtime.apiUrl || !runtime.apiToken) throw new Error('A API local não foi iniciada.');
      return { apiUrl: runtime.apiUrl, apiToken: runtime.apiToken, centroCustosUrl: runtime.centroCustosUrl };
    });
    return runtimePromise;
  }
  const defaultApiUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : 'http://127.0.0.1:5173';
  const apiUrl = (typeof window !== 'undefined' && (window as unknown as { __CONSTRUTEC_API_URL__?: string }).__CONSTRUTEC_API_URL__)
    || defaultApiUrl;
  const apiToken = (typeof localStorage !== 'undefined' && localStorage.getItem('construtec_api_token')) || '';
  const centroCustosUrl = CENTRO_CUSTOS_CLOUD_URL;
  runtimePromise = Promise.resolve({ apiUrl, apiToken, centroCustosUrl });
  return runtimePromise;
};

export const CENTRO_CUSTOS_CLOUD_URL = 'https://centro-custos-api.construtec-reports.workers.dev';

export const getCentroCustosUrl = async () => (await getRuntime()).centroCustosUrl;

export const isCloudRuntime = () => typeof window === 'undefined' || !window.construtec?.runtime;

const requestHeaders = (apiToken: string, hasBody = false) => ({
  ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
  ...(authSessionToken ? { 'X-Construtec-Session': authSessionToken } : {}),
  ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
});

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const { apiUrl, apiToken } = await getRuntime();
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      ...requestHeaders(apiToken, Boolean(init?.body)),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Resposta inválida da API local.' })) as ApiErrorPayload;
    throw new Error(payload.error);
  }
  return response.json() as Promise<T>;
};

const requestBinary = async (path: string): Promise<Uint8Array> => {
  const { apiUrl, apiToken } = await getRuntime();
  const response = await fetch(`${apiUrl}${path}`, { headers: requestHeaders(apiToken) });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Resposta inválida da API local.' })) as ApiErrorPayload;
    throw new Error(payload.error);
  }
  return new Uint8Array(await response.arrayBuffer());
};

const requestText = async (path: string): Promise<string> => {
  const { apiUrl, apiToken } = await getRuntime();
  const response = await fetch(`${apiUrl}${path}`, { headers: requestHeaders(apiToken), cache: 'no-store' });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Resposta inválida da API local.' })) as ApiErrorPayload;
    throw new Error(payload.error);
  }
  return response.text();
};

export const authApi = {
  login: (input: { email: string; password: string; rememberMe?: boolean }) => request<AuthSession>(
    '/api/auth/login', { method: 'POST', body: JSON.stringify(input) },
  ),
  me: () => request<{ user: AuthUser }>('/api/auth/me'),
  logout: () => request<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),
  handoff: (code: string) => request<AuthSession>('/api/auth/handoff', { method: 'POST', body: JSON.stringify({ code }) }),
};

// Preco do catalogo que mudou depois que o item entrou na proposta. Sem p10 o custo (de e para) nao vem.
export type PriceDriftItem = {
  id: string; code: string; description: string; quantity: number; unit: string; changePercent: number; finalDelta: number;
  fromUnit?: number; toUnit?: number; costDelta?: number;
};
export type PriceDrift = {
  id: string; number: string; revision: number; clientName: string; workName: string; status: string; frozen: boolean;
  items: PriceDriftItem[]; finalBefore: number; finalAfter: number; finalDelta: number; costDelta?: number;
};

export type DiscardedProposalRecord = {
  id: string; proposal_number: string; client_name: string | null; work_name: string | null; revision_count: number;
  had_approval: boolean; reason: string | null; discarded_by_name: string | null; discarded_at: string;
  restored_at: string | null; restored_by_name: string | null;
};

export const proposalApi = {
  list: () => request<{ proposals: ProposalSummary[] }>('/api/proposals'),
  current: () => request<{ proposal: ProposalDetail }>('/api/proposals/current'),
  create: (input: { clientId: string; workId: string; scope: string; validUntil: string | null }) => request<{ proposal: ProposalDetail }>(
    '/api/proposals', { method: 'POST', body: JSON.stringify(input) },
  ),
  byId: (proposalId: string) => request<{ proposal: ProposalDetail }>(`/api/proposals/${proposalId}`),
  delete: (proposalId: string, mode: 'all' | 'revision' = 'all') => request<{ success: boolean; nextProposalId?: string }>(
    `/api/proposals/${proposalId}?mode=${mode}`, { method: 'DELETE' },
  ),
  discard: (proposalId: string, input: { confirmNumber: string; reason?: string }) => request<{ discardId: string; proposalNumber: string }>(
    `/api/proposals/${proposalId}/discard`, { method: 'POST', body: JSON.stringify(input) },
  ),
  discarded: () => request<{ discarded: DiscardedProposalRecord[] }>('/api/proposals/discarded'),
  restoreDiscarded: (discardId: string) => request<{ proposalId: string | null; proposalNumber: string }>(
    `/api/proposals/discarded/${discardId}/restore`, { method: 'POST', body: '{}' },
  ),
  updateStatus: (proposalId: string, status: ProposalDetail['status']) => request<{ proposal: ProposalDetail }>(
    `/api/proposals/${proposalId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) },
  ),
  clone: (proposalId: string, input?: { clientId?: string; workId?: string; scope?: string }) => request<{ proposal: ProposalDetail }>(
    `/api/proposals/${proposalId}/clone`, { method: 'POST', body: JSON.stringify(input ?? {}) },
  ),
  history: (proposalId: string) => request<{ revisions: ProposalRevisionSummary[] }>(`/api/proposals/${proposalId}/history`),
  createRevision: (proposalId: string) => request<{ proposal: ProposalDetail }>(
    `/api/proposals/${proposalId}/revisions`, { method: 'POST' },
  ),
  catalog: (query: string, signal?: AbortSignal) => request<{ products: CatalogProduct[] }>(
    `/api/catalog?q=${encodeURIComponent(query)}&limit=10`, { signal },
  ),
  addItem: (proposalId: string, productId: string) => request<{ proposal: ProposalDetail }>(
    `/api/proposals/${proposalId}/items`, { method: 'POST', body: JSON.stringify({ productId, quantity: 1 }) },
  ),
  importBatch: (proposalId: string, items: Array<{
    code?: string;
    description: string;
    category?: string;
    unit?: string;
    quantity: number;
    unitCost?: number;
    unitSale?: number;
  }>) => request<{ proposal: ProposalDetail }>(
    `/api/proposals/${proposalId}/items/import-batch`,
    { method: 'POST', body: JSON.stringify({ items }) },
  ),
  copyFromProposal: (targetProposalId: string, sourceProposalId: string, itemIds?: string[]) => request<{ proposal: ProposalDetail }>(
    `/api/proposals/${targetProposalId}/items/copy-from-proposal`,
    { method: 'POST', body: JSON.stringify({ sourceProposalId, itemIds }) },
  ),
  removeItems: (proposalId: string, itemIds: string[]) => request<{ proposal: ProposalDetail }>(
    `/api/proposals/${proposalId}/items/remove`, { method: 'POST', body: JSON.stringify({ itemIds }) },
  ),
  updateQuantity: (proposalId: string, itemId: string, quantity: number) => request<{ proposal: ProposalDetail }>(
    `/api/proposals/${proposalId}/items/${itemId}`, { method: 'PATCH', body: JSON.stringify({ quantity }) },
  ),
  updateItem: (proposalId: string, itemId: string, input: Partial<Pick<ProposalLine, 'description' | 'quantity' | 'unit' | 'unitCost' | 'unitSale'>>) => request<{ proposal: ProposalDetail }>(
    `/api/proposals/${proposalId}/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(input) },
  ),
  duplicateItem: (proposalId: string, itemId: string) => request<{ proposal: ProposalDetail }>(
    `/api/proposals/${proposalId}/items/${itemId}/duplicate`, { method: 'POST' },
  ),
  moveItem: (proposalId: string, itemId: string, direction: 'up' | 'down') => request<{ proposal: ProposalDetail }>(
    `/api/proposals/${proposalId}/items/${itemId}/move`, { method: 'POST', body: JSON.stringify({ direction }) },
  ),
  updateBdi: (proposalId: string, bdiMultiplier: number) => request<{ proposal: ProposalDetail }>(
    `/api/proposals/${proposalId}/bdi`, { method: 'PATCH', body: JSON.stringify({ bdiMultiplier }) },
  ),
  updateTax: (proposalId: string, taxPercentage: number) => request<{ proposal: ProposalDetail }>(
    `/api/proposals/${proposalId}/tax`, { method: 'PATCH', body: JSON.stringify({ taxPercentage }) },
  ),
  updateDetails: (proposalId: string, input: { scope?: string; validUntil?: string | null }) => request<{ proposal: ProposalDetail }>(
    `/api/proposals/${proposalId}/details`, { method: 'PATCH', body: JSON.stringify(input) },
  ),
  // Corpo montado da proposta (blocos). blocks null volta ao documento no layout de sempre.
  updateBody: (proposalId: string, blocks: BodyBlock[] | null) => request<{ proposal: ProposalDetail }>(
    `/api/proposals/${proposalId}/body`, { method: 'PUT', body: JSON.stringify({ blocks }) },
  ),
  bodyTemplates: () => request<{ templates: BodyTemplate[] }>('/api/proposals/body-templates'),
  addBodyTemplate: (input: Omit<BodyTemplate, 'id' | 'builtin'>) => request<{ templates: BodyTemplate[] }>(
    '/api/proposals/body-templates', { method: 'POST', body: JSON.stringify(input) },
  ),
  updateContext: (proposalId: string, clientId: string, workId: string) => request<{ proposal: ProposalDetail }>(
    `/api/proposals/${proposalId}/context`, { method: 'PATCH', body: JSON.stringify({ clientId, workId }) },
  ),
  labor: (proposalId: string) => request<{ items: ProposalLaborItem[]; standardMonthlyHours: number }>(`/api/proposals/${proposalId}/labor`),
  addLabor: (proposalId: string, input: ProposalLaborInput) => request<{ items: ProposalLaborItem[] }>(
    `/api/proposals/${proposalId}/labor`, { method: 'POST', body: JSON.stringify(input) },
  ),
  updateLabor: (proposalId: string, itemId: string, input: ProposalLaborInput) => request<{ items: ProposalLaborItem[] }>(
    `/api/proposals/${proposalId}/labor/${itemId}`, { method: 'PATCH', body: JSON.stringify(input) },
  ),
  removeLabor: (proposalId: string, itemId: string) => request<{ items: ProposalLaborItem[] }>(
    `/api/proposals/${proposalId}/labor/${itemId}/remove`, { method: 'POST' },
  ),
  updateLaborSettings: (proposalId: string, standardMonthlyHours: number) => request<{ standardMonthlyHours: number }>(
    `/api/proposals/${proposalId}/labor-settings`, { method: 'PATCH', body: JSON.stringify({ standardMonthlyHours }) },
  ),
  priceDrift: (proposalId: string) => request<{ drift: PriceDrift }>(`/api/proposals/${proposalId}/price-drift`),
  applyPriceDrift: (proposalId: string, itemIds?: string[]) => request<{ updated: number; proposal: ProposalDetail }>(
    `/api/proposals/${proposalId}/price-drift/apply`, { method: 'POST', body: JSON.stringify(itemIds?.length ? { itemIds } : {}) },
  ),
  // HTML do PDF do cliente, montado no servidor (so precos de venda).
  documentHtml: (proposalId: string, query: string) => requestText(`/api/proposals/${proposalId}/document?${query}`),
  clientLink: (proposalId: string) => request<{ link: ClientLinkInfo | null }>(`/api/proposals/${proposalId}/client-link`),
  createClientLink: (proposalId: string, input: { days: number; requireIdentity: boolean }) => request<{ link: ClientLinkInfo }>(
    `/api/proposals/${proposalId}/client-link`, { method: 'POST', body: JSON.stringify(input) },
  ),
  disableClientLink: (proposalId: string) => request<{ link: ClientLinkInfo }>(`/api/proposals/${proposalId}/client-link/disable`, { method: 'POST' }),
  confirmClientApproval: (proposalId: string) => request<{ proposal: ProposalDetail; link: ClientLinkInfo }>(`/api/proposals/${proposalId}/client-link/confirm`, { method: 'POST' }),
  centerTracking: (proposalId: string) => request<CenterTracking>(`/api/proposals/${proposalId}/center-tracking`),
  directSync: (proposalId: string) => request<DirectSyncResult>(
    `/api/proposals/${proposalId}/direct-sync`, { method: 'POST' },
  ),
  integrationExport: (proposalId: string) => request<Record<string, unknown>>(
    `/api/proposals/${proposalId}/integration-export`, { method: 'POST' },
  ),
};

export const priceDriftApi = {
  list: () => request<{ proposals: PriceDriftProposal[] }>('/api/proposals/price-drift'),
  apply: (proposalId: string, itemIds?: string[]) => request<{ updated: number; proposal: ProposalDetail }>(
    `/api/proposals/${proposalId}/price-drift/apply`, { method: 'POST', body: JSON.stringify(itemIds ? { itemIds } : {}) },
  ),
};

export const clientsApi = {
  list: (query = '') => request<{ clients: ClientRecord[] }>(`/api/clients?q=${encodeURIComponent(query)}`),
  create: (input: { legalName: string; tradeName: string | null; document: string | null }) => request<{ clientId: string; clients: ClientRecord[] }>(
    '/api/clients', { method: 'POST', body: JSON.stringify(input) },
  ),
  update: (clientId: string, input: { legalName: string; tradeName: string | null; document: string | null }) => request<{ clients: ClientRecord[] }>(
    `/api/clients/${clientId}`, { method: 'PATCH', body: JSON.stringify(input) },
  ),
  createWork: (clientId: string, input: { name: string; address: string | null }) => request<{ workId: string; clients: ClientRecord[] }>(
    `/api/clients/${clientId}/works`, { method: 'POST', body: JSON.stringify(input) },
  ),
  updateWork: (clientId: string, workId: string, input: { name: string; address: string | null; active: boolean }) => request<{ clients: ClientRecord[] }>(
    `/api/clients/${clientId}/works/${workId}`, { method: 'PATCH', body: JSON.stringify(input) },
  ),
};

export const catalogApi = {
  list: (query = '') => request<{ products: CatalogProduct[] }>(`/api/catalog/manage?q=${encodeURIComponent(query)}`),
  create: (input: Omit<CatalogProduct, 'id' | 'updatedAt'>) => request<{ productId: string; products: CatalogProduct[] }>(
    '/api/catalog', { method: 'POST', body: JSON.stringify(input) },
  ),
  update: (productId: string, input: Omit<CatalogProduct, 'id' | 'updatedAt'>) => request<{ products: CatalogProduct[] }>(
    `/api/catalog/${productId}`, { method: 'PATCH', body: JSON.stringify(input) },
  ),
  previewImport: (items: CatalogImportItem[]) => request<CatalogImportPreview>(
    '/api/catalog/import/preview', { method: 'POST', body: JSON.stringify({ items }) },
  ),
  importBulk: (items: CatalogImportItem[]) => request<{ created: number; updated: number; ignored: number; products: CatalogProduct[] }>(
    '/api/catalog/import/bulk', { method: 'POST', body: JSON.stringify({ items }) },
  ),
  units: () => request<{ units: Array<{ unit: string; total: number }> }>('/api/catalog/units'),
  overview: () => request<{ overview: CatalogOverview }>('/api/catalog/overview'),
  delete: (productId: string) => request<{ products: CatalogProduct[] }>(
    `/api/catalog/${productId}`, { method: 'DELETE' },
  ),
};

export const kitsApi = {
  list: (query = '') => request<{ kits: KitSummary[] }>(`/api/kits?q=${encodeURIComponent(query)}`),
  get: (kitId: string) => request<{ kit: KitDetail }>(`/api/kits/${kitId}`),
  create: (input: KitInput) => request<{ kit: KitDetail; kits: KitSummary[] }>('/api/kits', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  update: (kitId: string, input: KitInput) => request<{ kit: KitDetail; kits: KitSummary[] }>(`/api/kits/${kitId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  }),
  delete: (kitId: string) => request<{ success: boolean; kits: KitSummary[] }>(`/api/kits/${kitId}`, {
    method: 'DELETE',
  }),
  applyToProposal: (kitId: string, proposalId: string) => request<{ proposal: ProposalDetail }>(`/api/kits/${kitId}/apply-to-proposal`, {
    method: 'POST',
    body: JSON.stringify({ proposalId }),
  }),
};

export const settingsApi = {
  defaultBody: () => request<{ blocks: BodyBlock[] | null }>('/api/settings/default-body'),
  saveDefaultBody: (blocks: BodyBlock[] | null) => request<{ blocks: BodyBlock[] | null }>('/api/settings/default-body', { method: 'PUT', body: JSON.stringify({ blocks }) }),
  bodyTemplates: () => request<{ templates: BodyTemplate[] }>('/api/settings/body-templates'),
  saveBodyTemplates: (templates: BodyTemplate[]) => request<{ templates: BodyTemplate[] }>('/api/settings/body-templates', { method: 'PUT', body: JSON.stringify({ templates }) }),
  get: () => request<{ settings: AppSettings }>('/api/settings'),
  update: (input: Partial<AppSettings>) => request<{ settings: AppSettings }>('/api/settings', {
    method: 'PATCH',
    body: JSON.stringify(input),
  }),
};

export const usersApi = {
  list: () => request<{ users: UserRecord[] }>('/api/users'),
  create: (input: { name: string; email: string; password: string; role: AuthRole }) => request<{ user: UserRecord; users: UserRecord[] }>('/api/users', {
    method: 'POST', body: JSON.stringify(input),
  }),
  update: (userId: string, input: { role: AuthRole; active: boolean }) => request<{ user: UserRecord; users: UserRecord[] }>(`/api/users/${userId}`, {
    method: 'PATCH', body: JSON.stringify(input),
  }),
  remove: (userId: string) => request<{ users: UserRecord[] }>(`/api/users/${userId}`, { method: 'DELETE' }),
  authorizedEmails: () => request<{ emails: AuthorizedEmailRecord[] }>('/api/users/authorized-emails/list'),
  authorizeEmail: (email: string, note: string) => request<{ emails: AuthorizedEmailRecord[] }>('/api/users/authorized-emails', {
    method: 'POST', body: JSON.stringify({ email, note }),
  }),
  revokeEmail: (email: string) => request<{ emails: AuthorizedEmailRecord[] }>('/api/users/authorized-emails/revoke', {
    method: 'POST', body: JSON.stringify({ email }),
  }),
};

export const systemApi = {
  createBackup: () => requestBinary('/api/system/backup'),
  restoreBackup: () => {
    if (!authSessionToken) return Promise.reject(new Error('Sua sessão de usuário expirou.'));
    if (!window.construtec?.restoreBackup) return Promise.reject(new Error('A restauração só pode ser executada pelo aplicativo desktop.'));
    return window.construtec.restoreBackup(authSessionToken);
  },
};

export const dashboardApi = {
  get: () => request<{ summary: DashboardMetrics }>('/api/dashboard'),
};

// Para telas que falam com a API sem engordar este arquivo (limite de 350 linhas).
export { request as apiRequest };
