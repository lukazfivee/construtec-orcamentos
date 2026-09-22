import {
  Copy,
  Eye,
  FilePlus2,
  Save,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import type { ProposalDetail } from '../shared/contracts';
import { ProposalSyncDirectAction } from './ProposalSyncDirectAction';

export const money = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function Amount({
  label,
  value,
  tone,
  compact = false,
}: {
  label: string;
  value: string;
  tone?: 'blue' | 'green';
  compact?: boolean;
}) {
  return (
    <div className={`amount ${tone ?? ''} ${compact ? 'compact' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

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
  onProposalUpdate?: (proposal: ProposalDetail) => void;
  onNavigateToCentroCustos?: (costCenterId?: number) => void;
  showNotice?: (message: string) => void;
  materialsTotal: number;
  baseCost: number;
  finalValue: number;
  bdiAdditions: number;
  taxAmount: number;
  taxPercentage: number;
  onClose: () => void;
  onRequestDelete: () => void;
};

export function ProposalSummaryMobileSheet({
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
  onProposalUpdate,
  onNavigateToCentroCustos,
  showNotice,
  materialsTotal,
  baseCost,
  finalValue,
  bdiAdditions,
  taxAmount,
  taxPercentage,
  onClose,
  onRequestDelete,
}: Props) {
  return (
    <div className="proposal-summary-sheet-backdrop" role="presentation" onClick={onClose}>
      <div
        className="proposal-summary-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Resumo e ações da proposta"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="proposal-summary-sheet-handle" />
        <div className="proposal-summary-sheet-head">
          <b>Resumo &amp; ações</b>
          <button type="button" aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="proposal-summary-sheet-amount"><span>Total de materiais</span><b>R$ {money.format(materialsTotal)}</b></div>
        <div className="proposal-summary-sheet-amount"><span>Total de mão de obra</span><b>R$ {money.format(laborTotal)}</b></div>
        <div className="proposal-summary-sheet-amount"><span>Custo base</span><b>R$ {money.format(baseCost)}</b></div>
        <div className="proposal-summary-sheet-amount"><span>BDI / acréscimos</span><b>R$ {money.format(bdiAdditions)}</b></div>
        {taxAmount > 0 && (
          <div className="proposal-summary-sheet-amount"><span>Impostos ({String(taxPercentage).replace('.', ',')}%)</span><b>R$ {money.format(taxAmount)}</b></div>
        )}
        <div className="proposal-summary-sheet-amount final"><span>Valor final da proposta</span><b>R$ {money.format(finalValue)}</b></div>

        <div className="proposal-summary-sheet-params">
          <label>
            Multiplicador BDI
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
          <label>
            Impostos
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
        </div>

        <div className="proposal-summary-sheet-actions">
          <button type="button" disabled={!proposal.isLatest || mutationPending} onClick={() => { onCreateRevision(); onClose(); }}>
            <Save size={16} /> Criar revisão
          </button>
          <button type="button" disabled={mutationPending} onClick={() => { onCloneProposal(); onClose(); }}>
            <Copy size={16} /> Clonar proposta
          </button>
          <button type="button" disabled={documentPending} onClick={() => { onPreviewProposal(); onClose(); }}>
            <Eye size={16} /> Pré-visualizar
          </button>
          <button
            className="primary"
            type="button"
            disabled={(!proposal.items.length && laborTotal <= 0) || documentPending}
            onClick={() => { onExportProposal(); onClose(); }}
          >
            <FilePlus2 size={16} /> {documentPending ? 'Preparando…' : 'Gerar PDF + Word'}
          </button>
          {onShareProposal && (
            <button type="button" disabled={documentPending} onClick={() => { onShareProposal(); onClose(); }}>
              <Share2 size={16} /> Compartilhar
            </button>
          )}
          <ProposalSyncDirectAction
            proposal={proposal}
            onProposalUpdate={onProposalUpdate}
            onNavigateToCentroCustos={onNavigateToCentroCustos}
            showNotice={showNotice}
            disabled={mutationPending}
          />
          <button
            className="danger"
            type="button"
            disabled={mutationPending || proposal.status === 'approved' || proposal.hasApprovedRevision}
            onClick={() => { onClose(); onRequestDelete(); }}
          >
            <Trash2 size={16} /> Excluir orçamento
          </button>
        </div>
      </div>
    </div>
  );
}
