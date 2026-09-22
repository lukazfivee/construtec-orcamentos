import {
  ChevronDown,
  ChevronUp,
  Copy,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { useProposalItemActions } from './useProposalItemActions';

type ItemActions = ReturnType<typeof useProposalItemActions>;

type QuickSearchProps = {
  filterSearch: string;
  setFilterSearch: (value: string) => void;
};

export function ProposalItemsQuickSearch({ filterSearch, setFilterSearch }: QuickSearchProps) {
  return (
    <div className="proposal-items-quick-search" role="search" aria-label="Buscar item da proposta">
      <Search size={15} className="search-icon" />
      <input
        type="text"
        className="quick-search-input"
        placeholder="Buscar item ou código…"
        value={filterSearch}
        onChange={(e) => setFilterSearch(e.target.value)}
      />
      {filterSearch && (
        <button
          type="button"
          className="filter-clear-input-btn"
          onClick={() => setFilterSearch('')}
          aria-label="Limpar busca"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

type ToolbarProps = {
  isEditable: boolean;
  mutationPending: boolean;
  selectedItemIds: string[];
  filterBarOpen: boolean;
  hasActiveFilters: boolean;
  moreActionsOpen: boolean;
  columnsPopoverOpen: boolean;
  actions: ItemActions;
  onToggleCatalog: () => void;
  onToggleFilterBar: () => void;
  onToggleMoreActions: () => void;
  onOpenImport: () => void;
  onToggleColumnsPopover: () => void;
};

export function ProposalItemsToolbar({
  isEditable,
  mutationPending,
  selectedItemIds,
  filterBarOpen,
  hasActiveFilters,
  moreActionsOpen,
  columnsPopoverOpen,
  actions,
  onToggleCatalog,
  onToggleFilterBar,
  onToggleMoreActions,
  onOpenImport,
  onToggleColumnsPopover,
}: ToolbarProps) {
  const singleItemSelected = selectedItemIds.length === 1;

  return (
    <div className="toolbar" aria-label="Ações dos itens">
      <button className="primary compact insert-toolbar-btn" type="button" disabled={!isEditable || mutationPending} onClick={onToggleCatalog}>
        <Plus size={17} /> Inserir <ChevronDown size={14} />
      </button>
      <button className="bulk-only" type="button" disabled={!isEditable || selectedItemIds.length === 0 || mutationPending} onClick={() => void actions.removeSelectedItems(selectedItemIds)}>
        <Trash2 size={16} /> Excluir
      </button>
      <button
        className={`icon-button filter-toolbar-btn ${filterBarOpen || hasActiveFilters ? 'active' : ''}`}
        aria-label="Filtrar itens"
        type="button"
        onClick={onToggleFilterBar}
        title="Filtrar itens da proposta por código, descrição ou categoria"
      >
        <Filter size={18} />
      </button>
      <span className="toolbar-space" />
      <button
        className={`icon-button toolbar-more-toggle ${moreActionsOpen ? 'active' : ''}`}
        aria-label="Mais ações"
        aria-expanded={moreActionsOpen}
        type="button"
        onClick={onToggleMoreActions}
        title="Mais ações: duplicar, mover, importar e colunas"
      >
        <MoreHorizontal size={18} />
      </button>
      <div className={`toolbar-secondary-group ${moreActionsOpen ? 'open' : ''}`}>
        <button className="bulk-only" type="button" disabled={!isEditable || !singleItemSelected || mutationPending} onClick={() => void actions.duplicateSelectedItem(selectedItemIds)}>
          <Copy size={16} /> Duplicar
        </button>
        <button className="bulk-only" type="button" disabled={!isEditable || !singleItemSelected || mutationPending} onClick={() => void actions.moveSelectedItem(selectedItemIds, 'up')}>
          <ChevronUp size={14} /> Mover
        </button>
        <button className="bulk-only" type="button" disabled={!isEditable || !singleItemSelected || mutationPending} onClick={() => void actions.moveSelectedItem(selectedItemIds, 'down')}>
          <ChevronDown size={14} /> Mover
        </button>
        <button
          type="button"
          disabled={!isEditable || mutationPending}
          onClick={onOpenImport}
          title="Importar itens via planilha (CSV), de outra proposta ou de um kit"
        >
          <Upload size={15} /> Importar
        </button>
        <button
          className={`icon-button ${columnsPopoverOpen ? 'active' : ''}`}
          aria-label="Configurar colunas"
          type="button"
          onClick={onToggleColumnsPopover}
          title="Configurar colunas visíveis da tabela"
        >
          <SlidersHorizontal size={18} />
        </button>
        <button className="icon-button" aria-label="Configurações da tabela (indisponível)" aria-disabled="true" type="button" disabled title="Configurações da tabela serão implementadas em uma próxima etapa.">
          <Settings size={18} />
        </button>
      </div>
    </div>
  );
}
