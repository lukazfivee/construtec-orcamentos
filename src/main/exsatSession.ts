import { app, BrowserWindow, session } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CatalogImportItem, ExsatBatchPreview, ExsatPageFailure, ExsatSyncHistoryEntry, ExsatSyncInfo } from '../shared/contracts';
import { parseExsatProductsHtml, validateExsatUrl } from '../server/services/catalog';

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

type ExsatCatalogPage = {
  html: string;
  finalUrl: string;
  items: CatalogImportItem[];
};

class ExsatPageLoadError extends Error {
  constructor(
    readonly stage: ExsatPageFailure['stage'],
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ExsatPageLoadError';
  }
}

const technicalCode = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : '';
  return message.match(/\b(?:EXSAT|ERR)_[A-Z0-9_]+\b/)?.[0] ?? fallback;
};

const safeTechnicalMessage = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(/https?:\/\/\S+/gi, '[URL]').replace(/\s+/g, ' ').trim().slice(0, 180) || fallback;
};

const safeFailureUrl = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl);
    url.username = '';
    url.password = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/token|secret|password|senha|session|auth|key/i.test(key)) url.searchParams.set(key, '[redacted]');
    }
    return url.toString().slice(0, 500);
  } catch {
    return rawUrl.replace(/\s+/g, ' ').trim().slice(0, 500);
  }
};

const pageFailure = (url: string, error: unknown): ExsatPageFailure => {
  if (error instanceof ExsatPageLoadError) {
    return { url: safeFailureUrl(url), stage: error.stage, code: error.code, message: safeTechnicalMessage(error, 'Falha ao carregar a página.') };
  }
  const code = technicalCode(error, 'EXSAT_UNKNOWN');
  return {
    url: safeFailureUrl(url),
    stage: code === 'EXSAT_URL_INVALID' ? 'validation' : 'unknown',
    code,
    message: safeTechnicalMessage(error, 'Falha desconhecida ao carregar a página.'),
  };
};

const exsatSession = () => session.fromPartition(PARTITION);
const syncStatePath = () => path.join(app.getPath('userData'), 'exsat-sync-state.json');

const isExsatLoginUrl = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl);
    return url.hostname === 'exsat.com.br' && url.pathname.toLowerCase().includes('/central-cliente/login');
  } catch {
    return false;
  }
};

const looksLikeLoginHtml = (html: string) => (
  /Login do Revendedor|name=["']?(?:senha|password)|type=["']password/i.test(html)
);

const hasAuthenticatedAccountMarker = (html: string) => (
  /(?:href|action)=["'][^"']*(?:logout|sair)[^"']*["']|\b(?:sair|encerrar sess[aã]o|minha conta|meus pedidos)\b/i.test(html)
);

const isLoginPage = (page: { html: string; finalUrl: string }) => (
  isExsatLoginUrl(page.finalUrl) || looksLikeLoginHtml(page.html)
);

const assertCatalogSession = (page: { html: string; finalUrl: string }) => {
  if (isLoginPage(page)) throw new Error('EXSAT_LOGIN_REQUIRED');
};

const parseCatalogItems = (html: string, includeMissingPrice: boolean) => {
  try {
    return parseExsatProductsHtml(html, includeMissingPrice);
  } catch (error) {
    if (error instanceof Error && error.message === 'EXSAT_NO_PRODUCTS') return [];
    throw new ExsatPageLoadError(
      'parser',
      technicalCode(error, 'EXSAT_PARSE_FAILED'),
      safeTechnicalMessage(error, 'Falha ao interpretar os produtos da página.'),
    );
  }
};

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
  const completedAt = new Date().toISOString();
  const completed: ExsatSyncHistoryEntry = {
    ...state.pendingSync,
    completedAt,
    created: Math.max(0, Math.trunc(result.created)),
    updated: Math.max(0, Math.trunc(result.updated)),
  };
  await saveSyncState({
    ...state,
    lastSyncAt: completedAt,
    lastFullSyncAt: state.pendingSync.mode === 'full' ? completedAt : state.lastFullSyncAt,
    pendingSync: undefined,
    history: [completed, ...state.history].slice(0, MAX_HISTORY),
  });
  return getExsatSyncInfo();
};

const responseHtml = async (url: string) => {
  try {
    const response = await exsatSession().fetch(url, {
      redirect: 'follow',
      credentials: 'include',
    });
    if (!response.ok) {
      throw new ExsatPageLoadError('http', `EXSAT_HTTP_${response.status}`, `HTTP ${response.status} ${response.statusText}`.trim());
    }
    const html = await response.text();
    if (html.length > 8_000_000) throw new ExsatPageLoadError('http', 'EXSAT_RESPONSE_TOO_LARGE', 'Resposta HTTP maior que 8 MB.');
    return { html, finalUrl: response.url };
  } catch (error) {
    if (error instanceof ExsatPageLoadError) throw error;
    throw new ExsatPageLoadError(
      'http',
      technicalCode(error, 'EXSAT_HTTP_FAILED'),
      safeTechnicalMessage(error, 'Falha na requisição HTTP.'),
    );
  }
};

const responseRenderedHtml = async (url: string) => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      partition: PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  try {
    try {
      await window.loadURL(url);
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const html = await window.webContents.executeJavaScript('document.documentElement.outerHTML', true) as string;
      if (!html) throw new ExsatPageLoadError('electron', 'EXSAT_RENDER_EMPTY', 'A página renderizada não retornou HTML.');
      if (html.length > 8_000_000) throw new ExsatPageLoadError('electron', 'EXSAT_RENDER_TOO_LARGE', 'Página renderizada maior que 8 MB.');
      return { html, finalUrl: window.webContents.getURL() };
    } catch (error) {
      if (error instanceof ExsatPageLoadError) throw error;
      throw new ExsatPageLoadError(
        'electron',
        technicalCode(error, 'EXSAT_ELECTRON_FAILED'),
        safeTechnicalMessage(error, 'Falha na navegação Electron.'),
      );
    }
  } finally {
    if (!window.isDestroyed()) window.destroy();
  }
};

const loadCatalogPage = async (url: string, includeMissingPrice = true): Promise<ExsatCatalogPage> => {
  let directFailure: ExsatPageFailure | undefined;
  try {
    const raw = await responseHtml(url);
    assertCatalogSession(raw);
    const rawItems = parseCatalogItems(raw.html, includeMissingPrice);
    if (rawItems.length > 0) return { ...raw, items: rawItems };
  } catch (error) {
    if (error instanceof Error && error.message === 'EXSAT_LOGIN_REQUIRED') throw error;
    directFailure = pageFailure(url, error);
  }

  try {
    const rendered = await responseRenderedHtml(url);
    assertCatalogSession(rendered);
    return { ...rendered, items: parseCatalogItems(rendered.html, includeMissingPrice) };
  } catch (error) {
    if (error instanceof Error && error.message === 'EXSAT_LOGIN_REQUIRED') throw error;
    if (!directFailure) throw error;
    const renderedFailure = pageFailure(url, error);
    throw new ExsatPageLoadError(
      renderedFailure.stage,
      renderedFailure.code,
      `Direto ${directFailure.stage}/${directFailure.code}: ${directFailure.message}; fallback ${renderedFailure.stage}/${renderedFailure.code}: ${renderedFailure.message}`.slice(0, 180),
    );
  }
};

const loadCatalogPageWithRetry = async (url: string, includeMissingPrice = true): Promise<ExsatCatalogPage> => {
  try {
    return await loadCatalogPage(url, includeMissingPrice);
  } catch (error) {
    if (error instanceof Error && error.message === 'EXSAT_LOGIN_REQUIRED') throw error;
    return loadCatalogPage(url, includeMissingPrice);
  }
};

const isCatalogCandidate = (url: URL) => {
  const pathName = url.pathname.toLowerCase();
  const query = url.search.toLowerCase();
  if (/login|logout|minha-conta|carrinho|checkout|pedido|contato|politica|termos/.test(pathName)) return false;
  if (/\/produtos?\/(?:detalhes?|detail)\//.test(pathName)) return false;
  if (url.hash) url.hash = '';
  return /produto|categoria|departamento|marca|busca|pesquisa|shop|loja|catalog/.test(pathName)
    || /page|paged|pagina|s=|search|orderby|product_cat/.test(query)
    || pathName === '/' || pathName === '/home/';
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

const isAuthenticatedResponse = (page: { html: string; finalUrl: string }) => (
  !isLoginPage(page) && hasAuthenticatedAccountMarker(page.html)
);

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
    items: [...items.values()].slice(0, 500),
    connected: true,
    sourceCount: urls.length - failures.length,
    ignored,
    failures,
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

  return {
    items: [...items.values()].slice(0, MAX_AUTO_ITEMS),
    connected: true,
    sourceCount: visited.size - failures.length,
    ignored,
    failures,
  };
};
