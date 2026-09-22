import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { ProposalDetail } from '../shared/contracts';
import { ProposalCatalogPopover } from './ProposalCatalogPopover';
import { ProposalImportDialog } from './ProposalImportDialog';
import {
  DEFAULT_PROPOSAL_COLUMNS,
  ProposalColumnsPopover,
  type ProposalColumnsVisibility,
} from './ProposalColumnsPopover';
import { ProposalItemsFabMenu } from './ProposalItemsFabMenu';
import { ProposalItemsFilterBar } from './ProposalItemsFilterBar';
import { ProposalItemsQuickSearch, ProposalItemsToolbar } from './ProposalItemsToolbar';
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

  const divergentCount = isEditable
    ? proposal.items.filter((item) => item.catalogCurrentCost !== null && item.catalogCurrentCost !== undefined && Math.abs(item.catalogCurrentCost - item.unitCost) >= 0.01).length
    : 0;

  const hasActiveFilters = Boolean(filterSearch.trim()) || Boolean(filterCategory);
  const visibleColCount = 3 + (columns.code ? 1 : 0) + (columns.unit ? 1 : 0) + (columns.unitCost ? 1 : 0) + (columns.totalCost ? 1 : 0) + (columns.unitSale ? 1 : 0) + (columns.totalSale ? 1 : 0);
  const editingItem = editingItemId ? proposal.items.find((item) => item.id === editingItemId) ?? null : null;

  return (
    <div className="proposal-items-panel">
      <ProposalItemsToolbar
        isEditable={isEditable}
        mutationPending={mutationPending}
        selectedItemIds={selectedItemIds}
        filterBarOpen={filterBarOpen}
        hasActiveFilters={hasActiveFilters}
        moreActionsOpen={moreActionsOpen}
        columnsPopoverOpen={columnsPopoverOpen}
        actions={actions}
        onToggleCatalog={() => setCatalogOpen((v) => !v)}
        onToggleFilterBar={() => setFilterBarOpen((v) => !v)}
        onToggleMoreActions={() => setMoreActionsOpen((v) => !v)}
        onOpenImport={() => setImportDialogOpen(true)}
        onToggleColumnsPopover={() => setColumnsPopoverOpen((v) => !v)}
      />

      <ProposalItemsQuickSearch filterSearch={filterSearch} setFilterSearch={setFilterSearch} />

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

      <ProposalItemsFabMenu
        fabMenuOpen={fabMenuOpen}
        isEditable={isEditable}
        mutationPending={mutationPending}
        onToggleFab={() => setFabMenuOpen((v) => !v)}
        onCloseFab={() => setFabMenuOpen(false)}
        onOpenCatalog={() => setCatalogOpen(true)}
        onOpenFilterBar={() => setFilterBarOpen(true)}
        onOpenImport={() => setImportDialogOpen(true)}
        onOpenColumns={() => setColumnsPopoverOpen(true)}
      />

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
