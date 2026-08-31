import { randomUUID } from 'node:crypto';
import type { KitDetail, KitInput, KitItemSummary, KitSummary, ProposalDetail } from '../../shared/contracts';
import type { LocalDatabase } from './database';
import { getProposalById } from './proposals';

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

type KitRow = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  active: boolean;
  item_count: string;
  total_estimated_cost: string;
  updated_at: string;
};

export const listKits = async (database: LocalDatabase, query = ''): Promise<KitSummary[]> => {
  const pattern = `%${query.trim()}%`;
  const result = await database.query<KitRow>(`
    SELECT
      k.id,
      k.name,
      k.description,
      k.category,
      k.active,
      count(ki.id)::text AS item_count,
      COALESCE(SUM(ki.quantity * p.current_cost), 0)::text AS total_estimated_cost,
      k.updated_at::text
    FROM kits k
    LEFT JOIN kit_items ki ON ki.kit_id = k.id
    LEFT JOIN products p ON p.id = ki.catalog_product_id
    WHERE $1 = '%%' OR k.name ILIKE $1 OR k.category ILIKE $1 OR k.description ILIKE $1
    GROUP BY k.id, k.name, k.description, k.category, k.active, k.updated_at
    ORDER BY k.active DESC, k.category, k.name
    LIMIT 200
  `, [pattern]);

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    active: row.active,
    itemCount: Number(row.item_count),
    totalEstimatedCost: roundMoney(Number(row.total_estimated_cost)),
    updatedAt: row.updated_at,
  }));
};

export const getKitById = async (database: LocalDatabase, id: string): Promise<KitDetail> => {
  const kitResult = await database.query<{
    id: string;
    name: string;
    description: string | null;
    category: string;
    active: boolean;
    updated_at: string;
  }>('SELECT id, name, description, category, active, updated_at::text FROM kits WHERE id = $1', [id]);

  const kit = kitResult.rows[0];
  if (!kit) throw new Error('KIT_NOT_FOUND');

  const itemsResult = await database.query<{
    id: string;
    product_id: string;
    code: string;
    description: string;
    category: string;
    unit: string;
    current_cost: string;
    quantity: string;
    position: number;
  }>(`
    SELECT
      ki.id,
      ki.catalog_product_id as product_id,
      COALESCE(p.code, ki.snapshot_code) as code,
      COALESCE(p.description, ki.snapshot_description) as description,
      COALESCE(p.category, 'Geral') as category,
      COALESCE(p.unit, ki.snapshot_unit) as unit,
      COALESCE(p.current_cost::text, '0') as current_cost,
      ki.quantity::text,
      ki.position
    FROM kit_items ki
    LEFT JOIN products p ON p.id = ki.catalog_product_id
    WHERE ki.kit_id = $1
    ORDER BY ki.position ASC
  `, [id]);

  let totalCost = 0;
  const items: KitItemSummary[] = itemsResult.rows.map((row) => {
    const unitCost = Number(row.current_cost);
    const quantity = Number(row.quantity);
    const itemTotal = roundMoney(unitCost * quantity);
    totalCost += itemTotal;
    return {
      id: row.id,
      productId: row.product_id,
      code: row.code,
      description: row.description,
      category: row.category,
      unit: row.unit,
      currentCost: unitCost,
      quantity,
      totalCost: itemTotal,
      position: row.position,
    };
  });

  return {
    id: kit.id,
    name: kit.name,
    description: kit.description,
    category: kit.category,
    active: kit.active,
    itemCount: items.length,
    totalEstimatedCost: roundMoney(totalCost),
    updatedAt: kit.updated_at,
    items,
  };
};

export const createKit = async (database: LocalDatabase, input: KitInput): Promise<KitDetail> => {
  const kitId = randomUUID();
  await database.transaction(async (transaction) => {
    const existing = await transaction.query<{ id: string }>(
      'SELECT id FROM kits WHERE lower(name) = lower($1)',
      [input.name.trim()],
    );
    if (existing.rows[0]) throw new Error('KIT_NAME_DUPLICATE');

    await transaction.query(`
      INSERT INTO kits (id, name, description, category, active)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      kitId,
      input.name.trim(),
      input.description?.trim() || null,
      input.category?.trim() || 'Geral',
      input.active !== false,
    ]);

    for (const [index, item] of input.items.entries()) {
      if (item.quantity <= 0) continue;
      const prodRes = await transaction.query<{
        code: string; description: string; unit: string;
      }>('SELECT code, description, unit FROM products WHERE id = $1', [item.productId]);
      const prod = prodRes.rows[0];
      if (!prod) throw new Error('PRODUCT_NOT_FOUND');
      await transaction.query(`
        INSERT INTO kit_items (id, kit_id, catalog_product_id, position, snapshot_code, snapshot_description, snapshot_unit, quantity)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        randomUUID(),
        kitId,
        item.productId,
        index + 1,
        prod.code,
        prod.description,
        prod.unit,
        item.quantity,
      ]);
    }
  });

  return getKitById(database, kitId);
};

export const updateKit = async (database: LocalDatabase, id: string, input: KitInput): Promise<KitDetail> => {
  await database.transaction(async (transaction) => {
    const kit = await transaction.query<{ id: string }>('SELECT id FROM kits WHERE id = $1', [id]);
    if (!kit.rows[0]) throw new Error('KIT_NOT_FOUND');

    const duplicate = await transaction.query<{ id: string }>(
      'SELECT id FROM kits WHERE lower(name) = lower($1) AND id <> $2',
      [input.name.trim(), id],
    );
    if (duplicate.rows[0]) throw new Error('KIT_NAME_DUPLICATE');

    await transaction.query(`
      UPDATE kits
      SET name = $2, description = $3, category = $4, active = $5, updated_at = now()
      WHERE id = $1
    `, [
      id,
      input.name.trim(),
      input.description?.trim() || null,
      input.category?.trim() || 'Geral',
      input.active !== false,
    ]);

    await transaction.query('DELETE FROM kit_items WHERE kit_id = $1', [id]);

    for (const [index, item] of input.items.entries()) {
      if (item.quantity <= 0) continue;
      const prodRes = await transaction.query<{
        code: string; description: string; unit: string;
      }>('SELECT code, description, unit FROM products WHERE id = $1', [item.productId]);
      const prod = prodRes.rows[0];
      if (!prod) throw new Error('PRODUCT_NOT_FOUND');
      await transaction.query(`
        INSERT INTO kit_items (id, kit_id, catalog_product_id, position, snapshot_code, snapshot_description, snapshot_unit, quantity)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        randomUUID(),
        id,
        item.productId,
        index + 1,
        prod.code,
        prod.description,
        prod.unit,
        item.quantity,
      ]);
    }
  });

  return getKitById(database, id);
};

export const deleteKit = async (database: LocalDatabase, id: string): Promise<void> => {
  const result = await database.query('DELETE FROM kits WHERE id = $1', [id]);
  if ((result.affectedRows ?? 0) === 0) {
    const check = await database.query<{ id: string }>('SELECT id FROM kits WHERE id = $1', [id]);
    if (!check.rows[0]) throw new Error('KIT_NOT_FOUND');
  }
};

export const applyKitToProposal = async (
  database: LocalDatabase,
  kitId: string,
  proposalId: string,
): Promise<ProposalDetail> => {
  const kit = await getKitById(database, kitId);
  if (kit.items.length === 0) throw new Error('KIT_EMPTY');

  await database.transaction(async (transaction) => {
    const proposalRes = await transaction.query<{
      id: string;
      bdi_multiplier: string;
      status: string;
    }>('SELECT id, bdi_multiplier, status FROM proposals WHERE id = $1', [proposalId]);

    const proposal = proposalRes.rows[0];
    if (!proposal) throw new Error('PROPOSAL_NOT_FOUND');
    if (proposal.status !== 'draft') throw new Error('PROPOSAL_LOCKED');

    const bdiMultiplier = Number(proposal.bdi_multiplier);

    const maxPosRes = await transaction.query<{ max_pos: string | null }>(
      'SELECT max(position)::text AS max_pos FROM proposal_items WHERE proposal_id = $1',
      [proposalId],
    );
    let nextPosition = Number(maxPosRes.rows[0]?.max_pos ?? 0);

    for (const item of kit.items) {
      nextPosition += 1;
      const unitCost = item.currentCost;
      const saleUnitPrice = roundMoney(unitCost * bdiMultiplier);

      const productRes = await transaction.query<{
        code: string;
        manufacturer: string | null;
        model: string | null;
        description: string;
        category: string;
        unit: string;
      }>('SELECT code, manufacturer, model, description, category, unit FROM products WHERE id = $1', [item.productId]);

      const prod = productRes.rows[0];
      if (!prod) continue;

      await transaction.query(`
        INSERT INTO proposal_items (
          id, proposal_id, catalog_product_id, position, snapshot_code,
          snapshot_manufacturer, snapshot_model, snapshot_description,
          snapshot_category, snapshot_unit, snapshot_unit_cost, quantity,
          sale_unit_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        randomUUID(),
        proposalId,
        item.productId,
        nextPosition,
        prod.code,
        prod.manufacturer,
        prod.model,
        prod.description,
        prod.category || 'Outros',
        prod.unit,
        unitCost,
        item.quantity,
        saleUnitPrice,
      ]);
    }

    await transaction.query('UPDATE proposals SET updated_at = now() WHERE id = $1', [proposalId]);
  });

  const updated = await getProposalById(database, proposalId);
  if (!updated) throw new Error('PROPOSAL_NOT_FOUND');
  return updated;
};
