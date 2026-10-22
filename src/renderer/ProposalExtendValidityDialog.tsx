import { useEffect, useState } from 'react';
import { CalendarClock, Check, Clock } from 'lucide-react';
import type { ProposalSummary } from '../shared/contracts';
import { Dialogo } from './orcDeskUi';
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
  }, [open, proposal]);

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
    <Dialogo
      id="extend-validity"
      icon={CalendarClock}
      title="Prorrogar validade"
      sub={`${proposal.number} · REV.${String(proposal.revision).padStart(2, '0')} · ${proposal.clientName}`}
      className="w-sm extend-dlg"
      busy={loading}
      onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={loading}>Cancelar</button>
          <button type="button" className="primary" disabled={!selectedDate || loading} onClick={() => void handleConfirm()}>
            <Check size={16} /> {loading ? 'Prorrogando…' : 'Confirmar prorrogação'}
          </button>
        </>
      )}
    >
      <div className="extend-now">
        <span>
          <small>Validade atual</small>
          <strong>{currentStatus.formattedDate === '—' ? 'Sem data definida' : `Até ${currentStatus.formattedDate}`}</strong>
        </span>
        <span className={`validity-badge ${currentStatus.badgeClass}`}>
          <Clock size={12} /> {currentStatus.label}
        </span>
      </div>

      <div>
        <span className="dlg-label">Prorrogar por</span>
        <div className="extend-presets">
          {[7, 15, 30, 45].map((days) => (
            <button key={days} type="button" className="od-btn s" onClick={() => handleApplyPreset(days)}>+{days} dias</button>
          ))}
        </div>
      </div>

      <label>
        <span className="dlg-label">Ou escolha a data</span>
        <input className="od-inp" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
      </label>

      {selectedDate && <p className="dlg-note"><b>Nova validade:</b> {previewDateFormatted}</p>}
    </Dialogo>
  );
}
