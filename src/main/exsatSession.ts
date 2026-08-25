import { BrowserWindow, session } from 'electron';
import type { CatalogImportItem } from '../shared/contracts';
import { parseExsatProductsHtml, validateExsatUrl } from '../server/services/catalog';

const LOGIN_URL = 'https://exsat.com.br/central-cliente/login/';
const PARTITION = 'persist:construtec-exsat';
let loginWindow: BrowserWindow | undefined;

const exsatSession = () => session.fromPartition(PARTITION);

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
