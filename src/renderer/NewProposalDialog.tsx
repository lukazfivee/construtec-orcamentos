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
  const [newWorkName, setNewWorkName] = useState('');
  const [isCreatingWork, setIsCreatingWork] = useState(false);
  const [scope, setScope] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    clientsApi.list().then((result) => {
      setClients(result.clients);
      if (result.clients.length > 0) {
        const firstClient = result.clients[0];
        setClientId(firstClient.id);
        const active = firstClient.works.filter((w) => w.active);
        if (active.length > 0) {
          setWorkId(active[0].id);
          setIsCreatingWork(false);
          setNewWorkName('');
        } else {
          setWorkId('');
          setIsCreatingWork(true);
          setNewWorkName(firstClient.tradeName || firstClient.legalName || '');
        }
      } else {
        setClientId('');
        setWorkId('');
        setIsCreatingWork(false);
        setNewWorkName('');
      }
    }).catch((error: unknown) => {
      onError(error instanceof Error ? error.message : 'Não foi possível carregar clientes e obras.');
    }).finally(() => setLoading(false));
  }, [onError, open]);

  const selectedClient = useMemo(() => clients.find((client) => client.id === clientId), [clientId, clients]);
  const activeWorks = useMemo(() => selectedClient?.works.filter((work) => work.active) ?? [], [selectedClient]);

  const handleClientChange = (nextId: string) => {
    setClientId(nextId);
    const nextClient = clients.find((client) => client.id === nextId);
    if (!nextClient) {
      setWorkId('');
      setIsCreatingWork(false);
      setNewWorkName('');
      return;
    }
    const works = nextClient.works.filter((w) => w.active);
    if (works.length > 0) {
      setWorkId(works[0].id);
      setIsCreatingWork(false);
      setNewWorkName('');
    } else {
      setWorkId('');
      setIsCreatingWork(true);
      setNewWorkName(nextClient.tradeName || nextClient.legalName || '');
    }
  };

  const isWorkValid = (activeWorks.length === 0 || isCreatingWork)
    ? newWorkName.trim().length >= 2
    : Boolean(workId);
  const canSubmit = Boolean(clientId && isWorkValid && scope.trim().length >= 3 && !loading);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, loading, onClose]);

  if (!open) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      let finalWorkId = workId;
      if (activeWorks.length === 0 || isCreatingWork) {
        const obraName = newWorkName.trim();
        if (obraName.length < 2) {
          onError('O nome da obra deve conter pelo menos 2 caracteres.');
          setLoading(false);
          return;
        }
        const createdWork = await clientsApi.createWork(clientId, {
          name: obraName,
          address: null,
        });
        finalWorkId = createdWork.workId;
      }

      const result = await proposalApi.create({
        clientId,
        workId: finalWorkId,
        scope: scope.trim(),
        validUntil: validUntil || null,
      });
      onCreated(result.proposal);
      setScope('');
      setValidUntil('');
      setNewWorkName('');
      setIsCreatingWork(false);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível criar a proposta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <section className="new-proposal-dialog" role="dialog" aria-modal="true" aria-labelledby="new-proposal-title">
        <header>
          <div>
            <FilePlus2 size={22} />
            <span>
              <h2 id="new-proposal-title">Nova proposta</h2>
              <p>A numeração e a revisão 00 serão criadas automaticamente.</p>
            </span>
          </div>
          <button type="button" className="dialog-close" aria-label="Fechar" disabled={loading} onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <form onSubmit={(event) => void submit(event)}>
          <label htmlFor="new-proposal-client">
            <span><Building2 size={15} /> Cliente <b>*</b></span>
            <select
              id="new-proposal-client"
              value={clientId}
              disabled={loading}
              onChange={(event) => handleClientChange(event.target.value)}
            >
              <option value="">Selecione</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.tradeName || client.legalName}
                </option>
              ))}
            </select>
          </label>

          {activeWorks.length > 0 && !isCreatingWork ? (
            <label htmlFor="new-proposal-work">
              <span><MapPin size={15} /> Obra <b>*</b></span>
              <select
                id="new-proposal-work"
                value={workId}
                disabled={loading || !clientId}
                onChange={(event) => {
                  if (event.target.value === '__new__') {
                    setIsCreatingWork(true);
                    setWorkId('');
                    if (!newWorkName) {
                      setNewWorkName(selectedClient?.tradeName || selectedClient?.legalName || '');
                    }
                  } else {
                    setWorkId(event.target.value);
                  }
                }}
              >
                <option value="">Selecione</option>
                {activeWorks.map((work) => (
                  <option key={work.id} value={work.id}>
                    {work.name}
                  </option>
                ))}
                <option value="__new__">+ Cadastrar nova obra...</option>
              </select>
            </label>
          ) : (
            <label htmlFor="new-proposal-work-name">
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={15} /> {activeWorks.length > 0 ? 'Nova Obra' : 'Obra'} <b>*</b>
                </span>
                {activeWorks.length > 0 && (
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--blue)',
                      cursor: 'pointer',
                      fontSize: '11px',
                      padding: 0,
                    }}
                    onClick={() => {
                      setIsCreatingWork(false);
                      setWorkId(activeWorks[0]?.id ?? '');
                    }}
                  >
                    Selecionar existente
                  </button>
                )}
              </span>
              <input
                id="new-proposal-work-name"
                type="text"
                maxLength={180}
                placeholder={activeWorks.length > 0 ? 'Nome da nova obra' : 'Nome da obra (ex: Sede, Principal)'}
                value={newWorkName}
                disabled={loading || !clientId}
                onChange={(event) => setNewWorkName(event.target.value)}
              />
            </label>
          )}

          <label htmlFor="new-proposal-scope" className="wide">
            <span>Escopo da proposta <b>*</b></span>
            <input
              id="new-proposal-scope"
              autoFocus
              type="text"
              maxLength={300}
              value={scope}
              disabled={loading}
              onChange={(event) => setScope(event.target.value)}
            />
          </label>

          <label htmlFor="new-proposal-validity" className="wide">
            <span><CalendarDays size={15} /> Validade</span>
            <input
              id="new-proposal-validity"
              type="date"
              value={validUntil}
              disabled={loading}
              onChange={(event) => setValidUntil(event.target.value)}
            />
          </label>

          {clients.length === 0 && !loading && (
            <p className="dialog-warning">Cadastre um cliente antes de criar a proposta.</p>
          )}

          <footer>
            <button type="button" disabled={loading} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="primary" disabled={!canSubmit}>
              {loading ? 'Criando…' : 'Criar proposta'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
