import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { startApiServer, type ApiRuntime } from './server/startApiServer';

if (started) app.quit();

let apiRuntime: ApiRuntime | undefined;

const createWindow = async () => {
  const mainWindow = new BrowserWindow({
    width: 1536,
    height: 1024,
    minWidth: 1280,
    minHeight: 720,
    backgroundColor: '#fefefe',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (!app.isPackaged) {
    mainWindow.webContents.on('did-fail-load', (_event, code, description) => {
      console.error(`Falha ao carregar o renderer (${code}): ${description}`);
    });
  }

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
  mainWindow.show();
};

app.whenReady().then(async () => {
  const packagedPGlitePath = app.isPackaged ? path.join(process.resourcesPath, 'pglite') : undefined;
  apiRuntime = await startApiServer(app.getPath('userData'), packagedPGlitePath);

  ipcMain.handle('app:runtime', () => ({
    apiUrl: apiRuntime?.url,
    apiToken: apiRuntime?.token,
    platform: process.platform,
    storage: 'local',
  }));

  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
}).catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  dialog.showErrorBox('Construtec Orçamentos não pôde iniciar', message);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  void apiRuntime?.close();
});
