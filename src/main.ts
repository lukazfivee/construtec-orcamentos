import { app, BrowserWindow, dialog, nativeTheme, screen, shell } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { startOrcamentosMain, type OrcamentosMain } from './main/orcamentosMain';
import { registerUpdaterIpc } from './main/updaterIpc';


if (started) app.quit();

let orcamentos: OrcamentosMain | undefined;

const createWindow = async () => {
  const { width: availableWidth, height: availableHeight } = screen.getPrimaryDisplay().workAreaSize;
  const mainWindow = new BrowserWindow({
    width: Math.min(1536, availableWidth),
    height: Math.min(1024, availableHeight),
    minWidth: Math.min(860, availableWidth),
    minHeight: Math.min(560, availableHeight),
    resizable: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#07202a' : '#fefefe',
    show: true,
    autoHideMenuBar: true,
    ...(process.platform === 'win32' ? { titleBarStyle: 'hidden' as const, titleBarOverlay: { color: '#031f29', symbolColor: '#b9d4dd', height: 35 } } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?|mailto):/i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-fail-load', (_event, code, description) => {
    console.error(`Falha ao carregar o renderer (${code}): ${description}`);
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[RENDERER CONSOLE ${level}] ${message} (${sourceId}:${line})`);
  });

  const devUrl = typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== 'undefined'
    ? MAIN_WINDOW_VITE_DEV_SERVER_URL
    : (process.env.CONSTRUTEC_DEV_SERVER_URL || (!app.isPackaged ? 'http://127.0.0.1:5173' : undefined));
  const rendererName = typeof MAIN_WINDOW_VITE_NAME !== 'undefined' ? MAIN_WINDOW_VITE_NAME : 'main_window';

  if (devUrl) {
    await mainWindow.loadURL(devUrl);
  } else {
    await mainWindow.loadFile(path.join(__dirname, `../renderer/${rendererName}/index.html`));
  }
  mainWindow.show();
  mainWindow.focus();
};

app.whenReady().then(async () => {
  const userDataPath = app.getPath('userData');
  const packagedPGlitePath = app.isPackaged ? path.join(process.resourcesPath, 'pglite') : undefined;
  orcamentos = await startOrcamentosMain({ userDataPath, packagedPGlitePath });

  registerUpdaterIpc();
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
  void orcamentos?.close();
});
