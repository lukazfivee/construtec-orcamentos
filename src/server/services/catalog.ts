import { randomUUID } from 'node:crypto';
import type { CatalogProduct } from '../../shared/contracts';
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
