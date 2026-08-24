import type { ApiErrorPayload, CatalogProduct, ProposalDetail } from '../shared/contracts';

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
  current: () => request<{ proposal: ProposalDetail }>('/api/proposals/current'),
  catalog: (query: string, signal?: AbortSignal) => request<{ products: CatalogProduct[] }>(
    `/api/catalog?q=${encodeURIComponent(query)}&limit=10`,
    { signal },
  ),
  addItem: (proposalId: string, productId: string) => request<{ proposal: ProposalDetail }>(
    `/api/proposals/${proposalId}/items`,
    { method: 'POST', body: JSON.stringify({ productId, quantity: 1 }) },
  ),
  removeItems: (proposalId: string, itemIds: string[]) => request<{ proposal: ProposalDetail }>(
    `/api/proposals/${proposalId}/items/remove`,
    { method: 'POST', body: JSON.stringify({ itemIds }) },
  ),
};
