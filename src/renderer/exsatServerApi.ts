// Conta e varredura da Exsat feitas pelo servidor (site). A senha so sobe no Salvar e conectar e nunca desce.
import type { ExsatAccountStatus, ExsatResultsPage, ExsatSyncJob } from '../shared/exsatServer';
import { apiRequest } from './api';

export const exsatServerApi = {
  status: () => apiRequest<{ status: ExsatAccountStatus }>('/api/exsat/status'),
  saveCredential: (username: string, password: string) => apiRequest<{ status: ExsatAccountStatus }>(
    '/api/exsat/credential', { method: 'PUT', body: JSON.stringify({ username, password }) },
  ),
  removeCredential: () => apiRequest<{ status: ExsatAccountStatus }>('/api/exsat/credential', { method: 'DELETE' }),
  startSync: () => apiRequest<{ job: ExsatSyncJob; alreadyRunning?: boolean }>('/api/exsat/sync', { method: 'POST', body: '{}' }),
  resumeSync: (id: string) => apiRequest<{ job: ExsatSyncJob }>(`/api/exsat/sync/${id}/resume`, { method: 'POST', body: '{}' }),
  cancelSync: (id: string) => apiRequest<{ job: ExsatSyncJob }>(`/api/exsat/sync/${id}/cancel`, { method: 'POST', body: '{}' }),
  items: (id: string, offset: number, limit = 500) => apiRequest<ExsatResultsPage>(`/api/exsat/sync/${id}/items?offset=${offset}&limit=${limit}`),
};
