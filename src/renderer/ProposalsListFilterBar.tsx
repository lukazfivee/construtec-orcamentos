import {
  Calendar,
  Clock,
  DollarSign,
  Download,
  FilterX,
  Search,
  X,
} from 'lucide-react';
import type { ProposalDetail, ProposalSummary } from '../shared/contracts';
import type { ValidityFilterOption } from './proposalValidityHelpers';

export type DateFilterOption = 'all' | 'today' | 'month' | 'last30' | 'year';
export type ValueFilterOption = 'all' | 'under10k' | '10k-50k' | '50k-100k' | 'above100k';

type ProposalsListFilterBarProps = {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: 'all' | ProposalDetail['status'];
  onStatusChange: (status: 'all' | ProposalDetail['status']) => void;
  dateFilter: DateFilterOption;
  onDateFilterChange: (option: DateFilterOption) => void;
  valueFilter: ValueFilterOption;
  onValueFilterChange: (option: ValueFilterOption) => void;
  validityFilter: ValidityFilterOption;
  onValidityFilterChange: (option: ValidityFilterOption) => void;
  proposals: ProposalSummary[];
  filteredCount: number;
  onClearFilters: () => void;
  onExportCsv: () => void;
};

const statusLabels: Record<ProposalDetail['status'], string> = {
  draft: 'Em edição',
  review: 'Em revisão',
  sent: 'Enviada',
  approved: 'Aprovada',
  rejected: 'Recusada',
};

const statusList: ProposalDetail['status'][] = ['draft', 'review', 'sent', 'approved', 'rejected'];

export function ProposalsListFilterBar({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  dateFilter,
  onDateFilterChange,
  valueFilter,
  onValueFilterChange,
  validityFilter,
  onValidityFilterChange,
  proposals,
  filteredCount,
  onClearFilters,
  onExportCsv,
}: ProposalsListFilterBarProps) {
  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
    statusFilter !== 'all' ||
    dateFilter !== 'all' ||
    valueFilter !== 'all' ||
    validityFilter !== 'all'
  );

  return (
    <div className="proposals-filter-bar-container">
      {/* Row 1: Search, Dropdown Selectors and Action Buttons */}
      <div className="proposals-filter-top-row">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por número (PA-XXXX), cliente ou obra..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className="clear-btn"
              onClick={() => onSearchChange('')}
              title="Limpar busca"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="filter-select-group">
          {/* Validity Filter */}
          <div className="filter-select-wrapper" title="Filtrar por prazo de validade">
            <Clock size={14} className="filter-select-icon" />
            <select
              className="filter-select"
              value={validityFilter}
              onChange={(e) => onValidityFilterChange(e.target.value as ValidityFilterOption)}
            >
              <option value="all">Todas as validades</option>
              <option value="expiringSoon">⏳ Vencendo em breve (3d)</option>
              <option value="expired">⚠️ Vencidas</option>
              <option value="valid">✅ No prazo</option>
              <option value="none">Sem validade</option>
            </select>
          </div>

          {/* Date Period Filter */}
          <div className="filter-select-wrapper" title="Filtrar por data de atualização">
            <Calendar size={14} className="filter-select-icon" />
            <select
              className="filter-select"
              value={dateFilter}
              onChange={(e) => onDateFilterChange(e.target.value as DateFilterOption)}
            >
              <option value="all">Todas as datas</option>
              <option value="today">Hoje</option>
              <option value="month">Este mês</option>
              <option value="last30">Últimos 30 dias</option>
              <option value="year">Este ano</option>
            </select>
          </div>

          {/* Value Range Filter */}
          <div className="filter-select-wrapper" title="Filtrar por valor da proposta">
            <DollarSign size={14} className="filter-select-icon" />
            <select
              className="filter-select"
              value={valueFilter}
              onChange={(e) => onValueFilterChange(e.target.value as ValueFilterOption)}
            >
              <option value="all">Todas as faixas</option>
              <option value="under10k">Até R$ 10.000</option>
              <option value="10k-50k">R$ 10.000 a R$ 50.000</option>
              <option value="50k-100k">R$ 50.000 a R$ 100.000</option>
              <option value="above100k">Acima de R$ 100.000</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              className="clear-filters-btn"
              onClick={onClearFilters}
              title="Restaurar todos os filtros"
            >
              <FilterX size={14} />
              Limpar filtros
            </button>
          )}

          {/* Export CSV Button */}
          <button
            type="button"
            className="btn-export-csv"
            onClick={onExportCsv}
            disabled={filteredCount === 0}
            title={filteredCount === 0 ? 'Nenhuma proposta para exportar' : `Exportar ${filteredCount} propostas em planilha CSV`}
          >
            <Download size={14} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Row 2: Status Chips */}
      <div className="filter-chips">
        <button
          type="button"
          className={`filter-chip ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => onStatusChange('all')}
        >
          Todas
          <span className="chip-count">{proposals.length}</span>
        </button>

        {statusList.map((st) => {
          const count = proposals.filter((p) => p.status === st).length;
          return (
            <button
              key={st}
              type="button"
              className={`filter-chip ${statusFilter === st ? 'active' : ''}`}
              onClick={() => onStatusChange(st)}
            >
              {statusLabels[st]}
              <span className="chip-count">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function matchesDateFilter(updatedAt: string, dateFilter: DateFilterOption): boolean {
  if (dateFilter === 'all') return true;
  const itemDate = new Date(updatedAt);
  const now = new Date();
  if (dateFilter === 'today') return itemDate.toDateString() === now.toDateString();
  if (dateFilter === 'month') {
    return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
  }
  if (dateFilter === 'last30') {
    return itemDate.getTime() >= now.getTime() - 30 * 24 * 60 * 60 * 1000;
  }
  if (dateFilter === 'year') return itemDate.getFullYear() === now.getFullYear();
  return true;
}

export function matchesValueFilter(totalSale: number, valueFilter: ValueFilterOption): boolean {
  if (valueFilter === 'all') return true;
  if (valueFilter === 'under10k') return totalSale < 10000;
  if (valueFilter === '10k-50k') return totalSale >= 10000 && totalSale <= 50000;
  if (valueFilter === '50k-100k') return totalSale > 50000 && totalSale <= 100000;
  if (valueFilter === 'above100k') return totalSale > 100000;
  return true;
}

