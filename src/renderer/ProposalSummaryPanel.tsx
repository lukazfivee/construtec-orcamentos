import { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  FilePlus2,
  LockKeyhole,
  Save,
  Share2,
  Trash2,
} from 'lucide-react';
import { calculateProposalTotals } from '../shared/proposalFinancials';
import type { ProposalDetail } from '../shared/contracts';
import { ProposalSyncDirectAction } from './ProposalSyncDirectAction';
import { ProposalSummaryMobileSheet, Amount, money } from './ProposalSummaryMobileSheet';
import { DeleteProposalModal } from './DeleteProposalModal';

type Props = {
  proposal: ProposalDetail;
  laborTotal: number;
  isEditable: boolean;
  mutationPending: boolean;
  documentPending: boolean;
  bdiDraft: string | null;
  setBdiDraft: (draft: string | null) => void;
  onUpdateBdi: () => void;
  taxDraft?: string | null;
  setTaxDraft?: (draft: string | null) => void;
  onUpdateTax?: () => void;
  onCreateRevision: () => void;
  onCloneProposal: () => void;
  onPreviewProposal: () => void;
  onExportProposal: () => void;
  onShareProposal?: () => void;
  onDeleteProposal: () => void;
  onProposalUpdate?: (proposal: ProposalDetail) => void;
  onNavigateToCentroCustos?: (costCenterId?: number) => void;
  showNotice?: (message: string) => void;
};

export function ProposalSummaryPanel({
  proposal,
  laborTotal,
  isEditable,
  mutationPending,
  documentPending,
  bdiDraft,
  setBdiDraft,
  onUpdateBdi,
  taxDraft,
  setTaxDraft,
  onUpdateTax,
  onCreateRevision,
  onCloneProposal,
  onPreviewProposal,
  onExportProposal,
  onShareProposal,
  onDeleteProposal,
  onProposalUpdate,
  onNavigateToCentroCustos,
  showNotice,
}: Props) {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);
  const [paramsCollapsed, setParamsCollapsed] = useState(false);
  const [actionsCollapsed, setActionsCollapsed] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  useEffect(() => {
    if (!deleteModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !mutationPending) setDeleteModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteModalOpen, mutationPending]);

  const materialsTotal = proposal.totals.cost ?? 0;
  const parsedDraftTax = taxDraft != null ? Number(taxDraft.trim().replace(/%/g, '').replace(',', '.')) : NaN;
  const taxPercentage = Number.isFinite(parsedDraftTax) && parsedDraftTax >= 0 && parsedDraftTax <= 100
    ? parsedDraftTax
    : (proposal.taxPercentage ?? 0);
  const parsedDraftBdi = bdiDraft != null ? Number(bdiDraft.trim().replace(/[xX]/g, '').replace(',', '.')) : NaN;
  const bdiMultiplier = Number.isFinite(parsedDraftBdi) && parsedDraftBdi > 0 ? parsedDraftBdi : (proposal.bdiMultiplier ?? 1);
  const { baseCost, finalValue } = calculateProposalTotals(materialsTotal, laborTotal, bdiMultiplier, taxPercentage);
  const subtotalWithBdi = Math.round((baseCost * bdiMultiplier + Number.EPSILON) * 100) / 100;
  const bdiAdditions = Math.round((subtotalWithBdi - baseCost + Number.EPSILON) * 100) / 100;
  const taxAmount = taxPercentage > 0 ? Math.round((subtotalWithBdi * (taxPercentage / 100) + Number.EPSILON) * 100) / 100 : 0;

  const formattedUpdatedAt = proposal.updatedAt
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(proposal.updatedAt))
    : '—';

  return (
    <>
      <aside className="commercial-panel">
        <button
          type="button"
          className="panel-title panel-title-toggle"
          aria-expanded={!summaryCollapsed}
          onClick={() => setSummaryCollapsed((v) => !v)}
        >
          <b>Resumo comercial</b>
          {summaryCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
        {!summaryCollapsed && (
          <>
            <Amount label="Total de Materiais" value={`R$ ${money.format(materialsTotal)}`} />
            <Amount label="Total de Mão de Obra" value={`R$ ${money.format(laborTotal)}`} />
            <Amount label="Custo Base" value={`R$ ${money.format(baseCost)}`} />
            <Amount label="BDI / acréscimos" value={`R$ ${money.format(bdiAdditions)}`} />
            {taxAmount > 0 && (
              <Amount label={`Impostos (${String(taxPercentage).replace('.', ',')}%)`} value={`R$ ${money.format(taxAmount)}`} />
            )}
          </>
        )}
        {/* Item mais importante do painel: fica visível mesmo com "Resumo comercial" recolhido. */}
        <Amount label="Valor Final da Proposta" value={`R$ ${money.format(finalValue)}`} tone="blue" />

        <div className="panel-section">
          <button
            type="button"
            className="panel-section-toggle"
            aria-expanded={!paramsCollapsed}
            onClick={() => setParamsCollapsed((v) => !v)}
          >
            <h2>Parâmetros internos</h2>
            {paramsCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          {/* Item mais importante da seção: fica visível mesmo com "Parâmetros internos" recolhido. */}
          <label>
            Multiplicador BDI{' '}
            <span className="editable-parameter">
              <input
                type="text"
                inputMode="decimal"
                aria-label="Multiplicador BDI"
                value={bdiDraft ?? String(proposal.bdiMultiplier ?? 0).replace('.', ',')}
                disabled={!isEditable || mutationPending}
                onFocus={() => {
                  if (bdiDraft === null) setBdiDraft(String(proposal.bdiMultiplier).replace('.', ','));
                }}
                onChange={(event) => setBdiDraft(event.target.value)}
                onBlur={onUpdateBdi}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                  if (event.key === 'Escape') {
                    setBdiDraft(null);
                    event.currentTarget.blur();
                  }
                }}
              />
              <span aria-hidden="true">×</span>
            </span>
          </label>
          {!paramsCollapsed && (
          <>
          <label>
            Impostos{' '}
            <span className="editable-parameter">
              <input
                type="text"
                inputMode="decimal"
                aria-label="Alíquota de Impostos"
                value={taxDraft ?? String(proposal.taxPercentage ?? 0).replace('.', ',')}
                disabled={!isEditable || mutationPending}
                onFocus={() => {
                  if (taxDraft === null && setTaxDraft) setTaxDraft(String(proposal.taxPercentage ?? 0).replace('.', ','));
                }}
                onChange={(event) => setTaxDraft?.(event.target.value)}
                onBlur={onUpdateTax}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                  if (event.key === 'Escape') {
                    setTaxDraft?.(null);
                    event.currentTarget.blur();
                  }
                }}
              />
              <span aria-hidden="true">%</span>
            </span>
          </label>
          <label>
            Encargos <span className="locked-input">87,25% <ChevronDown size={14} /></span>
          </label>
          </>
          )}
        </div>

        <div className="frozen-state">
          <LockKeyhole size={17} />
          <span>{proposal.isLatest ? 'Custos-base preservados nesta revisão' : 'Revisão histórica · somente leitura'}</span>
        </div>

        <div className="panel-section actions">
          <button
            type="button"
            className="panel-section-toggle"
            aria-expanded={!actionsCollapsed}
            onClick={() => setActionsCollapsed((v) => !v)}
          >
            <h2>Ações</h2>
            {actionsCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          {!actionsCollapsed && (
            <button type="button" disabled={!proposal.isLatest || mutationPending} onClick={onCreateRevision}>
              <Save size={18} /> Criar revisão <kbd>Ctrl+S</kbd>
            </button>
          )}
          {!actionsCollapsed && (
            <button
              type="button"
              disabled={mutationPending}
              onClick={onCloneProposal}
              title="Clonar este orçamento gerando um novo número"
            >
              <Copy size={18} /> Clonar proposta
            </button>
          )}
          {!actionsCollapsed && (
            <button type="button" disabled={documentPending} onClick={onPreviewProposal}>
              <Eye size={18} /> Pré-visualizar <kbd>Ctrl+P</kbd>
            </button>
          )}
          {/* Item mais importante da seção: fica visível mesmo com "Ações" recolhida. */}
          <button
            className="primary generate"
            type="button"
            disabled={(!proposal.items.length && laborTotal <= 0) || documentPending}
            onClick={onExportProposal}
          >
            <FilePlus2 size={18} /> {documentPending ? 'Preparando…' : 'Gerar PDF + Word'} <kbd>Ctrl+G</kbd>
          </button>
          {!actionsCollapsed && onShareProposal && (
            <button
              type="button"
              className="share-action-btn"
              disabled={documentPending}
              onClick={onShareProposal}
              title="Compartilhar proposta via WhatsApp ou E-mail"
            >
              <Share2 size={18} /> Compartilhar proposta
            </button>
          )}
          {!actionsCollapsed && (
            <ProposalSyncDirectAction
              proposal={proposal}
              onProposalUpdate={onProposalUpdate}
              onNavigateToCentroCustos={onNavigateToCentroCustos}
              showNotice={showNotice}
              disabled={mutationPending}
            />
          )}
          {!actionsCollapsed && (
            <button
              type="button"
              className="danger-action-btn"
              disabled={mutationPending || proposal.status === 'approved' || proposal.hasApprovedRevision}
              onClick={() => setDeleteModalOpen(true)}
              title="Excluir este orçamento definitivamente"
            >
              <Trash2 size={16} /> Excluir orçamento
            </button>
          )}
        </div>
        <div className="panel-footnote">
          <p className="demo-data-note">Base inicial demonstrativa · salva localmente</p>
          <p className="last-change">
            Última alteração: {formattedUpdatedAt}
            <br />
            por {proposal.responsibleName ?? '—'}
          </p>
        </div>
      </aside>

      {/* Mobile: sidebar vira um chip fixo no rodape (sempre visivel, sem
          precisar rolar) que abre uma folha "Resumo & acoes" -- mesmo padrao
          validado com o usuario no prototipo (qa-proposals.tsx, Variante 3). */}
      <button
        type="button"
        className="proposal-summary-chip"
        onClick={() => setMobileSheetOpen(true)}
        aria-haspopup="dialog"
      >
        <span>
          <small>Valor final</small>
          <strong>R$ {money.format(finalValue)}</strong>
        </span>
        <span className="proposal-summary-chip-arrow" aria-hidden="true">
          <ChevronUp size={16} />
        </span>
      </button>

      {mobileSheetOpen && (
        <ProposalSummaryMobileSheet
          proposal={proposal}
          laborTotal={laborTotal}
          isEditable={isEditable}
          mutationPending={mutationPending}
          documentPending={documentPending}
          bdiDraft={bdiDraft}
          setBdiDraft={setBdiDraft}
          onUpdateBdi={onUpdateBdi}
          taxDraft={taxDraft}
          setTaxDraft={setTaxDraft}
          onUpdateTax={onUpdateTax}
          onCreateRevision={onCreateRevision}
          onCloneProposal={onCloneProposal}
          onPreviewProposal={onPreviewProposal}
          onExportProposal={onExportProposal}
          onShareProposal={onShareProposal}
          onProposalUpdate={onProposalUpdate}
          onNavigateToCentroCustos={onNavigateToCentroCustos}
          showNotice={showNotice}
          materialsTotal={materialsTotal}
          baseCost={baseCost}
          finalValue={finalValue}
          bdiAdditions={bdiAdditions}
          taxAmount={taxAmount}
          taxPercentage={taxPercentage}
          onClose={() => setMobileSheetOpen(false)}
          onRequestDelete={() => setDeleteModalOpen(true)}
        />
      )}

      {deleteModalOpen && (
        <DeleteProposalModal
          proposal={proposal}
          mutationPending={mutationPending}
          onClose={() => setDeleteModalOpen(false)}
          onDeleteProposal={onDeleteProposal}
        />
      )}
    </>
  );
}
