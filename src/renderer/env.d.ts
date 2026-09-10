import type { CatalogImportFile, CatalogImportItem, ExsatBatchPreview, ExsatSyncInfo, ProposalDetail, ProposalExportOptions } from '../shared/contracts';

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
      openExternal?: (url: string) => Promise<{ opened: boolean }>;
      openWebmail?: (composeData?: { to?: string; subject?: string; body?: string }) => Promise<{ opened: boolean }>;
      webmailStatus?: () => Promise<{ connected: boolean }>;
      webmailLogout?: () => Promise<{ success: boolean }>;
      previewProposal: (proposal: ProposalDetail, options?: ProposalExportOptions) => Promise<{ opened: boolean }>;
      exportProposal: (proposal: ProposalDetail, options?: ProposalExportOptions) => Promise<{ canceled: boolean; files: string[] }>;
      saveBackup: (bytes: Uint8Array, suggestedName: string) => Promise<{ canceled: boolean; filePath?: string }>;
      restoreBackup: (sessionToken: string) => Promise<{ canceled: boolean; restarting: boolean; emergencyBackupPath?: string }>;
      selectCatalogImport: (kind: 'table' | 'image') => Promise<CatalogImportFile>;
      exportCatalogPreview: (items: CatalogImportItem[]) => Promise<{ canceled: boolean; filePath?: string }>;
      exsatStatus: () => Promise<{ connected: boolean }>;
      exsatLogin: () => Promise<{ connected: boolean }>;
      exsatLogout: () => Promise<{ connected: boolean }>;
      previewExsat: (url: string) => Promise<{ items: CatalogImportItem[]; connected: boolean }>;
      previewExsatBatch: (urls: string[]) => Promise<ExsatBatchPreview>;
      previewExsatAuto: () => Promise<ExsatBatchPreview>;
      exsatSyncInfo: () => Promise<ExsatSyncInfo>;
      recordExsatSync: (result: { created: number; updated: number }) => Promise<ExsatSyncInfo>;
      onExsatValidationProgress?: (callback: (data: { current: number; total: number; code: string }) => void) => () => void;
    };
  }
}
