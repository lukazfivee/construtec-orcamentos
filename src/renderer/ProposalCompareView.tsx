import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, Check, ChevronLeft, ChevronDown, ChevronUp, History, Loader2, Minus, Pencil, Plus, RefreshCw, WifiOff, Equal } from 'lucide-react';
import type { ProposalDetail, ProposalRevisionSummary } from '../shared/contracts';
import { proposalApi } from './api';
import { compareProposals, deltaDirection, rowDirection, rowTag, type CompareLine, type CompareRow } from './proposalCompare';
import { revLabel } from './proposalPdfPages';
import { useSuitePermission } from './SuitePermissions';

const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });
const dateFull = new Intl.DateTimeFormat('pt-BR');
const statusLabels: Record<ProposalDetail['status'], string> = { draft: 'Em edição', review: 'Em revisão', sent: 'Enviada', approved: 'Aprovada', rejected: 'Recusada' };
const statusClasses: Record<ProposalDetail['status'], string> = { draft: 'status-draft', review: 'status-review', sent: 'status-sent', approved: 'status-approved', rejected: 'status-rejected' };
const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${brl0.format(Math.abs(value))}`;
const pct = (value: number) => `${Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const when = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : dateFull.format(d); };
const side = (line: CompareLine | undefined) => (line ? `${num.format(line.quantity)} ${line.unit}` : '—');
const sideSub = (line: CompareLine | undefined) => (line ? `${brl.format(line.unitSale)}/${line.unit}` : '');

type Props = {
  proposalId: string;
  initialFrom?: string;
  onBack: () => void;
};

type Load =
  | { state: 'loading'; text: string }
  | { state: 'error'; offline: boolean; message: string }
  | { state: 'single'; revision: ProposalRevisionSummary | null }
  | { state: 'ready' };

// Comparativo de revisoes no computador (Rodada 23, telas 23q a 23t): partida e chegada lado a lado,
// contadores e a tabela por sistema. Verde: entrou ou aumentou; vermelho: saiu ou diminuiu.
export function ProposalCompareView({ proposalId, initialFrom, onBack }: Props) {
  const p10 = useSuitePermission('p10');
  const [load, setLoad] = useState<Load>({ state: 'loading', text: 'Carregando as revisões…' });
  const [revisions, setRevisions] = useState<ProposalRevisionSummary[]>([]);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [only, setOnly] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [pair, setPair] = useState<{ from: ProposalDetail; to: ProposalDetail } | null>(null);
  const [pairLoading, setPairLoading] = useState(false);
  const cache = useRef(new Map<string, ProposalDetail>());

  const loadProposal = useCallback(async (id: string) => {
    const hit = cache.current.get(id);
    if (hit) return hit;
    const result = await proposalApi.byId(id);
    cache.current.set(id, result.proposal);
    return result.proposal;
  }, []);

  const fail = (error: unknown) => {
    const message = error instanceof Error ? error.message : 'Não foi possível comparar agora.';
    setLoad({ state: 'error', offline: /failed to fetch|network|load failed/i.test(message), message });
  };

  useEffect(() => {
    let active = true;
    cache.current.clear();
    setLoad({ state: 'loading', text: 'Carregando as revisões…' });
    void proposalApi.history(proposalId).then((result) => {
      if (!active) return;
      const list = result.revisions.slice().sort((a, b) => a.revision - b.revision);
      setRevisions(list);
      if (list.length < 2) { setLoad({ state: 'single', revision: list[0] ?? null }); return; }
      const ids = list.map((r) => r.id);
      const from = initialFrom && ids.includes(initialFrom) ? initialFrom : ids[0];
      const lastId = ids[ids.length - 1];
      setFromId(from);
      setToId(from === lastId ? ids[0] : lastId);
      setLoad({ state: 'ready' });
    }).catch((error: unknown) => { if (active) fail(error); });
    return () => { active = false; };
  }, [proposalId, initialFrom, attempt]);

  useEffect(() => {
    if (load.state !== 'ready' || !fromId || !toId) return undefined;
    let active = true;
    setPairLoading(true);
    void Promise.all([loadProposal(fromId), loadProposal(toId)])
      .then(([from, to]) => { if (active) { setPair({ from, to }); setPairLoading(false); } })
      .catch((error: unknown) => { if (active) { setPairLoading(false); fail(error); } });
    return () => { active = false; };
  }, [load.state, fromId, toId, loadProposal]);

  const result = useMemo(() => (pair ? compareProposals(pair.from, pair.to) : null), [pair]);
  const revA = revisions.find((r) => r.id === fromId);
  const revB = revisions.find((r) => r.id === toId);

  const choose = (setter: 'from' | 'to', id: string) => {
    if (setter === 'from') { if (id === toId) setToId(fromId); setFromId(id); }
    else { if (id === fromId) setFromId(toId); setToId(id); }
  };

  const head = (sub: string) => (
    <>
      <button type="button" className="page-back" onClick={onBack}><ChevronLeft size={16} /> Voltar às revisões</button>
      <header className="page-head"><div><span className="page-eyebrow">Proposta</span><h1>Comparar revisões</h1><span className="page-sub">{sub}</span></div></header>
    </>
  );

  if (load.state === 'loading') {
    return <main className="workspace-page compare-page">{head('')}<div className="page-loading" role="status"><Loader2 size={18} className="spinning" /> {load.text}</div></main>;
  }
  if (load.state === 'error') {
    return (
      <main className="workspace-page compare-page">{head('')}
        <div className="page-empty">
          {load.offline ? <WifiOff size={28} /> : <History size={28} />}
          <b>Não deu para comparar agora</b>
          <span>{load.offline ? 'As revisões antigas ficam no servidor e o computador está sem internet. A revisão atual continua aberta na proposta.' : load.message}</span>
          <div><button type="button" className="flow-btn primary" onClick={() => setAttempt((v) => v + 1)}><RefreshCw size={16} /> Tentar de novo</button>
            <button type="button" className="flow-btn" onClick={onBack}>Voltar às revisões</button></div>
        </div>
      </main>
    );
  }
  if (load.state === 'single') {
    return (
      <main className="workspace-page compare-page">{head(load.revision ? `${revLabel(load.revision.revision)} · revisão única` : '')}
        <div className="page-empty">
          <History size={28} />
          <b>Só existe uma revisão</b>
          <span>Para comparar, a proposta precisa de pelo menos duas revisões. Quando o cliente pedir ajustes, crie uma nova revisão e volte aqui.</span>
          <div><button type="button" className="flow-btn" onClick={onBack}>Voltar às revisões</button></div>
        </div>
      </main>
    );
  }

  const optionText = (r: ProposalRevisionSummary) => `${revLabel(r.revision)} · ${statusLabels[r.status]} · ${r.totalSale ? brl0.format(r.totalSale) : 'sem itens'}`;
  const labelA = revA ? revLabel(revA.revision) : '';
  const labelB = revB ? revLabel(revB.revision) : '';
  const base = pair?.to;
  const sub = base && revA && revB ? `${base.number} · ${base.workName || '—'} · ${base.clientName}` : '';
  const editingNow = Boolean(pair && pair.to.status === 'draft' && revB?.isLatest);
  const counters: Array<[string, number]> = result ? [['Incluídos', result.counts.add], ['Removidos', result.counts.del], ['Quantidade', result.counts.qty], ['Preço', result.counts.price]] : [];
  const icon = (row: CompareRow) => (row.kind === 'add' ? <Plus size={13} /> : row.kind === 'del' ? <Minus size={13} /> : row.kind === 'same' ? <Equal size={13} /> : <Pencil size={13} />);

  return (
    <main className="workspace-page compare-page">
      {head(sub)}
      <div className="compare-pick">
        <label><span>De</span>
          <select value={fromId} onChange={(event) => choose('from', event.target.value)}>
            {revisions.map((r) => <option key={r.id} value={r.id}>{optionText(r)}</option>)}
          </select>
        </label>
        <button type="button" className="compare-swap" aria-label="Trocar a ordem das revisões" onClick={() => { setFromId(toId); setToId(fromId); }}><ArrowLeftRight size={18} /></button>
        <label><span>Para</span>
          <select value={toId} onChange={(event) => choose('to', event.target.value)}>
            {revisions.map((r) => <option key={r.id} value={r.id}>{optionText(r)}</option>)}
          </select>
        </label>
        {pair && revA && revB && (
          <p className="compare-pick-meta">
            <span className={`flow-status ${statusClasses[pair.from.status]}`}>{statusLabels[pair.from.status]}</span> {when(revA.updatedAt)}
            <span aria-hidden="true"> → </span>
            <span className={`flow-status ${statusClasses[pair.to.status]}`}>{statusLabels[pair.to.status]}</span> {when(revB.updatedAt)}
            {editingNow && ' · comparando com o que está sendo editado agora'}
          </p>
        )}
      </div>

      {(pairLoading || !result) && <div className="page-loading" role="status"><Loader2 size={18} className="spinning" /> Comparando {labelA} e {labelB}…</div>}

      {result && !pairLoading && (
        <div className="compare-body">
          <section className="compare-summary" aria-label="Resumo da diferença">
            <div className="compare-hero">
              <span>Valor final</span>
              <b className={`delta ${deltaDirection(result.finalDelta)}`}>{signed(result.finalDelta)}</b>
              <small>{result.percent ? `${result.percent > 0 ? '+' : '−'}${pct(result.percent)} no valor final` : 'sem mudança'}</small>
              <small>{labelA} {brl0.format(result.finalFrom)} → {labelB} {brl0.format(result.finalTo)}</small>
            </div>
            <div className="compare-parts">
              <div><span>Itens</span><b className={`delta ${deltaDirection(result.itemsDelta)}`}>{signed(result.itemsDelta)}</b></div>
              {Math.abs(result.generalDelta) > 0.5 && (
                <div>
                  <span>{p10 && result.bdiChanged && pair ? `BDI ${pair.from.bdiMultiplier.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} → ${pair.to.bdiMultiplier.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Ajuste geral de preço'}</span>
                  <b className={`delta ${deltaDirection(result.generalDelta)}`}>{signed(result.generalDelta)}</b>
                </div>
              )}
              {!p10 && <small>Valores de venda. Custo e BDI ficam com quem tem essa permissão.</small>}
            </div>
            <div className="compare-count">
              {counters.map(([label, n]) => <span key={label}><b>{n}</b><small>{label}</small></span>)}
            </div>
          </section>

          <div className="compare-toolbar">
            <button type="button" role="switch" aria-checked={only} onClick={() => setOnly((v) => !v)}>
              <span><b>Só o que mudou</b><small>{result.changedCount} de {result.rows.length} {result.rows.length === 1 ? 'item mudou' : 'itens mudaram'}</small></span><i className="switch" />
            </button>
            <p className="compare-legend"><span className="delta up"><ChevronUp size={13} /> entrou ou aumentou</span> <span className="delta down"><ChevronDown size={13} /> saiu ou diminuiu</span></p>
          </div>

          {only && result.changedCount === 0 ? (
            <div className="page-empty compact"><Check size={26} /> Nada mudou entre as duas revisões.</div>
          ) : (
            <div className="compare-table-wrap">
              <table className="compare-table">
                <thead>
                  <tr><th>Item</th><th>{labelA}</th><th className="num">Total</th><th>{labelB}</th><th className="num">Total</th><th className="num">Diferença</th><th>Mudança</th></tr>
                </thead>
                <tbody>
                  {result.groups.map((group) => {
                    const shown = only ? group.rows.filter((row) => row.kind !== 'same') : group.rows;
                    if (!shown.length) return null;
                    return (
                      <Fragment key={group.system}>
                        <tr className="group">
                          <td colSpan={5}>{group.system} · {group.changed ? `${group.changed} ${group.changed === 1 ? 'mudou' : 'mudaram'}` : `nada mudou · ${group.rows.length} ${group.rows.length === 1 ? 'item' : 'itens'}`}</td>
                          <td className={`num delta ${deltaDirection(group.delta)}`}>{group.changed ? signed(group.delta) : ''}</td>
                          <td />
                        </tr>
                        {shown.map((row, index) => {
                          const dir = rowDirection(row);
                          return (
                            <tr key={`${row.item.code}-${row.item.description}-${index}`} className={`row ${row.kind}`}>
                              <td><b>{row.item.description}</b>{row.item.code && <small>{row.item.code}</small>}</td>
                              <td className={row.qtyChanged ? 'changed' : ''}>{side(row.before)}<small>{sideSub(row.before)}</small></td>
                              <td className="num">{row.before ? brl0.format(row.before.totalSale) : '—'}</td>
                              <td className={row.qtyChanged || row.priceChanged ? 'changed' : ''}>{side(row.kind === 'del' ? undefined : row.item)}<small>{row.kind === 'del' ? '' : sideSub(row.item)}</small></td>
                              <td className="num">{row.kind === 'del' ? '—' : brl0.format(row.item.totalSale)}</td>
                              <td className={`num delta ${dir}`}>{row.kind === 'same' ? '—' : signed(row.delta)}</td>
                              <td><span className={`compare-tag ${row.kind === 'same' ? 'eq' : dir}`}>{icon(row)}{rowTag(row)}</span></td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
