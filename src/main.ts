import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { startApiServer, type ApiRuntime } from './server/startApiServer';
import type { ProposalDetail } from './shared/contracts';
import { buildProposalDocx, buildProposalHtml, proposalFileBaseName } from './documents/proposalDocument';
import { selectCatalogImport } from './main/catalogImport';
import { disconnectExsat, exsatConnectionStatus, openExsatLogin, previewAuthenticatedExsat, previewAuthenticatedExsatAuto, previewAuthenticatedExsatBatch } from './main/exsatSession';

if (started) app.quit();

let apiRuntime: ApiRuntime | undefined;
const previewWindows = new Set<BrowserWindow>();

const loadDocumentWindow = async (proposal: ProposalDetail, show: boolean) => {
  const documentWindow = new BrowserWindow({
    width: 1100,
    height: 850,
    show: false,
    title: `Pré-visualização - ${proposal.number}`,
    autoHideMenuBar: true,
    backgroundColor: '#e9edf3',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  previewWindows.add(documentWindow);
  documentWindow.on('closed', () => previewWindows.delete(documentWindow));
  await documentWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildProposalHtml(proposal))}`);
  if (show) documentWindow.show();
  return documentWindow;
};

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

  ipcMain.handle('documents:preview', async (_event, proposal: ProposalDetail) => {
    await loadDocumentWindow(proposal, true);
    return { opened: true };
  });

  ipcMain.handle('documents:export', async (_event, proposal: ProposalDetail) => {
    const selection = await dialog.showOpenDialog({
      title: 'Escolha onde salvar a proposta',
      defaultPath: app.getPath('documents'),
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'Salvar PDF e Word',
    });
    if (selection.canceled || !selection.filePaths[0]) return { canceled: true, files: [] };
    const outputDirectory = selection.filePaths[0];
    await mkdir(outputDirectory, { recursive: true });
    const baseName = proposalFileBaseName(proposal);
    const docxPath = path.join(outputDirectory, `${baseName}.docx`);
    const pdfPath = path.join(outputDirectory, `${baseName}.pdf`);
    await writeFile(docxPath, await buildProposalDocx(proposal));
    const pdfWindow = await loadDocumentWindow(proposal, false);
    try {
      const pdf = await pdfWindow.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
      await writeFile(pdfPath, pdf);
    } finally {
      pdfWindow.destroy();
    }
    return { canceled: false, files: [pdfPath, docxPath] };
  });

  ipcMain.handle('catalog:select-import', (_event, kind: 'table' | 'image') => selectCatalogImport(kind));
  ipcMain.handle('exsat:status', () => exsatConnectionStatus());
  ipcMain.handle('exsat:login', () => openExsatLogin());
  ipcMain.handle('exsat:logout', () => disconnectExsat());
  ipcMain.handle('exsat:preview', (_event, url: string) => previewAuthenticatedExsat(url));
  ipcMain.handle('exsat:preview-batch', (_event, urls: string[]) => previewAuthenticatedExsatBatch(urls));
  ipcMain.handle('exsat:preview-auto', () => previewAuthenticatedExsatAuto());

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
