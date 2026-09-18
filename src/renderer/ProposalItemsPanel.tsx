import { useMemo, useState } from 'react';
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
import type { ProposalDetail } from '../shared/contracts';
import { ProposalCatalogPopover } from './ProposalCatalogPopover';
import { ProposalImportDialog } from './ProposalImportDialog';
import {
  DEFAULT_PROPOSAL_COLUMNS,
  ProposalColumnsPopover,
  type ProposalColumnsVisibility,
} from './ProposalColumnsPopover';
import { ProposalItemsFilterBar } from './ProposalItemsFilterBar';
import { ProposalItemsTableRow } from './ProposalItemsTableRow';
import { ProposalItemCard } from './ProposalItemCard';
import { ProposalItemEditSheet } from './ProposalItemEditSheet';
import { useProposalItemActions } from './useProposalItemActions';

const money = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const COLUMNS_STORAGE_KEY = 'construtec.proposal.columns';

const loadSavedColumns = (): ProposalColumnsVisibility => {
  try {
    const raw = localStorage.getItem(COLUMNS_STORAGE_KEY);
    return raw ? { ...DEFAULT_PROPOSAL_COLUMNS, ...JSON.parse(raw) } : DEFAULT_PROPOSAL_COLUMNS;
  } catch {
    return DEFAULT_PROPOSAL_COLUMNS;
  }
};

type Props = {
  proposal: ProposalDetail;
  isEditable: boolean;
  mutationPending: boolean;
  loading: boolean;
  catalogOpen: boolean;
  setCatalogOpen: (open: boolean | ((current: boolean) => boolean)) => void;
  onUpdateProposal: (proposal: ProposalDetail) => void;
  showNotice: (message: string) => void;
  setError: (error: string) => void;
  setMutationPending: (pending: boolean) => void;
};

export function ProposalItemsPanel({
  proposal,
  isEditable,
  mutationPending,
  loading,
  catalogOpen,
  setCatalogOpen,
  onUpdateProposal,
  showNotice,
  setError,
  setMutationPending,
}: Props) {
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [columns, setColumns] = useState<ProposalColumnsVisibility>(loadSavedColumns);
  const [columnsPopoverOpen, setColumnsPopoverOpen] = useState(false);
  const [filterBarOpen, setFilterBarOpen] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [peekedCardId, setPeekedCardId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);

  const actions = useProposalItemActions({
    proposal,
    isEditable,
    mutationPending,
    onUpdateProposal,
    showNotice,
    setError,
    setMutationPending,
    setQuantityDrafts,
    setSelectedItemIds,
    setCatalogOpen,
  });

  const handleColumnsChange = (next: ProposalColumnsVisibility) => {
    setColumns(next);
    try {
      localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const categories = useMemo(
    () => Array.from(new Set(proposal.items.map((it) => it.category || 'Geral'))).sort(),
    [proposal.items]
  );

  const filteredItems = useMemo(() => {
    let items = proposal.items;
    if (filterCategory) {
      items = items.filter((it) => (it.category || 'Geral') === filterCategory);
    }
    if (filterSearch.trim()) {
      const term = filterSearch.trim().toLowerCase();
      items = items.filter((it) =>
        it.code.toLowerCase().includes(term) ||
        it.description.toLowerCase().includes(term)
      );
    }
    return items;
  }, [proposal.items, filterCategory, filterSearch]);

  const allSelected = Boolean(filteredItems.length) && selectedItemIds.length === filteredItems.length;
  const singleItemSelected = selectedItemIds.length === 1;

  const divergentCount = isEditable
    ? proposal.items.filter((item) => item.catalogCurrentCost !== null && item.catalogCurrentCost !== undefined && Math.abs(item.catalogCurrentCost - item.unitCost) >= 0.01).length
    : 0;

  const hasActiveFilters = Boolean(filterSearch.trim()) || Boolean(filterCategory);
  const visibleColCount = 3 + (columns.code ? 1 : 0) + (columns.unit ? 1 : 0) + (columns.unitCost ? 1 : 0) + (columns.totalCost ? 1 : 0) + (columns.unitSale ? 1 : 0) + (columns.totalSale ? 1 : 0);
  const editingItem = editingItemId ? proposal.items.find((item) => item.id === editingItemId) ?? null : null;

  return (
    <div className="proposal-items-panel">
      <div className="toolbar" aria-label="Ações dos itens">
        <button className="primary compact insert-toolbar-btn" type="button" disabled={!isEditable || mutationPending} onClick={() => setCatalogOpen((v) => !v)}>
          <Plus size={17} /> Inserir <ChevronDown size={14} />
        </button>
        <button className="bulk-only" type="button" disabled={!isEditable || selectedItemIds.length === 0 || mutationPending} onClick={() => void actions.removeSelectedItems(selectedItemIds)}>
          <Trash2 size={16} /> Excluir
        </button>
        <button
          className={`icon-button filter-toolbar-btn ${filterBarOpen || hasActiveFilters ? 'active' : ''}`}
          aria-label="Filtrar itens"
          type="button"
          onClick={() => setFilterBarOpen((v) => !v)}
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
          onClick={() => setMoreActionsOpen((v) => !v)}
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
            onClick={() => setImportDialogOpen(true)}
            title="Importar itens via planilha (CSV), de outra proposta ou de um kit"
          >
            <Upload size={15} /> Importar
          </button>
          <button
            className={`icon-button ${columnsPopoverOpen ? 'active' : ''}`}
            aria-label="Configurar colunas"
            type="button"
            onClick={() => setColumnsPopoverOpen((v) => !v)}
            title="Configurar colunas visíveis da tabela"
          >
            <SlidersHorizontal size={18} />
          </button>
          <button className="icon-button" aria-label="Configurações da tabela (indisponível)" aria-disabled="true" type="button" disabled title="Configurações da tabela serão implementadas em uma próxima etapa.">
            <Settings size={18} />
          </button>
        </div>
      </div>

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

      <ProposalColumnsPopover
        open={columnsPopoverOpen}
        onClose={() => setColumnsPopoverOpen(false)}
        columns={columns}
        onChangeColumns={handleColumnsChange}
      />

      <ProposalItemsFilterBar
        open={filterBarOpen}
        searchTerm={filterSearch}
        onSearchTermChange={setFilterSearch}
        selectedCategory={filterCategory}
        onSelectedCategoryChange={setFilterCategory}
        categories={categories}
        filteredCount={filteredItems.length}
        totalCount={proposal.items.length}
        onClearFilters={() => {
          setFilterSearch('');
          setFilterCategory('');
        }}
        onClose={() => setFilterBarOpen(false)}
      />

      {divergentCount > 0 && (
        <div className="proposal-divergence-banner" role="status">
          <span><b>Atenção ao custo:</b> {divergentCount} item(ns) possuem valor atualizado no catálogo. Clique no indicador ao lado do custo para sincronizar.</span>
        </div>
      )}

      <div className="table-region">
        <table className="proposal-items-table">
          <thead>
            <tr>
              <th className="col-select" aria-label="Selecionar">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos os itens"
                  checked={allSelected}
                  disabled={!isEditable}
                  onChange={() => setSelectedItemIds(allSelected ? [] : filteredItems.map((item) => item.id))}
                />
              </th>
              <th className="col-index">#</th>
              {columns.code && <th className="col-code">Código</th>}
              <th className="col-description">Descrição</th>
              <th className="col-quantity">Quantidade</th>
              {columns.unit && <th className="col-unit">Unid.</th>}
              {columns.unitCost && <th className="col-cost">Custo unit. (R$)</th>}
              {columns.totalCost && <th className="col-total-cost">Custo total (R$)</th>}
              {columns.unitSale && <th className="col-sale">Venda unit. (R$)</th>}
              {columns.totalSale && <th className="col-total-sale">Venda total (R$)</th>}
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item, index) => (
              <ProposalItemsTableRow
                key={item.id}
                item={item}
                index={index}
                columns={columns}
                isSelected={selectedItemIds.includes(item.id)}
                isEditable={isEditable}
                mutationPending={mutationPending}
                quantityDraft={quantityDrafts[item.id]}
                onToggleSelect={(id) => setSelectedItemIds((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id])}
                onQuantityDraftChange={(id, val) => setQuantityDrafts((curr) => ({ ...curr, [id]: val }))}
                onQuantityDraftBlur={(id, val) => void actions.updateQuantity(id, val)}
                onUpdateText={(id, field, val) => void actions.updateItemText(id, field, val)}
                onUpdateMoney={(id, field, val) => void actions.updateItemMoney(id, field, val)}
              />
            ))}
            {!loading && proposal.items.length > 0 && filteredItems.length === 0 && (
              <tr className="empty-row">
                <td colSpan={visibleColCount}>
                  Nenhum item corresponde ao filtro aplicado.{' '}
                  <button type="button" className="filter-inline-clear-btn" onClick={() => { setFilterSearch(''); setFilterCategory(''); }}>
                    Limpar filtro
                  </button>
                </td>
              </tr>
            )}
            {!loading && proposal.items.length === 0 && (
              <tr className="empty-row">
                <td colSpan={visibleColCount}>Nenhum item nesta proposta. Use “Inserir” para pesquisar no catálogo local.</td>
              </tr>
            )}
            {loading && (
              <tr className="empty-row">
                <td colSpan={visibleColCount}>Carregando dados locais…</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className="col-select" />
              <td className="col-index" />
              {columns.code && <td className="col-code" />}
              <td className="col-description">
                <b>{filteredItems.length}</b> {filteredItems.length === 1 ? 'item' : 'itens'}
                {hasActiveFilters && ` (de ${proposal.items.length})`}
              </td>
              <td className="col-quantity" />
              {columns.unit && <td className="col-unit" />}
              {columns.unitCost && <td className="col-cost" />}
              {columns.totalCost && (
                <td className="number col-total-cost">
                  <b>{money.format(proposal.totals.cost ?? 0)}</b>
                </td>
              )}
              {columns.unitSale && <td className="col-sale" />}
              {columns.totalSale && (
                <td className="number col-total-sale">
                  <b>{money.format(proposal.totals.sale ?? 0)}</b>
                </td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>

      <ul className="proposal-items-cards">
        {filteredItems.map((item) => (
          <ProposalItemCard
            key={item.id}
            item={item}
            isEditable={isEditable}
            mutationPending={mutationPending}
            peeked={peekedCardId === item.id}
            onPeek={() => setPeekedCardId(item.id)}
            onClosePeek={() => setPeekedCardId((curr) => (curr === item.id ? null : curr))}
            onOpenEdit={() => setEditingItemId(item.id)}
            onDuplicate={() => { setPeekedCardId(null); void actions.duplicateSelectedItem([item.id]); }}
            onDelete={() => { setPeekedCardId(null); void actions.removeSelectedItems([item.id]); }}
          />
        ))}
        {!loading && proposal.items.length > 0 && filteredItems.length === 0 && (
          <li className="proposal-items-cards-empty">
            Nenhum item corresponde ao filtro aplicado.{' '}
            <button type="button" className="filter-inline-clear-btn" onClick={() => { setFilterSearch(''); setFilterCategory(''); }}>
              Limpar filtro
            </button>
          </li>
        )}
        {!loading && proposal.items.length === 0 && (
          <li className="proposal-items-cards-empty">Nenhum item nesta proposta. Toque no + para pesquisar no catálogo local.</li>
        )}
        {loading && <li className="proposal-items-cards-empty">Carregando dados locais…</li>}
      </ul>

      {fabMenuOpen && (
        <div className="proposal-items-fab-backdrop" onClick={() => setFabMenuOpen(false)} />
      )}

      {fabMenuOpen && (
        <div className="proposal-items-fab-menu" role="menu" aria-label="Ações da lista de itens">
          <button
            type="button"
            role="menuitem"
            disabled={!isEditable || mutationPending}
            onClick={() => { setCatalogOpen(true); setFabMenuOpen(false); }}
          >
            <Search size={16} /> Inserir do catálogo
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => { setFilterBarOpen(true); setFabMenuOpen(false); }}
          >
            <Filter size={16} /> Filtrar por categoria
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!isEditable || mutationPending}
            onClick={() => { setImportDialogOpen(true); setFabMenuOpen(false); }}
          >
            <Upload size={16} /> Importar itens
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => { setColumnsPopoverOpen(true); setFabMenuOpen(false); }}
          >
            <SlidersHorizontal size={16} /> Configurar colunas
          </button>
        </div>
      )}

      <button
        className="proposal-items-fab"
        type="button"
        aria-label={fabMenuOpen ? 'Fechar ações' : 'Ações da lista de itens'}
        aria-expanded={fabMenuOpen}
        onClick={() => setFabMenuOpen((v) => !v)}
      >
        {fabMenuOpen ? <X size={24} /> : <Plus size={24} />}
      </button>

      {editingItem && (
        <ProposalItemEditSheet
          item={editingItem}
          isEditable={isEditable}
          mutationPending={mutationPending}
          onClose={() => setEditingItemId(null)}
          onUpdateText={(id, field, val) => void actions.updateItemText(id, field, val)}
          onUpdateMoney={(id, field, val) => void actions.updateItemMoney(id, field, val)}
          onUpdateQuantity={(id, val) => void actions.updateQuantity(id, val)}
          onDuplicate={() => { void actions.duplicateSelectedItem([editingItem.id]); setEditingItemId(null); }}
          onDelete={() => { void actions.removeSelectedItems([editingItem.id]); setEditingItemId(null); }}
        />
      )}

      <button className="add-line" type="button" disabled={!isEditable || mutationPending} onClick={() => setCatalogOpen(true)}>
        <Plus size={16} /> Adicionar linha <kbd>Ctrl+I</kbd>
      </button>

      {catalogOpen && (
        <ProposalCatalogPopover
          isEditable={isEditable}
          mutationPending={mutationPending}
          onSelectItem={(item) => void actions.addCatalogItem(item)}
          onClose={() => setCatalogOpen(false)}
          setError={setError}
        />
      )}

      <ProposalImportDialog
        open={importDialogOpen}
        proposal={proposal}
        onClose={() => setImportDialogOpen(false)}
        onProposalUpdated={onUpdateProposal}
        onNotice={showNotice}
        onError={setError}
      />
    </div>
  );
}
