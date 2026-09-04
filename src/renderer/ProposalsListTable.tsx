import {
  ArrowUpDown,
  Building2,
  Calendar,
  Copy,
  ExternalLink,
  FilePlus2,
  FileText,
  Layers,
  Trash2,
} from 'lucide-react';
import type { ProposalDetail, ProposalSummary } from '../shared/contracts';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const statusClasses: Record<ProposalDetail['status'], string> = {
  draft: 'status-draft',
  review: 'status-review',
  sent: 'status-sent',
  approved: 'status-approved',
  rejected: 'status-rejected',
};

type ProposalsListTableProps = {
  proposals: ProposalSummary[];
  searchTerm: string;
  statusFilter: string;
  sortBy: 'date' | 'number' | 'client' | 'value';
  actionPending: boolean;
  onToggleSort: (field: 'date' | 'number' | 'client' | 'value') => void;
  onOpenProposal: (proposalId: string) => void;
  onStatusChange: (proposalId: string, newStatus: ProposalDetail['status']) => void;
  onClone: (item: ProposalSummary) => void;
  onDeleteRequest: (item: ProposalSummary) => void;
  onClearFilters: () => void;
  onNewProposal: () => void;
};

export function ProposalsListTable({
  proposals,
  searchTerm,
  statusFilter,
  actionPending,
  onToggleSort,
  onOpenProposal,
  onStatusChange,
  onClone,
  onDeleteRequest,
  onClearFilters,
  onNewProposal,
}: ProposalsListTableProps) {
  return (
    <div className="home-panel table-panel">
      <div className="home-panel-header">
        <div>
          <h3>Lista de Propostas ({proposals.length})</h3>
          <p>Clique em uma proposta para abrir a mesa de edição e composição.</p>
        </div>
      </div>

      {proposals.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} className="empty-state-icon" />
          <h4>Nenhuma proposta encontrada</h4>
          <p>
            {searchTerm || statusFilter !== 'all'
              ? 'Nenhum orçamento corresponde aos filtros selecionados.'
              : 'Você ainda não possui orçamentos cadastrados.'}
          </p>
          {searchTerm || statusFilter !== 'all' ? (
            <button
              type="button"
              className="secondary-btn"
              onClick={onClearFilters}
            >
              Limpar filtros
            </button>
          ) : (
            <button type="button" className="primary-btn" onClick={onNewProposal}>
              <FilePlus2 size={16} />
              Criar primeiro orçamento
            </button>
          )}
        </div>
      ) : (
        <div className="proposals-table-wrapper">
          <table className="proposals-table">
            <thead>
              <tr>
                <th onClick={() => onToggleSort('number')} className="sortable-th">
                  <span>Proposta</span>
                  <ArrowUpDown size={14} />
                </th>
                <th onClick={() => onToggleSort('client')} className="sortable-th">
                  <span>Cliente / Obra</span>
                  <ArrowUpDown size={14} />
                </th>
                <th>Itens</th>
                <th onClick={() => onToggleSort('value')} className="sortable-th text-right">
                  <span>Valor Total</span>
                  <ArrowUpDown size={14} />
                </th>
                <th>Status</th>
                <th onClick={() => onToggleSort('date')} className="sortable-th">
                  <span>Atualizado em</span>
                  <ArrowUpDown size={14} />
                </th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((item) => (
                <tr key={item.id} className="proposal-row">
                  <td className="proposal-number-cell" onClick={() => onOpenProposal(item.id)}>
                    <div className="proposal-number-badge">
                      <strong>{item.number}</strong>
                      <span className="revision-tag">REV.{String(item.revision).padStart(2, '0')}</span>
                    </div>
                  </td>
                  <td className="proposal-client-cell" onClick={() => onOpenProposal(item.id)}>
                    <div className="client-name">{item.clientName}</div>
                    <div className="work-name">
                      <Building2 size={12} />
                      {item.workName}
                    </div>
                  </td>
                  <td onClick={() => onOpenProposal(item.id)}>
                    <span className="items-count-badge">
                      <Layers size={12} />
                      {item.itemCount} {item.itemCount === 1 ? 'item' : 'itens'}
                    </span>
                  </td>
                  <td className="proposal-value-cell text-right" onClick={() => onOpenProposal(item.id)}>
                    <strong>{money.format(item.totalSale)}</strong>
                  </td>
                  <td className="proposal-status-cell">
                    <select
                      className={`status-select ${statusClasses[item.status]}`}
                      value={item.status}
                      disabled={actionPending}
                      onChange={(e) => onStatusChange(item.id, e.target.value as ProposalDetail['status'])}
                    >
                      <option value="draft">Em edição</option>
                      <option value="review">Em revisão</option>
                      <option value="sent">Enviada</option>
                      <option value="approved">Aprovada</option>
                      <option value="rejected">Recusada</option>
                    </select>
                  </td>
                  <td className="proposal-date-cell" onClick={() => onOpenProposal(item.id)}>
                    <Calendar size={12} />
                    {dateTime.format(new Date(item.updatedAt))}
                  </td>
                  <td className="proposal-actions-cell text-right">
                    <button
                      type="button"
                      className="table-action-btn primary"
                      title="Abrir proposta na mesa operacional"
                      onClick={() => onOpenProposal(item.id)}
                    >
                      <ExternalLink size={15} />
                      Abrir
                    </button>
                    <button
                      type="button"
                      className="table-action-btn secondary"
                      title="Clonar como novo orçamento"
                      disabled={actionPending}
                      onClick={() => void onClone(item)}
                    >
                      <Copy size={14} />
                      Clonar
                    </button>
                    <button
                      type="button"
                      className="table-action-btn danger"
                      title="Excluir proposta"
                      disabled={actionPending}
                      onClick={() => onDeleteRequest(item)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
