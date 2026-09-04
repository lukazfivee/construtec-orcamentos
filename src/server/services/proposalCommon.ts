import type { ProposalDetail } from '../../shared/contracts';
import type { LocalDatabase } from './database';

export type Queryable = Pick<LocalDatabase, 'query'>;

export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const getLatestProposal = async (database: Queryable, proposalId: string) => {
  const result = await database.query<{
    status: ProposalDetail['status'];
    bdi_multiplier: string;
    proposal_number: string;
    revision: number;
    superseded: boolean;
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

export const getEditableProposal = async (database: Queryable, proposalId: string) => {
  const proposal = await getLatestProposal(database, proposalId);
  if (proposal.status !== 'draft' && proposal.status !== 'review') throw new Error('PROPOSAL_LOCKED');
  return proposal;
};
