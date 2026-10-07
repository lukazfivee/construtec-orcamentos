// Varredura no servidor: le os cartoes de produto de uma pagina de departamento da Exsat.
// O PRECO vem so do que o cartao mostra (price-current). O JSON de analytics da pagina (dataLayer) tambem traz um
// "price", mas aparece mesmo sem login; por isso ele serve so para fabricante e categoria, nunca para o preco.
import type { CatalogImportItem } from '../../shared/contracts';
import { decodeHtml } from './catalog';
import { priceFromCard } from './exsatPages';

export type ExsatCard = { item: CatalogImportItem; hasPrice: boolean };

const CARD_START = /<div[^>]+class=["'][^"']*\bproduct-card\b/gi;
const MAX_CARD_CHARS = 6000;

const dataLayerMeta = (html: string) => {
  const meta = new Map<string, { brand: string; category: string }>();
  for (const match of html.matchAll(/\{\s*["']id["']\s*:\s*["']([A-Za-z0-9_-]{3,60})["']\s*,\s*["']name["']\s*:\s*["'][^"']*["']\s*,\s*["']brand["']\s*:\s*["']([^"']*)["']\s*,\s*["']category["']\s*:\s*["']([^"']*)["']/gi)) {
    meta.set(match[1].toUpperCase(), { brand: decodeHtml(match[2]), category: decodeHtml(match[3]) });
  }
  return meta;
};

export const parseExsatCards = (html: string): ExsatCard[] => {
  if (html.length > 8_000_000) throw new Error('EXSAT_UNAVAILABLE');
  const pageCategory = decodeHtml(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '') || 'Exsat';
  const meta = dataLayerMeta(html);
  const starts = [...html.matchAll(CARD_START)].map((match) => match.index ?? 0);
  const cards = new Map<string, ExsatCard>();
  starts.forEach((start, index) => {
    const card = html.slice(start, Math.min(starts[index + 1] ?? html.length, start + MAX_CARD_CHARS));
    const code = card.match(/class=["']product-sku["'][^>]*>\s*([A-Za-z0-9][A-Za-z0-9._/-]{1,59})\s*</i)?.[1]?.toUpperCase();
    const title = decodeHtml(card.match(/class=["'][^"']*product-title[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? '');
    if (!code || title.length < 3) return;
    const currentCost = priceFromCard(card);
    const extra = meta.get(code);
    const item: CatalogImportItem = {
      code,
      manufacturer: extra?.brand || (/intelbras/i.test(title) ? 'Intelbras' : null),
      model: null,
      description: title,
      category: extra?.category || pageCategory,
      unit: 'un',
      currentCost,
      source: 'EXSAT',
      active: true,
    };
    const previous = cards.get(code);
    if (!previous || (!previous.hasPrice && currentCost > 0)) cards.set(code, { item, hasPrice: currentCost > 0 });
  });
  return [...cards.values()];
};
