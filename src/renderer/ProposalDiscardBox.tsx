import { useState, type FormEvent } from 'react';
import { proposalApi } from './api';
import { useIsAdmin } from './SuitePermissions';

// Só administrador. Descarta a proposta (inclusive aprovada) guardando tudo para recuperar em Configurações.
// O servidor confere o número digitado e descarta junto a obra no Centro de Custos (só sem movimento).
type Props = { proposalId: string; number: string; approved: boolean };

export function ProposalDiscardBox({ proposalId, number, approved }: Props) {
  const isAdmin = useIsAdmin();
  const [open, setOpen] = useState(approved);
  const [confirmNumber, setConfirmNumber] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  if (!isAdmin) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      await proposalApi.discard(proposalId, { confirmNumber, reason });
      window.location.reload();
    } catch (discardError) {
      setError(discardError instanceof Error ? discardError.message : 'Não foi possível descartar a proposta.');
      setPending(false);
    }
  };

  if (!open) {
    return (
      <p className="discard-open">
        <button type="button" className="od-btn g sm" onClick={() => setOpen(true)}>Descartar com registro (dá para recuperar)</button>
      </p>
    );
  }
  return (
    <form className="discard-form" onSubmit={(event) => void submit(event)}>
      <div className="danger-callout">
        Descartar tira {number} da lista, com todas as revisões, e guarda uma cópia em Configurações, onde ela pode ser restaurada. A obra no Centro de Custos, sem movimento, sai junto e volta se a proposta for restaurada. Se a obra tem lançamentos, notas ou medições, o descarte é recusado.
      </div>
      <label><span className="dlg-label">Motivo (opcional)</span>
        <input className="od-inp" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} />
      </label>
      <label><span className="dlg-label">Digite {number} para confirmar</span>
        <input className="od-inp" value={confirmNumber} onChange={(event) => setConfirmNumber(event.target.value)} autoComplete="off" />
      </label>
      {error && <div role="alert" className="dlg-note bad">{error}</div>}
      <button type="submit" className="danger-btn" disabled={pending || !confirmNumber.trim()}>{pending ? 'Descartando…' : 'Descartar proposta'}</button>
    </form>
  );
}
