import type { CatalogImportFile, ProposalDetail } from '../shared/contracts';

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
    };
  }
}
