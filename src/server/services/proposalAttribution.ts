import type { LocalDatabase } from './database';

export type ProposalCreationAction = 'created' | 'cloned' | 'revision_created';

export const attributeProposalCreation = async (
  database: LocalDatabase,
  proposalId: string,
  userId: string,
  action: ProposalCreationAction,
) => {
  await database.transaction(async (transaction) => {
    const proposal = await transaction.query<{ id: string }>(
      'UPDATE proposals SET created_by = $2, updated_at = now() WHERE id = $1 RETURNING id',
      [proposalId, userId],
    );
    if (!proposal.rows[0]) throw new Error('PROPOSAL_NOT_FOUND');

    await transaction.query(`
      UPDATE audit_events
      SET user_id = $2
      WHERE entity_type = 'proposal' AND entity_id = $1 AND action = $3
    `, [proposalId, userId, action]);
  });
};
