// Linha avulsa na proposta (item que nao esta no catalogo) e promocao dela a produto do catalogo.
// A linha avulsa nasce vazia para ser preenchida na tabela; o custo e o preco de venda sao os da propria linha.
import { randomUUID } from 'node:crypto';
import type { LocalDatabase } from './database';
import { logEvent } from './logger';
import { getEditableProposal } from './proposalCommon';
import { importProposalItemsBatch } from './proposalImport';

export const BLANK_ITEM_DESCRIPTION = 'Novo item';

export const addBlankProposalItem = (database: LocalDatabase, proposalId: string, userId?: string) =>
  importProposalItemsBatch(database, proposalId, [{ description: BLANK_ITEM_DESCRIPTION, category: 'Outros', unit: 'un', quantity: 1, unitCost: 0, unitSale: 0 }], userId);

// Cria o produto no catalogo a partir da linha (descricao, unidade, categoria e custo da linha) e liga a linha a ele.
export const addProposalItemToCatalog = async (
  database: LocalDatabase, proposalId: string, itemId: string, input: { code: string; category?: string }, userId?: string,
): Promise<string> => {
  const productId = randomUUID();
  await database.transaction(async (transaction) => {
    await getEditableProposal(transaction, proposalId);
    const found = await transaction.query<{
      catalog_product_id: string | null; snapshot_description: string; snapshot_category: string | null; snapshot_unit: string; snapshot_unit_cost: string;
    }>(`
      SELECT catalog_product_id, snapshot_description, snapshot_category, snapshot_unit, snapshot_unit_cost::text
      FROM proposal_items WHERE proposal_id = $1 AND id = $2 FOR UPDATE
    `, [proposalId, itemId]);
    const item = found.rows[0];
    if (!item) throw new Error('ITEM_NOT_FOUND');
    if (item.catalog_product_id) throw new Error('ITEM_ALREADY_IN_CATALOG');
    const code = input.code.trim().toUpperCase();
    const duplicate = await transaction.query<{ id: string }>('SELECT id FROM products WHERE lower(code) = lower($1)', [code]);
    if (duplicate.rows[0]) throw new Error('PRODUCT_DUPLICATE');
    const category = input.category?.trim() || item.snapshot_category?.trim() || 'Outros';
    await transaction.query(`
      INSERT INTO products (id, code, manufacturer, model, description, category, unit, current_cost, source, active)
      VALUES ($1, $2, NULL, NULL, $3, $4, $5, $6, 'CONSTRUTEC', true)
    `, [productId, code, item.snapshot_description, category, item.snapshot_unit.trim().toLowerCase(), item.snapshot_unit_cost]);
    await transaction.query('UPDATE proposal_items SET catalog_product_id = $3, snapshot_code = $4, snapshot_category = $5 WHERE proposal_id = $1 AND id = $2', [proposalId, itemId, productId, code, category]);
    await transaction.query('UPDATE proposals SET updated_at = now() WHERE id = $1', [proposalId]);
    await transaction.query(`
      INSERT INTO audit_events (id, user_id, entity_type, entity_id, action, after_data)
      VALUES ($1, $2, 'product', $3, 'created_from_proposal_item', $4::jsonb)
    `, [randomUUID(), userId ?? null, productId, JSON.stringify({ proposalId, itemId, code })]);
    logEvent('info', 'proposal.item_added_to_catalog', { proposalId, itemId, productId });
  });
  return productId;
};
