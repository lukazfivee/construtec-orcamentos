import { randomUUID } from 'node:crypto';
import type { ProposalDetail } from '../../shared/contracts';
import { isManualSale } from '../../shared/proposalFinancials';
import type { LocalDatabase } from './database';
import { logEvent } from './logger';
import { getEditableProposal, insertProposalItems, roundMoney, type ProposalItemInsert } from './proposalCommon';
import { getProposalById } from './proposals';

type CatalogRow = {
  id: string; code: string; manufacturer: string | null; model: string | null;
  description: string; category: string; unit: string; current_cost: string;
};

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

    // Uma consulta para todos os codigos do lote, em vez de uma por item.
    const codes = [...new Set(items.map((item) => item.code?.trim() ?? '').filter(Boolean))];
    const products = new Map<string, CatalogRow>();
    if (codes.length > 0) {
      const found = await transaction.query<CatalogRow>(
        'SELECT id, code, manufacturer, model, description, category, unit, current_cost::text FROM products WHERE code = ANY($1::text[]) AND active = true',
        [codes],
      );
      for (const row of found.rows) if (!products.has(row.code)) products.set(row.code, row);
    }

    const rows: ProposalItemInsert[] = [];
    for (const item of items) {
      if (item.quantity <= 0) continue;
      nextPosition += 1;
      const prod = item.code?.trim() ? products.get(item.code.trim()) : undefined;
      let unitCost = item.unitCost !== undefined && item.unitCost >= 0 ? item.unitCost : 0;
      if (prod && (item.unitCost === undefined || item.unitCost === null)) unitCost = Number(prod.current_cost);

      rows.push({
        catalogProductId: prod?.id ?? null,
        position: nextPosition,
        code: prod?.code ?? (item.code?.trim() || `ITEM-${String(nextPosition).padStart(3, '0')}`),
        manufacturer: prod?.manufacturer ?? null,
        model: prod?.model ?? null,
        description: item.description.trim() || prod?.description || '',
        category: prod && !item.category ? prod.category : (item.category?.trim() || 'Importado'),
        unit: prod && !item.unit ? prod.unit : (item.unit?.trim() || 'un'),
        unitCost,
        quantity: item.quantity,
        saleUnitPrice: item.unitSale !== undefined && item.unitSale >= 0
          ? roundMoney(item.unitSale / (1 + Number(proposal.tax_percentage ?? 0) / 100))
          : roundMoney(unitCost * bdiMultiplier),
      });
    }
    await insertProposalItems(transaction, proposalId, rows);

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

    // source_bdi: BDI da proposta de origem, para saber se a venda do item foi digitada a mao.
    let query = `
      SELECT pi.catalog_product_id, pi.snapshot_code, pi.snapshot_manufacturer,
        pi.snapshot_model, pi.snapshot_description, pi.snapshot_category,
        pi.snapshot_unit, pi.snapshot_unit_cost::text, pi.quantity::text, pi.sale_unit_price::text,
        p.bdi_multiplier::text AS source_bdi
      FROM proposal_items pi
      JOIN proposals p ON p.id = pi.proposal_id
      WHERE pi.proposal_id = $1
    `;
    const params: (string | string[])[] = [sourceProposalId];
    if (itemIds && itemIds.length > 0) {
      query += ' AND pi.id = ANY($2::uuid[])';
      params.push(itemIds);
    }
    query += ' ORDER BY pi.position ASC';

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
      source_bdi: string;
    }>(query, params);

    if (sourceItems.rows.length === 0) throw new Error('NO_ITEMS_FOUND');

    const maxPosRes = await transaction.query<{ max_pos: string | null }>(
      'SELECT max(position)::text AS max_pos FROM proposal_items WHERE proposal_id = $1',
      [targetProposalId],
    );
    let nextPosition = Number(maxPosRes.rows[0]?.max_pos ?? 0);

    await insertProposalItems(transaction, targetProposalId, sourceItems.rows.map((item) => {
      nextPosition += 1;
      const unitCost = Number(item.snapshot_unit_cost);
      const sourceSale = Number(item.sale_unit_price);
      // Venda automatica (custo x BDI) segue o BDI do destino; venda digitada a mao fica (mesmo criterio de updateProposalItem).
      const manual = isManualSale({ unitCost, saleUnitPrice: sourceSale }, Number(item.source_bdi));
      return {
        catalogProductId: item.catalog_product_id,
        position: nextPosition,
        code: item.snapshot_code,
        manufacturer: item.snapshot_manufacturer,
        model: item.snapshot_model,
        description: item.snapshot_description,
        category: item.snapshot_category || 'Geral',
        unit: item.snapshot_unit,
        unitCost,
        quantity: Number(item.quantity),
        saleUnitPrice: manual ? sourceSale : roundMoney(unitCost * bdiMultiplier),
      };
    }));

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
