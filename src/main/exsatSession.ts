import { BrowserWindow } from 'electron';
import type { CatalogImportItem, ExsatBatchPreview, ExsatPageFailure, ExsatValidationSummary } from '../shared/contracts';
import { validateExsatUrl } from '../server/services/catalog';
import {
  discoverCatalogLinks,
  ExsatPageLoadError,
  exsatSession,
  isAuthenticatedResponse,
  isLoginPage,
  loadCatalogPageWithRetry,
  pageFailure,
  PARTITION,
  responseHtml,
  responseRenderedHtml,
  validateExsatProduct,
} from './exsatFetcher';
import {
  FULL_SYNC_INTERVAL_MS,
  type ExsatSyncPage,
  loadSyncState,
  MAX_AUTO_ITEMS,
  MAX_AUTO_PAGES,
  MAX_INCREMENTAL_PAGES,
  saveSyncState,
} from './exsatSyncState';

export { getExsatSyncInfo, recordExsatSyncResult } from './exsatSyncState';

const LOGIN_URL = 'https://exsat.com.br/central-cliente/login/';
const START_URL = 'https://exsat.com.br/home/';
const CATALOG_SEEDS = [
  'https://exsat.com.br/produtos/departamento/controle-de-acesso/',
  'https://exsat.com.br/produtos/departamento/seguranca-eletronica/',
  'https://exsat.com.br/produtos/departamento/redes-e-cabeamento/',
  'https://exsat.com.br/produtos/departamento/linha-comunicacao/',
  'https://exsat.com.br/produtos/departamento/linha-energia/',
  'https://exsat.com.br/produtos/departamento/energia-solar/',
  'https://exsat.com.br/produtos/departamento/automatizadores/',
  'https://exsat.com.br/produtos/departamento/gravadores-digitais/',
  'https://exsat.com.br/produtos/departamento/cameras-ip/',
  'https://exsat.com.br/produtos/departamento/acessorios-smart-home/',
];

let loginWindow: BrowserWindow | undefined;

export const exsatConnectionStatus = async () => {
  try {
    const login = await responseHtml(LOGIN_URL);
    if (!isLoginPage(login)) {
      return { connected: true };
    }

    const home = await responseHtml(START_URL);
    if (isAuthenticatedResponse(home)) return { connected: true };

    const renderedHome = await responseRenderedHtml(START_URL);
    return { connected: isAuthenticatedResponse(renderedHome) };
  } catch {
    return { connected: false };
  }
};

export const openExsatLogin = async () => {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.focus();
    return new Promise<{ connected: boolean }>((resolve) => {
      loginWindow?.once('closed', () => { void exsatConnectionStatus().then(resolve); });
    });
  }

  loginWindow = new BrowserWindow({
    width: 1120,
    height: 820,
    minWidth: 840,
    minHeight: 640,
    title: 'Entrar na Exsat',
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      partition: PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  loginWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  await loginWindow.loadURL(LOGIN_URL);

  return new Promise<{ connected: boolean }>((resolve) => {
    loginWindow?.once('closed', () => {
      loginWindow = undefined;
      void exsatConnectionStatus().then(resolve);
    });
  });
};

export const disconnectExsat = async () => {
  await exsatSession().clearStorageData({ storages: ['cookies', 'localstorage'] });
  await exsatSession().clearCache();
  const state = await loadSyncState();
  if (state.pendingSync) await saveSyncState({ ...state, pendingSync: undefined });
  return { connected: false };
};

export const previewAuthenticatedExsat = async (rawUrl: string): Promise<{ items: CatalogImportItem[]; connected: boolean }> => {
  const url = validateExsatUrl(rawUrl);
  const status = await exsatConnectionStatus();
  if (!status.connected) throw new Error('EXSAT_LOGIN_REQUIRED');
  const page = await loadCatalogPageWithRetry(url.toString(), false);
  if (page.items.length === 0) throw new Error('EXSAT_NO_PRODUCTS');
  return { items: page.items, connected: true };
};

const emitValidationProgress = (current: number, total: number, code: string) => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('exsat:validation-progress', { current, total, code });
    }
  }
};

const validateBatchItems = async (
  rawItems: CatalogImportItem[],
  failures: ExsatPageFailure[],
): Promise<{ items: CatalogImportItem[]; validationSummary: ExsatValidationSummary }> => {
  const items = [...rawItems];
  const validationSummary: ExsatValidationSummary = { confirmed: 0, divergent: 0, unavailable: 0, error: 0 };
  const total = items.length;
  let completed = 0;
  const CONCURRENCY = 3;

  for (let index = 0; index < items.length; index += CONCURRENCY) {
    const chunk = items.slice(index, index + CONCURRENCY);
    await Promise.all(chunk.map(async (item) => {
      emitValidationProgress(completed + 1, total, item.code);
      const validation = await validateExsatProduct(item.code, item.currentCost);
      completed += 1;
      emitValidationProgress(completed, total, item.code);
      item.validationStatus = validation.status;
      if (validation.status === 'confirmed' || validation.status === 'divergent') {
        item.currentCost = validation.currentCost;
      }
      validationSummary[validation.status] += 1;
      if (validation.failure) {
        failures.push(validation.failure);
      }
    }));
  }

  return { items, validationSummary };
};

export const previewAuthenticatedExsatBatch = async (rawUrls: string[]): Promise<ExsatBatchPreview> => {
  const status = await exsatConnectionStatus();
  if (!status.connected) throw new Error('EXSAT_LOGIN_REQUIRED');
  const startedAt = new Date().toISOString();
  const urls = [...new Set(rawUrls.map((value) => value.trim()).filter(Boolean))].slice(0, 30);
  if (urls.length === 0) throw new Error('EXSAT_URL_INVALID');
  const items = new Map<string, CatalogImportItem>();
  const failures: ExsatPageFailure[] = [];
  let ignored = 0;
  for (const rawUrl of urls) {
    let url: string;
    try {
      url = validateExsatUrl(rawUrl).toString();
    } catch {
      failures.push(pageFailure(rawUrl, new ExsatPageLoadError('validation', 'EXSAT_URL_INVALID', 'Endereço Exsat inválido.')));
      continue;
    }
    try {
      const page = await loadCatalogPageWithRetry(url, true);
      for (const item of page.items) {
        if (items.has(item.code.toLowerCase())) ignored += 1;
        items.set(item.code.toLowerCase(), item);
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'EXSAT_LOGIN_REQUIRED') throw error;
      failures.push(pageFailure(url, error));
    }
  }
  if (items.size === 0) throw new Error('EXSAT_NO_PRODUCTS');
  const rawList = [...items.values()].slice(0, 500);
  const validated = await validateBatchItems(rawList, failures);
  const state = await loadSyncState();
  await saveSyncState({
    ...state,
    pendingSync: {
      id: crypto.randomUUID(),
      startedAt,
      mode: 'manual',
      pagesRead: urls.length - failures.length,
      itemsFound: items.size,
      ignored,
      failedPages: failures.length,
    },
  });
  return {
    items: validated.items,
    connected: true,
    sourceCount: urls.length - failures.length,
    ignored,
    failures,
    validationSummary: validated.validationSummary,
  };
};

export const previewAuthenticatedExsatAuto = async (): Promise<ExsatBatchPreview> => {
  const status = await exsatConnectionStatus();
  if (!status.connected) throw new Error('EXSAT_LOGIN_REQUIRED');
  const startedAt = new Date().toISOString();

  const previous = await loadSyncState();
  const lastFullSync = previous.lastFullSyncAt ? Date.parse(previous.lastFullSyncAt) : 0;
  const fullSync = !lastFullSync || Date.now() - lastFullSync >= FULL_SYNC_INTERVAL_MS || previous.pages.length === 0;
  const pageLimit = fullSync ? MAX_AUTO_PAGES : MAX_INCREMENTAL_PAGES;
  const priorityPages = previous.pages
    .slice()
    .sort((left, right) => right.productCount - left.productCount || Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt))
    .map((page) => page.url);
  const seeds = [START_URL, ...CATALOG_SEEDS, ...priorityPages];
  const queue = [...new Set(seeds)].slice(0, pageLimit);
  const queued = new Set(queue);
  const visited = new Set<string>();
  const items = new Map<string, CatalogImportItem>();
  const failures: ExsatPageFailure[] = [];
  const pageStats = new Map<string, ExsatSyncPage>();
  let ignored = 0;

  while (queue.length > 0 && visited.size < pageLimit && items.size < MAX_AUTO_ITEMS) {
    const url = queue.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);
    try {
      const page = await loadCatalogPageWithRetry(url, true);
      const final = validateExsatUrl(page.finalUrl).toString();
      const productCount = page.items.length;
      for (const item of page.items) {
        if (items.has(item.code.toLowerCase())) ignored += 1;
        items.set(item.code.toLowerCase(), item);
        if (items.size >= MAX_AUTO_ITEMS) break;
      }
      pageStats.set(final, { url: final, productCount, lastSeenAt: new Date().toISOString() });
      for (const link of discoverCatalogLinks(page.html, final)) {
        if (!visited.has(link) && !queued.has(link) && queued.size < pageLimit * 4) {
          queue.push(link);
          queued.add(link);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'EXSAT_LOGIN_REQUIRED') throw error;
      failures.push(pageFailure(url, error));
    }
  }

  if (items.size === 0) {
    if (previous.pendingSync) await saveSyncState({ ...previous, pendingSync: undefined });
    throw new Error('EXSAT_NO_PRODUCTS');
  }

  const retainedPages = previous.pages.filter((page) => !pageStats.has(page.url));
  const nextPages = [...pageStats.values(), ...retainedPages]
    .sort((left, right) => right.productCount - left.productCount || Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt))
    .slice(0, MAX_AUTO_PAGES);
  await saveSyncState({
    ...previous,
    pages: nextPages,
    pendingSync: {
      id: crypto.randomUUID(),
      startedAt,
      mode: fullSync ? 'full' : 'incremental',
      pagesRead: visited.size - failures.length,
      itemsFound: items.size,
      ignored,
      failedPages: failures.length,
    },
  });

  const rawList = [...items.values()].slice(0, MAX_AUTO_ITEMS);
  const validated = await validateBatchItems(rawList, failures);

  return {
    items: validated.items,
    connected: true,
    sourceCount: visited.size - failures.length,
    ignored,
    failures,
    validationSummary: validated.validationSummary,
  };
};
