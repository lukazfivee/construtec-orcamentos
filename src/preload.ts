import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('construtec', {
  runtime: () => ipcRenderer.invoke('app:runtime'),
});
