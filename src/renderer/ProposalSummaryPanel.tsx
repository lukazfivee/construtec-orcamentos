import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  FilePlus2,
  LockKeyhole,
  Save,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { calculateProposalTotals } from '../shared/proposalFinancials';
import type { ProposalDetail } from '../shared/contracts';
import { ProposalSyncDirectAction } from './ProposalSyncDirectAction';

const money = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Amount({
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
  onCreateRevision: () => void;
  onCloneProposal: () => void;
  onPreviewProposal: () => void;
  onExportProposal: () => void;
  onShareProposal?: () => void;
  onDeleteProposal: () => void;
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
  onCreateRevision,
  onCloneProposal,
  onPreviewProposal,
  onExportProposal,
  onShareProposal,
  onDeleteProposal,
}: Props) {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (!deleteModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !mutationPending) setDeleteModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteModalOpen, mutationPending]);

  const materialsTotal = proposal.totals.cost ?? 0;
  const { baseCost, finalValue, additions } = calculateProposalTotals(materialsTotal, laborTotal, proposal.bdiMultiplier ?? 1);

  const formattedUpdatedAt = proposal.updatedAt
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(proposal.updatedAt))
    : '—';

  return (
    <>
      <aside className="commercial-panel">
        <div className="panel-title">
          <b>Resumo comercial</b>
          <ChevronUp size={16} />
        </div>
        <Amount label="Total de Materiais" value={`R$ ${money.format(materialsTotal)}`} />
        <Amount label="Total de Mão de Obra" value={`R$ ${money.format(laborTotal)}`} />
        <Amount label="Custo Base" value={`R$ ${money.format(baseCost)}`} />
        <Amount label="BDI / acréscimos" value={`R$ ${money.format(additions)}`} />
        <Amount label="Valor Final da Proposta" value={`R$ ${money.format(finalValue)}`} tone="blue" />

        <div className="panel-section">
          <h2>Parâmetros internos</h2>
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
          <label>
            Encargos <span className="locked-input">87,25% <ChevronDown size={14} /></span>
          </label>
        </div>

        <div className="frozen-state">
          <LockKeyhole size={17} />
          <span>{proposal.isLatest ? 'Custos-base preservados nesta revisão' : 'Revisão histórica · somente leitura'}</span>
        </div>

        <div className="panel-section actions">
          <h2>Ações</h2>
          <button type="button" disabled={!proposal.isLatest || mutationPending} onClick={onCreateRevision}>
            <Save size={18} /> Criar revisão <kbd>Ctrl+S</kbd>
          </button>
          <button
            type="button"
            disabled={mutationPending}
            onClick={onCloneProposal}
            title="Clonar este orçamento gerando um novo número"
          >
            <Copy size={18} /> Clonar proposta
          </button>
          <button type="button" disabled={documentPending} onClick={onPreviewProposal}>
            <Eye size={18} /> Pré-visualizar <kbd>Ctrl+P</kbd>
          </button>
          <button
            className="primary generate"
            type="button"
            disabled={(!proposal.items.length && laborTotal <= 0) || documentPending}
            onClick={onExportProposal}
          >
            <FilePlus2 size={18} /> {documentPending ? 'Preparando…' : 'Gerar PDF + Word'} <kbd>Ctrl+G</kbd>
          </button>
          {onShareProposal && (
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
          <ProposalSyncDirectAction proposal={proposal} />
          <button
            type="button"
            className="danger-action-btn"
            disabled={mutationPending || proposal.status === 'approved' || proposal.hasApprovedRevision}
            onClick={() => setDeleteModalOpen(true)}
            title="Excluir este orçamento definitivamente"
          >
            <Trash2 size={16} /> Excluir orçamento
          </button>
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

      {deleteModalOpen && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !mutationPending) setDeleteModalOpen(false);
          }}
        >
          <div className="modal-card delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-proposal-title">
            <div className="modal-header danger-header">
              <AlertTriangle size={24} color="#dc2626" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 id="delete-proposal-title">Excluir Orçamento</h3>
                <p>Confirmação de exclusão permanente</p>
              </div>
              <button
                type="button"
                className="dialog-close"
                aria-label="Fechar"
                disabled={mutationPending}
                onClick={() => setDeleteModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Tem certeza que deseja excluir o orçamento <strong>{proposal.number}</strong> (Cliente: <em>{proposal.clientName}</em>)?
              </p>
              <div className="danger-callout">
                Esta ação removerá todas as revisões, itens, composições de mão de obra e histórico associados a este orçamento do banco de dados local.
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="secondary-btn"
                disabled={mutationPending}
                onClick={() => setDeleteModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="danger-btn"
                disabled={mutationPending}
                onClick={() => {
                  setDeleteModalOpen(false);
                  onDeleteProposal();
                }}
              >
                <Trash2 size={16} />
                {mutationPending ? 'Excluindo...' : 'Sim, excluir definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
