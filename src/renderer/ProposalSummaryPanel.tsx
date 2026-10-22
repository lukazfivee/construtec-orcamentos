import { useEffect, useRef, useState } from 'react';
import { calculateProposalTotalsFromLines, countManualSales, proposalSaleLines } from '../shared/proposalFinancials';
import type { ProposalDetail } from '../shared/contracts';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  MoreHorizontal,
  FilePlus2,
  LockKeyhole,
  Save,
  Share2,
  Trash2,
} from './icons';
import { isAdminNow , useSuitePermission } from './SuitePermissions';
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
  const [paramsCollapsed, setParamsCollapsed] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  // p10 (custo, BDI e margem) e p11 (enviar e aprovar). Documentos saem do calculo de custo: sem p10 nao se gera.
  const canSeeCost = useSuitePermission('p10');
  const canSend = useSuitePermission('p11') && canSeeCost;

  // Menu "Mais acoes": fecha com Esc ou clique fora.
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMoreOpen(false); };
    const onDown = (event: MouseEvent) => { if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onDown); };
  }, [moreOpen]);
  const runMore = (action: () => void) => { setMoreOpen(false); action(); };

  const materialsTotal = proposal.totals.cost ?? 0;
  const parsedDraftTax = taxDraft != null ? Number(taxDraft.trim().replace(/%/g, '').replace(',', '.')) : NaN;
  const taxPercentage = Number.isFinite(parsedDraftTax) && parsedDraftTax >= 0 && parsedDraftTax <= 100
    ? parsedDraftTax
    : (proposal.taxPercentage ?? 0);
  const parsedDraftBdi = bdiDraft != null ? Number(bdiDraft.trim().replace(/[xX]/g, '').replace(',', '.')) : NaN;
  const bdiMultiplier = Number.isFinite(parsedDraftBdi) && parsedDraftBdi > 0 ? parsedDraftBdi : (proposal.bdiMultiplier ?? 1);
  // Mesma regra do servidor: Valor final = soma da venda dos itens + mao de obra x BDI, com imposto (previa com BDI/imposto digitados).
  const saleLines = proposalSaleLines(proposal, bdiMultiplier);
  const previewTotals = calculateProposalTotalsFromLines(saleLines, laborTotal, bdiMultiplier, taxPercentage);
  const { baseCost } = previewTotals;
  const finalValue = canSeeCost ? previewTotals.finalValue : (proposal.totals.finalValue ?? 0);
  const subtotalWithBdi = previewTotals.subtotalWithBdi ?? previewTotals.finalValue;
  const bdiAdditions = Math.round((subtotalWithBdi - baseCost + Number.EPSILON) * 100) / 100;
  const taxAmount = previewTotals.taxAmount ?? 0;
  // Sem p10 o custo chega zerado; vale o que o servidor marcou em cada item.
  const manualSaleCount = canSeeCost ? countManualSales(saleLines, bdiMultiplier) : proposal.items.filter((item) => item.manualSale).length;
  const manualSaleNote = manualSaleCount > 0
    ? `Inclui ${manualSaleCount} ${manualSaleCount === 1 ? 'item' : 'itens'} com preço de venda manual`
    : null;

  const formattedUpdatedAt = proposal.updatedAt
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(proposal.updatedAt))
    : '—';

  return (
    <>
      <aside className="commercial-panel">
        <section className="panel-card summary-card" aria-label="Resumo comercial">
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
            {canSeeCost && (
              <>
                {/* Valores em R$ sem o simbolo: cabem ao lado do rotulo na coluna de 260 px (o valor final mantem o R$). */}
                <Amount label="Materiais" value={money.format(materialsTotal)} />
                <Amount label="Mão de obra" value={money.format(laborTotal)} />
                <Amount label="Custo base" value={money.format(baseCost)} />
                <Amount label="BDI" value={money.format(bdiAdditions)} />
              </>
            )}
            {taxAmount > 0 && (
              <Amount label={`Impostos ${String(taxPercentage).replace('.', ',')}%`} value={money.format(taxAmount)} />
            )}
          </>
        )}
        {/* Item mais importante do painel: fica visível mesmo com "Resumo comercial" recolhido. */}
        <Amount label="Valor final" value={`R$ ${money.format(finalValue)}`} tone="blue" />
        {manualSaleNote && <p className="summary-manual-note">{manualSaleNote}</p>}
        </section>

        <div className="panel-card panel-section" style={canSeeCost ? undefined : { display: 'none' }}>
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
            Encargos <span className="locked-input">87,25%</span>
          </label>
          </>
          )}
        </div>

        {!proposal.isLatest && (
          <div className="frozen-state">
            <LockKeyhole size={17} />
            <span>Revisão histórica · somente leitura</span>
          </div>
        )}

        <div className="panel-footnote">
          <p className="last-change">
            Última alteração: {formattedUpdatedAt}
            <br />
            por {proposal.responsibleName ?? '—'}
          </p>
        </div>
        {/* Acoes: as finais (Centro de Custo e PDF + Word) ficam sempre visiveis no pe da coluna, uma por linha;
            as de apoio (revisao, clonar, compartilhar, excluir) ficam no menu "Mais acoes". */}
        <div className="panel-card panel-section actions">
          <h2 className="actions-title">Ações</h2>
          <div className="more-actions" ref={moreRef}>
            <button type="button" aria-haspopup="menu" aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}>
              <MoreHorizontal size={18} /> Mais ações
            </button>
            {moreOpen && (
              <div className="pop more-actions-pop" role="menu" aria-label="Mais ações">
                <button type="button" role="menuitem" disabled={!proposal.isLatest || mutationPending} onClick={() => runMore(onCreateRevision)} title="Criar a próxima revisão (Ctrl+S)">
                  <Save size={18} /> Criar revisão
                </button>
                <button type="button" role="menuitem" disabled={mutationPending} onClick={() => runMore(onCloneProposal)} title="Duplicar esta proposta com um número novo">
                  <Copy size={18} /> Duplicar
                </button>
                {canSend && onShareProposal && (
                  <button type="button" role="menuitem" disabled={documentPending} onClick={() => runMore(onShareProposal)} title="Compartilhar por WhatsApp ou e-mail">
                    <Share2 size={18} /> Compartilhar
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  className="danger"
                  disabled={mutationPending || ((proposal.status === 'approved' || proposal.hasApprovedRevision) && !isAdminNow())}
                  onClick={() => runMore(() => setDeleteModalOpen(true))}
                  title="Excluir esta proposta"
                >
                  <Trash2 size={18} /> Excluir
                </button>
              </div>
            )}
          </div>
          <ProposalSyncDirectAction
            proposal={proposal}
            onProposalUpdate={onProposalUpdate}
            onNavigateToCentroCustos={onNavigateToCentroCustos}
            showNotice={showNotice}
            disabled={mutationPending}
          />
          <button
            className="primary generate"
            type="button"
            disabled={(!proposal.items.length && laborTotal <= 0) || documentPending}
            onClick={onExportProposal}
            title="Abre o PDF da proposta: opções, prévia e arquivo em PDF ou Word (Ctrl+G)"
            style={canSend ? undefined : { display: 'none' }}
          >
            <FilePlus2 size={18} /> {documentPending ? 'Preparando…' : 'Gerar PDF ou Word'}
          </button>
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
          manualSaleNote={manualSaleNote}
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
