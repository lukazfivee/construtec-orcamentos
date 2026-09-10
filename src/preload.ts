import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('construtec', {
  runtime: () => ipcRenderer.invoke('app:runtime'),
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
  openWebmail: (composeData?: unknown) => ipcRenderer.invoke('webmail:open', composeData),
  webmailStatus: () => ipcRenderer.invoke('webmail:status'),
  webmailLogout: () => ipcRenderer.invoke('webmail:logout'),
  previewProposal: (proposal: unknown, options?: unknown) => ipcRenderer.invoke('documents:preview', proposal, options),
  exportProposal: (proposal: unknown, options?: unknown) => ipcRenderer.invoke('documents:export', proposal, options),
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
  onExsatValidationProgress: (callback: (data: { current: number; total: number; code: string }) => void) => {
    const listener = (_event: unknown, data: { current: number; total: number; code: string }) => callback(data);
    ipcRenderer.on('exsat:validation-progress', listener);
    return () => { ipcRenderer.removeListener('exsat:validation-progress', listener); };
  },
});
