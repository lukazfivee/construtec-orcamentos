import type { ProposalDetail } from './contracts';

type Status = ProposalDetail['status'];

// Uma proposta aprovada só pode originar outra revisão; seu aceite é definitivo.
// Mantém o fluxo comercial atual entre os demais estados, inclusive aceite direto.
export const proposalStatusTransitions: Record<Status, readonly Status[]> = {
  draft: ['review', 'sent', 'approved', 'rejected'],
  review: ['draft', 'sent', 'approved', 'rejected'],
  sent: ['draft', 'review', 'approved', 'rejected'],
  approved: [],
  rejected: ['draft', 'review', 'sent', 'approved'],
};

export const canChangeProposalStatus = (current: Status, next: Status) =>
  current === next || proposalStatusTransitions[current].includes(next);
