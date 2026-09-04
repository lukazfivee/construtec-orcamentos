import { useCallback, useEffect, useState } from 'react';
import { History as HistoryIcon } from 'lucide-react';
import type { ProposalDetail, ProposalRevisionSummary } from '../shared/contracts';
import { proposalApi } from './api';

const statusLabels: Record<ProposalDetail['status'], string> = {
  draft: 'Em edição',
  review: 'Em revisão',
  sent: 'Enviada',
  approved: 'Aprovada',
  rejected: 'Recusada',
};

const money = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

type Props = {
  proposal: ProposalDetail;
  parentLoading: boolean;
  onOpenRevision: (proposalId: string) => void;
  setError: (error: string) => void;
};

export function ProposalHistoryPanel({ proposal, parentLoading, onOpenRevision, setError }: Props) {
  const [revisions, setRevisions] = useState<ProposalRevisionSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = useCallback(async (proposalId: string) => {
    setHistoryLoading(true);
    setError('');
    try {
      const result = await proposalApi.history(proposalId);
      setRevisions(result.revisions);
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : 'Não foi possível carregar o histórico desta proposta.');
    } finally {
      setHistoryLoading(false);
    }
  }, [setError]);

  useEffect(() => {
    void loadHistory(proposal.id);
  }, [loadHistory, proposal.id]);

  return (
    <div className="history-region" aria-busy={historyLoading}>
      <div className="history-heading">
        <div>
          <HistoryIcon size={18} />
          <span>
            <b>Histórico da proposta</b>
            <small>Versões anteriores permanecem preservadas e somente para consulta.</small>
          </span>
        </div>
        <button type="button" disabled={historyLoading} onClick={() => void loadHistory(proposal.id)}>
          Atualizar
        </button>
      </div>
      {historyLoading && <p className="history-message">Carregando histórico local…</p>}
      {!historyLoading && revisions.length === 0 && (
        <p className="history-message">Nenhuma revisão registrada para esta proposta.</p>
      )}
      {!historyLoading && revisions.length > 0 && (
        <table className="history-table">
          <thead>
            <tr>
              <th>Revisão</th>
              <th>Status</th>
              <th>Itens</th>
              <th>Venda total</th>
              <th>Responsável</th>
              <th>Última alteração</th>
              <th aria-label="Ação" />
            </tr>
          </thead>
          <tbody>
            {revisions.map((revision) => (
              <tr key={revision.id} className={revision.id === proposal.id ? 'current-revision' : ''}>
                <td>
                  <b>{revision.number} · REV.{String(revision.revision).padStart(2, '0')}</b>
                  {revision.isLatest && <small>Atual</small>}
                </td>
                <td>{statusLabels[revision.status]}</td>
                <td>{revision.itemCount}</td>
                <td className="number">R$ {money.format(revision.totalSale)}</td>
                <td>{revision.responsibleName}</td>
                <td>{dateTime.format(new Date(revision.updatedAt))}</td>
                <td>
                  <button
                    type="button"
                    disabled={revision.id === proposal.id || parentLoading}
                    onClick={() => onOpenRevision(revision.id)}
                  >
                    {revision.id === proposal.id ? 'Aberta' : 'Consultar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
