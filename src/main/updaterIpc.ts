import { app, autoUpdater, BrowserWindow, ipcMain, net } from 'electron';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AUTO_CHECK_INTERVAL_MS, createUpdater, type UpdaterState } from './updater';

const DEFAULT_FEED = 'https://github.com/lukazfivee/construtec-orcamentos/releases/download/windows-updates';
const REQUEST_TIMEOUT_MS = 15_000;

const fetchText = async (url: string): Promise<string> => {
  const response = await net.fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
};

// O Squirrel só atualiza o app instalado por ele (existe Update.exe ao lado da pasta app-X.Y.Z).
const installedBySquirrel = () => process.platform === 'win32' && app.isPackaged
  && existsSync(path.resolve(path.dirname(process.execPath), '..', 'Update.exe'));

export function registerUpdaterIpc() {
  const statePath = path.join(app.getPath('userData'), 'updater-state.json');
  const updater = createUpdater({
    autoUpdater,
    fetchText,
    currentVersion: app.getVersion(),
    feedUrl: (process.env.CONSTRUTEC_UPDATE_URL || DEFAULT_FEED).replace(/\/+$/, ''),
    supported: installedBySquirrel(),
    loadLastCheck: async () => {
      const saved = JSON.parse(await readFile(statePath, 'utf8')) as { lastCheck?: unknown };
      return typeof saved.lastCheck === 'number' ? saved.lastCheck : undefined;
    },
    saveLastCheck: (lastCheck) => writeFile(statePath, JSON.stringify({ lastCheck })),
    onChange: (state: UpdaterState) => {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) window.webContents.send('updater:changed', state);
      }
    },
  });

  ipcMain.handle('updater:state', () => updater.getState());
  ipcMain.handle('updater:check', () => updater.check());
  ipcMain.handle('updater:download', () => updater.download());
  ipcMain.handle('updater:install', () => updater.install());

  // Em segundo plano: pouco depois de abrir e a cada 6 horas com o app aberto (o limite de 6 h vale também entre aberturas).
  setTimeout(() => void updater.autoCheck(), 20_000);
  setInterval(() => void updater.autoCheck(), AUTO_CHECK_INTERVAL_MS).unref();
}
