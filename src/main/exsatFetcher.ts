import { BrowserWindow, session } from 'electron';
import type { CatalogImportItem, ExsatPageFailure, ExsatValidationStatus } from '../shared/contracts';
import { parseExsatProductsHtml, validateExsatUrl } from '../server/services/catalog';

export const PARTITION = 'persist:construtec-exsat';

export type ExsatCatalogPage = {
  html: string;
  finalUrl: string;
  items: CatalogImportItem[];
};

export class ExsatPageLoadError extends Error {
  readonly stage: ExsatPageFailure['stage'];
  readonly code: string;

  constructor(
    stage: ExsatPageFailure['stage'],
    code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ExsatPageLoadError';
    this.stage = stage;
    this.code = code;
  }
}

export const technicalCode = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : '';
  return message.match(/\b(?:EXSAT|ERR)_[A-Z0-9_]+\b/)?.[0] ?? fallback;
};

export const safeTechnicalMessage = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(/https?:\/\/\S+/gi, '[URL]').replace(/\s+/g, ' ').trim().slice(0, 180) || fallback;
};

export const safeFailureUrl = (rawUrl: string) => {
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

export const pageFailure = (url: string, error: unknown): ExsatPageFailure => {
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

export const exsatSession = () => session.fromPartition(PARTITION);

export const isExsatLoginUrl = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl);
    return url.hostname === 'exsat.com.br' && url.pathname.toLowerCase().includes('/central-cliente/login');
  } catch {
    return false;
  }
};

export const looksLikeLoginHtml = (html: string) => (
  /Login do Revendedor|name=["']?(?:senha|password)|type=["']password/i.test(html)
);

export const hasAuthenticatedAccountMarker = (html: string) => (
  /(?:href|action)=["'][^"']*(?:logout|sair)[^"']*["']|\b(?:sair|encerrar sess[aã]o|minha conta|meus pedidos)\b/i.test(html)
);

export const isLoginPage = (page: { html: string; finalUrl: string }) => (
  isExsatLoginUrl(page.finalUrl) || looksLikeLoginHtml(page.html)
);

export const assertCatalogSession = (page: { html: string; finalUrl: string }) => {
  if (isLoginPage(page)) throw new Error('EXSAT_LOGIN_REQUIRED');
};

export const parseCatalogItems = (html: string, includeMissingPrice: boolean) => {
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

export const responseHtml = async (url: string) => {
  try {
    const response = await exsatSession().fetch(url, {
      redirect: 'follow',
      credentials: 'include',
    });
    if (!response.ok) {
      throw new ExsatPageLoadError('http', `EXSAT_HTTP_${response.status}`, `HTTP ${response.status} ${response.statusText}`.trim());
    }
    const body = await response.arrayBuffer();
    if (body.byteLength > 8_000_000) throw new ExsatPageLoadError('http', 'EXSAT_RESPONSE_TOO_LARGE', 'Resposta HTTP maior que 8 MB.');
    const charset = response.headers.get('content-type')?.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1]?.toLowerCase();
    const html = new TextDecoder(charset === 'iso-8859-1' ? 'windows-1252' : 'utf-8').decode(body);
    return { html, finalUrl: url };
  } catch (error) {
    if (error instanceof ExsatPageLoadError) throw error;
    throw new ExsatPageLoadError(
      'http',
      technicalCode(error, 'EXSAT_HTTP_FAILED'),
      safeTechnicalMessage(error, 'Falha na requisição HTTP.'),
    );
  }
};

export const responseRenderedHtml = async (url: string) => {
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

export const loadCatalogPage = async (url: string, includeMissingPrice = true): Promise<ExsatCatalogPage> => {
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

export const loadCatalogPageWithRetry = async (url: string, includeMissingPrice = true): Promise<ExsatCatalogPage> => {
  try {
    return await loadCatalogPage(url, includeMissingPrice);
  } catch (error) {
    if (error instanceof Error && error.message === 'EXSAT_LOGIN_REQUIRED') throw error;
    return loadCatalogPage(url, includeMissingPrice);
  }
};

export const isCatalogCandidate = (url: URL) => {
  const pathName = url.pathname.toLowerCase();
  const query = url.search.toLowerCase();
  if (/login|logout|minha-conta|carrinho|checkout|pedido|contato|politica|termos/.test(pathName)) return false;
  if (/\/produtos?\/(?:detalhes?|detail)\//.test(pathName)) return false;
  if (url.hash) url.hash = '';
  return /produto|categoria|departamento|marca|busca|pesquisa|shop|loja|catalog/.test(pathName)
    || /page|paged|pagina|s=|search|orderby|product_cat/.test(query)
    || pathName === '/' || pathName === '/home/';
};

export const discoverCatalogLinks = (html: string, baseUrl: string) => {
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

export const isAuthenticatedResponse = (page: { html: string; finalUrl: string }) => (
  !isLoginPage(page) && hasAuthenticatedAccountMarker(page.html)
);

export const parseIndividualProductPrice = (value?: string) => {
  if (!value) return 0;
  const normalized = value.replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  const price = Number(normalized);
  return Number.isFinite(price) ? Math.round(price * 100) / 100 : 0;
};

export const parseExsatIndividualProduct = (
  html: string,
  code: string,
  catalogCost: number,
): { status: ExsatValidationStatus; currentCost: number } => {
  const normalizedCode = code.trim().toUpperCase();
  const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  if (/nenhum produto encontrado|produto n[ãa]o encontrado|n[ãa]o encontramos|0 produto/i.test(html)) {
    return { status: 'unavailable', currentCost: 0 };
  }

  const skuPattern = new RegExp(`class=["']product-sku["'][^>]*>\\s*${escapeRegex(normalizedCode)}\\s*<`, 'i');
  const detailPattern = new RegExp(`href=["'][^"']*\\/produtos\\/detalhes\\/${escapeRegex(normalizedCode)}\\/`, 'i');
  const codeMarkerPattern = new RegExp(`C[oó]digo\\s*:\\s*(?:<[^>]+>\\s*)*${escapeRegex(normalizedCode)}\\b`, 'i');

  let cardHtml = '';
  const match = html.match(skuPattern) ?? html.match(detailPattern) ?? html.match(codeMarkerPattern);
  if (match && match.index !== undefined) {
    const lastCardIndex = Math.max(
      html.lastIndexOf('class="product-card', match.index),
      html.lastIndexOf("class='product-card", match.index),
      html.lastIndexOf('class="card', match.index),
      html.lastIndexOf("class='card", match.index),
    );
    const start = lastCardIndex !== -1 ? lastCardIndex : Math.max(0, match.index - 500);
    const nextCardMatch = html.slice(match.index + 1).search(/(?:class=["'][^"']*(?:product-card|card)[^"']*["']|<div class=["']product-sku)/i);
    const end = nextCardMatch !== -1 ? match.index + 1 + nextCardMatch : Math.min(html.length, match.index + 2500);
    cardHtml = html.slice(start, end);
  } else {
    return { status: 'unavailable', currentCost: 0 };
  }

  if (/\b(?:indispon[íi]vel|esgotado|sem estoque|fora de estoque|avise-me|sob consulta)\b/i.test(cardHtml)) {
    return { status: 'unavailable', currentCost: 0 };
  }

  let price = 0;
  const priceCurrentMatch = cardHtml.match(/class=["'][^"']*price-current[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|p)>/i);
  if (priceCurrentMatch) {
    const priceTextMatch = priceCurrentMatch[1].match(/R\$\s*[\d.,]+|[\d.,]+/);
    price = parseIndividualProductPrice(priceTextMatch ? priceTextMatch[0] : '');
  }

  if (price <= 0) {
    const cleanCard = cardHtml
      .replace(/<del\b[\s\S]*?<\/del>/gi, '')
      .replace(/<s\b[\s\S]*?<\/s>/gi, '')
      .replace(/class=["'][^"']*(?:price-old|preco-antigo|line-through)[^"']*["'][\s\S]*?<\/(?:div|span|p)>/gi, '')
      .replace(/class=["'][^"']*price-installment[^"']*["'][\s\S]*?<\/(?:div|span|p)>/gi, '')
      .replace(/\d+\s*x\s*de\s*R\$\s*[\d.,]+/gi, '');
    const priceMatch = cleanCard.match(/R\$\s*([\d.]+,\d{2})/i) ?? cleanCard.match(/R\$\s*([\d.,]+)/i);
    if (priceMatch) price = parseIndividualProductPrice(priceMatch[0]);
  }

  if (price <= 0) {
    return { status: 'unavailable', currentCost: 0 };
  }

  const normCatalog = Math.round(catalogCost * 100) / 100;
  if (normCatalog > 0 && Math.abs(normCatalog - price) >= 0.01) {
    return { status: 'divergent', currentCost: price };
  }
  return { status: 'confirmed', currentCost: price };
};

export const validateExsatProduct = async (
  code: string,
  catalogCost: number,
): Promise<{ status: ExsatValidationStatus; currentCost: number; failure?: ExsatPageFailure }> => {
  const searchUrl = `https://exsat.com.br/produtos/pesquisa/?busca=${encodeURIComponent(code.trim())}`;
  try {
    const page = await responseHtml(searchUrl);
    assertCatalogSession(page);
    return parseExsatIndividualProduct(page.html, code, catalogCost);
  } catch (error) {
    if (error instanceof Error && error.message === 'EXSAT_LOGIN_REQUIRED') throw error;
    return {
      status: 'error',
      currentCost: catalogCost,
      failure: pageFailure(searchUrl, error),
    };
  }
};
