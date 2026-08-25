import { useEffect, useMemo, useState } from 'react';
import { Building2, CalendarDays, FilePlus2, MapPin, X } from 'lucide-react';
import type { ClientRecord, ProposalDetail } from '../shared/contracts';
import { clientsApi, proposalApi } from './api';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (proposal: ProposalDetail) => void;
  onError: (message: string) => void;
};

export function NewProposalDialog({ open, onClose, onCreated, onError }: Props) {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [clientId, setClientId] = useState('');
  const [workId, setWorkId] = useState('');
  const [scope, setScope] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    clientsApi.list().then((result) => {
      setClients(result.clients);
      const firstClient = result.clients.find((client) => client.works.some((work) => work.active));
      setClientId(firstClient?.id ?? '');
      setWorkId(firstClient?.works.find((work) => work.active)?.id ?? '');
    }).catch((error: unknown) => {
      onError(error instanceof Error ? error.message : 'Não foi possível carregar clientes e obras.');
    }).finally(() => setLoading(false));
  }, [onError, open]);

  const selectedClient = useMemo(() => clients.find((client) => client.id === clientId), [clientId, clients]);
  const activeWorks = selectedClient?.works.filter((work) => work.active) ?? [];
  const canSubmit = Boolean(clientId && workId && scope.trim().length >= 3 && !loading);

  if (!open) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      const result = await proposalApi.create({ clientId, workId, scope: scope.trim(), validUntil: validUntil || null });
      onCreated(result.proposal);
      setScope('');
      setValidUntil('');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível criar a proposta.');
    } finally {
      setLoading(false);
    }
  };

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) onClose(); }}>
    <section className="new-proposal-dialog" role="dialog" aria-modal="true" aria-labelledby="new-proposal-title">
      <header><div><FilePlus2 size={22} /><span><h2 id="new-proposal-title">Nova proposta</h2><p>A numeração e a revisão 00 serão criadas automaticamente.</p></span></div><button type="button" className="dialog-close" aria-label="Fechar" disabled={loading} onClick={onClose}><X size={18} /></button></header>
      <form onSubmit={(event) => void submit(event)}>
        <label><span><Building2 size={15} /> Cliente <b>*</b></span><select value={clientId} disabled={loading} onChange={(event) => { const nextId = event.target.value; const nextClient = clients.find((client) => client.id === nextId); setClientId(nextId); setWorkId(nextClient?.works.find((work) => work.active)?.id ?? ''); }}><option value="">Selecione</option>{clients.filter((client) => client.works.some((work) => work.active)).map((client) => <option key={client.id} value={client.id}>{client.tradeName || client.legalName}</option>)}</select></label>
        <label><span><MapPin size={15} /> Obra <b>*</b></span><select value={workId} disabled={loading || !clientId} onChange={(event) => setWorkId(event.target.value)}><option value="">Selecione</option>{activeWorks.map((work) => <option key={work.id} value={work.id}>{work.name}</option>)}</select></label>
        <label className="wide"><span>Escopo da proposta <b>*</b></span><input autoFocus type="text" maxLength={300} value={scope} disabled={loading} placeholder="Ex.: Sistema de CFTV e controle de acesso" onChange={(event) => setScope(event.target.value)} /></label>
        <label className="wide"><span><CalendarDays size={15} /> Validade</span><input type="date" value={validUntil} disabled={loading} onChange={(event) => setValidUntil(event.target.value)} /></label>
        {clients.length === 0 && !loading && <p className="dialog-warning">Cadastre um cliente e uma obra ativa antes de criar a proposta.</p>}
        <footer><button type="button" disabled={loading} onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={!canSubmit}>{loading ? 'Criando…' : 'Criar proposta'}</button></footer>
      </form>
    </section>
  </div>;
}
