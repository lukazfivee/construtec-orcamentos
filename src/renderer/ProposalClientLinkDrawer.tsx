import { useCallback, useEffect, useState } from 'react';
import { Check, CheckCircle2, Copy, Eye, Link2, Loader2, MessageCircle, Send } from 'lucide-react';
import type { ClientLinkInfo, ProposalDetail } from '../shared/contracts';
import { proposalApi } from './api';
import { openExternalUrl } from './proposalPdfActions';
import { revLabel } from './proposalPdfPages';

type Props = {
  proposal: ProposalDetail;
  canManage: boolean;
  onClose: () => void;
  onChanged: (proposal?: ProposalDetail) => void;
  showNotice: (message: string) => void;
};

const DAYS = [7, 15, 30];
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const when = (value: string) => {
  // O Postgres devolve "2026-11-03 20:15:00+00".
  const date = new Date(value.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00'));
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};
const day = (value: string) => { const [y, m, d] = value.slice(0, 10).split('-'); return d ? `${d}/${m}/${y}` : ''; };
const absolute = (url: string) => (/^https?:/.test(url) ? url : `${window.location.origin}${url}`);

const STATE_TEXT: Partial<Record<ClientLinkInfo['state'], [string, string]>> = {
  disabled: ['Link desativado', 'Quem abrir vê um aviso de link desativado. Gere um novo link para enviar de novo.'],
  expired: ['Link vencido', 'O prazo do link acabou. Gere um novo link para o cliente.'],
  superseded: ['Link de uma revisão antiga', 'Existe uma revisão mais nova desta proposta; gere o link dela.'],
  adjust: ['Cliente pediu ajuste', 'A proposta voltou para edição como nova revisão. Ajuste e envie de novo.'],
  confirmed: ['Aprovação confirmada', 'A proposta está aprovada com o aceite do cliente como evidência.'],
};

// Link para o cliente ver e aprovar (Rodada 27D). Gerar, desativar e confirmar exigem p11 (o servidor confere de novo).
export function ProposalClientLinkDrawer({ proposal, canManage, onClose, onChanged, showNotice }: Props) {
  const [link, setLink] = useState<ClientLinkInfo | null | undefined>(undefined);
  const [days, setDays] = useState(30);
  const [identity, setIdentity] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [problem, setProblem] = useState('');
  const canIssue = canManage && proposal.isLatest && (proposal.status === 'review' || proposal.status === 'sent');

  const load = useCallback(async () => {
    try { setLink((await proposalApi.clientLink(proposal.id)).link); }
    catch (error) { setProblem(error instanceof Error ? error.message : 'Não foi possível carregar o link.'); setLink(null); }
  }, [proposal.id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setProblem('');
    try { await action(); } catch (error) { setProblem(error instanceof Error ? error.message : 'Não foi possível concluir agora.'); } finally { setBusy(false); }
  };
  const generate = () => run(async () => {
    const result = await proposalApi.createClientLink(proposal.id, { days, requireIdentity: identity });
    setLink(result.link);
    onChanged();
    showNotice('Link gerado.');
  });
  const disable = () => run(async () => {
    const result = await proposalApi.disableClientLink(proposal.id);
    setLink(result.link);
    showNotice('Link desativado.');
  });
  const confirm = () => run(async () => {
    const result = await proposalApi.confirmClientApproval(proposal.id);
    onChanged(result.proposal);
    showNotice('Proposta aprovada.');
    onClose();
  });

  const url = link ? absolute(link.url) : '';
  const message = `Olá! Segue o link para ver e aprovar a proposta ${proposal.number} (${revLabel(proposal.revision)}) da Construtec para ${proposal.workName || proposal.clientName}, no valor de ${money.format(proposal.totals.finalValue ?? 0)}.\n${url}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 2500); }
    catch { showNotice('Não foi possível copiar. Selecione o endereço e copie.'); }
  };
  const reply = link?.response;
  const note = link ? STATE_TEXT[link.state] : undefined;
  const views = link?.views ?? [];

  return (
    <div className="side-drawer-layer">
      <button type="button" className="side-drawer-scrim" aria-label="Fechar painel" disabled={busy} onClick={onClose} />
      <aside className="side-drawer" role="dialog" aria-modal="true" aria-label="Link para o cliente">
        <header>
          <span className="side-drawer-icon" aria-hidden="true"><Link2 size={18} /></span>
          <div><h2>Link para o cliente</h2><p>{proposal.number} · {revLabel(proposal.revision)} · {proposal.workName || proposal.clientName}</p></div>
        </header>
        <div className="side-drawer-body">
          {link === undefined && <p className="side-drawer-note"><Loader2 size={14} className="spinning" /> Carregando…</p>}
          {note && <div className="drawer-warn" role="note"><b>{note[0]}.</b> {note[1]}</div>}
          {reply && (
            <div className="drawer-attach"><CheckCircle2 size={20} /><span>
              <b>{reply.kind === 'approved' ? 'O cliente aprovou' : 'Pedido de ajuste'} · {when(reply.at)}</b>
              <small>{[reply.name, reply.role].filter(Boolean).join(' · ')}{reply.code ? ` · código ${reply.code}` : ''}</small>
              {reply.message && <small>{reply.message}</small>}
            </span></div>
          )}
          {link?.state === 'active' && (
            <>
              <div className="kv-line"><span>Vale até</span><b>{day(link.expiresAt)}</b></div>
              <div className="kv-line"><span>Nome e cargo</span><b>{link.requireIdentity ? 'O cliente informa' : 'Não pede'}</b></div>
              <label className="drawer-field"><span>Endereço do link</span><input type="text" readOnly value={url} onFocus={(event) => event.currentTarget.select()} /></label>
              <div className="drawer-row">
                <button type="button" className="flow-btn" onClick={() => void copy()}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copiado' : 'Copiar'}</button>
                {canManage && <button type="button" className="flow-btn" onClick={() => openExternalUrl(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`)}><MessageCircle size={16} /> WhatsApp</button>}
              </div>
            </>
          )}
          {link && (
            <div className="drawer-attach"><Eye size={20} /><span><b>Visualizações: {views.length}</b>
              {views.length ? views.slice(0, 5).map((v, i) => <small key={i}>{when(v.at)} · {v.device || 'Aparelho'}</small>) : <small>O cliente ainda não abriu o link.</small>}
            </span></div>
          )}
          {link?.state === 'approved' && (
            <p className="side-drawer-note">A aprovação do cliente fica como evidência. A proposta só passa para Aprovada quando você confirma.</p>
          )}
          {link !== undefined && (!link || ['disabled', 'expired', 'superseded', 'adjust'].includes(link.state)) && (
            canIssue ? (
              <>
                <fieldset className="drawer-field"><legend>Validade do link</legend>
                  <div className="drawer-row">
                    {DAYS.map((d) => <button key={d} type="button" className={`flow-btn${days === d ? ' primary' : ''}`} aria-pressed={days === d} onClick={() => setDays(d)}>{d} dias</button>)}
                  </div>
                </fieldset>
                <button type="button" className="drawer-switch" role="switch" aria-checked={identity} onClick={() => setIdentity((v) => !v)}>
                  <span><b>Pedir nome e cargo</b><small>O cliente informa quem está aprovando</small></span><i className="switch" />
                </button>
                <p className="side-drawer-note">Gerar o link conta como envio: a proposta passa para Enviada. O cliente vê só preços de venda.</p>
              </>
            ) : <p className="side-drawer-note">{proposal.status === 'draft' ? 'Envie a proposta para revisão antes de gerar o link.' : !canManage ? 'Seu papel não permite gerar o link.' : 'Só a revisão atual pode ter link.'}</p>
          )}
          {problem && <p className="drawer-problem" role="alert">{problem}</p>}
        </div>
        <footer>
          <button type="button" className="flow-btn" disabled={busy} onClick={onClose}>Fechar</button>
          {link?.state === 'active' && canManage && <button type="button" className="flow-btn" disabled={busy} onClick={() => void disable()}>Desativar link</button>}
          {link?.state === 'approved' && canManage && proposal.isLatest && (
            <button type="button" className="flow-btn primary" disabled={busy} onClick={() => void confirm()}>{busy ? <Loader2 size={16} className="spinning" /> : <CheckCircle2 size={16} />} Confirmar aprovação</button>
          )}
          {link !== undefined && (!link || ['disabled', 'expired', 'superseded', 'adjust'].includes(link.state)) && canIssue && (
            <button type="button" className="flow-btn primary" disabled={busy} onClick={() => void generate()}>{busy ? <Loader2 size={16} className="spinning" /> : <Send size={16} />} Gerar link</button>
          )}
        </footer>
      </aside>
    </div>
  );
}
