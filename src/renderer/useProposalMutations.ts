import { useState } from 'react';
import type { ProposalDetail, ProposalSummary } from '../shared/contracts';
import { proposalApi } from './api';

type Options = {
  proposal: ProposalDetail;
  onProposalUpdate: (proposal: ProposalDetail) => void;
  onProposalTabsUpdate: (tabs: ProposalSummary[]) => void;
  onOpenProposal: (proposalId: string) => Promise<void>;
  onViewList: () => void;
  showNotice: (message: string) => void;
  setError: (error: string) => void;
};

export function useProposalMutations({
  proposal,
  onProposalUpdate,
  onProposalTabsUpdate,
  onOpenProposal,
  onViewList,
  showNotice,
  setError,
}: Options) {
  const [mutationPending, setMutationPending] = useState(false);
  const [bdiDraft, setBdiDraft] = useState<string | null>(null);
  const [taxDraft, setTaxDraft] = useState<string | null>(null);

  const reloadProposalTabs = async () => {
    try {
      const tabsResult = await proposalApi.list();
      onProposalTabsUpdate(tabsResult.proposals);
    } catch {
      // Ignorar falha secundária de listagem
    }
  };

  const updateBdi = async () => {
    if (mutationPending) return;
    const nextBdi = Number((bdiDraft ?? String(proposal.bdiMultiplier)).trim().replace(',', '.'));
    if (!Number.isFinite(nextBdi) || nextBdi <= 0 || nextBdi > 100) {
      setBdiDraft(null);
      showNotice('Informe um multiplicador BDI maior que zero.');
      return;
    }
    if (proposal.bdiMultiplier === nextBdi) return;
    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.updateBdi(proposal.id, nextBdi);
      onProposalUpdate(result.proposal);
      setBdiDraft(null);
      showNotice('BDI atualizado e preços de venda recalculados.');
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Não foi possível alterar o BDI.');
    } finally {
      setMutationPending(false);
    }
  };

  const updateTax = async () => {
    if (mutationPending) return;
    const raw = (taxDraft ?? String(proposal.taxPercentage ?? 0)).trim().replace(/%/g, '').replace(',', '.');
    const nextTax = Number(raw);
    if (!Number.isFinite(nextTax) || nextTax < 0 || nextTax > 100) {
      setTaxDraft(null);
      showNotice('Informe uma alíquota de impostos entre 0 e 100%.');
      return;
    }
    if ((proposal.taxPercentage ?? 0) === nextTax) {
      setTaxDraft(null);
      return;
    }
    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.updateTax(proposal.id, nextTax);
      onProposalUpdate(result.proposal);
      setTaxDraft(null);
      showNotice('Alíquota de impostos atualizada.');
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Não foi possível alterar o imposto.');
    } finally {
      setMutationPending(false);
    }
  };

  const deleteCurrentProposal = async () => {
    if (mutationPending) return;
    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.delete(proposal.id, 'all');
      showNotice(`Orçamento ${proposal.number} excluído com sucesso.`);
      await reloadProposalTabs();
      if (result.nextProposalId) await onOpenProposal(result.nextProposalId);
      else onViewList();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Não foi possível excluir a proposta.');
    } finally {
      setMutationPending(false);
    }
  };

  return {
    mutationPending,
    setMutationPending,
    bdiDraft,
    setBdiDraft,
    taxDraft,
    setTaxDraft,
    updateBdi,
    updateTax,
    reloadProposalTabs,
    deleteCurrentProposal,
  };
}
