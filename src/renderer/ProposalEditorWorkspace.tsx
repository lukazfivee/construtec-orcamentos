import { useEffect, useState } from 'react';
import { ChevronDown, LayoutList, Plus, X } from 'lucide-react';
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
import { ProposalSummaryPanel } from './ProposalSummaryPanel';

const sectionTabs = [
  { label: 'Itens', enabled: true }, { label: 'Mão de obra', enabled: true },
  { label: 'Kits', enabled: true }, { label: 'Condições', enabled: true }, { label: 'Histórico', enabled: true },
] as const;
type ActiveSection = typeof sectionTabs[number]['label'];

const mobileStatusLabels: Record<ProposalDetail['status'], string> = {
  draft: 'Em edição',
  review: 'Em revisão',
  sent: 'Enviada',
  approved: 'Aprovada',
  rejected: 'Recusada',
};

const mobileStatusClasses: Record<ProposalDetail['status'], string> = {
  draft: 'status-draft',
  review: 'status-review',
  sent: 'status-sent',
  approved: 'status-approved',
  rejected: 'status-rejected',
};

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
  onPreviewProposal,
  onExportProposal,
  onNavigateToCentroCustos,
  showNotice,
  setError,
}: Props) {
  const [activeSection, setActiveSection] = useState<ActiveSection>('Itens');
  const [mobileHeaderOpen, setMobileHeaderOpen] = useState(false);
  const [mutationPending, setMutationPending] = useState(false);
  const [laborTotal, setLaborTotal] = useState(0);
  const [bdiDraft, setBdiDraft] = useState<string | null>(null);
  const [taxDraft, setTaxDraft] = useState<string | null>(null);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

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

      {/* Mobile: abas abertas + Cliente/Obra/Status/Validade/Responsavel viram
          uma barra compacta (numero + status) que abre uma folha unica com
          tudo empilhado -- elimina o scroll horizontal duplo que existia
          nas duas faixas acima. Desktop continua usando as faixas de cima. */}
      <button
        type="button"
        className="proposal-mobile-header"
        onClick={() => setMobileHeaderOpen(true)}
        aria-haspopup="dialog"
      >
        <span className="proposal-mobile-header-number">{proposal.number} · REV.{String(proposal.revision).padStart(2, '0')}</span>
        <span className={`status-tag ${mobileStatusClasses[proposal.status ?? 'draft']}`}>{mobileStatusLabels[proposal.status ?? 'draft']}</span>
        <span className="proposal-mobile-header-chevron" aria-hidden="true"><ChevronDown size={16} /></span>
      </button>

      {mobileHeaderOpen && (
        <div className="proposal-mobile-sheet-backdrop" role="presentation" onClick={() => setMobileHeaderOpen(false)}>
          <div
            className="proposal-mobile-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Abas abertas e detalhes da proposta"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="proposal-mobile-sheet-handle" />
            <div className="proposal-mobile-sheet-head">
              <b>Proposta</b>
              <button type="button" aria-label="Fechar" onClick={() => setMobileHeaderOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <h3 className="proposal-mobile-sheet-section">Abas abertas</h3>
            {proposalTabs.map((tab) => {
              const selected = tab.id === proposal.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`proposal-mobile-tab-row ${selected ? 'active' : ''}`}
                  disabled={loading}
                  onClick={() => {
                    setMobileHeaderOpen(false);
                    void onOpenProposal(tab.id);
                  }}
                >
                  <LayoutList size={16} />
                  <span>
                    <b>{tab.number} · REV.{String(tab.revision).padStart(2, '0')}</b>
                    <small>{tab.clientName} · {tab.workName}</small>
                  </span>
                  {selected && <span className="status-tag status-review">Aberta</span>}
                </button>
              );
            })}
            <button
              type="button"
              className="proposal-mobile-tab-row new"
              onClick={() => {
                setMobileHeaderOpen(false);
                onNewProposal();
              }}
            >
              <Plus size={16} /> Nova proposta
            </button>

            <h3 className="proposal-mobile-sheet-section">Detalhes da proposta</h3>
            <div className="proposal-mobile-meta">
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
            </div>
          </div>
        </div>
      )}

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
