import type { ProposalSummary } from '../shared/contracts';
import { AlertTriangle, Trash2 } from './icons';
import { Dialogo } from './orcDeskUi';
import { ProposalDiscardBox } from './ProposalDiscardBox';

type ProposalDeleteModalProps = {
  proposal: Pick<ProposalSummary, 'id' | 'number' | 'clientName' | 'status' | 'hasApprovedRevision'> | null;
  actionPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

/* Excluir (ou, se ja aprovada, so descartar com registro): a mesma janela na lista de Propostas e no editor. */
export function ProposalDeleteModal({
  proposal,
  actionPending,
  onClose,
  onConfirm,
}: ProposalDeleteModalProps) {
  if (!proposal) return null;
  const locked = proposal.status === 'approved' || proposal.hasApprovedRevision === true;

  return (
    <Dialogo
      id="delete-modal"
      icon={AlertTriangle}
      tone="bad"
      title={locked ? 'Descartar proposta aprovada' : 'Excluir proposta'}
      sub={locked ? 'Proposta aprovada não pode ser excluída, só descartada com registro.' : 'A exclusão não pode ser desfeita.'}
      className="w-sm delete-dlg"
      busy={actionPending}
      onClose={onClose}
      footer={(
        <>
          <button type="button" disabled={actionPending} onClick={onClose}>Cancelar</button>
          {!locked && (
            <button type="button" className="danger" disabled={actionPending} onClick={onConfirm}>
              <Trash2 size={16} />
              {actionPending ? 'Excluindo…' : 'Excluir de vez'}
            </button>
          )}
        </>
      )}
    >
      <p className="delete-q">
        {locked ? 'A proposta ' : 'Excluir a proposta '}<strong>{proposal.number}</strong> de {proposal.clientName}{locked ? ' está aprovada.' : '?'}
      </p>
      {!locked && (
        <p className="dlg-note bad">Saem junto todas as revisões, os itens, a mão de obra e o histórico desta proposta.</p>
      )}
      <ProposalDiscardBox proposalId={proposal.id} number={proposal.number} approved={locked} />
    </Dialogo>
  );
}
