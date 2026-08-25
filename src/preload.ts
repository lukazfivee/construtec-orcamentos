import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('construtec', {
  runtime: () => ipcRenderer.invoke('app:runtime'),
  previewProposal: (proposal: unknown) => ipcRenderer.invoke('documents:preview', proposal),
  exportProposal: (proposal: unknown) => ipcRenderer.invoke('documents:export', proposal),
  selectCatalogImport: (kind: 'table' | 'image') => ipcRenderer.invoke('catalog:select-import', kind),
  exsatStatus: () => ipcRenderer.invoke('exsat:status'),
  exsatLogin: () => ipcRenderer.invoke('exsat:login'),
  exsatLogout: () => ipcRenderer.invoke('exsat:logout'),
  previewExsat: (url: string) => ipcRenderer.invoke('exsat:preview', url),
  previewExsatBatch: (urls: string[]) => ipcRenderer.invoke('exsat:preview-batch', urls),
});
