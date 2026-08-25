import { app, BrowserWindow, session } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CatalogImportItem, ExsatBatchPreview, ExsatSyncHistoryEntry, ExsatSyncInfo } from '../shared/contracts';
import { parseExsatProductsHtml, validateExsatUrl } from '../server/services/catalog';

const LOGIN_URL = 'https://exsat.com.br/central-cliente/login/';
const START_URL = 'https://exsat.com.br/';
const PARTITION = 'persist:construtec-exsat';
const MAX_AUTO_PAGES = 60;
const MAX_INCREMENTAL_PAGES = 24;
const MAX_AUTO_ITEMS = 500;
const MAX_HISTORY = 20;
const FULL_SYNC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
let loginWindow: BrowserWindow | undefined;

type ExsatSyncPage = {
  url: string;
  productCount: number;
  lastSeenAt: string;
};

type ExsatPendingSync = Omit<ExsatSyncHistoryEntry, 'completedAt' | 'created' | 'updated'>;

type ExsatSyncState = {
  lastSyncAt?: string;
  lastFullSyncAt?: string;
  pages: ExsatSyncPage[];
  history: ExsatSyncHistoryEntry[];
  pendingSync?: ExsatPendingSync;
};

const exsatSession = () => session.fromPartition(PARTITION);
const syncStatePath = () => path.join(app.getPath('userData'), 'exsat-sync-state.json');

const isHistoryEntry = (entry: unknown): entry is ExsatSyncHistoryEntry => {
  if (!entry || typeof entry !== 'object') return false;
  const value = entry as Partial<ExsatSyncHistoryEntry>;
  return typeof value.id === 'string' && typeof value.startedAt === 'string' && typeof value.completedAt === 'string'
    && (value.mode === 'full' || value.mode === 'incremental' || value.mode === 'manual')
    && typeof value.pagesRead === 'number' && typeof value.itemsFound === 'number'
    && typeof value.created === 'number' && typeof value.updated === 'number'
    && typeof value.ignored === 'number' && typeof value.failedPages === 'number';
};

const loadSyncState = async (): Promise<ExsatSyncState> => {
  try {
    const state = JSON.parse(await readFile(syncStatePath(), 'utf8')) as Partial<ExsatSyncState>;
    return {
      lastSyncAt: state.lastSyncAt,
      lastFullSyncAt: state.lastFullSyncAt,
      pages: Array.isArray(state.pages) ? state.pages.filter((page): page is ExsatSyncPage => (
        Boolean(page) && typeof page.url === 'string' && typeof page.productCount === 'number' && typeof page.lastSeenAt === 'string'
      )).slice(0, MAX_AUTO_PAGES) : [],
      history: Array.isArray(state.history) ? state.history.filter(isHistoryEntry).slice(0, MAX_HISTORY) : [],
      pendingSync: state.pendingSync,
    };
  } catch {
    return { pages: [], history: [] };
  }
};

const saveSyncState = async (state: ExsatSyncState) => {
  await mkdir(path.dirname(syncStatePath()), { recursive: true });
  await writeFile(syncStatePath(), JSON.stringify(state, null, 2), 'utf8');
};

export const getExsatSyncInfo = async (): Promise<ExsatSyncInfo> => {
  const state = await loadSyncState();
  return {
    lastSyncAt: state.lastSyncAt,
    lastFullSyncAt: state.lastFullSyncAt,
    history: state.history,
  };
};

export const recordExsatSyncResult = async (result: { created: number; updated: number }) => {
  const state = await loadSyncState();
  if (!state.pendingSync) return getExsatSyncInfo();
  const completed: ExsatSyncHistoryEntry = {
    ...state.pendingSync,
    completedAt: new Date().toISOString(),
    created: Math.max(0, Math.trunc(result.created)),
    updated: Math.max(0, Math.trunc(result.updated)),
  };
  await saveSyncState({
    ...state,
    pendingSync: undefined,
    history: [completed, ...state.history].slice(0, MAX_HISTORY),
  });
  return getExsatSyncInfo();
};

const responseHtml = async (url: string) => {
  const response = await exsatSession().fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'Construtec-Orcamentos/1.0 (+catalog-import)' },
  });
  if (!response.ok) throw new Error('EXSAT_UNAVAILABLE');
  const html = await response.text();
  if (html.length > 8_000_000) throw new Error('EXSAT_UNAVAILABLE');
  return { html, finalUrl: response.url };
};

const isCatalogCandidate = (url: URL) => {
  const pathName = url.pathname.toLowerCase();
  const query = url.search.toLowerCase();
  if (/login|logout|minha-conta|carrinho|checkout|pedido|contato|politica|termos/.test(pathName)) return false;
  if (url.hash) url.hash = '';
  return /produto|categoria|departamento|marca|busca|pesquisa|shop|loja|catalog/.test(pathName)
    || /page|paged|pagina|s=|search|orderby|product_cat/.test(query)
    || pathName === '/';
};

const discoverCatalogLinks = (html: string, baseUrl: string) => {
  const links = new Set<string>();
  for (const match of html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
    try {
      const candidate = validateExsatUrl(new URL(match[1], baseUrl).toString());
      candidate.hash = '';
      if (isCatalogCandidate(candidate)) links.add(candidate.toString());
    } catch {
      // Ignora links externos ou inválidos.
    }
  }
  return [...links];
};

export const exsatConnectionStatus = async () => {
  try {
    const { html, finalUrl } = await responseHtml(LOGIN_URL);
    const stillOnLogin = new URL(finalUrl).pathname.includes('/central-cliente/login')
      || /Login do Revendedor|name=["']?(?:senha|password)|type=["']password/i.test(html);
    return { connected: !stillOnLogin };
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
  return { connected: false };
};

export const previewAuthenticatedExsat = async (rawUrl: string): Promise<{ items: CatalogImportItem[]; connected: boolean }> => {
  const url = validateExsatUrl(rawUrl);
  const status = await exsatConnectionStatus();
  const { html } = await responseHtml(url.toString());
  return { items: parseExsatProductsHtml(html), connected: status.connected };
};

export const previewAuthenticatedExsatBatch = async (rawUrls: string[]): Promise<ExsatBatchPreview> => {
  const status = await exsatConnectionStatus();
  if (!status.connected) throw new Error('EXSAT_LOGIN_REQUIRED');
  const startedAt = new Date().toISOString();
  const urls = [...new Set(rawUrls.map((value) => value.trim()).filter(Boolean).map((value) => validateExsatUrl(value).toString()))].slice(0, 30);
  if (urls.length === 0) throw new Error('EXSAT_URL_INVALID');
  const items = new Map<string, CatalogImportItem>();
  const failedUrls: string[] = [];
  let ignored = 0;
  for (const url of urls) {
    try {
      const { html } = await responseHtml(url);
      const parsed = parseExsatProductsHtml(html, true);
      for (const item of parsed) {
        if (items.has(item.code.toLowerCase())) ignored += 1;
        items.set(item.code.toLowerCase(), item);
      }
    } catch {
      failedUrls.push(url);
    }
  }
  if (items.size === 0) throw new Error('EXSAT_NO_PRODUCTS');
  const state = await loadSyncState();
  const now = new Date().toISOString();
  await saveSyncState({
    ...state,
    lastSyncAt: now,
    pendingSync: {
      id: crypto.randomUUID(),
      startedAt,
      mode: 'manual',
      pagesRead: urls.length - failedUrls.length,
      itemsFound: items.size,
      ignored,
      failedPages: failedUrls.length,
    },
  });
  return {
    items: [...items.values()].slice(0, 500),
    connected: true,
    sourceCount: urls.length - failedUrls.length,
    ignored,
    failedUrls,
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
  const seeds = fullSync ? [START_URL, ...priorityPages] : [...priorityPages, START_URL];
  const queue = [...new Set(seeds)].slice(0, pageLimit);
  const queued = new Set(queue);
  const visited = new Set<string>();
  const items = new Map<string, CatalogImportItem>();
  const failedUrls: string[] = [];
  const pageStats = new Map<string, ExsatSyncPage>();
  let ignored = 0;

  while (queue.length > 0 && visited.size < pageLimit && items.size < MAX_AUTO_ITEMS) {
    const url = queue.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);
    try {
      const { html, finalUrl } = await responseHtml(url);
      const final = validateExsatUrl(finalUrl).toString();
      let productCount = 0;
      try {
        const parsed = parseExsatProductsHtml(html, true);
        productCount = parsed.length;
        for (const item of parsed) {
          if (items.has(item.code.toLowerCase())) ignored += 1;
          items.set(item.code.toLowerCase(), item);
          if (items.size >= MAX_AUTO_ITEMS) break;
        }
      } catch (error) {
        if (!(error instanceof Error && error.message === 'EXSAT_NO_PRODUCTS')) throw error;
      }
      pageStats.set(final, { url: final, productCount, lastSeenAt: new Date().toISOString() });
      for (const link of discoverCatalogLinks(html, final)) {
        if (!visited.has(link) && !queued.has(link) && queued.size < pageLimit * 4) {
          queue.push(link);
          queued.add(link);
        }
      }
    } catch {
      failedUrls.push(url);
    }
  }

  if (items.size === 0) throw new Error('EXSAT_NO_PRODUCTS');

  const now = new Date().toISOString();
  const retainedPages = previous.pages.filter((page) => !pageStats.has(page.url));
  const nextPages = [...pageStats.values(), ...retainedPages]
    .sort((left, right) => right.productCount - left.productCount || Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt))
    .slice(0, MAX_AUTO_PAGES);
  await saveSyncState({
    ...previous,
    lastSyncAt: now,
    lastFullSyncAt: fullSync ? now : previous.lastFullSyncAt,
    pages: nextPages,
    pendingSync: {
      id: crypto.randomUUID(),
      startedAt,
      mode: fullSync ? 'full' : 'incremental',
      pagesRead: visited.size - failedUrls.length,
      itemsFound: items.size,
      ignored,
      failedPages: failedUrls.length,
    },
  });

  return {
    items: [...items.values()].slice(0, MAX_AUTO_ITEMS),
    connected: true,
    sourceCount: visited.size - failedUrls.length,
    ignored,
    failedUrls,
  };
};
