import { randomUUID } from 'node:crypto';
import type { CatalogProduct, ProposalLine } from '../../shared/contracts';
import type { LocalDatabase } from './database';
import { logEvent } from './logger';
import { getEditableProposal, roundMoney } from './proposalCommon';

export type ItemRow = {
  id: string;
  snapshot_code: string;
  snapshot_description: string;
  snapshot_category: string;
  quantity: string;
  snapshot_unit: string;
  snapshot_unit_cost: string;
  sale_unit_price: string;
};

export type ProposalItemUpdateInput = Partial<
  Pick<ProposalLine, 'description' | 'category' | 'quantity' | 'unit' | 'unitCost' | 'unitSale'>
>;

export const searchCatalog = async (
  database: LocalDatabase,
  query: string,
  limit: number,
): Promise<CatalogProduct[]> => {
  const pattern = `%${query.trim()}%`;
  const result = await database.query<{
    id: string;
    code: string;
    manufacturer: string | null;
    model: string | null;
    description: string;
    category: string;
    unit: string;
    current_cost: string;
    source: string;
    active: boolean;
    updated_at: string;
  }>(`
    SELECT id, code, manufacturer, model, description, category, unit, current_cost::text, source, active, updated_at::text
    FROM products
    WHERE active = true AND ($1 = '%%' OR code ILIKE $1 OR description ILIKE $1 OR manufacturer ILIKE $1 OR model ILIKE $1)
    ORDER BY CASE WHEN code ILIKE $1 THEN 0 ELSE 1 END, description
    LIMIT $2
  `, [pattern, limit]);

  return result.rows.map((product) => ({
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
  }));
};

export const addProductToProposal = async (
  database: LocalDatabase,
  proposalId: string,
  productId: string,
  quantity: number,
) => {
  await database.transaction(async (transaction) => {
    const proposal = await getEditableProposal(transaction, proposalId);

    const productResult = await transaction.query<{
      id: string;
      code: string;
      manufacturer: string | null;
      model: string | null;
      description: string;
      category: string;
      unit: string;
      current_cost: string;
    }>('SELECT id, code, manufacturer, model, description, category, unit, current_cost::text FROM products WHERE id = $1', [productId]);
    const product = productResult.rows[0];
    if (!product) throw new Error('PRODUCT_NOT_FOUND');

    const positionResult = await transaction.query<{ next_position: number }>(
      'SELECT COALESCE(max(position), 0) + 1 AS next_position FROM proposal_items WHERE proposal_id = $1',
      [proposalId],
    );
    const unitCost = Number(product.current_cost);
    const salePrice = roundMoney(unitCost * Number(proposal.bdi_multiplier));
    const itemId = randomUUID();

    await transaction.query(`
      INSERT INTO proposal_items
        (id, proposal_id, catalog_product_id, position, snapshot_code, snapshot_manufacturer,
         snapshot_model, snapshot_description, snapshot_category, snapshot_unit, snapshot_unit_cost, quantity, sale_unit_price)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      itemId,
      proposalId,
      product.id,
      positionResult.rows[0]?.next_position ?? 1,
      product.code,
      product.manufacturer,
      product.model,
      product.description,
      product.category,
      product.unit,
      unitCost,
      quantity,
      salePrice,
    ]);

    await transaction.query('UPDATE proposals SET updated_at = now() WHERE id = $1', [proposalId]);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, after_data)
      VALUES ($1, 'proposal_item', $2, 'created', $3::jsonb)
    `, [randomUUID(), itemId, JSON.stringify({ productId, snapshotUnitCost: unitCost, quantity, salePrice })]);
    logEvent('info', 'proposal.item_added', { proposalId, itemId, quantity });
  });
};

export const removeProposalItems = async (database: LocalDatabase, proposalId: string, itemIds: string[]) => {
  await database.transaction(async (transaction) => {
    await getEditableProposal(transaction, proposalId);
    const result = await transaction.query<{ id: string }>(
      'DELETE FROM proposal_items WHERE proposal_id = $1 AND id = ANY($2::uuid[]) RETURNING id',
      [proposalId, itemIds],
    );
    if (result.rows.length !== itemIds.length) throw new Error('ITEM_NOT_FOUND');
    await transaction.query('UPDATE proposals SET updated_at = now() WHERE id = $1', [proposalId]);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, before_data)
      VALUES ($1, 'proposal', $2, 'items_removed', $3::jsonb)
    `, [randomUUID(), proposalId, JSON.stringify({ itemIds })]);
    logEvent('info', 'proposal.items_removed', { proposalId, count: itemIds.length });
  });
};

export const updateProposalItem = async (
  database: LocalDatabase,
  proposalId: string,
  itemId: string,
  input: ProposalItemUpdateInput,
) => {
  await database.transaction(async (transaction) => {
    await getEditableProposal(transaction, proposalId);

    const itemResult = await transaction.query<ItemRow>(`
      SELECT id, snapshot_code, snapshot_description, snapshot_category, quantity::text,
        snapshot_unit, snapshot_unit_cost::text, sale_unit_price::text
      FROM proposal_items
      WHERE proposal_id = $1 AND id = $2
      FOR UPDATE
    `, [proposalId, itemId]);
    const item = itemResult.rows[0];
    if (!item) throw new Error('ITEM_NOT_FOUND');

    const next = {
      description: input.description?.trim() ?? item.snapshot_description,
      category: input.category?.trim() ?? item.snapshot_category ?? 'Outros',
      quantity: input.quantity ?? Number(item.quantity),
      unit: input.unit?.trim() ?? item.snapshot_unit,
      unitCost: input.unitCost ?? Number(item.snapshot_unit_cost),
      unitSale: input.unitSale ?? Number(item.sale_unit_price),
    };

    await transaction.query(`
      UPDATE proposal_items
      SET snapshot_description = $3, snapshot_category = $4, quantity = $5, snapshot_unit = $6,
        snapshot_unit_cost = $7, sale_unit_price = $8
      WHERE proposal_id = $1 AND id = $2
    `, [proposalId, itemId, next.description, next.category, next.quantity, next.unit, next.unitCost, next.unitSale]);

    await transaction.query('UPDATE proposals SET updated_at = now() WHERE id = $1', [proposalId]);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data)
      VALUES ($1, 'proposal_item', $2, 'updated', $3::jsonb, $4::jsonb)
    `, [randomUUID(), itemId, JSON.stringify({
      description: item.snapshot_description,
      category: item.snapshot_category ?? 'Outros',
      quantity: Number(item.quantity),
      unit: item.snapshot_unit,
      unitCost: Number(item.snapshot_unit_cost),
      unitSale: Number(item.sale_unit_price),
    }), JSON.stringify(next)]);
    logEvent('info', 'proposal.item_updated', { proposalId, itemId });
  });
};

export const updateProposalItemQuantity = async (
  database: LocalDatabase,
  proposalId: string,
  itemId: string,
  quantity: number,
) => updateProposalItem(database, proposalId, itemId, { quantity });

export const duplicateProposalItem = async (database: LocalDatabase, proposalId: string, itemId: string) => {
  await database.transaction(async (transaction) => {
    await getEditableProposal(transaction, proposalId);
    const itemResult = await transaction.query<{
      catalog_product_id: string | null;
      snapshot_code: string;
      snapshot_manufacturer: string | null;
      snapshot_model: string | null;
      snapshot_description: string;
      snapshot_category: string;
      snapshot_unit: string;
      snapshot_unit_cost: string;
      quantity: string;
      sale_unit_price: string;
    }>(`
      SELECT catalog_product_id, snapshot_code, snapshot_manufacturer, snapshot_model,
        snapshot_description, snapshot_category, snapshot_unit, snapshot_unit_cost::text, quantity::text, sale_unit_price::text
      FROM proposal_items
      WHERE proposal_id = $1 AND id = $2
      FOR UPDATE
    `, [proposalId, itemId]);
    const item = itemResult.rows[0];
    if (!item) throw new Error('ITEM_NOT_FOUND');

    const positionResult = await transaction.query<{ next_position: number }>(
      'SELECT COALESCE(max(position), 0) + 1 AS next_position FROM proposal_items WHERE proposal_id = $1',
      [proposalId],
    );
    const newItemId = randomUUID();
    await transaction.query(`
      INSERT INTO proposal_items
        (id, proposal_id, catalog_product_id, position, snapshot_code, snapshot_manufacturer,
         snapshot_model, snapshot_description, snapshot_category, snapshot_unit, snapshot_unit_cost, quantity, sale_unit_price)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      newItemId,
      proposalId,
      item.catalog_product_id,
      positionResult.rows[0]?.next_position ?? 1,
      item.snapshot_code,
      item.snapshot_manufacturer,
      item.snapshot_model,
      item.snapshot_description,
      item.snapshot_category ?? 'Outros',
      item.snapshot_unit,
      Number(item.snapshot_unit_cost),
      Number(item.quantity),
      Number(item.sale_unit_price),
    ]);

    await transaction.query('UPDATE proposals SET updated_at = now() WHERE id = $1', [proposalId]);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data)
      VALUES ($1, 'proposal_item', $2, 'duplicated', $3::jsonb, $4::jsonb)
    `, [randomUUID(), newItemId, JSON.stringify({ sourceItemId: itemId }), JSON.stringify({ position: positionResult.rows[0]?.next_position ?? 1 })]);
    logEvent('info', 'proposal.item_duplicated', { proposalId, sourceItemId: itemId, newItemId });
  });
};

export const moveProposalItem = async (
  database: LocalDatabase,
  proposalId: string,
  itemId: string,
  direction: 'up' | 'down',
) => {
  await database.transaction(async (transaction) => {
    await getEditableProposal(transaction, proposalId);
    const itemResult = await transaction.query<{ id: string; position: number }>(
      'SELECT id, position FROM proposal_items WHERE proposal_id = $1 AND id = $2 FOR UPDATE',
      [proposalId, itemId],
    );
    const item = itemResult.rows[0];
    if (!item) throw new Error('ITEM_NOT_FOUND');

    const siblingResult = await transaction.query<{ id: string; position: number }>(`
      SELECT id, position
      FROM proposal_items
      WHERE proposal_id = $1 AND position ${direction === 'up' ? '<' : '>'} $2
      ORDER BY position ${direction === 'up' ? 'DESC' : 'ASC'}
      LIMIT 1
      FOR UPDATE
    `, [proposalId, item.position]);
    const sibling = siblingResult.rows[0];
    if (!sibling) return;

    await transaction.query('UPDATE proposal_items SET position = -1 WHERE proposal_id = $1 AND id = $2', [proposalId, item.id]);
    await transaction.query('UPDATE proposal_items SET position = $3 WHERE proposal_id = $1 AND id = $2', [proposalId, sibling.id, item.position]);
    await transaction.query('UPDATE proposal_items SET position = $3 WHERE proposal_id = $1 AND id = $2', [proposalId, item.id, sibling.position]);
    await transaction.query('UPDATE proposals SET updated_at = now() WHERE id = $1', [proposalId]);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data)
      VALUES ($1, 'proposal_item', $2, 'moved', $3::jsonb, $4::jsonb)
    `, [randomUUID(), itemId, JSON.stringify({ position: item.position }), JSON.stringify({ position: sibling.position })]);
    logEvent('info', 'proposal.item_moved', { proposalId, itemId, direction });
  });
};
