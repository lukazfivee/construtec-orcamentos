import { AlertTriangle, Trash2, X } from 'lucide-react';
import type { ProposalDetail } from '../shared/contracts';
import { ProposalDiscardBox } from './ProposalDiscardBox';

type Props = {
  proposal: ProposalDetail;
  mutationPending: boolean;
  onClose: () => void;
  onDeleteProposal: () => void;
};

export function DeleteProposalModal({ proposal, mutationPending, onClose, onDeleteProposal }: Props) {
  const locked = proposal.status === 'approved' || proposal.hasApprovedRevision === true;
  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !mutationPending) onClose();
      }}
    >
      <div className="modal-card delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-proposal-title">
        <div className="modal-header danger-header">
          <AlertTriangle size={24} color="var(--tx-red-51)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 id="delete-proposal-title">{locked ? 'Descartar Orçamento aprovado' : 'Excluir Orçamento'}</h3>
            <p>{locked ? 'Aprovação é definitiva: só o descarte com registro é possível' : 'Confirmação de exclusão permanente'}</p>
          </div>
          <button
            type="button"
            className="dialog-close"
            aria-label="Fechar"
            disabled={mutationPending}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <p>
            {locked ? 'O orçamento ' : 'Tem certeza que deseja excluir o orçamento '}<strong>{proposal.number}</strong> (Cliente: <em>{proposal.clientName}</em>){locked ? ' está aprovado e não pode ser excluído.' : '?'}
          </p>
          {!locked && (
            <div className="danger-callout">
              Esta ação removerá todas as revisões, itens, composições de mão de obra e histórico associados a este orçamento do banco de dados local.
            </div>
          )}
          <ProposalDiscardBox proposalId={proposal.id} number={proposal.number} approved={locked} />
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="secondary-btn"
            disabled={mutationPending}
            onClick={onClose}
          >
            Cancelar
          </button>
          {!locked && <button
            type="button"
            className="danger-btn"
            disabled={mutationPending}
            onClick={() => {
              onClose();
              onDeleteProposal();
            }}
          >
            <Trash2 size={16} />
            {mutationPending ? 'Excluindo...' : 'Sim, excluir definitivamente'}
          </button>}
        </div>
      </div>
    </div>
  );
}
