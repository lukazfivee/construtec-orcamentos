import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronRight, EyeOff, Loader2, PackagePlus, RefreshCw, Search, Upload, WifiOff } from 'lucide-react';
import type { CatalogOverviewNewItem, CatalogProduct } from '../shared/contracts';
import { catalogApi } from './api';
import { PageHead, Seg, brl, nfmt, pctSigned, plural } from './orcDeskUi';
import { formatSyncDate } from './catalogImportHelpers';
import type { CatalogOverviewData } from './useCatalogOverview';
import type { ExsatSync } from './useExsatSync';

type Row = Pick<CatalogProduct, 'code' | 'description' | 'category' | 'unit'> & { currentCost?: number; active?: boolean };
type Filter = 'todos' | 'mudou' | 'novo';

type Props = {
  data: CatalogOverviewData;
  sync: ExsatSync;
  seesCost: boolean;
  canWrite: boolean;
  onImport: () => void;
  onExsat: () => void;
  onEdit: () => void;
};

export const exsatCardPill = (sync: ExsatSync): { text: string; tone: 'ok' | 'warn' | 'neu' | 'bad' } => {
  if (!sync.desktop) return { text: 'Só no aplicativo', tone: 'neu' };
  if (sync.error?.kind === 'offline') return { text: 'Sem internet', tone: 'bad' };
  if (!sync.statusReady) return { text: 'Verificando', tone: 'neu' };
  return sync.connected ? { text: 'Conectado', tone: 'ok' } : { text: 'Sem conexão', tone: 'warn' };
};

export const syncDisabledReason = (sync: ExsatSync, canWrite: boolean): string => {
  if (!sync.desktop) return 'A varredura do EXSAT usa a conta conectada no aplicativo do computador. No site, o catálogo e os avisos de preço continuam disponíveis.';
  if (!canWrite) return 'Seu papel não permite alterar o catálogo, que carrega o custo.';
  if (!sync.connected) return 'Entre na conta do EXSAT em Integração EXSAT para sincronizar.';
  return '';
};

export function CatalogHome({ data, sync, seesCost, canWrite, onImport, onExsat, onEdit }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');
  const [products, setProducts] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');
  const [attempt, setAttempt] = useState(0);
  const overview = data.overview;
  const info = useMemo(() => new Map((overview?.items ?? []).map((item) => [item.code, item])), [overview]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true); setFailed('');
      try { const result = await catalogApi.list(query); if (active) setProducts(result.products); }
      catch (error) { if (active) setFailed(error instanceof Error ? error.message : 'Não foi possível carregar o catálogo.'); }
      finally { if (active) setLoading(false); }
    }, query ? 180 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, data.overview, attempt]);

  const changedCount = useMemo(() => (overview?.items ?? []).filter((item) => item.changePercent !== undefined).length, [overview]);
  const newCount = overview?.newCount ?? 0;
  const matches = (row: CatalogOverviewNewItem) => {
    const q = query.trim().toLowerCase();
    return !q || row.code.toLowerCase().includes(q) || row.description.toLowerCase().includes(q) || row.category.toLowerCase().includes(q);
  };
  const rows: Row[] = filter === 'mudou' ? (overview?.changedItems ?? []).filter(matches)
    : filter === 'novo' ? (overview?.newItems ?? []).filter(matches)
      : products;

  const pill = exsatCardPill(sync);
  const syncReason = syncDisabledReason(sync, canWrite);
  const cardSub = !sync.desktop
    ? 'Preços do distribuidor no catálogo e nas propostas · a sincronização roda no aplicativo do computador'
    : `${sync.info.lastSyncAt ? `Sincronizado ${formatSyncDate(sync.info.lastSyncAt)}` : 'Ainda não sincronizado'} · ${changedCount ? plural(changedCount, 'preço mudou', 'preços mudaram') : 'nenhum preço mudou'}${newCount ? ` · ${plural(newCount, 'item novo', 'itens novos')}` : ''}`;
  const fil = (key: Filter, label: string) => [key, label] as const;

  return <main className="od-page" aria-busy={loading}><div className="od-stack">
    <PageHead eyebrow="Cadastros" title="Catálogo EXSAT" sub={`${overview ? `${nfmt(overview.productCount)} itens` : 'Carregando itens'}${seesCost ? ' · preços de custo, sem BDI' : ''}`}>
      <button type="button" className="od-btn s" onClick={onEdit}><PackagePlus size={17} />Cadastrar itens</button>
      {canWrite && <button type="button" className="od-btn s" onClick={onImport}><Upload size={17} />Importar lista</button>}
      <button type="button" className="od-btn p" disabled={!!syncReason || sync.busy} title={syncReason || undefined} onClick={() => void sync.run()}>
        {sync.busy ? <Loader2 size={17} className="od-spin" /> : <RefreshCw size={17} />}{sync.busy ? `Sincronizando… ${sync.phase.pct}%` : 'Sincronizar agora'}
      </button>
    </PageHead>

    <button type="button" className="od-card od-link-card" onClick={onExsat}>
      <span className="od-ex-badge">EX</span>
      <span className="od-grow"><b>Integração EXSAT</b><span>{cardSub}</span></span>
      <span className={`od-chip ${pill.tone}`}>{pill.tone === 'bad' && <WifiOff size={13} />}{pill.text}</span>
      <span className="od-go">Ver mudanças<ChevronRight size={16} /></span>
    </button>
    {sync.busy && <div className="od-card pad" role="status"><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Loader2 size={15} className="od-spin" />{sync.phase.text}</span><b>{sync.phase.pct}%</b></div><span className="od-bar"><span style={{ width: `${sync.phase.pct}%` }} /></span></div>}
    {sync.error && !sync.busy && <div className="od-note bad" role="alert"><WifiOff size={17} /><span>{sync.error.kind === 'offline' ? 'Sem internet. O catálogo continua com os preços da última sincronização.' : `${sync.error.message} O catálogo continua com os preços da última sincronização.`}</span></div>}
    {sync.last && !sync.busy && !sync.error && <div className="od-note ok" role="status"><RefreshCw size={17} /><span>Sincronizado agora · {plural(sync.last.created, 'item novo', 'itens novos')}, {plural(sync.last.updated, 'preço atualizado', 'preços atualizados')}{sync.last.skipped ? ` · ${plural(sync.last.skipped, 'item não confirmado ficou de fora', 'itens não confirmados ficaram de fora')}` : ''}.</span></div>}
    {!seesCost && <div className="od-note"><EyeOff size={17} /><span>Seu perfil não vê preços de custo. A coluna Custo fica escondida; o resto do catálogo funciona igual.</span></div>}

    <div className="od-card" style={{ overflow: 'hidden' }}>
      <div className="od-toolbar">
        <div className="od-search"><Search size={17} /><input className="od-inp" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome ou código" aria-label="Buscar por nome ou código" /></div>
        <Seg<Filter> label="Filtrar catálogo" value={filter} onChange={setFilter} options={[
          fil('todos', `Todos · ${nfmt(overview?.productCount ?? products.length)}`), fil('mudou', `Preço mudou · ${nfmt(changedCount)}`), fil('novo', `Itens novos · ${nfmt(newCount)}`),
        ]} />
      </div>
      <div className="od-scroll"><table className="od-tbl">
        <thead><tr><th>Item</th><th>Categoria</th><th>Unid.</th>{seesCost && <th className="od-num">Custo</th>}<th>Mudança de preço</th><th>Usado em</th></tr></thead>
        <tbody>
          {loading && filter === 'todos' && Array.from({ length: 6 }, (_, index) => <tr key={`s${index}`}><td colSpan={seesCost ? 6 : 5}><div className="od-skel" style={{ height: 22 }} /></td></tr>)}
          {!(loading && filter === 'todos') && rows.map((row) => {
            const extra = info.get(row.code);
            const pct = extra?.changePercent;
            return <tr key={row.code}>
              <td><span className="od-item"><b>{row.description}</b><span>{row.code}{row.active === false ? ' · inativo' : ''}</span></span></td>
              <td>{row.category}</td><td>{row.unit}</td>
              {seesCost && <td className="od-num" style={{ fontWeight: 600 }}>{brl(row.currentCost ?? 0)}</td>}
              <td>
                {pct !== undefined && <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`od-chip ${pct > 0 ? 'warn' : 'ok'}`}>{pct > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{pctSigned(pct)}</span>
                  {seesCost && extra?.fromUnit !== undefined && <span className="od-small">antes {brl(extra.fromUnit)}</span>}
                </span>}
                {extra?.isNew && <span className="od-chip info">Novo</span>}
              </td>
              <td className="od-small" style={{ fontSize: 12.5 }}>{extra?.usedIn.length ? extra.usedIn.slice(0, 3).join(', ') + (extra.usedIn.length > 3 ? ` +${extra.usedIn.length - 3}` : '') : '—'}</td>
            </tr>;
          })}
        </tbody>
      </table></div>
      {failed && <div className="od-note bad" role="alert" style={{ margin: 16 }}><WifiOff size={17} /><span>{failed}</span> <button type="button" className="od-btn sm s" onClick={() => setAttempt((n) => n + 1)}>Tentar de novo</button></div>}
      {!loading && !failed && rows.length === 0 && <div className="od-empty"><Search size={30} />{filter === 'todos' ? 'Nada encontrado com esse nome.' : filter === 'mudou' ? 'Nenhum preço mudou em relação às propostas em edição.' : 'Nenhum item novo nos últimos 7 dias.'}</div>}
      <div className="od-footer"><span>{nfmt(rows.length)} de {nfmt(filter === 'todos' ? (overview?.productCount ?? rows.length) : rows.length)} itens{filter === 'todos' ? ' · a busca procura no catálogo inteiro' : ''}</span></div>
    </div>
  </div></main>;
}
