import { AlertTriangle, Trash2, X } from 'lucide-react';
import type { ProposalDetail } from '../shared/contracts';

type Props = {
  proposal: ProposalDetail;
  mutationPending: boolean;
  onClose: () => void;
  onDeleteProposal: () => void;
};

export function DeleteProposalModal({ proposal, mutationPending, onClose, onDeleteProposal }: Props) {
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
          <AlertTriangle size={24} color="#dc2626" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 id="delete-proposal-title">Excluir Orçamento</h3>
            <p>Confirmação de exclusão permanente</p>
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
            Tem certeza que deseja excluir o orçamento <strong>{proposal.number}</strong> (Cliente: <em>{proposal.clientName}</em>)?
          </p>
          <div className="danger-callout">
            Esta ação removerá todas as revisões, itens, composições de mão de obra e histórico associados a este orçamento do banco de dados local.
          </div>
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
          <button
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
          </button>
        </div>
      </div>
    </div>
  );
}
