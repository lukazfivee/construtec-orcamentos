import { randomUUID } from 'node:crypto';
import type { ProposalDetail } from '../../shared/contracts';
import type { LocalDatabase } from './database';
import { logEvent } from './logger';
import { getEditableProposal, roundMoney } from './proposalCommon';
import { getProposalById } from './proposals';

export interface ProposalBatchImportItem {
  code?: string;
  description: string;
  category?: string;
  unit?: string;
  quantity: number;
  unitCost?: number;
  unitSale?: number;
}

export const importProposalItemsBatch = async (
  database: LocalDatabase,
  proposalId: string,
  items: ProposalBatchImportItem[],
  userId?: string,
): Promise<ProposalDetail> => {
  if (items.length === 0) throw new Error('EMPTY_ITEMS_LIST');

  await database.transaction(async (transaction) => {
    const proposal = await getEditableProposal(transaction, proposalId);
    const bdiMultiplier = Number(proposal.bdi_multiplier);

    const maxPosRes = await transaction.query<{ max_pos: string | null }>(
      'SELECT max(position)::text AS max_pos FROM proposal_items WHERE proposal_id = $1',
      [proposalId],
    );
    let nextPosition = Number(maxPosRes.rows[0]?.max_pos ?? 0);

    for (const item of items) {
      if (item.quantity <= 0) continue;
      nextPosition += 1;
      const itemId = randomUUID();

      let catalogProductId: string | null = null;
      let code = item.code?.trim() || `ITEM-${String(nextPosition).padStart(3, '0')}`;
      let description = item.description.trim();
      let category = item.category?.trim() || 'Importado';
      let unit = item.unit?.trim() || 'un';
      let manufacturer: string | null = null;
      let model: string | null = null;
      let unitCost = item.unitCost !== undefined && item.unitCost >= 0 ? item.unitCost : 0;

      if (item.code?.trim()) {
        const prodRes = await transaction.query<{
          id: string;
          code: string;
          manufacturer: string | null;
          model: string | null;
          description: string;
          category: string;
          unit: string;
          current_cost: string;
        }>(
          'SELECT id, code, manufacturer, model, description, category, unit, current_cost::text FROM products WHERE code = $1 AND active = true LIMIT 1',
          [item.code.trim()],
        );
        const prod = prodRes.rows[0];
        if (prod) {
          catalogProductId = prod.id;
          code = prod.code;
          manufacturer = prod.manufacturer;
          model = prod.model;
          if (!description) description = prod.description;
          if (!item.category) category = prod.category;
          if (!item.unit) unit = prod.unit;
          if (item.unitCost === undefined || item.unitCost === null) {
            unitCost = Number(prod.current_cost);
          }
        }
      }

      const saleUnitPrice = item.unitSale !== undefined && item.unitSale >= 0
        ? item.unitSale
        : roundMoney(unitCost * bdiMultiplier);

      await transaction.query(`
        INSERT INTO proposal_items (
          id, proposal_id, catalog_product_id, position, snapshot_code,
          snapshot_manufacturer, snapshot_model, snapshot_description,
          snapshot_category, snapshot_unit, snapshot_unit_cost, quantity,
          sale_unit_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        itemId,
        proposalId,
        catalogProductId,
        nextPosition,
        code,
        manufacturer,
        model,
        description,
        category,
        unit,
        unitCost,
        item.quantity,
        saleUnitPrice,
      ]);
    }

    await transaction.query('UPDATE proposals SET updated_at = now() WHERE id = $1', [proposalId]);
    await transaction.query(`
      INSERT INTO audit_events (id, user_id, entity_type, entity_id, action, after_data)
      VALUES ($1, $2, 'proposal', $3, 'items_imported', $4::jsonb)
    `, [randomUUID(), userId ?? null, proposalId, JSON.stringify({ count: items.length })]);
    logEvent('info', 'proposal.items_imported', { proposalId, count: items.length });
  });

  const updated = await getProposalById(database, proposalId);
  if (!updated) throw new Error('PROPOSAL_NOT_FOUND');
  return updated;
};

export const copyItemsFromProposal = async (
  database: LocalDatabase,
  targetProposalId: string,
  sourceProposalId: string,
  itemIds?: string[],
  userId?: string,
): Promise<ProposalDetail> => {
  await database.transaction(async (transaction) => {
    const targetProposal = await getEditableProposal(transaction, targetProposalId);
    const bdiMultiplier = Number(targetProposal.bdi_multiplier);

    let query = `
      SELECT catalog_product_id, snapshot_code, snapshot_manufacturer,
        snapshot_model, snapshot_description, snapshot_category,
        snapshot_unit, snapshot_unit_cost::text, quantity::text, sale_unit_price::text
      FROM proposal_items
      WHERE proposal_id = $1
    `;
    const params: (string | string[])[] = [sourceProposalId];
    if (itemIds && itemIds.length > 0) {
      query += ' AND id = ANY($2::uuid[])';
      params.push(itemIds);
    }
    query += ' ORDER BY position ASC';

    const sourceItems = await transaction.query<{
      catalog_product_id: string | null;
      snapshot_code: string;
      snapshot_manufacturer: string | null;
      snapshot_model: string | null;
      snapshot_description: string;
      snapshot_category: string | null;
      snapshot_unit: string;
      snapshot_unit_cost: string;
      quantity: string;
      sale_unit_price: string;
    }>(query, params);

    if (sourceItems.rows.length === 0) throw new Error('NO_ITEMS_FOUND');

    const maxPosRes = await transaction.query<{ max_pos: string | null }>(
      'SELECT max(position)::text AS max_pos FROM proposal_items WHERE proposal_id = $1',
      [targetProposalId],
    );
    let nextPosition = Number(maxPosRes.rows[0]?.max_pos ?? 0);

    for (const item of sourceItems.rows) {
      nextPosition += 1;
      const itemId = randomUUID();
      const unitCost = Number(item.snapshot_unit_cost);
      const saleUnitPrice = roundMoney(unitCost * bdiMultiplier);

      await transaction.query(`
        INSERT INTO proposal_items (
          id, proposal_id, catalog_product_id, position, snapshot_code,
          snapshot_manufacturer, snapshot_model, snapshot_description,
          snapshot_category, snapshot_unit, snapshot_unit_cost, quantity,
          sale_unit_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        itemId,
        targetProposalId,
        item.catalog_product_id,
        nextPosition,
        item.snapshot_code,
        item.snapshot_manufacturer,
        item.snapshot_model,
        item.snapshot_description,
        item.snapshot_category || 'Geral',
        item.snapshot_unit,
        unitCost,
        Number(item.quantity),
        saleUnitPrice,
      ]);
    }

    await transaction.query('UPDATE proposals SET updated_at = now() WHERE id = $1', [targetProposalId]);
    await transaction.query(`
      INSERT INTO audit_events (id, user_id, entity_type, entity_id, action, after_data)
      VALUES ($1, $2, 'proposal', $3, 'items_copied', $4::jsonb)
    `, [randomUUID(), userId ?? null, targetProposalId, JSON.stringify({ sourceProposalId, count: sourceItems.rows.length })]);
    logEvent('info', 'proposal.items_copied', { targetProposalId, sourceProposalId, count: sourceItems.rows.length });
  });

  const updated = await getProposalById(database, targetProposalId);
  if (!updated) throw new Error('PROPOSAL_NOT_FOUND');
  return updated;
};
