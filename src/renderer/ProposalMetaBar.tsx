import { useEffect, useState, type ReactNode } from 'react';
import {
  Building2,
  ChevronDown,
  ExternalLink,
  MapPin,
  Search,
} from 'lucide-react';
import type { ClientRecord, ProposalDetail } from '../shared/contracts';
import { clientsApi, proposalApi } from './api';

const statusClasses: Record<ProposalDetail['status'], string> = {
  draft: 'status-draft',
  review: 'status-review',
  sent: 'status-sent',
  approved: 'status-approved',
  rejected: 'status-rejected',
};

const statusLabels: Record<ProposalDetail['status'], string> = {
  draft: 'Em edição',
  review: 'Em revisão',
  sent: 'Enviada',
  approved: 'Aprovada',
  rejected: 'Recusada',
};

const date = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });

function MetaField({
  label,
  value,
  icon,
  accent = false,
  disabled = false,
  onClick,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  accent?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="meta-field">
      <span>{label}</span>
      <button type="button" className={accent ? 'accent' : ''} disabled={disabled} onClick={onClick}>
        {icon}
        {value}
        {!disabled && <ChevronDown size={14} />}
      </button>
    </div>
  );
}

type Props = {
  proposal: ProposalDetail;
  isEditable: boolean;
  mutationPending: boolean;
  setMutationPending: (pending: boolean) => void;
  onProposalUpdate: (proposal: ProposalDetail) => void;
  onProposalTabsReload: () => void;
  onManageClients: () => void;
  showNotice: (message: string) => void;
  setError: (error: string) => void;
  setCatalogOpen: (open: boolean) => void;
};

export function ProposalMetaBar({
  proposal,
  isEditable,
  mutationPending,
  setMutationPending,
  onProposalUpdate,
  onProposalTabsReload,
  onManageClients,
  showNotice,
  setError,
  setCatalogOpen,
}: Props) {
  const [contextOpen, setContextOpen] = useState(false);
  const [contextQuery, setContextQuery] = useState('');
  const [contextClients, setContextClients] = useState<ClientRecord[]>([]);
  const [contextLoading, setContextLoading] = useState(false);

  useEffect(() => {
    if (!contextOpen) return undefined;
    let active = true;
    const timer = window.setTimeout(async () => {
      setContextLoading(true);
      try {
        const result = await clientsApi.list(contextQuery);
        if (active) setContextClients(result.clients);
      } catch (contextError) {
        if (active) setError(contextError instanceof Error ? contextError.message : 'Não foi possível carregar clientes e obras.');
      } finally {
        if (active) setContextLoading(false);
      }
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [contextOpen, contextQuery, setError]);

  const updateProposalStatusDirect = async (newStatus: ProposalDetail['status']) => {
    if (mutationPending) return;
    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.updateStatus(proposal.id, newStatus);
      onProposalUpdate(result.proposal);
      showNotice(`Status alterado para "${statusLabels[newStatus]}".`);
      onProposalTabsReload();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Não foi possível alterar o status.');
    } finally {
      setMutationPending(false);
    }
  };

  const updateProposalContext = async (clientId: string, workId: string) => {
    if (!proposal.isLatest || mutationPending) return;
    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.updateContext(proposal.id, clientId, workId);
      onProposalUpdate(result.proposal);
      setContextOpen(false);
      showNotice('Cliente e obra atualizados nesta revisão.');
    } catch (contextError) {
      setError(contextError instanceof Error ? contextError.message : 'Não foi possível alterar o cliente e a obra.');
    } finally {
      setMutationPending(false);
    }
  };

  return (
    <>
      <div className="proposal-meta">
        <MetaField
          label="Cliente"
          value={proposal.clientName ?? '—'}
          icon={<Building2 size={19} />}
          disabled={!isEditable || mutationPending}
          onClick={() => {
            setCatalogOpen(false);
            setContextOpen((value) => !value);
          }}
        />
        <MetaField
          label="Obra"
          value={proposal.workName ?? '—'}
          disabled={!isEditable || mutationPending}
          onClick={() => {
            setCatalogOpen(false);
            setContextOpen((value) => !value);
          }}
        />
        <div className="meta-field status-field">
          <label>Status</label>
          <select
            className={`status-select ${statusClasses[proposal.status ?? 'draft']}`}
            value={proposal.status ?? 'draft'}
            disabled={mutationPending || !proposal.isLatest || proposal.status === 'approved'}
            title={proposal.status === 'approved' ? 'Proposta aprovada: crie uma nova revisão para alterar.' : undefined}
            onChange={(e) => void updateProposalStatusDirect(e.target.value as ProposalDetail['status'])}
          >
            <option value="draft">Em edição</option>
            <option value="review">Em revisão</option>
            <option value="sent">Enviada</option>
            <option value="approved">Aprovada</option>
            <option value="rejected">Recusada</option>
          </select>
        </div>
        <MetaField label="Validade" value={proposal.validUntil ? date.format(new Date(`${proposal.validUntil}T00:00:00Z`)) : '—'} disabled />
        <MetaField label="Responsável" value={proposal.responsibleName ?? '—'} disabled />
      </div>

      {contextOpen && (
        <div className="context-popover" role="dialog" aria-label="Selecionar cliente e obra">
          <div className="popover-heading">
            <span>
              <b>Selecionar cliente e obra</b>
              <small>A alteração vale somente para esta revisão.</small>
            </span>
            <button
              type="button"
              onClick={() => {
                onManageClients();
                setContextOpen(false);
              }}
            >
              Gerenciar clientes <ExternalLink size={12} />
            </button>
          </div>
          <label className="catalog-search">
            <Search size={15} />
            <input
              autoFocus
              value={contextQuery}
              onChange={(event) => setContextQuery(event.target.value)}
              placeholder="Buscar cliente, documento ou obra"
              aria-label="Buscar cliente ou obra"
            />
            <kbd>Esc</kbd>
          </label>
          <div className="context-results" aria-busy={contextLoading}>
            {contextLoading && <p className="catalog-message">Carregando cadastros locais…</p>}
            {!contextLoading &&
              contextClients.map((client) => {
                const activeWorks = client.works.filter((work) => work.active);
                return (
                  <section key={client.id}>
                    <h3>
                      {client.tradeName || client.legalName}
                      <small>{client.document || client.legalName}</small>
                    </h3>
                    {activeWorks.map((work) => (
                      <button
                        type="button"
                        key={work.id}
                        disabled={mutationPending}
                        onClick={() => void updateProposalContext(client.id, work.id)}
                      >
                        <MapPin size={16} />
                        <span>
                          {work.name}
                          <small>{work.address || 'Endereço não informado'}</small>
                        </span>
                        {proposal.workId === work.id && <em>Selecionada</em>}
                      </button>
                    ))}
                    {activeWorks.length === 0 && <p>Nenhuma obra ativa</p>}
                  </section>
                );
              })}
            {!contextLoading && contextClients.length === 0 && <p className="catalog-message">Nenhum cliente ou obra encontrado.</p>}
          </div>
          <div className="popover-footer">
            <span>Escolha uma obra para atualizar os dois campos</span>
            <span><kbd>Esc</kbd> Fechar</span>
          </div>
        </div>
      )}
    </>
  );
}
