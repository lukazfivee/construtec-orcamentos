import { useState } from 'react';
import { ChevronDown, LayoutList, Plus, X } from 'lucide-react';
import type { ProposalDetail, ProposalSummary } from '../shared/contracts';
import { ProposalMetaBar } from './ProposalMetaBar';

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
  isEditable: boolean;
  mutationPending: boolean;
  setMutationPending: (pending: boolean) => void;
  onOpenProposal: (proposalId: string) => Promise<void>;
  onProposalUpdate: (proposal: ProposalDetail) => void;
  onProposalTabsReload: () => void;
  onNewProposal: () => void;
  onManageClients: () => void;
  setCatalogOpen: (open: boolean) => void;
  showNotice: (message: string) => void;
  setError: (error: string) => void;
};

export function ProposalMobileSheet({
  proposal,
  proposalTabs,
  loading,
  isEditable,
  mutationPending,
  setMutationPending,
  onOpenProposal,
  onProposalUpdate,
  onProposalTabsReload,
  onNewProposal,
  onManageClients,
  setCatalogOpen,
  showNotice,
  setError,
}: Props) {
  const [mobileHeaderOpen, setMobileHeaderOpen] = useState(false);

  return (
    <>
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
                  {selected && <span className="current-tag">Aberta</span>}
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
                onProposalTabsReload={onProposalTabsReload}
                onManageClients={onManageClients}
                showNotice={showNotice}
                setError={setError}
                setCatalogOpen={setCatalogOpen}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
