import type { ProposalDetail } from '../shared/contracts';
import { ProposalDeleteModal } from './ProposalDeleteModal';

type Props = {
  proposal: ProposalDetail;
  mutationPending: boolean;
  onClose: () => void;
  onDeleteProposal: () => void;
};

// Editor: a mesma janela de exclusao da lista de Propostas.
export function DeleteProposalModal({ proposal, mutationPending, onClose, onDeleteProposal }: Props) {
  return (
    <ProposalDeleteModal
      proposal={proposal}
      actionPending={mutationPending}
      onClose={onClose}
      onConfirm={() => { onClose(); onDeleteProposal(); }}
    />
  );
}
