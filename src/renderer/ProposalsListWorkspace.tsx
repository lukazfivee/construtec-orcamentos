import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  FilePlus2,
  FileText,
  RefreshCw,
  Search,
} from 'lucide-react';
import type { ProposalDetail, ProposalSummary } from '../shared/contracts';
import { proposalApi } from './api';
import { ProposalDeleteModal } from './ProposalDeleteModal';
import { ProposalsListTable } from './ProposalsListTable';

type ProposalsListWorkspaceProps = {
  onOpenProposal: (proposalId: string) => void;
  onNewProposal: () => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const statusLabels: Record<ProposalDetail['status'], string> = {
  draft: 'Em edição',
  review: 'Em revisão',
  sent: 'Enviada',
  approved: 'Aprovada',
  rejected: 'Recusada',
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
        <ProposalsListTable
          proposals={filteredProposals}
          searchTerm={searchTerm}
          statusFilter={statusFilter}
          sortBy={sortBy}
          actionPending={actionPending}
          onToggleSort={toggleSort}
          onOpenProposal={onOpenProposal}
          onStatusChange={handleStatusChange}
          onClone={handleClone}
          onDeleteRequest={setDeletingProposal}
          onClearFilters={() => {
            setSearchTerm('');
            setStatusFilter('all');
          }}
          onNewProposal={onNewProposal}
        />
      </div>

      {/* Delete Confirmation Modal */}
      <ProposalDeleteModal
        proposal={deletingProposal}
        actionPending={actionPending}
        onClose={() => setDeletingProposal(null)}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </div>
  );
}
