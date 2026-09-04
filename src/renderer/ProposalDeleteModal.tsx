import { AlertTriangle, Trash2 } from 'lucide-react';
import type { ProposalSummary } from '../shared/contracts';

type ProposalDeleteModalProps = {
  proposal: ProposalSummary | null;
  actionPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ProposalDeleteModal({
  proposal,
  actionPending,
  onClose,
  onConfirm,
}: ProposalDeleteModalProps) {
  if (!proposal) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card delete-modal">
        <div className="modal-header danger-header">
          <AlertTriangle size={24} color="#dc2626" />
          <div>
            <h3>Excluir Orçamento</h3>
            <p>Confirmação de exclusão permanente</p>
          </div>
        </div>
        <div className="modal-body">
          <p>
            Tem certeza que deseja excluir o orçamento <strong>{proposal.number}</strong> (Cliente: <em>{proposal.clientName}</em>)?
          </p>
          <div className="danger-callout">
            Esta ação removerá todas as revisões, composições, itens de mão de obra e histórico associados a este orçamento do banco de dados local.
          </div>
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="secondary-btn"
            disabled={actionPending}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="danger-btn"
            disabled={actionPending}
            onClick={onConfirm}
          >
            <Trash2 size={16} />
            {actionPending ? 'Excluindo...' : 'Sim, excluir definitivamente'}
          </button>
        </div>
      </div>
    </div>
  );
}
