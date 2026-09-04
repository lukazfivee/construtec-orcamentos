import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Filter,
  Plus,
  Settings,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import type { CatalogProduct, ProposalDetail } from '../shared/contracts';
import { proposalApi } from './api';
import { ProposalCatalogPopover } from './ProposalCatalogPopover';
import { ProposalItemsTableRow } from './ProposalItemsTableRow';

const money = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseDecimal = (value: string) => Number(value.trim().replace(',', '.'));
const formatDecimal = (value: number) => String(value).replace('.', ',');

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

  const allSelected = Boolean(proposal.items.length) && selectedItemIds.length === proposal.items.length;
  const singleItemSelected = selectedItemIds.length === 1;

  const addCatalogItem = async (product: CatalogProduct) => {
    if (!isEditable || mutationPending) return;
    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.addItem(proposal.id, product.id);
      onUpdateProposal(result.proposal);
      setCatalogOpen(false);
      showNotice(`${product.description} adicionado com preço congelado.`);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Não foi possível adicionar o item.');
    } finally {
      setMutationPending(false);
    }
  };

  const removeSelectedItems = async () => {
    if (selectedItemIds.length === 0 || mutationPending) return;
    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.removeItems(proposal.id, selectedItemIds);
      onUpdateProposal(result.proposal);
      showNotice(`${selectedItemIds.length} ${selectedItemIds.length === 1 ? 'item removido' : 'itens removidos'}.`);
      setSelectedItemIds([]);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Não foi possível excluir os itens.');
    } finally {
      setMutationPending(false);
    }
  };

  const updateQuantity = async (itemId: string, value: string) => {
    if (mutationPending) return;
    const nextQuantity = parseDecimal(value);
    const currentItem = proposal.items.find((item) => item.id === itemId);
    if (!Number.isFinite(nextQuantity) || nextQuantity <= 0 || nextQuantity > 1_000_000) {
      setQuantityDrafts((current) => ({ ...current, [itemId]: formatDecimal(currentItem?.quantity ?? 1) }));
      showNotice('Informe uma quantidade maior que zero.');
      return;
    }
    if (currentItem?.quantity === nextQuantity) return;
    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.updateQuantity(proposal.id, itemId, nextQuantity);
      onUpdateProposal(result.proposal);
      setQuantityDrafts((current) => ({ ...current, [itemId]: formatDecimal(nextQuantity) }));
      showNotice('Quantidade atualizada e totais recalculados.');
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Não foi possível alterar a quantidade.');
    } finally {
      setMutationPending(false);
    }
  };

  const updateItemText = async (itemId: string, field: 'description' | 'unit', value: string) => {
    if (mutationPending) return;
    const currentItem = proposal.items.find((item) => item.id === itemId);
    const nextValue = value.trim();
    if (!currentItem || currentItem[field] === nextValue) return;
    if (nextValue.length < (field === 'description' ? 2 : 1)) {
      showNotice(field === 'description' ? 'Informe uma descrição válida.' : 'Informe uma unidade válida.');
      return;
    }
    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.updateItem(proposal.id, itemId, { [field]: nextValue });
      onUpdateProposal(result.proposal);
      showNotice('Item atualizado.');
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Não foi possível atualizar o item.');
    } finally {
      setMutationPending(false);
    }
  };

  const updateItemMoney = async (itemId: string, field: 'unitCost' | 'unitSale', value: string) => {
    if (mutationPending) return;
    const currentItem = proposal.items.find((item) => item.id === itemId);
    const nextValue = parseDecimal(value);
    if (!currentItem || currentItem[field] === nextValue) return;
    if (!Number.isFinite(nextValue) || nextValue < 0 || nextValue > 100_000_000) {
      showNotice('Informe um valor válido.');
      return;
    }
    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.updateItem(proposal.id, itemId, { [field]: nextValue });
      onUpdateProposal(result.proposal);
      showNotice('Item atualizado e totais recalculados.');
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Não foi possível atualizar o item.');
    } finally {
      setMutationPending(false);
    }
  };

  const duplicateSelectedItem = async () => {
    if (selectedItemIds.length !== 1 || mutationPending) return;
    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.duplicateItem(proposal.id, selectedItemIds[0]);
      onUpdateProposal(result.proposal);
      setSelectedItemIds([]);
      showNotice('Item duplicado.');
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Não foi possível duplicar o item.');
    } finally {
      setMutationPending(false);
    }
  };

  const moveSelectedItem = async (direction: 'up' | 'down') => {
    if (selectedItemIds.length !== 1 || mutationPending) return;
    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.moveItem(proposal.id, selectedItemIds[0], direction);
      onUpdateProposal(result.proposal);
      showNotice('Item movido.');
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Não foi possível mover o item.');
    } finally {
      setMutationPending(false);
    }
  };

  return (
    <>
      <div className="toolbar" aria-label="Ações dos itens">
        <button className="primary compact" type="button" disabled={!isEditable || mutationPending} onClick={() => setCatalogOpen((v) => !v)}>
          <Plus size={17} /> Inserir <ChevronDown size={14} />
        </button>
        <button type="button" disabled={!isEditable || selectedItemIds.length === 0 || mutationPending} onClick={() => void removeSelectedItems()}>
          <Trash2 size={16} /> Excluir
        </button>
        <button type="button" disabled={!isEditable || !singleItemSelected || mutationPending} onClick={() => void duplicateSelectedItem()}>
          <Copy size={16} /> Duplicar
        </button>
        <button type="button" disabled={!isEditable || !singleItemSelected || mutationPending} onClick={() => void moveSelectedItem('up')}>
          <ChevronUp size={14} /> Mover
        </button>
        <button type="button" disabled={!isEditable || !singleItemSelected || mutationPending} onClick={() => void moveSelectedItem('down')}>
          <ChevronDown size={14} /> Mover
        </button>
        <span className="toolbar-space" />
        <button type="button" aria-disabled="true" disabled title="Importação será implementada em uma próxima etapa.">
          Importar <ChevronDown size={14} />
        </button>
        <button className="icon-button" aria-label="Configurar colunas (indisponível)" aria-disabled="true" type="button" disabled title="Configuração de colunas será implementada em uma próxima etapa.">
          <SlidersHorizontal size={18} />
        </button>
        <button className="icon-button" aria-label="Filtrar itens (indisponível)" aria-disabled="true" type="button" disabled title="Filtro de itens será implementado em uma próxima etapa.">
          <Filter size={18} />
        </button>
        <button className="icon-button" aria-label="Configurações da tabela (indisponível)" aria-disabled="true" type="button" disabled title="Configurações da tabela serão implementadas em uma próxima etapa.">
          <Settings size={18} />
        </button>
      </div>

      <div className="table-region">
        <table>
          <thead>
            <tr>
              <th aria-label="Selecionar">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos os itens"
                  checked={allSelected}
                  disabled={!isEditable}
                  onChange={() => setSelectedItemIds(allSelected ? [] : proposal.items.map((item) => item.id))}
                />
              </th>
              <th>#</th>
              <th>Código</th>
              <th>Descrição</th>
              <th>Quantidade</th>
              <th>Unid.</th>
              <th>Custo unit. (R$)</th>
              <th>Custo total (R$)</th>
              <th>Venda unit. (R$)</th>
              <th>Venda total (R$)</th>
            </tr>
          </thead>
          <tbody>
            {proposal.items.map((item, index) => (
              <ProposalItemsTableRow
                key={item.id}
                item={item}
                index={index}
                isSelected={selectedItemIds.includes(item.id)}
                isEditable={isEditable}
                mutationPending={mutationPending}
                quantityDraft={quantityDrafts[item.id]}
                onToggleSelect={(id) => setSelectedItemIds((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id])}
                onQuantityDraftChange={(id, val) => setQuantityDrafts((curr) => ({ ...curr, [id]: val }))}
                onQuantityDraftBlur={(id, val) => void updateQuantity(id, val)}
                onUpdateText={(id, field, val) => void updateItemText(id, field, val)}
                onUpdateMoney={(id, field, val) => void updateItemMoney(id, field, val)}
              />
            ))}
            {!loading && proposal.items.length === 0 && (
              <tr className="empty-row">
                <td colSpan={10}>Nenhum item nesta proposta. Use “Inserir” para pesquisar no catálogo local.</td>
              </tr>
            )}
            {loading && (
              <tr className="empty-row">
                <td colSpan={10}>Carregando dados locais…</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>
                {proposal.items.length} {proposal.items.length === 1 ? 'item' : 'itens'}
              </td>
              <td colSpan={4} />
              <td className="number">{money.format(proposal.totals.cost ?? 0)}</td>
              <td />
              <td className="number">{money.format(proposal.totals.sale ?? 0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <button className="add-line" type="button" disabled={!isEditable || mutationPending} onClick={() => setCatalogOpen(true)}>
        <Plus size={16} /> Adicionar linha <kbd>Ctrl+I</kbd>
      </button>

      {catalogOpen && (
        <ProposalCatalogPopover
          isEditable={isEditable}
          mutationPending={mutationPending}
          onSelectItem={(item) => void addCatalogItem(item)}
          onClose={() => setCatalogOpen(false)}
          setError={setError}
        />
      )}
    </>
  );
}
