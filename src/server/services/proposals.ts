import { randomUUID } from 'node:crypto';
import type { CatalogProduct, ProposalDetail, ProposalLine } from '../../shared/contracts';
import type { LocalDatabase } from './database';

type ProposalRow = {
  id: string;
  proposal_number: string;
  revision: number;
  client_name: string;
  work_name: string;
  scope: string;
  status: ProposalDetail['status'];
  bdi_multiplier: string;
  valid_until: string | null;
  responsible_name: string;
  updated_at: string;
};

type ItemRow = {
  id: string;
  snapshot_code: string;
  snapshot_description: string;
  quantity: string;
  snapshot_unit: string;
  snapshot_unit_cost: string;
  sale_unit_price: string;
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const getCurrentProposal = async (database: LocalDatabase): Promise<ProposalDetail | null> => {
  const proposalResult = await database.query<ProposalRow>(`
    SELECT p.id, p.proposal_number, p.revision,
      COALESCE(c.trade_name, c.legal_name) AS client_name,
      p.work_name, p.scope, p.status, p.bdi_multiplier::text,
      p.valid_until::text, u.name AS responsible_name, p.updated_at::text
    FROM proposals p
    JOIN clients c ON c.id = p.client_id
    JOIN users u ON u.id = p.created_by
    ORDER BY p.updated_at DESC
    LIMIT 1
  `);
  const proposal = proposalResult.rows[0];
  if (!proposal) return null;

  const itemResult = await database.query<ItemRow>(`
    SELECT id, snapshot_code, snapshot_description, quantity::text,
      snapshot_unit, snapshot_unit_cost::text, sale_unit_price::text
    FROM proposal_items
    WHERE proposal_id = $1
    ORDER BY position
  `, [proposal.id]);

  const items: ProposalLine[] = itemResult.rows.map((item) => {
    const quantity = Number(item.quantity);
    const unitCost = Number(item.snapshot_unit_cost);
    const unitSale = Number(item.sale_unit_price);
    return {
      id: item.id,
      code: item.snapshot_code,
      description: item.snapshot_description,
      quantity,
      unit: item.snapshot_unit,
      unitCost,
      totalCost: roundMoney(quantity * unitCost),
      unitSale,
      totalSale: roundMoney(quantity * unitSale),
    };
  });

  const cost = roundMoney(items.reduce((total, item) => total + item.totalCost, 0));
  const sale = roundMoney(items.reduce((total, item) => total + item.totalSale, 0));
  const grossResult = roundMoney(sale - cost);

  return {
    id: proposal.id,
    number: proposal.proposal_number,
    revision: proposal.revision,
    clientName: proposal.client_name,
    workName: proposal.work_name,
    scope: proposal.scope,
    status: proposal.status,
    bdiMultiplier: Number(proposal.bdi_multiplier),
    validUntil: proposal.valid_until,
    responsibleName: proposal.responsible_name,
    updatedAt: proposal.updated_at,
    items,
    totals: {
      cost,
      sale,
      grossResult,
      marginPercent: sale > 0 ? roundMoney((grossResult / sale) * 100) : 0,
    },
  };
};

export const searchCatalog = async (database: LocalDatabase, query: string, limit: number): Promise<CatalogProduct[]> => {
  const pattern = `%${query.trim()}%`;
  const result = await database.query<{
    id: string; code: string; manufacturer: string | null; model: string | null;
    description: string; category: string; unit: string; current_cost: string; source: string;
  }>(`
    SELECT id, code, manufacturer, model, description, category, unit, current_cost::text, source
    FROM products
    WHERE $1 = '%%' OR code ILIKE $1 OR description ILIKE $1 OR manufacturer ILIKE $1 OR model ILIKE $1
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
  }));
};

export const addProductToProposal = async (database: LocalDatabase, proposalId: string, productId: string, quantity: number) => {
  await database.transaction(async (transaction) => {
    const proposalResult = await transaction.query<{ bdi_multiplier: string; status: string }>(
      'SELECT bdi_multiplier::text, status FROM proposals WHERE id = $1 FOR UPDATE',
      [proposalId],
    );
    const proposal = proposalResult.rows[0];
    if (!proposal) throw new Error('PROPOSAL_NOT_FOUND');
    if (proposal.status !== 'draft' && proposal.status !== 'review') throw new Error('PROPOSAL_LOCKED');

    const productResult = await transaction.query<{
      id: string; code: string; manufacturer: string | null; model: string | null;
      description: string; unit: string; current_cost: string;
    }>('SELECT id, code, manufacturer, model, description, unit, current_cost::text FROM products WHERE id = $1', [productId]);
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
         snapshot_model, snapshot_description, snapshot_unit, snapshot_unit_cost, quantity, sale_unit_price)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [itemId, proposalId, product.id, positionResult.rows[0]?.next_position ?? 1, product.code,
      product.manufacturer, product.model, product.description, product.unit, unitCost, quantity, salePrice]);

    await transaction.query('UPDATE proposals SET updated_at = now() WHERE id = $1', [proposalId]);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, after_data)
      VALUES ($1, 'proposal_item', $2, 'created', $3::jsonb)
    `, [randomUUID(), itemId, JSON.stringify({ productId, snapshotUnitCost: unitCost, quantity, salePrice })]);
  });
};

export const removeProposalItems = async (database: LocalDatabase, proposalId: string, itemIds: string[]) => {
  await database.transaction(async (transaction) => {
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
  });
};

export const updateProposalItemQuantity = async (
  database: LocalDatabase,
  proposalId: string,
  itemId: string,
  quantity: number,
) => {
  await database.transaction(async (transaction) => {
    const proposalResult = await transaction.query<{ status: string }>(
      'SELECT status FROM proposals WHERE id = $1 FOR UPDATE',
      [proposalId],
    );
    const proposal = proposalResult.rows[0];
    if (!proposal) throw new Error('PROPOSAL_NOT_FOUND');
    if (proposal.status !== 'draft' && proposal.status !== 'review') throw new Error('PROPOSAL_LOCKED');

    const itemResult = await transaction.query<{ quantity: string }>(
      'SELECT quantity::text FROM proposal_items WHERE proposal_id = $1 AND id = $2 FOR UPDATE',
      [proposalId, itemId],
    );
    const item = itemResult.rows[0];
    if (!item) throw new Error('ITEM_NOT_FOUND');

    await transaction.query(
      'UPDATE proposal_items SET quantity = $3 WHERE proposal_id = $1 AND id = $2',
      [proposalId, itemId, quantity],
    );

    await transaction.query('UPDATE proposals SET updated_at = now() WHERE id = $1', [proposalId]);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data)
      VALUES ($1, 'proposal_item', $2, 'quantity_updated', $3::jsonb, $4::jsonb)
    `, [randomUUID(), itemId, JSON.stringify({ quantity: Number(item.quantity) }), JSON.stringify({ quantity })]);
  });
};

export const updateProposalBdi = async (
  database: LocalDatabase,
  proposalId: string,
  bdiMultiplier: number,
) => {
  await database.transaction(async (transaction) => {
    const proposalResult = await transaction.query<{ status: string; bdi_multiplier: string }>(
      'SELECT status, bdi_multiplier::text FROM proposals WHERE id = $1 FOR UPDATE',
      [proposalId],
    );
    const proposal = proposalResult.rows[0];
    if (!proposal) throw new Error('PROPOSAL_NOT_FOUND');
    if (proposal.status !== 'draft' && proposal.status !== 'review') throw new Error('PROPOSAL_LOCKED');

    await transaction.query(
      'UPDATE proposals SET bdi_multiplier = $2, updated_at = now() WHERE id = $1',
      [proposalId, bdiMultiplier],
    );
    await transaction.query(
      `UPDATE proposal_items
       SET sale_unit_price = round(snapshot_unit_cost * $2, 2)
       WHERE proposal_id = $1`,
      [proposalId, bdiMultiplier],
    );
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data)
      VALUES ($1, 'proposal', $2, 'bdi_updated', $3::jsonb, $4::jsonb)
    `, [randomUUID(), proposalId, JSON.stringify({ bdiMultiplier: Number(proposal.bdi_multiplier) }), JSON.stringify({ bdiMultiplier })]);
  });
};
