import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Clock, FileText, Info, Loader2, LockKeyhole, LogIn, LogOut, Package, RefreshCw, Tag, Unplug, WifiOff } from 'lucide-react';
import type { PriceDriftProposal, ProposalDetail } from '../shared/contracts';
import { formatSyncDate } from './catalogImportHelpers';
import { exsatCardPill, syncDisabledReason } from './CatalogHome';
import { EmptyState, PageHead, Seg, brl, nfmt, pctSigned, plural, revText, signBrl, statusChip } from './orcDeskUi';
import { PriceDriftDrawer } from './PriceDriftDrawer';
import type { CatalogOverviewData } from './useCatalogOverview';
import type { ExsatSync } from './useExsatSync';

type Props = {
  data: CatalogOverviewData;
  sync: ExsatSync;
  seesCost: boolean;
  canWrite: boolean;
  canEdit: boolean;
  onBack: () => void;
  onOpenProposal: (proposalId: string) => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
};

type Fil = 'todos' | 'sub' | 'des';

// Integracao EXSAT (24g a 24i, 24s e 24t): status, contadores, mudancas de preco com onde cada item e usado e as propostas afetadas.
export function ExsatPage({ data, sync, seesCost, canWrite, canEdit, onBack, onOpenProposal, onNotice, onError }: Props) {
  const [fil, setFil] = useState<Fil>('todos');
  const [drawer, setDrawer] = useState<PriceDriftProposal | null>(null);
  const { overview, rows, drift } = data;
  const pill = exsatCardPill(sync);
  const reason = syncDisabledReason(sync, canWrite);
  const up = rows.filter((row) => row.pct > 0).length, down = rows.filter((row) => row.pct < 0).length;
  const shown = rows.filter((row) => fil === 'todos' || (fil === 'sub' ? row.pct > 0 : row.pct < 0));
  const frozen = overview?.frozenProposals ?? [];
  const lastAt = sync.info.lastSyncAt ? formatSyncDate(sync.info.lastSyncAt) : 'a última vez';
  const newItems = overview?.newItems ?? [];

  const frozenText = useMemo(() => {
    if (!frozen.length) return '';
    const names = frozen.slice(0, 3).map((f) => `${f.number} · ${revText(f.revision)} (${statusChip(f.status).label.toLowerCase()})`);
    const more = frozen.length > 3 ? ` e mais ${frozen.length - 3}` : '';
    return `${names.join(', ')}${more} ${frozen.length === 1 ? 'mantém' : 'mantêm'} os preços de quando ${frozen.length === 1 ? 'foi montada' : 'foram montadas'}. Os preços novos entram se você criar a próxima revisão.`;
  }, [frozen]);

  const header = <PageHead eyebrow="Cadastros" title="Integração EXSAT" sub="Preços do distribuidor chegando no catálogo e nas propostas">
    <button type="button" className="od-btn s" onClick={onBack}>Voltar ao catálogo</button>
    <button type="button" className="od-btn p" disabled={!!reason || sync.busy} title={reason || undefined} onClick={() => void sync.run()}>
      {sync.busy ? <Loader2 size={17} className="od-spin" /> : <RefreshCw size={17} />}{sync.busy ? `Sincronizando… ${sync.phase.pct}%` : 'Sincronizar agora'}
    </button>
  </PageHead>;

  if (data.loading && !overview) return <main className="od-page" aria-busy="true"><div className="od-stack">
    {header}
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)' }}><Loader2 size={16} className="od-spin" />Conectando ao EXSAT…</div>
    <div className="od-skel" style={{ height: 150 }} />
    <div className="od-kpis">{[0, 1, 2, 3].map((i) => <div key={i} className="od-skel" style={{ height: 96 }} />)}</div>
    <div className="od-cols"><div className="od-skel" style={{ height: 260 }} /><div className="od-skel" style={{ height: 260 }} /></div>
  </div></main>;

  const statusCard = <div className="od-card">
    <div className="od-ex-head">
      <span className="od-ex-badge">EX</span>
      <span className="od-grow"><b>EXSAT</b><span>Distribuidor de sistemas especiais · catálogo e preços de custo</span></span>
      <span className={`od-chip ${pill.tone}`}>{pill.tone === 'bad' ? <WifiOff size={13} /> : pill.tone === 'ok' ? <CheckCircle2 size={13} /> : <Info size={13} />}{pill.text}</span>
      {sync.desktop && (sync.connected
        ? <button type="button" className="od-btn sm s" disabled={sync.busy} onClick={() => void sync.logout()}><LogOut size={14} />Desconectar</button>
        : <button type="button" className="od-btn sm p" disabled={sync.busy || !sync.statusReady} onClick={() => void sync.login()}><LogIn size={14} />Entrar na Exsat</button>)}
    </div>
    <div className="od-kv">
      <span><span>Conta</span><b>{sync.desktop ? (sync.connected ? 'Conectada' : 'Não conectada') : 'Só no aplicativo'}</b></span>
      <span><span>Última sincronização</span><b>{sync.desktop ? formatSyncDate(sync.info.lastSyncAt) : '—'}</b></span>
      <span><span>Última varredura completa</span><b>{sync.desktop ? formatSyncDate(sync.info.lastFullSyncAt) : '—'}</b></span>
      <span><span>Itens no catálogo</span><b>{overview ? nfmt(overview.productCount) : '—'}</b></span>
    </div>
    {sync.busy && <div role="status" style={{ padding: '0 20px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Loader2 size={15} className="od-spin" />{sync.phase.text}</span><b>{sync.phase.pct}%</b></div>
      <span className="od-bar"><span style={{ width: `${sync.phase.pct}%` }} /></span>
    </div>}
    {!sync.desktop && <div className="od-note" style={{ margin: '0 20px 18px' }}><Info size={17} /><span>A varredura do EXSAT usa a conta conectada no aplicativo do computador. No site você vê o que mudou no catálogo e atualiza as propostas em edição.</span></div>}
  </div>;

  const failure = sync.error ?? (data.error ? { kind: data.error.offline ? 'offline' as const : 'other' as const, message: data.error.message } : null);
  if (failure && !sync.busy) {
    const off = failure.kind === 'offline';
    return <main className="od-page"><div className="od-stack">
      {header}{statusCard}
      <div className="od-card"><EmptyState icon={Unplug} tone="bad" title={off ? 'Sem internet' : (failure.kind === 'timeout' ? 'O EXSAT não respondeu' : 'Não deu para consultar os preços')}
        actions={<>
          <button type="button" className="od-btn p" onClick={() => { sync.clearError(); if (data.error) void data.reload(); else if (!reason) void sync.run(); }}><RefreshCw size={17} />Tentar de novo</button>
          <button type="button" className="od-btn s" onClick={onBack}>Voltar ao catálogo</button>
        </>}>
        {off ? `Conecte o computador para sincronizar. O catálogo continua com os preços de ${lastAt} e as propostas não mudam.`
          : `${failure.message} O catálogo continua com os preços de ${lastAt}. Tente de novo em alguns minutos.`}
      </EmptyState></div>
    </div></main>;
  }

  const kpi = (label: string, value: string, sub: string, Icon: typeof Clock, tone: 'info' | 'ok' | 'warn') => <div className="od-card od-kpi" key={label}>
    <div className="od-kpi-top"><span className="od-lbl">{label}</span><span className={`od-kpi-ic od-chip ${tone}`} style={{ padding: 0, width: 28, height: 28, justifyContent: 'center' }}><Icon size={15} /></span></div>
    <span className="od-kpi-v">{value}</span><span className="od-kpi-s">{sub}</span>
  </div>;

  const last = sync.last;
  const lastText = sync.info.lastSyncAt ? formatSyncDate(sync.info.lastSyncAt) : 'Nunca';
  return <main className="od-page"><div className="od-stack">
    {header}{statusCard}
    {last && !sync.busy && <div className="od-note ok" role="status"><RefreshCw size={17} /><span>Sincronizado agora · {plural(last.created, 'item novo', 'itens novos')} · {plural(last.updated, 'preço ou dado atualizado', 'preços ou dados atualizados')}{last.rose || last.fell ? ` (${last.rose} subiu, ${last.fell} baixou)` : ''}{last.skipped ? ` · ${plural(last.skipped, 'item não confirmado ficou de fora', 'itens não confirmados ficaram de fora')}` : ''}{last.failedPages ? ` · ${plural(last.failedPages, 'página não pôde ser lida', 'páginas não puderam ser lidas')}` : ''}.</span></div>}

    <div className="od-kpis">
      {kpi('Última sincronização', sync.desktop ? lastText : '—', sync.desktop ? (last ? 'feita por você agora' : 'EXSAT') : 'só no aplicativo', Clock, 'info')}
      {kpi('Itens no catálogo', overview ? nfmt(overview.productCount) : '—', overview?.newCount ? plural(overview.newCount, 'item novo', 'itens novos') : 'sem itens novos', Package, 'info')}
      {kpi('Preços que mudaram', nfmt(rows.length), rows.length ? `${up} subiu, ${down} baixou` : 'nada mudou', Tag, rows.length ? 'warn' : 'ok')}
      {kpi('Propostas afetadas', nfmt(drift.length), drift.length ? 'em edição, com preço antigo' : 'nenhuma em edição', FileText, drift.length ? 'warn' : 'ok')}
    </div>

    <div className="od-cols">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {rows.length > 0 ? <div className="od-card" style={{ overflow: 'hidden' }}>
          <div className="od-toolbar" style={{ justifyContent: 'space-between' }}>
            <span className="od-grow"><b style={{ fontSize: 15, fontWeight: 600 }}>Mudanças de preço</b><span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Preço do catálogo diferente do que as propostas em edição usam</span></span>
            <Seg<Fil> label="Filtrar mudanças" value={fil} onChange={setFil} options={[['todos', `Todos · ${rows.length}`], ['sub', `Subiram · ${up}`], ['des', `Baixaram · ${down}`]]} />
          </div>
          <div className="od-scroll"><table className="od-tbl">
            <thead><tr><th>Item</th>{seesCost && <><th className="od-num">Antes</th><th className="od-num">Depois</th></>}<th>Variação</th><th>Usado em</th></tr></thead>
            <tbody>{shown.map((row) => <tr key={row.code}>
              <td><span className="od-item"><b>{row.description}</b><span>{row.code}</span></span></td>
              {seesCost && <><td className="od-num">{row.from !== undefined ? brl(row.from) : '—'}</td>
              <td className="od-num" style={{ fontWeight: 600 }}>{row.to !== undefined ? brl(row.to) : '—'}</td></>}
              <td><span className={`od-chip ${row.pct > 0 ? 'warn' : 'ok'}`}>{row.pct > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{pctSigned(row.pct)}</span></td>
              <td style={{ fontSize: 12.5, color: 'var(--muted)' }}>{row.used.join(', ')}</td>
            </tr>)}</tbody>
          </table></div>
          {shown.length === 0 && <div className="od-empty">Nenhum item nesse filtro.</div>}
        </div> : <div className="od-card"><EmptyState icon={CheckCircle2} tone="ok" title="Nenhum preço mudou">
          Os itens das propostas em edição continuam com o mesmo preço do catálogo. Quando o catálogo for atualizado pelo EXSAT, os avisos aparecem aqui e dentro de cada proposta.{last ? ` Na sincronização de agora, ${nfmt(last.same)} itens continuaram com o mesmo preço.` : ''}
        </EmptyState></div>}

        {newItems.length > 0 && <div className="od-card" style={{ overflow: 'hidden' }}>
          <div className="od-sect-head"><b>Itens novos no catálogo</b><span>Entraram nos últimos 7 dias</span></div>
          <table className="od-tbl"><tbody>{newItems.slice(0, 10).map((row) => <tr key={row.code}>
            <td><span className="od-item"><b>{row.description}</b><span>{row.code}</span></span></td>
            {seesCost && <td className="od-num" style={{ fontWeight: 600 }}>{row.currentCost !== undefined ? brl(row.currentCost) : '—'}</td>}
          </tr>)}</tbody></table>
          {newItems.length > 10 && <div className="od-footer"><span>+ {nfmt(newItems.length - 10)} itens novos no catálogo</span></div>}
        </div>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="od-card" style={{ overflow: 'hidden' }}>
          <div className="od-sect-head"><b>Propostas em edição</b><span>Usam itens com preço antigo</span></div>
          {drift.map((proposal) => <div className="od-propcard" key={proposal.id}>
            <span className="od-grow"><span className="od-lbl">{proposal.number} · {revText(proposal.revision)}</span><b>{proposal.workName || proposal.clientName}</b>
              <span style={{ fontSize: 12 }}>{plural(proposal.items.length, 'item com preço novo', 'itens com preço novo')} · valor final {signBrl(proposal.finalDelta)}</span></span>
            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button type="button" className="od-btn sm s" onClick={() => onOpenProposal(proposal.id)}>Ver proposta</button>
              {canEdit && <button type="button" className="od-btn sm p" onClick={() => setDrawer(proposal)}><RefreshCw size={14} />Atualizar preços</button>}
            </span>
          </div>)}
          {drift.length === 0 && <div className="od-propcard"><CheckCircle2 size={18} style={{ color: 'var(--od-ok-fg)' }} /><span className="od-grow"><span>Nenhuma proposta em edição usa itens com preço mudado.</span></span></div>}
        </div>
        {frozenText && <div className="od-note"><LockKeyhole size={17} /><span>{frozenText}</span></div>}
      </div>
    </div>

    {drawer && <PriceDriftDrawer drift={drawer} onClose={() => setDrawer(null)} onError={onError}
      onApplied={(updated, proposal: ProposalDetail) => {
        setDrawer(null);
        onNotice(`${plural(updated, 'preço atualizado', 'preços atualizados')} na ${drawer.number} · valor final ${brl(proposal.totals.finalValue ?? drawer.finalAfter)}`);
        void data.reload();
      }} />}
  </div></main>;
}
