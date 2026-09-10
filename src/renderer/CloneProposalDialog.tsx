import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Copy,
  FileSpreadsheet,
  Loader2,
  MapPin,
  X,
} from 'lucide-react';
import type { ClientRecord, ProposalDetail } from '../shared/contracts';
import { clientsApi, proposalApi } from './api';

export interface SourceProposalInfo {
  id: string;
  number: string;
  revision: number;
  clientName: string;
  workName: string;
  scope?: string;
  itemCount?: number;
}

interface CloneProposalDialogProps {
  open: boolean;
  sourceProposal: SourceProposalInfo | null;
  onClose: () => void;
  onCloned: (newProposal: ProposalDetail) => void;
  onError: (message: string) => void;
}

export function CloneProposalDialog({
  open,
  sourceProposal,
  onClose,
  onCloned,
  onError,
}: CloneProposalDialogProps) {
  const [targetMode, setTargetMode] = useState<'same' | 'change'>('same');
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [clientId, setClientId] = useState('');
  const [workId, setWorkId] = useState('');
  const [scope, setScope] = useState('');
  const [loadingClients, setLoadingClients] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !sourceProposal) return;
    setTargetMode('same');
    setLoadingClients(true);

    if (sourceProposal.scope !== undefined) {
      setScope(sourceProposal.scope || '');
    } else {
      proposalApi
        .byId(sourceProposal.id)
        .then((res) => setScope(res.proposal.scope || ''))
        .catch(() => setScope(''));
    }

    clientsApi
      .list()
      .then((res) => {
        setClients(res.clients);
        const firstWithWork = res.clients.find((c) => c.works.some((w) => w.active));
        if (firstWithWork) {
          setClientId(firstWithWork.id);
          const activeWork = firstWithWork.works.find((w) => w.active);
          setWorkId(activeWork?.id ?? '');
        }
      })
      .catch((err: unknown) => {
        onError(err instanceof Error ? err.message : 'Não foi possível listar clientes.');
      })
      .finally(() => setLoadingClients(false));
  }, [open, sourceProposal, onError]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId),
    [clientId, clients]
  );
  const activeWorks = selectedClient?.works.filter((w) => w.active) ?? [];

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, submitting, onClose]);

  if (!open || !sourceProposal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (targetMode === 'change' && (!clientId || !workId)) {
      onError('Selecione o cliente e a obra para o novo orçamento.');
      return;
    }

    setSubmitting(true);
    try {
      const payload =
        targetMode === 'change'
          ? { clientId, workId, scope: scope.trim() }
          : { scope: scope.trim() };

      const result = await proposalApi.clone(sourceProposal.id, payload);
      onCloned(result.proposal);
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao clonar o orçamento.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <section
        className="new-proposal-dialog clone-proposal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clone-proposal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <Copy size={22} />
            <span>
              <h2 id="clone-proposal-title">Duplicar / Clonar Proposta</h2>
              <p>
                Origem: <b>{sourceProposal.number}</b> (REV.{String(sourceProposal.revision).padStart(2, '0')}) — {sourceProposal.clientName}
              </p>
            </span>
          </div>
          <button type="button" className="dialog-close" aria-label="Fechar" onClick={onClose} disabled={submitting}>
            <X size={18} />
          </button>
        </header>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="clone-mode-selector wide">
            <label className="radio-option">
              <input
                type="radio"
                name="targetMode"
                value="same"
                checked={targetMode === 'same'}
                onChange={() => setTargetMode('same')}
                disabled={submitting}
              />
              <span>
                <strong>Manter mesmo cliente e obra</strong>
                <small>{sourceProposal.clientName} • {sourceProposal.workName}</small>
              </span>
            </label>

            <label className="radio-option">
              <input
                type="radio"
                name="targetMode"
                value="change"
                checked={targetMode === 'change'}
                onChange={() => setTargetMode('change')}
                disabled={submitting}
              />
              <span>
                <strong>Selecionar outro cliente / obra</strong>
                <small>Replicar itens e composição para um novo destinatário</small>
              </span>
            </label>
          </div>

          {targetMode === 'change' && (
            <>
              <label htmlFor="clone-client">
                <span><Building2 size={15} /> Novo Cliente <b>*</b></span>
                <select
                  id="clone-client"
                  value={clientId}
                  disabled={submitting || loadingClients}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    const nextClient = clients.find((c) => c.id === nextId);
                    setClientId(nextId);
                    setWorkId(nextClient?.works.find((w) => w.active)?.id ?? '');
                  }}
                >
                  <option value="">Selecione um cliente...</option>
                  {clients
                    .filter((c) => c.works.some((w) => w.active))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.tradeName || c.legalName}
                      </option>
                    ))}
                </select>
              </label>

              <label htmlFor="clone-work">
                <span><MapPin size={15} /> Nova Obra <b>*</b></span>
                <select
                  id="clone-work"
                  value={workId}
                  disabled={submitting || !clientId}
                  onChange={(e) => setWorkId(e.target.value)}
                >
                  <option value="">Selecione uma obra...</option>
                  {activeWorks.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label htmlFor="clone-scope" className="wide">
            <span>Escopo da nova proposta <b>*</b></span>
            <input
              id="clone-scope"
              type="text"
              required
              minLength={3}
              maxLength={300}
              value={scope}
              disabled={submitting}
              onChange={(e) => setScope(e.target.value)}
              placeholder="Ex: Instalação de CFTV e controle de acesso"
            />
          </label>

          <div className="clone-summary-box wide">
            <div className="clone-summary-title">
              <FileSpreadsheet size={15} />
              <span>O que será gerado automaticamente:</span>
            </div>
            <ul>
              <li>
                <CheckCircle2 size={13} className="check-icon" />
                Novo número oficial sequencial (ex: <b>PA-XXXX</b>) na revisão <b>00</b> em modo rascunho.
              </li>
              <li>
                <CheckCircle2 size={13} className="check-icon" />
                Todos os itens de materiais com descrições e custos unitários congelados.
              </li>
              <li>
                <CheckCircle2 size={13} className="check-icon" />
                Toda a composição de mão de obra e taxa horária de encargos.
              </li>
              <li>
                <CheckCircle2 size={13} className="check-icon" />
                BDI, condições comerciais e regras fiscais da proposta original.
              </li>
            </ul>
          </div>

          <footer>
            <button type="button" disabled={submitting} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="primary" disabled={submitting || scope.trim().length < 3}>
              {submitting ? <Loader2 className="spinning" size={15} /> : <Copy size={15} />}
              {submitting ? 'Duplicando…' : 'Criar Novo Orçamento'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
