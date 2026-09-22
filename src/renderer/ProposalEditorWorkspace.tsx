import { useEffect, useState } from 'react';
import { LayoutList, Plus } from 'lucide-react';
import type { ProposalDetail, ProposalSummary } from '../shared/contracts';
import { proposalApi } from './api';
import { CloneProposalDialog } from './CloneProposalDialog';
import { ProposalExportDialog } from './ProposalExportDialog';
import { ProposalShareDialog } from './ProposalShareDialog';
import { ProposalCommercialConditionsPanel } from './ProposalCommercialConditionsPanel';
import { ProposalHistoryPanel } from './ProposalHistoryPanel';
import { ProposalItemsPanel } from './ProposalItemsPanel';
import { ProposalKitsPanel } from './ProposalKitsPanel';
import { ProposalLaborPanel } from './ProposalLaborPanel';
import { ProposalMetaBar } from './ProposalMetaBar';
import { ProposalMobileSheet } from './ProposalMobileSheet';
import { ProposalSummaryPanel } from './ProposalSummaryPanel';
import { useProposalMutations } from './useProposalMutations';

const sectionTabs = [
  { label: 'Itens', enabled: true }, { label: 'Mão de obra', enabled: true },
  { label: 'Kits', enabled: true }, { label: 'Condições', enabled: true }, { label: 'Histórico', enabled: true },
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
  onNavigateToCentroCustos?: (costCenterId?: number) => void;
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
  onNavigateToCentroCustos,
  showNotice,
  setError,
}: Props) {
  const [activeSection, setActiveSection] = useState<ActiveSection>('Itens');
  const [laborTotal, setLaborTotal] = useState(0);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const {
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
  } = useProposalMutations({
    proposal,
    onProposalUpdate,
    onProposalTabsUpdate,
    onOpenProposal,
    onViewList,
    showNotice,
    setError,
  });

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

      <ProposalMobileSheet
        proposal={proposal}
        proposalTabs={proposalTabs}
        loading={loading}
        isEditable={isEditable}
        mutationPending={mutationPending}
        setMutationPending={setMutationPending}
        onOpenProposal={onOpenProposal}
        onProposalUpdate={onProposalUpdate}
        onProposalTabsReload={() => void reloadProposalTabs()}
        onNewProposal={onNewProposal}
        onManageClients={onManageClients}
        setCatalogOpen={(open) => setCatalogOpen(open)}
        showNotice={showNotice}
        setError={setError}
      />

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
        taxDraft={taxDraft}
        setTaxDraft={setTaxDraft}
        onUpdateTax={() => void updateTax()}
        onCreateRevision={onCreateRevision}
        onCloneProposal={() => setCloneDialogOpen(true)}
        onPreviewProposal={() => setExportDialogOpen(true)}
        onExportProposal={() => setExportDialogOpen(true)}
        onShareProposal={() => setShareDialogOpen(true)}
        onDeleteProposal={() => void deleteCurrentProposal()}
        onProposalUpdate={onProposalUpdate}
        onNavigateToCentroCustos={onNavigateToCentroCustos}
        showNotice={showNotice}
      />

      <CloneProposalDialog
        open={cloneDialogOpen}
        sourceProposal={proposal}
        onClose={() => setCloneDialogOpen(false)}
        onCloned={async (cloned) => {
          showNotice(`Orçamento ${cloned.number} criado com sucesso a partir de ${proposal.number}.`);
          await reloadProposalTabs();
          await onOpenProposal(cloned.id);
        }}
        onError={setError}
      />

      <ProposalExportDialog
        open={exportDialogOpen}
        proposal={proposal}
        onClose={() => setExportDialogOpen(false)}
        onExportSuccess={(files) => {
          showNotice(`Proposta ${proposal.number} exportada com sucesso! (${files.length} arquivo${files.length > 1 ? 's' : ''})`);
        }}
        onError={setError}
      />

      <ProposalShareDialog
        open={shareDialogOpen}
        proposal={proposal}
        onClose={() => setShareDialogOpen(false)}
        onNotice={showNotice}
      />
    </main>
  );
}
