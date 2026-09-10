import type { CatalogProduct, ProposalDetail } from '../shared/contracts';
import { proposalApi } from './api';

const parseDecimal = (value: string) => Number(value.trim().replace(',', '.'));
const formatDecimal = (value: number) => String(value).replace('.', ',');

type Options = {
  proposal: ProposalDetail;
  isEditable: boolean;
  mutationPending: boolean;
  onUpdateProposal: (proposal: ProposalDetail) => void;
  showNotice: (message: string) => void;
  setError: (error: string) => void;
  setMutationPending: (pending: boolean) => void;
  setQuantityDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setSelectedItemIds: React.Dispatch<React.SetStateAction<string[]>>;
  setCatalogOpen: (open: boolean | ((current: boolean) => boolean)) => void;
};

export function useProposalItemActions({
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
}: Options) {
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

  const removeSelectedItems = async (selectedItemIds: string[]) => {
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

  const duplicateSelectedItem = async (selectedItemIds: string[]) => {
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

  const moveSelectedItem = async (selectedItemIds: string[], direction: 'up' | 'down') => {
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

  return {
    addCatalogItem,
    removeSelectedItems,
    updateQuantity,
    updateItemText,
    updateItemMoney,
    duplicateSelectedItem,
    moveSelectedItem,
  };
}
