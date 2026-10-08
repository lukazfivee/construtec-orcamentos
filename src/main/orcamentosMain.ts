import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { startApiServer, type ApiRuntime } from '../server/startApiServer';
import { getDatabasePath, restoreDatabaseFromBackup, validateDatabaseBackup } from '../server/services/database';
import type { AppSettings, ProposalDetail, ProposalExportOptions } from '../shared/contracts';
import { buildProposalDocx, buildProposalHtml, proposalFileBaseName, proposalPdfOptions } from '../documents/proposalDocument';
import { selectCatalogImport } from './catalogImport';
import { normalizeCatalogImportFile } from './catalogImportNormalize';
import { disconnectExsat, exsatConnectionStatus, getExsatSyncInfo, openExsatLogin, previewAuthenticatedExsat, previewAuthenticatedExsatAuto, previewAuthenticatedExsatBatch, recordExsatSyncResult } from './exsatSession';
import { disconnectWebmail, openWebmailWindow, webmailConnectionStatus } from './webmailSession';

// Parte do processo principal do Orçamentos: API local, banco e todos os canais IPC (documentos, backup,
// catálogo, Exsat, webmail). Usada pelo app avulso (src/main.ts) e pelo app Suíte unificado (Centro),
// que carrega este módulo já empacotado em modules/orcamentos-main.

export type OrcamentosMainOptions = {
  userDataPath: string;
  packagedPGlitePath?: string;
  /** Campos extras devolvidos por `app:runtime` ao renderer (ex.: `suite: true` no app unificado). */
  runtimeExtras?: Record<string, unknown>;
};

export type OrcamentosMain = {
  runtime: () => ApiRuntime | undefined;
  close: () => Promise<void>;
};

let apiRuntime: ApiRuntime | undefined;
const previewWindows = new Set<BrowserWindow>();

const fetchAppSettings = async (): Promise<AppSettings | undefined> => {
  if (!apiRuntime) return undefined;
  try {
    const res = await fetch(`${apiRuntime.url}/api/settings`, {
      headers: { 'X-Construtec-Token': apiRuntime.token },
    });
    if (res.ok) return (await res.json()) as AppSettings;
  } catch { return undefined; }
  return undefined;
};

const loadDocumentWindow = async (proposal: ProposalDetail, show: boolean, settings?: AppSettings, options?: ProposalExportOptions) => {
  const resolvedSettings = settings ?? (await fetchAppSettings());
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
  await documentWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildProposalHtml(proposal, resolvedSettings, options))}`);
  if (show) documentWindow.show();
  return documentWindow;
};

export const startOrcamentosMain = async (options: OrcamentosMainOptions): Promise<OrcamentosMain> => {
  const { userDataPath, packagedPGlitePath } = options;
  apiRuntime = await startApiServer(userDataPath, packagedPGlitePath);

  ipcMain.handle('app:runtime', () => ({
    apiUrl: apiRuntime?.url,
    apiToken: apiRuntime?.token,
    platform: process.platform,
    storage: 'local',
    centroCustosUrl: process.env.CENTRO_CUSTOS_URL || 'https://centro-custos-api.construtec-reports.workers.dev',
    ...options.runtimeExtras,
  }));

  ipcMain.handle('app:open-external', async (_event, targetUrl: string) => {
    if (typeof targetUrl === 'string' && /^(https?|mailto):/i.test(targetUrl.trim())) {
      await shell.openExternal(targetUrl.trim());
      return { opened: true };
    }
    return { opened: false };
  });

  ipcMain.handle('window:titlebar-colors', (event, color: unknown, symbolColor: unknown) => {
    const hex = /^#[0-9a-fA-F]{6}$/;
    if (process.platform !== 'win32' || typeof color !== 'string' || typeof symbolColor !== 'string' || !hex.test(color) || !hex.test(symbolColor)) return;
    BrowserWindow.fromWebContents(event.sender)?.setTitleBarOverlay({ color, symbolColor, height: 35 });
  });

  ipcMain.handle('webmail:open', (_event, composeData?: Parameters<typeof openWebmailWindow>[0]) => openWebmailWindow(composeData));
  ipcMain.handle('webmail:status', () => webmailConnectionStatus());
  ipcMain.handle('webmail:logout', () => disconnectWebmail());

  ipcMain.handle('documents:preview', async (_event, proposal: ProposalDetail, options?: ProposalExportOptions) => {
    await loadDocumentWindow(proposal, true, undefined, options);
    return { opened: true };
  });

  ipcMain.handle('documents:export', async (_event, proposal: ProposalDetail, options?: ProposalExportOptions) => {
    const selection = await dialog.showOpenDialog({
      title: 'Escolha onde salvar a proposta',
      defaultPath: app.getPath('documents'),
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'Salvar documentos',
    });
    if (selection.canceled || !selection.filePaths[0]) return { canceled: true, files: [] };
    const outputDirectory = selection.filePaths[0];
    await mkdir(outputDirectory, { recursive: true });
    const settings = await fetchAppSettings();
    const baseName = proposalFileBaseName(proposal);
    const docxPath = path.join(outputDirectory, `${baseName}.docx`);
    const pdfPath = path.join(outputDirectory, `${baseName}.pdf`);
    const exportedFiles: string[] = [];

    if (options?.format !== 'pdf') {
      await writeFile(docxPath, await buildProposalDocx(proposal, settings, options));
      exportedFiles.push(docxPath);
    }
    if (options?.format !== 'docx') {
      const pdfWindow = await loadDocumentWindow(proposal, false, settings, options);
      try {
        const pdf = await pdfWindow.webContents.printToPDF(proposalPdfOptions());
        await writeFile(pdfPath, pdf);
        exportedFiles.push(pdfPath);
      } finally {
        pdfWindow.destroy();
      }
    }
    return { canceled: false, files: exportedFiles };
  });

  // PDF da tela "PDF da proposta": o app mesmo gera o arquivo (mesmo caminho da exportacao), com o timbrado e o nome combinado.
  ipcMain.handle('documents:save-pdf', async (event, proposal: ProposalDetail, html: string, suggestedName: string) => {
    const safeName = path.basename(String(suggestedName || "Proposta_Construtec.pdf")).replace(/[<>:"/|?*]/g, "_");
    const selection = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender) ?? undefined as never, {
      title: 'Salvar o PDF da proposta',
      defaultPath: path.join(app.getPath('documents'), safeName),
      buttonLabel: 'Salvar PDF',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (selection.canceled || !selection.filePath) return { canceled: true };
    const settings = await fetchAppSettings();
    const pdfWindow = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
    try {
      await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      await writeFile(selection.filePath, await pdfWindow.webContents.printToPDF(proposalPdfOptions()));
    } finally {
      pdfWindow.destroy();
    }
    return { canceled: false, filePath: selection.filePath };
  });

  ipcMain.handle('backup:save', async (_event, bytes: Uint8Array, suggestedName: string) => {
    const safeName = path.basename(suggestedName || 'Construtec-Orcamentos-backup.tar.gz');
    const selection = await dialog.showSaveDialog({
      title: 'Salvar backup do Construtec Orçamentos',
      defaultPath: path.join(app.getPath('documents'), safeName),
      buttonLabel: 'Salvar backup',
      filters: [{ name: 'Backup PGlite', extensions: ['gz'] }],
    });
    if (selection.canceled || !selection.filePath) return { canceled: true };
    await writeFile(selection.filePath, Buffer.from(bytes));
    return { canceled: false, filePath: selection.filePath };
  });

  ipcMain.handle('backup:restore', async (_event, sessionToken: string) => {
    if (!apiRuntime || !sessionToken || !(await apiRuntime.isAdminSession(sessionToken))) {
      throw new Error('Apenas administradores podem restaurar backups.');
    }

    const selection = await dialog.showOpenDialog({
      title: 'Selecionar backup do Construtec Orçamentos',
      defaultPath: app.getPath('documents'),
      properties: ['openFile'],
      filters: [{ name: 'Backup PGlite', extensions: ['gz'] }],
    });
    if (selection.canceled || !selection.filePaths[0]) return { canceled: true, restarting: false };

    const backupPath = selection.filePaths[0];
    const backupBytes = Uint8Array.from(await readFile(backupPath));
    const metadata = await validateDatabaseBackup(backupBytes, packagedPGlitePath);
    const confirmation = await dialog.showMessageBox({
      type: 'warning',
      title: 'Restaurar backup local',
      message: 'O banco local atual será substituído e o aplicativo será reiniciado.',
      detail: `Backup validado. Esquema ${metadata.schemaVersion}; ${metadata.proposals} proposta(s); ${metadata.users} usuário(s). Antes da troca, uma cópia de emergência do banco atual será salva automaticamente.`,
      buttons: ['Cancelar', 'Restaurar e reiniciar'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (confirmation.response !== 1) return { canceled: true, restarting: false };

    const backupsDirectory = path.join(userDataPath, 'backups');
    await mkdir(backupsDirectory, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const emergencyBackupPath = path.join(backupsDirectory, `pre-restore-${timestamp}.tar.gz`);
    const emergencyBackup = await apiRuntime.backup();
    await writeFile(emergencyBackupPath, Buffer.from(emergencyBackup));

    const databasePath = getDatabasePath(userDataPath);
    const rollbackPath = path.join(path.dirname(databasePath), `postgres-rollback-${Date.now()}`);
    await apiRuntime.close();
    apiRuntime = undefined;

    try {
      await rename(databasePath, rollbackPath);
      try {
        await restoreDatabaseFromBackup(userDataPath, backupBytes, packagedPGlitePath);
      } catch (error) {
        await rm(databasePath, { recursive: true, force: true });
        await rename(rollbackPath, databasePath);
        throw error;
      }
      await rm(rollbackPath, { recursive: true, force: true });
      app.relaunch();
      app.exit(0);
      return { canceled: false, restarting: true, emergencyBackupPath };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      dialog.showErrorBox('Restauração não concluída', `O banco anterior foi preservado.\n\n${message}`);
      app.relaunch();
      app.exit(1);
      return { canceled: false, restarting: true, emergencyBackupPath };
    }
  });

  ipcMain.handle('catalog:select-import', async (_event, kind: 'table' | 'image') => {
    const result = await selectCatalogImport(kind);
    return normalizeCatalogImportFile(result);
  });
  ipcMain.handle('exsat:status', () => exsatConnectionStatus());
  ipcMain.handle('exsat:login', () => openExsatLogin());
  ipcMain.handle('exsat:logout', () => disconnectExsat());
  ipcMain.handle('exsat:preview', (_event, url: string) => previewAuthenticatedExsat(url));
  ipcMain.handle('exsat:preview-batch', (_event, urls: string[]) => previewAuthenticatedExsatBatch(urls));
  ipcMain.handle('exsat:preview-auto', () => previewAuthenticatedExsatAuto());
  ipcMain.handle('exsat:sync-info', () => getExsatSyncInfo());
  ipcMain.handle('exsat:record-sync', (_event, result: { created: number; updated: number }) => recordExsatSyncResult(result));

  return {
    runtime: () => apiRuntime,
    close: async () => { await apiRuntime?.close(); },
  };
};
