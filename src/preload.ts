import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('construtec', {
  // No app Suíte (preload gerado com CONSTRUTEC_SUITE=1) a janela e a barra de título são do Centro.
  titleBar: process.platform === 'win32' && process.env.CONSTRUTEC_SUITE !== '1',
  setTitleBarColors: (color: string, symbolColor: string) => ipcRenderer.invoke('window:titlebar-colors', color, symbolColor),
  runtime: () => ipcRenderer.invoke('app:runtime'),
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
  // Só responde no app Suíte unificado; no app avulso o canal não existe e o menu abre o Centro no navegador.
  suiteSwitch: (target: 'centro' | 'orcamentos', hash?: string) => ipcRenderer.invoke('suite:switch', target, hash),
  openWebmail: (composeData?: unknown) => ipcRenderer.invoke('webmail:open', composeData),
  webmailStatus: () => ipcRenderer.invoke('webmail:status'),
  webmailLogout: () => ipcRenderer.invoke('webmail:logout'),
  previewProposal: (proposal: unknown, options?: unknown) => ipcRenderer.invoke('documents:preview', proposal, options),
  exportProposal: (proposal: unknown, options?: unknown) => ipcRenderer.invoke('documents:export', proposal, options),
  savePdf: (proposal: unknown, html: string, suggestedName: string) => ipcRenderer.invoke('documents:save-pdf', proposal, html, suggestedName),
  saveBackup: (bytes: Uint8Array, suggestedName: string) => ipcRenderer.invoke('backup:save', bytes, suggestedName),
  restoreBackup: (sessionToken: string) => ipcRenderer.invoke('backup:restore', sessionToken),
  selectCatalogImport: (kind: 'table' | 'image') => ipcRenderer.invoke('catalog:select-import', kind),
  exportCatalogPreview: (items: unknown[]) => ipcRenderer.invoke('catalog:export-preview', items),
  exsatStatus: () => ipcRenderer.invoke('exsat:status'),
  exsatLogin: () => ipcRenderer.invoke('exsat:login'),
  exsatLogout: () => ipcRenderer.invoke('exsat:logout'),
  previewExsat: (url: string) => ipcRenderer.invoke('exsat:preview', url),
  previewExsatBatch: (urls: string[]) => ipcRenderer.invoke('exsat:preview-batch', urls),
  previewExsatAuto: () => ipcRenderer.invoke('exsat:preview-auto'),
  exsatSyncInfo: () => ipcRenderer.invoke('exsat:sync-info'),
  recordExsatSync: (result: { created: number; updated: number }) => ipcRenderer.invoke('exsat:record-sync', result),
  updaterState: () => ipcRenderer.invoke('updater:state'),
  checkForUpdate: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  onUpdaterChange: (callback: (state: unknown) => void) => {
    const listener = (_event: unknown, state: unknown) => callback(state);
    ipcRenderer.on('updater:changed', listener);
    return () => { ipcRenderer.removeListener('updater:changed', listener); };
  },
  onExsatValidationProgress: (callback: (data: { current: number; total: number; code: string }) => void) => {
    const listener = (_event: unknown, data: { current: number; total: number; code: string }) => callback(data);
    ipcRenderer.on('exsat:validation-progress', listener);
    return () => { ipcRenderer.removeListener('exsat:validation-progress', listener); };
  },
});
