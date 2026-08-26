import type { ApiErrorPayload, CatalogImportItem, CatalogImportPreview, CatalogProduct, ClientRecord, ProposalDetail, ProposalLaborInput, ProposalLaborItem, ProposalRevisionSummary, ProposalSummary } from '../shared/contracts';

let runtimePromise: Promise<{ apiUrl: string; apiToken: string }> | undefined;

const getRuntime = async () => {
  runtimePromise ??= window.construtec?.runtime().then((runtime) => {
    if (!runtime.apiUrl || !runtime.apiToken) throw new Error('A API local não foi iniciada.');
    return { apiUrl: runtime.apiUrl, apiToken: runtime.apiToken };
  }) ?? Promise.reject(new Error('O aplicativo precisa ser executado pelo Electron.'));
  return runtimePromise;
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const { apiUrl, apiToken } = await getRuntime();
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Resposta inválida da API local.' })) as ApiErrorPayload;
    throw new Error(payload.error);
  }
  return response.json() as Promise<T>;
};

export const proposalApi = {
  list: () => request<{ proposals: ProposalSummary[] }>('/api/proposals'),
  current: () => request<{ proposal: ProposalDetail }>('/api/proposals/current'),
  create: (input: { clientId: string; workId: string; scope: string; validUntil: string | null }) => request<{ proposal: ProposalDetail }>(
    '/api/proposals', { method: 'POST', body: JSON.stringify(input) },
  ),
  byId: (proposalId: string) => request<{ proposal: ProposalDetail }>(`/api/proposals/${proposalId}`),
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
  updateBdi: (proposalId: string, bdiMultiplier: number) => request<{ proposal: ProposalDetail }>(
    `/api/proposals/${proposalId}/bdi`, { method: 'PATCH', body: JSON.stringify({ bdiMultiplier }) },
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
