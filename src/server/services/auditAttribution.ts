import type { LocalDatabase } from './database';

export const attributeAuditEvent = async (
  database: LocalDatabase,
  userId: string,
  entityType: string,
  entityId: string,
  action: string,
) => {
  const result = await database.query<{ id: string }>(`
    WITH target AS (
      SELECT id
      FROM audit_events
      WHERE user_id IS NULL
        AND entity_type = $1
        AND entity_id = $2
        AND action = $3
      ORDER BY occurred_at DESC
      LIMIT 1
    )
    UPDATE audit_events event
    SET user_id = $4
    FROM target
    WHERE event.id = target.id
    RETURNING event.id
  `, [entityType, entityId, action, userId]);

  return Boolean(result.rows[0]);
};

export const attributeCreatedProposalItemAudit = async (
  database: LocalDatabase,
  userId: string,
  proposalId: string,
  productId: string,
) => {
  const result = await database.query<{ id: string }>(`
    WITH target AS (
      SELECT event.id
      FROM audit_events event
      JOIN proposal_items item ON item.id = event.entity_id
      WHERE event.user_id IS NULL
        AND event.entity_type = 'proposal_item'
        AND event.action = 'created'
        AND item.proposal_id = $1
        AND item.catalog_product_id = $2
      ORDER BY event.occurred_at DESC, item.created_at DESC
      LIMIT 1
    )
    UPDATE audit_events event
    SET user_id = $3
    FROM target
    WHERE event.id = target.id
    RETURNING event.id
  `, [proposalId, productId, userId]);

  return Boolean(result.rows[0]);
};

export const attributeDuplicatedProposalItemAudit = async (
  database: LocalDatabase,
  userId: string,
  proposalId: string,
  sourceItemId: string,
) => {
  const result = await database.query<{ id: string }>(`
    WITH target AS (
      SELECT event.id
      FROM audit_events event
      JOIN proposal_items item ON item.id = event.entity_id
      WHERE event.user_id IS NULL
        AND event.entity_type = 'proposal_item'
        AND event.action = 'duplicated'
        AND item.proposal_id = $1
        AND event.before_data->>'sourceItemId' = $2
      ORDER BY event.occurred_at DESC, item.created_at DESC
      LIMIT 1
    )
    UPDATE audit_events event
    SET user_id = $3
    FROM target
    WHERE event.id = target.id
    RETURNING event.id
  `, [proposalId, sourceItemId, userId]);

  return Boolean(result.rows[0]);
};

export const attributeCatalogBatchAudit = async (
  database: LocalDatabase,
  userId: string,
  codes: string[],
  summary: { created: number; updated: number; ignored: number },
) => {
  const result = await database.query<{ id: string }>(`
    WITH target AS (
      SELECT id
      FROM audit_events
      WHERE user_id IS NULL
        AND entity_type = 'catalog'
        AND action = 'batch_imported'
        AND after_data->'codes' = $1::jsonb
        AND (after_data->>'created')::integer = $2
        AND (after_data->>'updated')::integer = $3
        AND (after_data->>'ignored')::integer = $4
      ORDER BY occurred_at DESC
      LIMIT 1
    )
    UPDATE audit_events event
    SET user_id = $5
    FROM target
    WHERE event.id = target.id
    RETURNING event.id
  `, [JSON.stringify(codes), summary.created, summary.updated, summary.ignored, userId]);

  return Boolean(result.rows[0]);
};
