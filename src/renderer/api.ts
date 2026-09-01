import type {
  ApiErrorPayload,
  AppSettings,
  AuthRole,
  AuthSession,
  AuthSetupStatus,
  AuthUser,
  CatalogImportItem,
  CatalogImportPreview,
  CatalogProduct,
  ClientRecord,
  DashboardMetrics,
  KitDetail,
  KitInput,
  KitSummary,
  ProposalDetail,
  ProposalLaborInput,
  ProposalLaborItem,
  ProposalLine,
  ProposalRevisionSummary,
  ProposalSummary,
  UserRecord,
} from '../shared/contracts';

let runtimePromise: Promise<{ apiUrl: string; apiToken: string }> | undefined;
let authSessionToken = '';

export const setAuthSessionToken = (token: string | null) => {
  authSessionToken = token ?? '';
};

const getRuntime = async () => {
  runtimePromise ??= window.construtec?.runtime().then((runtime) => {
    if (!runtime.apiUrl || !runtime.apiToken) throw new Error('A API local não foi iniciada.');
    return { apiUrl: runtime.apiUrl, apiToken: runtime.apiToken };
  }) ?? Promise.reject(new Error('O aplicativo precisa ser executado pelo Electron.'));
  return runtimePromise;
};

const requestHeaders = (apiToken: string, hasBody = false) => ({
  Authorization: `Bearer ${apiToken}`,
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

export const authApi = {
  setupStatus: () => request<AuthSetupStatus>('/api/auth/setup-status'),
  setup: (input: { name: string; email: string; password: string }) => request<AuthSession>(
    '/api/auth/setup', { method: 'POST', body: JSON.stringify(input) },
  ),
  login: (input: { email: string; password: string }) => request<AuthSession>(
    '/api/auth/login', { method: 'POST', body: JSON.stringify(input) },
  ),
  me: () => request<{ user: AuthUser }>('/api/auth/me'),
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
  updateDetails: (proposalId: string, input: { scope?: string; validUntil?: string | null }) => request<{ proposal: ProposalDetail }>(
    `/api/proposals/${proposalId}/details`, { method: 'PATCH', body: JSON.stringify(input) },
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
  previewExsat: (url: string) => request<{ items: CatalogImportItem[] }>(
    '/api/catalog/import/exsat', { method: 'POST', body: JSON.stringify({ url }) },
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
  update: (userId: string, input: { name: string; email: string; role: AuthRole; active: boolean }) => request<{ user: UserRecord; users: UserRecord[] }>(`/api/users/${userId}`, {
    method: 'PATCH', body: JSON.stringify(input),
  }),
  resetPassword: (userId: string, password: string) => request<{ success: boolean }>(`/api/users/${userId}/password`, {
    method: 'POST', body: JSON.stringify({ password }),
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
