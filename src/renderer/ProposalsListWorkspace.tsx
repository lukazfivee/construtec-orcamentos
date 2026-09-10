import { useEffect, useMemo, useState } from 'react';
import {
  FilePlus2,
  RefreshCw,
} from 'lucide-react';
import type { ProposalDetail, ProposalSummary } from '../shared/contracts';
import { proposalApi } from './api';
import { CloneProposalDialog } from './CloneProposalDialog';
import { ProposalDeleteModal } from './ProposalDeleteModal';
import { ProposalExportDialog } from './ProposalExportDialog';
import { ProposalExtendValidityDialog } from './ProposalExtendValidityDialog';
import { ProposalShareDialog } from './ProposalShareDialog';
import type {
  DateFilterOption,
  ValueFilterOption} from './ProposalsListFilterBar';
import {
  matchesDateFilter,
  matchesValueFilter,
  ProposalsListFilterBar
} from './ProposalsListFilterBar';
import { ProposalsListFooterSummary } from './ProposalsListFooterSummary';
import { ProposalsListKpiBar } from './ProposalsListKpiBar';
import { ProposalsListTable } from './ProposalsListTable';
import { exportProposalsToCsv } from './proposalsListExport';
import {
  filterProposalsByValidity,
  type ValidityFilterOption,
} from './proposalValidityHelpers';

type ProposalsListWorkspaceProps = {
  onOpenProposal: (proposalId: string) => void;
  onNewProposal: () => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
};

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
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('all');
  const [valueFilter, setValueFilter] = useState<ValueFilterOption>('all');
  const [validityFilter, setValidityFilter] = useState<ValidityFilterOption>('all');
  const [sortBy, setSortBy] = useState<'date' | 'number' | 'client' | 'value'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [deletingProposal, setDeletingProposal] = useState<ProposalSummary | null>(null);
  const [cloningProposal, setCloningProposal] = useState<ProposalSummary | null>(null);
  const [exportingProposal, setExportingProposal] = useState<ProposalDetail | null>(null);
  const [sharingProposal, setSharingProposal] = useState<ProposalDetail | null>(null);
  const [extendingProposal, setExtendingProposal] = useState<ProposalSummary | null>(null);
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

  const handleExport = async (item: ProposalSummary) => {
    setActionPending(true);
    try {
      const detail = await proposalApi.byId(item.id);
      setExportingProposal(detail.proposal);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Erro ao carregar proposta para exportação.');
    } finally {
      setActionPending(false);
    }
  };

  const handleShare = async (item: ProposalSummary) => {
    setActionPending(true);
    try {
      const detail = await proposalApi.byId(item.id);
      setSharingProposal(detail.proposal);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Erro ao carregar proposta para compartilhamento.');
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

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDateFilter('all');
    setValueFilter('all');
    setValidityFilter('all');
  };

  const handleExportCsv = () => {
    const success = exportProposalsToCsv(filteredProposals);
    if (success) {
      onNotice(`Exportadas ${filteredProposals.length} propostas em formato CSV com sucesso.`);
    } else {
      onError('Nenhuma proposta disponível para exportação.');
    }
  };

  const filteredProposals = useMemo(() => {
    const byValidity = filterProposalsByValidity(proposals, validityFilter);
    return byValidity
      .filter((item) => {
        if (statusFilter !== 'all' && item.status !== statusFilter) return false;
        if (!matchesDateFilter(item.updatedAt, dateFilter)) return false;
        if (!matchesValueFilter(item.totalSale, valueFilter)) return false;
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
  }, [proposals, searchTerm, statusFilter, dateFilter, valueFilter, validityFilter, sortBy, sortOrder]);

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
        <ProposalsListKpiBar stats={stats} />

        {/* Filter and Search Bar Component */}
        <ProposalsListFilterBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          dateFilter={dateFilter}
          onDateFilterChange={setDateFilter}
          valueFilter={valueFilter}
          onValueFilterChange={setValueFilter}
          validityFilter={validityFilter}
          onValidityFilterChange={setValidityFilter}
          proposals={proposals}
          filteredCount={filteredProposals.length}
          onClearFilters={handleClearFilters}
          onExportCsv={handleExportCsv}
        />

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
          onClone={(item) => setCloningProposal(item)}
          onExport={(item) => void handleExport(item)}
          onShare={(item) => void handleShare(item)}
          onExtendValidity={(item) => setExtendingProposal(item)}
          onDeleteRequest={setDeletingProposal}
          onClearFilters={handleClearFilters}
          onNewProposal={onNewProposal}
        />

        {/* Portfolio Summary Footer Bar */}
        <ProposalsListFooterSummary
          filteredProposals={filteredProposals}
          totalCount={proposals.length}
        />
      </div>

      {/* Delete Confirmation Modal */}
      <ProposalDeleteModal
        proposal={deletingProposal}
        actionPending={actionPending}
        onClose={() => setDeletingProposal(null)}
        onConfirm={() => void handleDeleteConfirm()}
      />

      {/* Clone Proposal Dialog */}
      <CloneProposalDialog
        open={Boolean(cloningProposal)}
        sourceProposal={cloningProposal}
        onClose={() => setCloningProposal(null)}
        onCloned={(cloned) => {
          setCloningProposal(null);
          onNotice(`Orçamento ${cloned.number} criado com sucesso.`);
          onOpenProposal(cloned.id);
        }}
        onError={onError}
      />

      {/* Export Proposal Dialog */}
      <ProposalExportDialog
        open={Boolean(exportingProposal)}
        proposal={exportingProposal}
        onClose={() => setExportingProposal(null)}
        onExportSuccess={(files) => {
          onNotice(`Proposta exportada com sucesso! (${files.length} arquivo${files.length > 1 ? 's' : ''})`);
          setExportingProposal(null);
        }}
        onError={onError}
      />

      {/* Share Proposal Dialog */}
      <ProposalShareDialog
        open={Boolean(sharingProposal)}
        proposal={sharingProposal}
        onClose={() => setSharingProposal(null)}
        onNotice={onNotice}
      />

      {/* Extend Validity Dialog */}
      <ProposalExtendValidityDialog
        open={Boolean(extendingProposal)}
        proposal={extendingProposal}
        onClose={() => setExtendingProposal(null)}
        onSuccess={() => {
          onNotice('Validade da proposta prorrogada com sucesso.');
          setExtendingProposal(null);
          void loadProposals();
        }}
        onError={onError}
      />
    </div>
  );
}
