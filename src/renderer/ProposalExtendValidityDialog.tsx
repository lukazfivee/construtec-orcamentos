import { useEffect, useState } from 'react';
import { CalendarClock, Check, Clock, X } from 'lucide-react';
import type { ProposalSummary } from '../shared/contracts';
import { proposalApi } from './api';
import { calculateExtendedDate, getProposalValidityStatus } from './proposalValidityHelpers';

interface ProposalExtendValidityDialogProps {
  open: boolean;
  proposal: ProposalSummary | null;
  onClose: () => void;
  onSuccess: (updatedDate: string) => void;
  onError: (error: string) => void;
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' });

export function ProposalExtendValidityDialog({
  open,
  proposal,
  onClose,
  onSuccess,
  onError,
}: ProposalExtendValidityDialogProps) {
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !proposal) return;
    const initial = calculateExtendedDate(proposal.validUntil, 15);
    setSelectedDate(initial);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, proposal, onClose]);

  if (!open || !proposal) return null;

  const currentStatus = getProposalValidityStatus(proposal.validUntil, proposal.status);

  const handleApplyPreset = (days: number) => {
    const next = calculateExtendedDate(proposal.validUntil, days);
    setSelectedDate(next);
  };

  const handleConfirm = async () => {
    if (!selectedDate || loading) return;
    setLoading(true);
    try {
      await proposalApi.updateDetails(proposal.id, { validUntil: selectedDate });
      onSuccess(selectedDate);
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Não foi possível prorrogar a validade.');
    } finally {
      setLoading(false);
    }
  };

  const previewDateFormatted = selectedDate ? (() => {
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      return dateFmt.format(new Date(y, m - 1, d));
    } catch {
      return selectedDate;
    }
  })() : '';

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-dialog"
        style={{ width: '480px', maxWidth: '95vw', padding: '0', overflow: 'hidden' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="extend-validity-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="proposal-export-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <div className="title-group" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="icon-badge" style={{ width: '38px', height: '38px', background: 'var(--status-review-bg)', color: 'var(--tx-cool-29-3)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CalendarClock size={20} />
            </span>
            <div>
              <h2 id="extend-validity-title" style={{ fontSize: 'calc(15px * var(--fs, 1))', margin: 0, fontWeight: 700, color: 'var(--status-review-text)' }}>
                Prorrogar Validade da Proposta
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 'calc(11px * var(--fs, 1))', color: 'var(--muted)' }}>
                {proposal.number} (REV.{String(proposal.revision).padStart(2, '0')}) — {proposal.clientName}
              </p>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Fechar">
            <X size={16} />
          </button>
        </header>

        <div style={{ padding: '20px' }}>
          {/* Current Status Box */}
          <div style={{ padding: '12px 14px', background: 'var(--bg-cool-98)', borderRadius: '8px', border: '1px solid var(--bd-cool-93-2)', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <small style={{ display: 'block', fontSize: 'calc(10px * var(--fs, 1))', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Situação Atual
              </small>
              <strong style={{ fontSize: 'calc(12px * var(--fs, 1))', color: 'var(--ink)' }}>
                {currentStatus.formattedDate === '—' ? 'Sem data estipulada' : `Até ${currentStatus.formattedDate}`}
              </strong>
            </div>
            <span className={`validity-badge ${currentStatus.badgeClass}`}>
              <Clock size={11} /> {currentStatus.label}
            </span>
          </div>

          {/* Presets */}
          <label style={{ display: 'block', fontSize: 'calc(11px * var(--fs, 1))', fontWeight: 600, color: 'var(--ink-secondary)', marginBottom: '8px' }}>
            Extensões rápidas:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
            {[7, 15, 30, 45].map((days) => (
              <button
                key={days}
                type="button"
                className="secondary-btn"
                onClick={() => handleApplyPreset(days)}
                style={{ height: '34px', fontSize: 'calc(11px * var(--fs, 1))', fontWeight: 600, padding: '0 8px' }}
              >
                +{days} dias
              </button>
            ))}
          </div>

          {/* Custom Date Input */}
          <label style={{ display: 'block', fontSize: 'calc(11px * var(--fs, 1))', fontWeight: 600, color: 'var(--ink-secondary)', marginBottom: '6px' }}>
            Ou selecione a data limite:
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              width: '100%',
              height: '38px',
              border: '1px solid var(--line-strong)',
              borderRadius: '6px',
              padding: '0 12px',
              fontSize: 'calc(13px * var(--fs, 1))',
              marginBottom: '16px',
              boxSizing: 'border-box',
            }}
          />

          {/* Preview of new date */}
          {selectedDate && (
            <div style={{ padding: '10px 12px', background: 'var(--bg-cool-96-2)', borderRadius: '6px', border: '1px solid var(--bd-cool-86-2)', fontSize: 'calc(11px * var(--fs, 1))', color: 'var(--tx-cool-29-3)' }}>
              <b>Nova validade oficial:</b> {previewDateFormatted}
            </div>
          )}
        </div>

        <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px', background: 'var(--bg-cool-98)', borderTop: '1px solid var(--line)' }}>
          <button type="button" className="secondary-btn" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button
            type="button"
            className="primary-btn"
            disabled={!selectedDate || loading}
            onClick={() => void handleConfirm()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Check size={14} /> {loading ? 'Prorrogando…' : 'Confirmar prorrogação'}
          </button>
        </footer>
      </div>
    </div>
  );
}
