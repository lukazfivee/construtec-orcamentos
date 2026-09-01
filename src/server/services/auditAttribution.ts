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
