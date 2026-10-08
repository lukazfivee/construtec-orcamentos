import type { UpdaterState } from '../main/updater';
import type { CatalogImportFile, CatalogImportItem, ExsatBatchPreview, ExsatSyncInfo, ProposalDetail, ProposalExportOptions } from '../shared/contracts';

export {};

declare global {
  interface Window {
    construtec?: {
      /** true no app do Windows: a janela usa a barra de titulo propria (WindowTitleBar). */
      titleBar?: boolean;
      setTitleBarColors?: (color: string, symbolColor: string) => Promise<void>;
      runtime: () => Promise<{
        apiUrl?: string;
        apiToken?: string;
        platform: string;
        storage: 'local';
        centroCustosUrl: string;
        /** true dentro do app Suíte unificado: o Centro é a outra tela da mesma janela. */
        suite?: boolean;
      }>;
      suiteSwitch?: (target: 'centro' | 'orcamentos', hash?: string) => Promise<{ switched: boolean }>;
      openExternal?: (url: string) => Promise<{ opened: boolean }>;
      openWebmail?: (composeData?: { to?: string; subject?: string; body?: string }) => Promise<{ opened: boolean }>;
      webmailStatus?: () => Promise<{ connected: boolean }>;
      webmailLogout?: () => Promise<{ success: boolean }>;
      previewProposal: (proposal: ProposalDetail, options?: ProposalExportOptions) => Promise<{ opened: boolean }>;
      exportProposal: (proposal: ProposalDetail, options?: ProposalExportOptions) => Promise<{ canceled: boolean; files: string[] }>;
      savePdf?: (proposal: ProposalDetail, html: string, suggestedName: string) => Promise<{ canceled: boolean; filePath?: string }>;
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
      updaterState?: () => Promise<UpdaterState>;
      checkForUpdate?: () => Promise<UpdaterState>;
      downloadUpdate?: () => Promise<UpdaterState>;
      installUpdate?: () => Promise<UpdaterState>;
      onUpdaterChange?: (callback: (state: UpdaterState) => void) => () => void;
      onExsatValidationProgress?: (callback: (data: { current: number; total: number; code: string }) => void) => () => void;
    };
  }
}
