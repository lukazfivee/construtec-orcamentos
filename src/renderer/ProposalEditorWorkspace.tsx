import { useEffect, useState } from 'react';
import { LayoutList, Plus } from 'lucide-react';
import type { ProposalDetail, ProposalSummary } from '../shared/contracts';
import { proposalApi } from './api';
import { ProposalCommercialConditionsPanel } from './ProposalCommercialConditionsPanel';
import { ProposalHistoryPanel } from './ProposalHistoryPanel';
import { ProposalItemsPanel } from './ProposalItemsPanel';
import { ProposalKitsPanel } from './ProposalKitsPanel';
import { ProposalLaborPanel } from './ProposalLaborPanel';
import { ProposalMetaBar } from './ProposalMetaBar';
import { ProposalSummaryPanel } from './ProposalSummaryPanel';

const sectionTabs = [
  { label: 'Itens', enabled: true },
  { label: 'Mão de obra', enabled: true },
  { label: 'Kits', enabled: true },
  { label: 'Condições', enabled: true },
  { label: 'Histórico', enabled: true },
] as const;

type ActiveSection = typeof sectionTabs[number]['label'];

type Props = {
  proposal: ProposalDetail;
  proposalTabs: ProposalSummary[];
  loading: boolean;
  error: string;
  catalogOpen: boolean;
  setCatalogOpen: (open: boolean | ((current: boolean) => boolean)) => void;
  documentPending: boolean;
  onOpenProposal: (proposalId: string) => Promise<void>;
  onProposalUpdate: (proposal: ProposalDetail) => void;
  onProposalTabsUpdate: (tabs: ProposalSummary[]) => void;
  onViewList: () => void;
  onNewProposal: () => void;
  onManageClients: () => void;
  onCreateRevision: () => void;
  onPreviewProposal: () => void;
  onExportProposal: () => void;
  showNotice: (message: string) => void;
  setError: (error: string) => void;
};

export function ProposalEditorWorkspace({
  proposal,
  proposalTabs,
  loading,
  error,
  catalogOpen,
  setCatalogOpen,
  documentPending,
  onOpenProposal,
  onProposalUpdate,
  onProposalTabsUpdate,
  onViewList,
  onNewProposal,
  onManageClients,
  onCreateRevision,
  onPreviewProposal,
  onExportProposal,
  showNotice,
  setError,
}: Props) {
  const [activeSection, setActiveSection] = useState<ActiveSection>('Itens');
  const [mutationPending, setMutationPending] = useState(false);
  const [laborTotal, setLaborTotal] = useState(0);
  const [bdiDraft, setBdiDraft] = useState<string | null>(null);

  const isEditable = Boolean(proposal.isLatest && (proposal.status === 'draft' || proposal.status === 'review'));
  const proposalLabel = `${proposal.number} • REV.${String(proposal.revision).padStart(2, '0')}`;

  useEffect(() => {
    let active = true;
    void proposalApi
      .labor(proposal.id)
      .then((result) => {
        if (active) setLaborTotal(result.items.reduce((total, item) => total + item.totalCost, 0));
      })
      .catch((laborError: unknown) => {
        if (active) setError(laborError instanceof Error ? laborError.message : 'Não foi possível carregar o total de mão de obra.');
      });
    return () => {
      active = false;
    };
  }, [proposal.id, setError]);

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

  const cloneCurrentProposal = async () => {
    if (mutationPending) return;
    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.clone(proposal.id);
      showNotice(`Orçamento ${result.proposal.number} criado com sucesso a partir de ${proposal.number}.`);
      await reloadProposalTabs();
      await onOpenProposal(result.proposal.id);
    } catch (cloneError) {
      setError(cloneError instanceof Error ? cloneError.message : 'Não foi possível clonar a proposta.');
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
      if (result.nextProposalId) {
        await onOpenProposal(result.nextProposalId);
      } else {
        onViewList();
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Não foi possível excluir a proposta.');
    } finally {
      setMutationPending(false);
    }
  };

  return (
    <main className="workspace">
      <div className="proposal-tabs" role="tablist" aria-label="Propostas abertas">
        <button type="button" className="view-list-tab" onClick={onViewList} title="Ver lista completa de propostas">
          <LayoutList size={15} /> Ver todas ({proposalTabs.length})
        </button>
        <span className="tab-divider" />
        {proposalTabs.map((tab) => {
          const selected = tab.id === proposal.id;
          return (
            <button
              key={tab.id}
              className={selected ? 'selected' : ''}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={loading}
              title={`${tab.clientName} · ${tab.workName}`}
              onClick={() => void onOpenProposal(tab.id)}
            >
              {tab.number} • REV.{String(tab.revision).padStart(2, '0')}
            </button>
          );
        })}
        <button type="button" className="new-tab" onClick={onNewProposal}>
          <Plus size={17} /> Nova proposta
        </button>
      </div>

      <section className="proposal-editor" aria-label={`Editor da proposta ${proposalLabel}`} aria-busy={loading || mutationPending}>
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => void onOpenProposal(proposal.id)}>
              Tentar novamente
            </button>
          </div>
        )}

        <ProposalMetaBar
          proposal={proposal}
          isEditable={isEditable}
          mutationPending={mutationPending}
          setMutationPending={setMutationPending}
          onProposalUpdate={onProposalUpdate}
          onProposalTabsReload={() => void reloadProposalTabs()}
          onManageClients={onManageClients}
          showNotice={showNotice}
          setError={setError}
          setCatalogOpen={(open) => setCatalogOpen(open)}
        />

        <div className="section-tabs" role="tablist" aria-label="Seções da proposta">
          {sectionTabs.map((tab) => (
            <button
              key={tab.label}
              type="button"
              className={activeSection === tab.label ? 'selected' : ''}
              role="tab"
              aria-selected={activeSection === tab.label}
              disabled={!tab.enabled}
              title={tab.enabled ? undefined : `${tab.label} será implementado na próxima etapa.`}
              onClick={() => {
                if (tab.enabled) {
                  setActiveSection(tab.label);
                  setCatalogOpen(false);
                }
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeSection === 'Itens' ? (
          <ProposalItemsPanel
            proposal={proposal}
            isEditable={isEditable}
            mutationPending={mutationPending}
            loading={loading}
            catalogOpen={catalogOpen}
            setCatalogOpen={setCatalogOpen}
            onUpdateProposal={onProposalUpdate}
            showNotice={showNotice}
            setError={setError}
            setMutationPending={setMutationPending}
          />
        ) : activeSection === 'Mão de obra' ? (
          <ProposalLaborPanel
            proposalId={proposal.id}
            editable={isEditable}
            onLaborTotalChange={setLaborTotal}
            onError={setError}
            onNotice={showNotice}
          />
        ) : activeSection === 'Kits' ? (
          <ProposalKitsPanel
            proposalId={proposal.id}
            proposalNumber={proposal.number}
            bdiMultiplier={proposal.bdiMultiplier}
            editable={isEditable}
            onApplied={() => {
              void onOpenProposal(proposal.id);
              setActiveSection('Itens');
            }}
            onError={setError}
            onNotice={showNotice}
          />
        ) : activeSection === 'Condições' ? (
          <ProposalCommercialConditionsPanel
            proposal={proposal}
            editable={isEditable}
            mutationPending={mutationPending}
            onUpdateProposal={onProposalUpdate}
            showNotice={showNotice}
            setError={setError}
            setMutationPending={setMutationPending}
          />
        ) : (
          <ProposalHistoryPanel
            proposal={proposal}
            parentLoading={loading}
            onOpenRevision={(revId) => void onOpenProposal(revId)}
            setError={setError}
          />
        )}
      </section>

      <ProposalSummaryPanel
        proposal={proposal}
        laborTotal={laborTotal}
        isEditable={isEditable}
        mutationPending={mutationPending}
        documentPending={documentPending}
        bdiDraft={bdiDraft}
        setBdiDraft={setBdiDraft}
        onUpdateBdi={() => void updateBdi()}
        onCreateRevision={onCreateRevision}
        onCloneProposal={() => void cloneCurrentProposal()}
        onPreviewProposal={onPreviewProposal}
        onExportProposal={onExportProposal}
        onDeleteProposal={() => void deleteCurrentProposal()}
      />
    </main>
  );
}
