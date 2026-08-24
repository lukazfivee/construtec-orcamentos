import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { startApiServer, type ApiRuntime } from './server/startApiServer';

if (started) app.quit();

let apiRuntime: ApiRuntime | undefined;

const createWindow = () => {
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

  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

app.whenReady().then(async () => {
  apiRuntime = await startApiServer(app.getPath('userData'));

  ipcMain.handle('app:runtime', () => ({
    apiUrl: apiRuntime?.url,
    platform: process.platform,
    storage: 'local',
  }));

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  void apiRuntime?.close();
});
