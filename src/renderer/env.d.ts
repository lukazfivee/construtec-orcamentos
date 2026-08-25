import type { CatalogImportFile, CatalogImportItem, ExsatBatchPreview, ExsatSyncInfo, ProposalDetail } from '../shared/contracts';

export {};

declare global {
  interface Window {
    construtec?: {
      runtime: () => Promise<{
        apiUrl?: string;
        apiToken?: string;
        platform: string;
        storage: 'local';
      }>;
      previewProposal: (proposal: ProposalDetail) => Promise<{ opened: boolean }>;
      exportProposal: (proposal: ProposalDetail) => Promise<{ canceled: boolean; files: string[] }>;
      selectCatalogImport: (kind: 'table' | 'image') => Promise<CatalogImportFile>;
      exsatStatus: () => Promise<{ connected: boolean }>;
      exsatLogin: () => Promise<{ connected: boolean }>;
      exsatLogout: () => Promise<{ connected: boolean }>;
      previewExsat: (url: string) => Promise<{ items: CatalogImportItem[]; connected: boolean }>;
      previewExsatBatch: (urls: string[]) => Promise<ExsatBatchPreview>;
      previewExsatAuto: () => Promise<ExsatBatchPreview>;
      exsatSyncInfo: () => Promise<ExsatSyncInfo>;
      recordExsatSync: (result: { created: number; updated: number }) => Promise<ExsatSyncInfo>;
    };
  }
}
