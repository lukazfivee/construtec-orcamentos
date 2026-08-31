import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FilePlus2,
  FileText,
  Layers,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import type { ProposalDetail, ProposalSummary } from '../shared/contracts';
import { proposalApi } from './api';

type ProposalsListWorkspaceProps = {
  onOpenProposal: (proposalId: string) => void;
  onNewProposal: () => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const statusLabels: Record<ProposalDetail['status'], string> = {
  draft: 'Em edição',
  review: 'Em revisão',
  sent: 'Enviada',
  approved: 'Aprovada',
  rejected: 'Recusada',
};

const statusClasses: Record<ProposalDetail['status'], string> = {
  draft: 'status-draft',
  review: 'status-review',
  sent: 'status-sent',
  approved: 'status-approved',
  rejected: 'status-rejected',
};

export function ProposalsListWorkspace({
  onOpenProposal,
  onNewProposal,
  onError,
  onNotice,
}: ProposalsListWorkspaceProps) {
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProposalDetail['status']>('all');
  const [sortBy, setSortBy] = useState<'date' | 'number' | 'client' | 'value'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [deletingProposal, setDeletingProposal] = useState<ProposalSummary | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const loadProposals = async () => {
    setLoading(true);
    try {
      const result = await proposalApi.list();
      setProposals(result.proposals);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível carregar a lista de propostas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProposals();
  }, []);

  const handleStatusChange = async (proposalId: string, newStatus: ProposalDetail['status']) => {
    setActionPending(true);
    try {
      await proposalApi.updateStatus(proposalId, newStatus);
      onNotice(`Status da proposta alterado para "${statusLabels[newStatus]}".`);
      await loadProposals();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Erro ao atualizar status da proposta.');
    } finally {
      setActionPending(false);
    }
  };

  const handleClone = async (item: ProposalSummary) => {
    setActionPending(true);
    try {
      const result = await proposalApi.clone(item.id);
      onNotice(`Orçamento ${result.proposal.number} criado com sucesso a partir de ${item.number}.`);
      onOpenProposal(result.proposal.id);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Erro ao clonar o orçamento.');
    } finally {
      setActionPending(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProposal) return;
    setActionPending(true);
    try {
      await proposalApi.delete(deletingProposal.id, 'all');
      onNotice(`Orçamento ${deletingProposal.number} excluído com sucesso.`);
      setDeletingProposal(null);
      await loadProposals();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Erro ao excluir a proposta.');
    } finally {
      setActionPending(false);
    }
  };

  const filteredProposals = useMemo(() => {
    return proposals
      .filter((item) => {
        if (statusFilter !== 'all' && item.status !== statusFilter) return false;
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return (
          item.number.toLowerCase().includes(q) ||
          item.clientName.toLowerCase().includes(q) ||
          item.workName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'date') {
          diff = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        } else if (sortBy === 'number') {
          diff = a.number.localeCompare(b.number);
        } else if (sortBy === 'client') {
          diff = a.clientName.localeCompare(b.clientName);
        } else if (sortBy === 'value') {
          diff = a.totalSale - b.totalSale;
        }
        return sortOrder === 'desc' ? -diff : diff;
      });
  }, [proposals, searchTerm, statusFilter, sortBy, sortOrder]);

  const stats = useMemo(() => {
    const totalCount = proposals.length;
    const inNegotiation = proposals
      .filter((p) => ['draft', 'review', 'sent'].includes(p.status))
      .reduce((sum, p) => sum + p.totalSale, 0);
    const approved = proposals
      .filter((p) => p.status === 'approved')
      .reduce((sum, p) => sum + p.totalSale, 0);
    return { totalCount, inNegotiation, approved };
  }, [proposals]);

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="home-workspace proposals-list-workspace">
      <header className="home-header">
        <div>
          <span className="app-badge">Gestão de Orçamentos</span>
          <h1>Central de Propostas</h1>
          <p>Visualize, filtre, edite o status e gerencie todas as propostas comerciais da Construtec.</p>
        </div>
        <div className="home-header-actions">
          <button
            type="button"
            className="secondary-btn"
            onClick={() => void loadProposals()}
            disabled={loading}
            title="Atualizar lista"
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Atualizar
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={onNewProposal}
          >
            <FilePlus2 size={16} />
            Nova proposta
          </button>
        </div>
      </header>

      <div className="home-body">
        {/* KPI Mini-Bar */}
        <section className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <div className="kpi-card highlight-blue">
            <div className="kpi-icon">
              <FileText size={22} />
            </div>
            <div className="kpi-content">
              <span>Total de Orçamentos</span>
              <strong>{stats.totalCount}</strong>
              <small>Registros no banco local</small>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon" style={{ background: '#fffbeb', color: '#b45309' }}>
              <Clock size={22} />
            </div>
            <div className="kpi-content">
              <span>Em Negociação</span>
              <strong>{money.format(stats.inNegotiation)}</strong>
              <small>Edição, revisão ou enviadas</small>
            </div>
          </div>

          <div className="kpi-card highlight-green">
            <div className="kpi-icon">
              <CheckCircle2 size={22} />
            </div>
            <div className="kpi-content">
              <span>Propostas Aprovadas</span>
              <strong>{money.format(stats.approved)}</strong>
              <small>Fechamento confirmado</small>
            </div>
          </div>
        </section>

        {/* Filter and Search Bar */}
        <div className="proposals-filter-bar">
          <div className="search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Buscar por número (PA-XXXX), cliente ou obra..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button type="button" className="clear-btn" onClick={() => setSearchTerm('')}>
                ×
              </button>
            )}
          </div>

          <div className="filter-chips">
            {(['all', 'draft', 'review', 'sent', 'approved', 'rejected'] as const).map((st) => (
              <button
                key={st}
                type="button"
                className={`filter-chip ${statusFilter === st ? 'active' : ''}`}
                onClick={() => setStatusFilter(st)}
              >
                {st === 'all' ? 'Todas' : statusLabels[st]}
                {st !== 'all' && (
                  <span className="chip-count">
                    {proposals.filter((p) => p.status === st).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Proposals Table */}
        <div className="home-panel table-panel">
          <div className="home-panel-header">
            <div>
              <h3>Lista de Propostas ({filteredProposals.length})</h3>
              <p>Clique em uma proposta para abrir a mesa de edição e composição.</p>
            </div>
          </div>

          {filteredProposals.length === 0 ? (
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
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                  }}
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
                    <th onClick={() => toggleSort('number')} className="sortable-th">
                      <span>Proposta</span>
                      <ArrowUpDown size={14} />
                    </th>
                    <th onClick={() => toggleSort('client')} className="sortable-th">
                      <span>Cliente / Obra</span>
                      <ArrowUpDown size={14} />
                    </th>
                    <th>Itens</th>
                    <th onClick={() => toggleSort('value')} className="sortable-th text-right">
                      <span>Valor Total</span>
                      <ArrowUpDown size={14} />
                    </th>
                    <th>Status</th>
                    <th onClick={() => toggleSort('date')} className="sortable-th">
                      <span>Atualizado em</span>
                      <ArrowUpDown size={14} />
                    </th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProposals.map((item) => (
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
                          onChange={(e) => handleStatusChange(item.id, e.target.value as ProposalDetail['status'])}
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
                          onClick={() => void handleClone(item)}
                        >
                          <Copy size={14} />
                          Clonar
                        </button>
                        <button
                          type="button"
                          className="table-action-btn danger"
                          title="Excluir proposta"
                          disabled={actionPending}
                          onClick={() => setDeletingProposal(item)}
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
      </div>

      {/* Delete Confirmation Modal */}
      {deletingProposal && (
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
                Tem certeza que deseja excluir o orçamento <strong>{deletingProposal.number}</strong> (Cliente: <em>{deletingProposal.clientName}</em>)?
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
                onClick={() => setDeletingProposal(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="danger-btn"
                disabled={actionPending}
                onClick={() => void handleDeleteConfirm()}
              >
                <Trash2 size={16} />
                {actionPending ? 'Excluindo...' : 'Sim, excluir definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
