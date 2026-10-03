import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw, UserPlus, Users } from 'lucide-react';
import type { ProposalSummary } from '../shared/contracts';
import { clientsApi, proposalApi } from './api';
import { EmptyState, PageHead, brl, nfmt, revText, statusChip } from './orcDeskUi';

type Props = { onRegistry: () => void; onOpenProposal?: (proposalId: string) => void };

type ClientRow = { name: string; proposals: ProposalSummary[]; open: number; approved: number; approvedCount: number };

const initials = (name: string) => name.split(/\s+/).filter((w) => w.length > 2).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || name.slice(0, 2).toUpperCase();
const IN_PROGRESS = new Set(['draft', 'review', 'sent']);

// Clientes (24m): propostas, em andamento e aprovado por cliente, abrindo as propostas de cada um.
export function ClientsOverview({ onRegistry, onOpenProposal }: Props) {
  const [rows, setRows] = useState<ClientRow[] | null>(null);
  const [failed, setFailed] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setRows(null); setFailed('');
    void Promise.all([proposalApi.list(), clientsApi.list()]).then(([proposalResult, clientResult]) => {
      if (!active) return;
      const map = new Map<string, ProposalSummary[]>();
      for (const client of clientResult.clients) map.set(client.tradeName?.trim() || client.legalName, []);
      // So a ultima revisao de cada proposta conta como proposta do cliente.
      for (const proposal of proposalResult.proposals.filter((p) => p.isLatest !== false)) {
        const list = map.get(proposal.clientName) ?? [];
        list.push(proposal);
        map.set(proposal.clientName, list);
      }
      const built: ClientRow[] = [...map.entries()].map(([name, proposals]) => {
        const approved = proposals.filter((p) => p.status === 'approved');
        return {
          name, proposals, open: proposals.filter((p) => IN_PROGRESS.has(p.status)).length,
          approved: approved.reduce((sum, p) => sum + p.totalSale, 0), approvedCount: approved.length,
        };
      }).sort((a, b) => b.approved - a.approved || b.proposals.length - a.proposals.length || a.name.localeCompare(b.name, 'pt-BR'));
      setRows(built);
    }).catch((error) => { if (active) setFailed(error instanceof Error ? error.message : 'Não foi possível carregar os clientes.'); });
    return () => { active = false; };
  }, [attempt]);

  const totalProposals = useMemo(() => (rows ?? []).reduce((sum, row) => sum + row.proposals.length, 0), [rows]);
  const head = <PageHead eyebrow="Comercial" title="Clientes" sub="Quem recebe propostas e quanto já foi aprovado">
    <button type="button" className="od-btn s" onClick={onRegistry}><UserPlus size={17} />Cadastro de clientes e obras</button>
  </PageHead>;

  if (failed) return <main className="od-page"><div className="od-stack">{head}<div className="od-card"><EmptyState icon={RefreshCw} tone="bad" title="Não deu para carregar os clientes"
    actions={<button type="button" className="od-btn p" onClick={() => setAttempt((n) => n + 1)}>Tentar de novo</button>}>{failed}</EmptyState></div></div></main>;

  return <main className="od-page" aria-busy={rows === null}><div className="od-stack">
    {head}
    <div className="od-card" style={{ overflow: 'hidden' }}>
      {rows === null && <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>{[0, 1, 2, 3].map((i) => <div key={i} className="od-skel" style={{ height: 40 }} />)}</div>}
      {rows !== null && rows.length === 0 && <EmptyState icon={Users} title="Nenhum cliente cadastrado" actions={<button type="button" className="od-btn p" onClick={onRegistry}><UserPlus size={17} />Cadastrar cliente</button>}>
        Os clientes aparecem aqui com as propostas de cada um.</EmptyState>}
      {rows !== null && rows.length > 0 && <div className="od-scroll"><table className="od-tbl">
        <thead><tr><th>Cliente</th><th className="od-num">Propostas</th><th className="od-num">Em andamento</th><th className="od-num">Aprovado</th><th style={{ width: 60 }} /></tr></thead>
        <tbody>{rows.map((row) => {
          const isOpen = open === row.name;
          return <Fragment key={row.name}>
            <tr className="rw" onClick={() => setOpen(isOpen ? null : row.name)} aria-expanded={isOpen}>
              <td><span style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span className="od-ini">{initials(row.name)}</span><b>{row.name}</b></span></td>
              <td className="od-num">{nfmt(row.proposals.length)}</td><td className="od-num">{nfmt(row.open)}</td>
              <td className="od-num" style={{ fontWeight: 600 }}>{row.approvedCount ? brl(row.approved) : '—'}</td>
              <td>{isOpen ? <ChevronDown size={16} style={{ color: 'var(--muted)' }} /> : <ChevronRight size={16} style={{ color: 'var(--muted)' }} />}</td>
            </tr>
            {isOpen && row.proposals.length === 0 && <tr style={{ background: 'var(--surface-subtle)' }}><td colSpan={5} style={{ paddingLeft: 60 }} className="od-small">Este cliente ainda não tem propostas.</td></tr>}
            {isOpen && row.proposals.map((proposal) => {
              const chip = statusChip(proposal.status);
              return <tr key={proposal.id} className="rw" style={{ background: 'var(--surface-subtle)' }} onClick={() => onOpenProposal?.(proposal.id)}>
                <td style={{ paddingLeft: 60 }}><span className="od-item"><b>{proposal.workName}</b><span>{proposal.number} · {revText(proposal.revision)}</span></span></td>
                <td colSpan={2}><span className={`od-chip ${chip.tone === 'vio' ? 'info' : chip.tone}`}>{chip.label}</span></td>
                <td className="od-num">{proposal.itemCount ? brl(proposal.totalSale) : 'sem itens'}</td>
                <td><ChevronRight size={16} style={{ color: 'var(--muted)' }} /></td>
              </tr>;
            })}
          </Fragment>;
        })}</tbody>
      </table></div>}
      {rows !== null && rows.length > 0 && <div className="od-footer"><span>{nfmt(rows.length)} clientes · {nfmt(totalProposals)} propostas</span></div>}
    </div>
  </div></main>;
}
