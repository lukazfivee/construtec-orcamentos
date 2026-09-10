import { useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
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
  useEffect(() => {
    if (!proposal) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !actionPending) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [proposal, actionPending, onClose]);

  if (!proposal) return null;

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !actionPending) onClose();
      }}
    >
      <div className="modal-card delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
        <div className="modal-header danger-header">
          <AlertTriangle size={24} color="#dc2626" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 id="delete-modal-title">Excluir Orçamento</h3>
            <p>Confirmação de exclusão permanente</p>
          </div>
          <button
            type="button"
            className="dialog-close"
            aria-label="Fechar"
            disabled={actionPending}
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
