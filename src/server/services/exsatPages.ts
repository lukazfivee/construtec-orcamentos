// Leitura das paginas da Exsat sem Electron: deteccao de login, links de departamento e preco do cartao de produto.
// Usado pelo aplicativo do computador (src/main/exsatFetcher.ts) e pela varredura no servidor.
import type { ExsatValidationStatus } from '../../shared/contracts';
import { validateExsatUrl } from './exsatFetch';

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

export const isAuthenticatedResponse = (page: { html: string; finalUrl: string }) => (
  !isLoginPage(page) && hasAuthenticatedAccountMarker(page.html)
);

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

export const parseIndividualProductPrice = (value?: string) => {
  if (!value) return 0;
  const normalized = value.replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  const price = Number(normalized);
  return Number.isFinite(price) ? Math.round(price * 100) / 100 : 0;
};

const UNAVAILABLE = /\b(?:indispon[íi]vel|esgotado|sem estoque|fora de estoque|avise-me|sob consulta)\b/i;

// Preco a vista do cartao de um produto: o "price-current"; sem ele, o primeiro R$ fora de preco antigo e parcelas.
// Cartao indisponivel, esgotado ou "sob consulta" nao tem preco (0).
export const priceFromCard = (cardHtml: string): number => {
  if (UNAVAILABLE.test(cardHtml)) return 0;
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
  return price;
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

  const match = html.match(skuPattern) ?? html.match(detailPattern) ?? html.match(codeMarkerPattern);
  if (!match || match.index === undefined) return { status: 'unavailable', currentCost: 0 };
  const lastCardIndex = Math.max(
    html.lastIndexOf('class="product-card', match.index),
    html.lastIndexOf("class='product-card", match.index),
    html.lastIndexOf('class="card', match.index),
    html.lastIndexOf("class='card", match.index),
  );
  const start = lastCardIndex !== -1 ? lastCardIndex : Math.max(0, match.index - 500);
  const nextCardMatch = html.slice(match.index + 1).search(/(?:class=["'][^"']*(?:product-card|card)[^"']*["']|<div class=["']product-sku)/i);
  const end = nextCardMatch !== -1 ? match.index + 1 + nextCardMatch : Math.min(html.length, match.index + 2500);

  const price = priceFromCard(html.slice(start, end));
  if (price <= 0) return { status: 'unavailable', currentCost: 0 };

  const normCatalog = Math.round(catalogCost * 100) / 100;
  if (normCatalog > 0 && Math.abs(normCatalog - price) >= 0.01) {
    return { status: 'divergent', currentCost: price };
  }
  return { status: 'confirmed', currentCost: price };
};
