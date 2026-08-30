import { randomUUID } from 'node:crypto';
import type { CatalogProduct, ProposalDetail, ProposalLine, ProposalRevisionSummary, ProposalSummary } from '../../shared/contracts';
import type { LocalDatabase } from './database';
import { getProposalStandardMonthlyHours, listProposalLaborItems } from './proposalLabor';

type ProposalRow = {
  id: string;
  client_id: string;
  work_id: string | null;
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
  is_latest: boolean;
};

type ItemRow = {
  id: string;
  snapshot_code: string;
  snapshot_description: string;
  snapshot_category: string;
  quantity: string;
  snapshot_unit: string;
  snapshot_unit_cost: string;
  sale_unit_price: string;
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const getProposalById = async (database: LocalDatabase, proposalId: string): Promise<ProposalDetail | null> => {
  const proposalResult = await database.query<ProposalRow>(`
    SELECT p.id, p.client_id, p.work_id, p.proposal_number, p.revision,
      COALESCE(p.snapshot_client_name, c.trade_name, c.legal_name) AS client_name,
      COALESCE(p.snapshot_work_name, p.work_name) AS work_name, p.scope, p.status, p.bdi_multiplier::text,
      p.valid_until::text, u.name AS responsible_name, p.updated_at::text,
      NOT EXISTS (
        SELECT 1 FROM proposals newer
        WHERE newer.proposal_number = p.proposal_number AND newer.revision > p.revision
      ) AS is_latest
    FROM proposals p
    JOIN clients c ON c.id = p.client_id
    JOIN users u ON u.id = p.created_by
    WHERE p.id = $1
  `, [proposalId]);
  const proposal = proposalResult.rows[0];
  if (!proposal) return null;

  const itemResult = await database.query<ItemRow>(`
    SELECT id, snapshot_code, snapshot_description, snapshot_category, quantity::text,
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
      category: item.snapshot_category ?? 'Outros',
      quantity,
      unit: item.snapshot_unit,
      unitCost,
      totalCost: roundMoney(quantity * unitCost),
      unitSale,
      totalSale: roundMoney(quantity * unitSale),
    };
  });

  const bdiMultiplier = Number(proposal.bdi_multiplier);
  const laborItems = await listProposalLaborItems(database, proposal.id);
  const standardMonthlyHours = await getProposalStandardMonthlyHours(database, proposal.id);
  const materials = roundMoney(items.reduce((total, item) => total + item.totalCost, 0));
  const labor = roundMoney(laborItems.reduce((total, item) => total + item.totalCost, 0));
  const baseCost = roundMoney(materials + labor);
  const finalValue = roundMoney(baseCost * bdiMultiplier);
  const additions = roundMoney(finalValue - baseCost);
  const sale = roundMoney(items.reduce((total, item) => total + item.totalSale, 0));
  const grossResult = roundMoney(finalValue - baseCost);

  return {
    id: proposal.id,
    clientId: proposal.client_id,
    workId: proposal.work_id,
    number: proposal.proposal_number,
    revision: proposal.revision,
    clientName: proposal.client_name,
    workName: proposal.work_name,
    scope: proposal.scope,
    status: proposal.status,
    bdiMultiplier,
    validUntil: proposal.valid_until,
    responsibleName: proposal.responsible_name,
    updatedAt: proposal.updated_at,
    isLatest: proposal.is_latest,
    items,
    laborItems,
    standardMonthlyHours,
    totals: {
      cost: materials,
      sale,
      grossResult,
      marginPercent: finalValue > 0 ? roundMoney((grossResult / finalValue) * 100) : 0,
      materials,
      labor,
      baseCost,
      additions,
      finalValue,
    },
  };
};

export const getCurrentProposal = async (database: LocalDatabase): Promise<ProposalDetail | null> => {
  const result = await database.query<{ id: string }>(`
    SELECT p.id
    FROM proposals p
    WHERE NOT EXISTS (
      SELECT 1 FROM proposals newer
      WHERE newer.proposal_number = p.proposal_number AND newer.revision > p.revision
    )
    ORDER BY p.updated_at DESC
    LIMIT 1
  `);
  const proposalId = result.rows[0]?.id;
  return proposalId ? getProposalById(database, proposalId) : null;
};

export const listCurrentProposals = async (database: LocalDatabase): Promise<ProposalSummary[]> => {
  const result = await database.query<{
    id: string; proposal_number: string; revision: number; client_name: string; work_name: string;
    status: ProposalDetail['status']; item_count: string; total_sale: string; updated_at: string;
  }>(`
    SELECT p.id, p.proposal_number, p.revision,
      COALESCE(p.snapshot_client_name, c.trade_name, c.legal_name) AS client_name,
      COALESCE(p.snapshot_work_name, p.work_name) AS work_name,
      p.status, count(i.id)::text AS item_count,
      COALESCE(ROUND((
        COALESCE((SELECT SUM(pi.quantity * pi.snapshot_unit_cost) FROM proposal_items pi WHERE pi.proposal_id = p.id), 0)
        + COALESCE((SELECT SUM(
            pli.professional_count * (pli.monthly_salary + pli.monthly_food + pli.monthly_transport + pli.monthly_other_costs)
            / NULLIF(pli.standard_monthly_hours, 0) * pli.planned_hours
          ) FROM proposal_labor_items pli WHERE pli.proposal_id = p.id), 0)
      ) * p.bdi_multiplier, 2), 0)::text AS total_sale,
      p.updated_at::text
    FROM proposals p
    JOIN clients c ON c.id = p.client_id
    LEFT JOIN proposal_items i ON i.proposal_id = p.id
    WHERE NOT EXISTS (
      SELECT 1 FROM proposals newer
      WHERE newer.proposal_number = p.proposal_number AND newer.revision > p.revision
    )
    GROUP BY p.id, c.trade_name, c.legal_name, p.bdi_multiplier
    ORDER BY p.updated_at DESC
    LIMIT 20
  `);
  return result.rows.map((proposal) => ({
    id: proposal.id,
    number: proposal.proposal_number,
    revision: proposal.revision,
    clientName: proposal.client_name,
    workName: proposal.work_name,
    status: proposal.status,
    itemCount: Number(proposal.item_count),
    totalSale: roundMoney(Number(proposal.total_sale)),
    updatedAt: proposal.updated_at,
  }));
};

export const createProposal = async (
  database: LocalDatabase,
  input: { clientId: string; workId: string; scope: string; validUntil?: string | null },
) => database.transaction(async (transaction) => {
  const contextResult = await transaction.query<{ client_name: string; work_name: string }>(`
    SELECT COALESCE(c.trade_name, c.legal_name) AS client_name, w.name AS work_name
    FROM works w
    JOIN clients c ON c.id = w.client_id
    WHERE c.id = $1 AND w.id = $2 AND w.active = true
  `, [input.clientId, input.workId]);
  const context = contextResult.rows[0];
  if (!context) throw new Error('WORK_NOT_FOUND');

  const userResult = await transaction.query<{ id: string }>(`
    SELECT id FROM users WHERE active = true
    ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, created_at
    LIMIT 1
  `);
  const userId = userResult.rows[0]?.id;
  if (!userId) throw new Error('USER_NOT_FOUND');

  const numberResult = await transaction.query<{ proposal_number: string }>(`
    SELECT proposal_number
    FROM proposals
    WHERE proposal_number ~ '^PA-[0-9]+$'
    ORDER BY substring(proposal_number from 4)::integer DESC
    LIMIT 1
  `);
  const currentNumber = Number(numberResult.rows[0]?.proposal_number.slice(3) ?? 1000);
  const proposalNumber = `PA-${String(currentNumber + 1).padStart(4, '0')}`;
  const proposalId = randomUUID();
  await transaction.query(`
    INSERT INTO proposals
      (id, proposal_number, revision, client_id, work_id, work_name, snapshot_client_name,
       snapshot_work_name, scope, status, bdi_multiplier, valid_until, created_by)
    VALUES ($1, $2, 0, $3, $4, $5, $6, $5, $7, 'draft', 1.45, $8, $9)
  `, [proposalId, proposalNumber, input.clientId, input.workId, context.work_name,
    context.client_name, input.scope.trim(), input.validUntil || null, userId]);
  await transaction.query(`
    INSERT INTO audit_events (id, user_id, entity_type, entity_id, action, after_data)
    VALUES ($1, $2, 'proposal', $3, 'created', $4::jsonb)
  `, [randomUUID(), userId, proposalId, JSON.stringify({ proposalNumber, revision: 0, ...input })]);
  return proposalId;
});

type Queryable = Pick<LocalDatabase, 'query'>;

export type ProposalItemUpdateInput = Partial<Pick<ProposalLine, 'description' | 'category' | 'quantity' | 'unit' | 'unitCost' | 'unitSale'>>;

const getLatestProposal = async (database: Queryable, proposalId: string) => {
  const result = await database.query<{
    status: ProposalDetail['status']; bdi_multiplier: string; proposal_number: string; revision: number; superseded: boolean;
  }>(`
    SELECT p.status, p.bdi_multiplier::text, p.proposal_number, p.revision,
      EXISTS (
        SELECT 1 FROM proposals newer
        WHERE newer.proposal_number = p.proposal_number AND newer.revision > p.revision
      ) AS superseded
    FROM proposals p
    WHERE p.id = $1
    FOR UPDATE
  `, [proposalId]);
  const proposal = result.rows[0];
  if (!proposal) throw new Error('PROPOSAL_NOT_FOUND');
  if (proposal.superseded) throw new Error('PROPOSAL_LOCKED');
  return proposal;
};

const getEditableProposal = async (database: Queryable, proposalId: string) => {
  const proposal = await getLatestProposal(database, proposalId);
  if (proposal.status !== 'draft' && proposal.status !== 'review') throw new Error('PROPOSAL_LOCKED');
  return proposal;
};

export const searchCatalog = async (database: LocalDatabase, query: string, limit: number): Promise<CatalogProduct[]> => {
  const pattern = `%${query.trim()}%`;
  const result = await database.query<{
    id: string; code: string; manufacturer: string | null; model: string | null;
    description: string; category: string; unit: string; current_cost: string; source: string; active: boolean; updated_at: string;
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

export const addProductToProposal = async (database: LocalDatabase, proposalId: string, productId: string, quantity: number) => {
  await database.transaction(async (transaction) => {
    const proposal = await getEditableProposal(transaction, proposalId);

    const productResult = await transaction.query<{
      id: string; code: string; manufacturer: string | null; model: string | null;
      description: string; category: string; unit: string; current_cost: string;
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
    `, [itemId, proposalId, product.id, positionResult.rows[0]?.next_position ?? 1, product.code,
      product.manufacturer, product.model, product.description, product.category, product.unit, unitCost, quantity, salePrice]);

    await transaction.query('UPDATE proposals SET updated_at = now() WHERE id = $1', [proposalId]);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, after_data)
      VALUES ($1, 'proposal_item', $2, 'created', $3::jsonb)
    `, [randomUUID(), itemId, JSON.stringify({ productId, snapshotUnitCost: unitCost, quantity, salePrice })]);
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
      catalog_product_id: string | null; snapshot_code: string; snapshot_manufacturer: string | null;
      snapshot_model: string | null; snapshot_description: string; snapshot_category: string; snapshot_unit: string;
      snapshot_unit_cost: string; quantity: string; sale_unit_price: string;
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
    `, [newItemId, proposalId, item.catalog_product_id, positionResult.rows[0]?.next_position ?? 1,
      item.snapshot_code, item.snapshot_manufacturer, item.snapshot_model, item.snapshot_description,
      item.snapshot_category ?? 'Outros', item.snapshot_unit, Number(item.snapshot_unit_cost), Number(item.quantity), Number(item.sale_unit_price)]);

    await transaction.query('UPDATE proposals SET updated_at = now() WHERE id = $1', [proposalId]);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data)
      VALUES ($1, 'proposal_item', $2, 'duplicated', $3::jsonb, $4::jsonb)
    `, [randomUUID(), newItemId, JSON.stringify({ sourceItemId: itemId }), JSON.stringify({ position: positionResult.rows[0]?.next_position ?? 1 })]);
  });
};

export const moveProposalItem = async (database: LocalDatabase, proposalId: string, itemId: string, direction: 'up' | 'down') => {
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
  });
};

export const updateProposalBdi = async (
  database: LocalDatabase,
  proposalId: string,
  bdiMultiplier: number,
) => {
  await database.transaction(async (transaction) => {
    const proposal = await getEditableProposal(transaction, proposalId);

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

export const updateProposalDetails = async (
  database: LocalDatabase,
  proposalId: string,
  input: { scope?: string; validUntil?: string | null },
) => {
  await database.transaction(async (transaction) => {
    await getEditableProposal(transaction, proposalId);
    const current = await transaction.query<{ scope: string; valid_until: string | null }>(
      'SELECT scope, valid_until::text FROM proposals WHERE id = $1 FOR UPDATE',
      [proposalId],
    );
    const before = current.rows[0];
    if (!before) throw new Error('PROPOSAL_NOT_FOUND');

    const hasValidUntil = Object.prototype.hasOwnProperty.call(input, 'validUntil');
    const next = {
      scope: input.scope?.trim() ?? before.scope,
      validUntil: hasValidUntil ? input.validUntil ?? null : before.valid_until,
    };

    await transaction.query(
      'UPDATE proposals SET scope = $2, valid_until = $3, updated_at = now() WHERE id = $1',
      [proposalId, next.scope, next.validUntil],
    );
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data)
      VALUES ($1, 'proposal', $2, 'details_updated', $3::jsonb, $4::jsonb)
    `, [randomUUID(), proposalId, JSON.stringify(before), JSON.stringify(next)]);
  });
};

export const createProposalRevision = async (database: LocalDatabase, sourceProposalId: string) => {
  return database.transaction(async (transaction) => {
    const source = await getLatestProposal(transaction, sourceProposalId);
    const newProposalId = randomUUID();
    const created = await transaction.query<{ revision: number }>(`
      INSERT INTO proposals
        (id, proposal_number, revision, client_id, work_id, work_name, snapshot_client_name,
         snapshot_work_name, scope, status, bdi_multiplier, valid_until, created_by)
      SELECT $2, proposal_number, revision + 1, client_id, work_id, work_name, snapshot_client_name,
        snapshot_work_name, scope, 'draft', bdi_multiplier, valid_until, created_by
      FROM proposals
      WHERE id = $1
      RETURNING revision
    `, [sourceProposalId, newProposalId]);

    const items = await transaction.query<{
      catalog_product_id: string | null; position: number; snapshot_code: string;
      snapshot_manufacturer: string | null; snapshot_model: string | null; snapshot_description: string;
      snapshot_category: string; snapshot_unit: string; snapshot_unit_cost: string; quantity: string; sale_unit_price: string;
    }>(`
      SELECT catalog_product_id, position, snapshot_code, snapshot_manufacturer, snapshot_model,
        snapshot_description, snapshot_category, snapshot_unit, snapshot_unit_cost::text, quantity::text, sale_unit_price::text
      FROM proposal_items
      WHERE proposal_id = $1
      ORDER BY position
    `, [sourceProposalId]);

    for (const item of items.rows) {
      await transaction.query(`
        INSERT INTO proposal_items
          (id, proposal_id, catalog_product_id, position, snapshot_code, snapshot_manufacturer,
           snapshot_model, snapshot_description, snapshot_category, snapshot_unit, snapshot_unit_cost, quantity, sale_unit_price)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [randomUUID(), newProposalId, item.catalog_product_id, item.position, item.snapshot_code,
        item.snapshot_manufacturer, item.snapshot_model, item.snapshot_description, item.snapshot_category ?? 'Outros', item.snapshot_unit,
        Number(item.snapshot_unit_cost), Number(item.quantity), Number(item.sale_unit_price)]);
    }

    const revision = created.rows[0]?.revision ?? source.revision + 1;
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, after_data)
      VALUES ($1, 'proposal', $2, 'revision_created', $3::jsonb)
    `, [randomUUID(), newProposalId, JSON.stringify({ sourceProposalId, proposalNumber: source.proposal_number, revision })]);
    return newProposalId;
  });
};

export const updateProposalContext = async (
  database: LocalDatabase,
  proposalId: string,
  clientId: string,
  workId: string,
) => {
  await database.transaction(async (transaction) => {
    await getEditableProposal(transaction, proposalId);
    const current = await transaction.query<{
      client_id: string; work_id: string | null; snapshot_client_name: string | null; snapshot_work_name: string | null;
    }>('SELECT client_id, work_id, snapshot_client_name, snapshot_work_name FROM proposals WHERE id = $1', [proposalId]);
    const workResult = await transaction.query<{
      work_name: string; client_name: string;
    }>(`
      SELECT w.name AS work_name, COALESCE(c.trade_name, c.legal_name) AS client_name
      FROM works w
      JOIN clients c ON c.id = w.client_id
      WHERE w.id = $1 AND w.client_id = $2 AND w.active = true
    `, [workId, clientId]);
    const context = workResult.rows[0];
    if (!context) throw new Error('WORK_NOT_FOUND');

    await transaction.query(`
      UPDATE proposals
      SET client_id = $2, work_id = $3, work_name = $4,
          snapshot_client_name = $5, snapshot_work_name = $4, updated_at = now()
      WHERE id = $1
    `, [proposalId, clientId, workId, context.work_name, context.client_name]);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data)
      VALUES ($1, 'proposal', $2, 'context_updated', $3::jsonb, $4::jsonb)
    `, [randomUUID(), proposalId, JSON.stringify(current.rows[0] ?? null), JSON.stringify({ clientId, workId, clientName: context.client_name, workName: context.work_name })]);
  });
};

export const listProposalHistory = async (database: LocalDatabase, proposalId: string): Promise<ProposalRevisionSummary[]> => {
  const result = await database.query<{
    id: string; proposal_number: string; revision: number; status: ProposalDetail['status'];
    item_count: string; total_sale: string; responsible_name: string; updated_at: string; is_latest: boolean;
  }>(`
    SELECT p.id, p.proposal_number, p.revision, p.status,
      count(i.id)::text AS item_count,
      COALESCE(ROUND((
        COALESCE((SELECT SUM(pi.quantity * pi.snapshot_unit_cost) FROM proposal_items pi WHERE pi.proposal_id = p.id), 0)
        + COALESCE((SELECT SUM(
            pli.professional_count * (pli.monthly_salary + pli.monthly_food + pli.monthly_transport + pli.monthly_other_costs)
            / NULLIF(pli.standard_monthly_hours, 0) * pli.planned_hours
          ) FROM proposal_labor_items pli WHERE pli.proposal_id = p.id), 0)
      ) * p.bdi_multiplier, 2), 0)::text AS total_sale,
      u.name AS responsible_name, p.updated_at::text,
      p.revision = max(p.revision) OVER (PARTITION BY p.proposal_number) AS is_latest
    FROM proposals p
    JOIN proposals selected ON selected.id = $1 AND selected.proposal_number = p.proposal_number
    JOIN users u ON u.id = p.created_by
    LEFT JOIN proposal_items i ON i.proposal_id = p.id
    GROUP BY p.id, u.name, p.bdi_multiplier
    ORDER BY p.revision DESC
  `, [proposalId]);
  return result.rows.map((revision) => ({
    id: revision.id,
    number: revision.proposal_number,
    revision: revision.revision,
    status: revision.status,
    itemCount: Number(revision.item_count),
    totalSale: roundMoney(Number(revision.total_sale)),
    responsibleName: revision.responsible_name,
    updatedAt: revision.updated_at,
    isLatest: revision.is_latest,
  }));
};
