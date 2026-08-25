import { randomUUID } from 'node:crypto';
import type { CatalogImportItem, CatalogProduct } from '../../shared/contracts';
import type { LocalDatabase } from './database';

type ProductRow = {
  id: string; code: string; manufacturer: string | null; model: string | null; description: string;
  category: string; unit: string; current_cost: string; source: string; active: boolean; updated_at: string;
};

const mapProduct = (product: ProductRow): CatalogProduct => ({
  id: product.id,
  code: product.code,
  manufacturer: product.manufacturer,
  model: product.model,
  description: product.description,
  category: product.category,
  unit: product.unit,
  currentCost: Number(product.current_cost),
  source: product.source,
  active: product.active,
  updatedAt: product.updated_at,
});

export const listCatalogProducts = async (database: LocalDatabase, query = ''): Promise<CatalogProduct[]> => {
  const pattern = `%${query.trim()}%`;
  const result = await database.query<ProductRow>(`
    SELECT id, code, manufacturer, model, description, category, unit,
      current_cost::text, source, active, updated_at::text
    FROM products
    WHERE $1 = '%%' OR code ILIKE $1 OR description ILIKE $1 OR manufacturer ILIKE $1
      OR model ILIKE $1 OR category ILIKE $1
    ORDER BY active DESC, category, code
    LIMIT 300
  `, [pattern]);
  return result.rows.map(mapProduct);
};

type ProductInput = {
  code: string; manufacturer?: string | null; model?: string | null; description: string;
  category: string; unit: string; currentCost: number; source?: string; active?: boolean;
};

export const createCatalogProduct = async (database: LocalDatabase, input: ProductInput) => {
  const productId = randomUUID();
  await database.transaction(async (transaction) => {
    const duplicate = await transaction.query<{ id: string }>('SELECT id FROM products WHERE lower(code) = lower($1)', [input.code.trim()]);
    if (duplicate.rows[0]) throw new Error('PRODUCT_DUPLICATE');
    await transaction.query(`
      INSERT INTO products
        (id, code, manufacturer, model, description, category, unit, current_cost, source, active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
    `, [productId, input.code.trim().toUpperCase(), input.manufacturer?.trim() || null,
      input.model?.trim() || null, input.description.trim(), input.category.trim(), input.unit.trim().toLowerCase(),
      input.currentCost, input.source?.trim() || 'CONSTRUTEC']);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, after_data)
      VALUES ($1, 'product', $2, 'created', $3::jsonb)
    `, [randomUUID(), productId, JSON.stringify(input)]);
  });
  return productId;
};

export const updateCatalogProduct = async (database: LocalDatabase, productId: string, input: ProductInput) => {
  await database.transaction(async (transaction) => {
    const before = await transaction.query<ProductRow>(`
      SELECT id, code, manufacturer, model, description, category, unit,
        current_cost::text, source, active, updated_at::text
      FROM products WHERE id = $1 FOR UPDATE
    `, [productId]);
    if (!before.rows[0]) throw new Error('PRODUCT_NOT_FOUND');
    const duplicate = await transaction.query<{ id: string }>(
      'SELECT id FROM products WHERE lower(code) = lower($1) AND id <> $2',
      [input.code.trim(), productId],
    );
    if (duplicate.rows[0]) throw new Error('PRODUCT_DUPLICATE');
    await transaction.query(`
      UPDATE products
      SET code = $2, manufacturer = $3, model = $4, description = $5, category = $6,
          unit = $7, current_cost = $8, source = $9, active = $10,
          revision = revision + 1, updated_at = now()
      WHERE id = $1
    `, [productId, input.code.trim().toUpperCase(), input.manufacturer?.trim() || null,
      input.model?.trim() || null, input.description.trim(), input.category.trim(), input.unit.trim().toLowerCase(),
      input.currentCost, input.source?.trim() || 'CONSTRUTEC', input.active ?? true]);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data)
      VALUES ($1, 'product', $2, 'updated', $3::jsonb, $4::jsonb)
    `, [randomUUID(), productId, JSON.stringify(before.rows[0]), JSON.stringify(input)]);
  });
};

export const importCatalogProducts = async (database: LocalDatabase, items: CatalogImportItem[]) => {
  return database.transaction(async (transaction) => {
    let created = 0;
    let updated = 0;
    for (const input of items) {
      const code = input.code.trim().toUpperCase();
      const existing = await transaction.query<{ id: string }>(
        'SELECT id FROM products WHERE lower(code) = lower($1) FOR UPDATE',
        [code],
      );
      if (existing.rows[0]) {
        await transaction.query(`
          UPDATE products
          SET manufacturer = $2, model = $3, description = $4, category = $5, unit = $6,
              current_cost = $7, source = $8, active = $9, revision = revision + 1, updated_at = now()
          WHERE id = $1
        `, [existing.rows[0].id, input.manufacturer?.trim() || null, input.model?.trim() || null,
          input.description.trim(), input.category.trim(), input.unit.trim().toLowerCase(), input.currentCost,
          input.source.trim() || 'IMPORTAÇÃO', input.active]);
        updated += 1;
      } else {
        await transaction.query(`
          INSERT INTO products
            (id, code, manufacturer, model, description, category, unit, current_cost, source, active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [randomUUID(), code, input.manufacturer?.trim() || null, input.model?.trim() || null,
          input.description.trim(), input.category.trim(), input.unit.trim().toLowerCase(), input.currentCost,
          input.source.trim() || 'IMPORTAÇÃO', input.active]);
        created += 1;
      }
    }
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, after_data)
      VALUES ($1, 'catalog', $2, 'batch_imported', $3::jsonb)
    `, [randomUUID(), randomUUID(), JSON.stringify({ created, updated, codes: items.map((item) => item.code) })]);
    return { created, updated };
  });
};

const decodeHtml = (value: string) => value
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, ' ').trim();

const parsePrice = (value?: string) => {
  if (!value) return 0;
  const normalized = value.replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  const price = Number(normalized);
  return Number.isFinite(price) ? price : 0;
};

export const parseExsatProductsHtml = (html: string): CatalogImportItem[] => {
  if (html.length > 8_000_000) throw new Error('EXSAT_UNAVAILABLE');
  const category = decodeHtml(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '') || 'Exsat';
  const items = new Map<string, CatalogImportItem>();
  for (const match of html.matchAll(/C[oó]digo\s*:\s*(?:<[^>]+>\s*)*([A-Za-z0-9_-]{3,60})/gi)) {
    const code = match[1].toUpperCase();
    const start = match.index ?? 0;
    const after = html.slice(start + match[0].length, start + match[0].length + 1800);
    const before = html.slice(Math.max(0, start - 900), start);
    const headingAfter = after.match(/<h[2-5]\b[^>]*>([\s\S]*?)<\/h[2-5]>/i)?.[1];
    const headingBefore = [...before.matchAll(/<h[2-5]\b[^>]*>([\s\S]*?)<\/h[2-5]>/gi)].at(-1)?.[1];
    const productLink = after.match(/<a\b[^>]*(?:product|produto)[^>]*>([\s\S]*?)<\/a>/i)?.[1];
    const description = decodeHtml(headingAfter ?? productLink ?? headingBefore ?? '');
    if (!description || /carrinho|categoria|produto não encontrado/i.test(description)) continue;
    const priceText = after.match(/R\$\s*[\d.]+,\d{2}/i)?.[0];
    items.set(code, {
      code,
      manufacturer: /intelbras/i.test(description) ? 'Intelbras' : null,
      model: null,
      description,
      category,
      unit: 'un',
      currentCost: parsePrice(priceText),
      source: 'EXSAT',
      active: true,
    });
  }
  if (items.size === 0) throw new Error('EXSAT_NO_PRODUCTS');
  return [...items.values()].slice(0, 500);
};

export const validateExsatUrl = (rawUrl: string) => {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' || !['exsat.com.br', 'www.exsat.com.br'].includes(url.hostname.toLowerCase())) {
    throw new Error('EXSAT_URL_INVALID');
  }
  return url;
};

export const previewExsatProducts = async (rawUrl: string): Promise<CatalogImportItem[]> => {
  const url = validateExsatUrl(rawUrl);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20_000),
    headers: { 'User-Agent': 'Construtec-Orcamentos/1.0 (+catalog-import)' },
  });
  if (!response.ok) throw new Error('EXSAT_UNAVAILABLE');
  const html = await response.text();
  return parseExsatProductsHtml(html);
};
