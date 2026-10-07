import { CheckCircle2, Loader2, LogIn, LogOut, RefreshCw, WifiOff } from 'lucide-react';
import type { ExsatSyncInfo } from '../shared/contracts';
import { formatSyncDate } from './catalogImportHelpers';
import { ExsatAccountCard } from './ExsatAccountCard';
import type { ExsatServer } from './useExsatServer';

type Props = {
  desktop: boolean;
  connected: boolean;
  busy: boolean;
  progress: string;
  info: ExsatSyncInfo;
  urls: string;
  onUrls: (value: string) => void;
  onLogin: () => void;
  onLogout: () => void;
  onAuto: () => void;
  onManual: () => void;
  onOpenExsat?: () => void;
  onUseSheet: () => void;
  /** No site: conta e varredura no servidor. */
  server?: ExsatServer;
};

const MODE_LABEL = { full: 'Completa', incremental: 'Incremental', manual: 'Manual' } as const;

export function CatalogImportExsat(props: Props) {
  const { desktop, connected, busy, progress, info, urls } = props;
  if (!desktop) return props.server ? <ExsatAccountCard server={props.server} onUseSheet={props.onUseSheet} onOpenExsat={props.onOpenExsat} /> : null;
  return <div className="cid-stack">
    <section className="cid-card" aria-label="Conta da Exsat">
      <div className="cid-status">
        <span className="cid-ico">{connected ? <CheckCircle2 size={20} aria-hidden="true" /> : <WifiOff size={20} aria-hidden="true" />}</span>
        <span className="cid-grow"><b>Conta da Exsat</b>
          <span>{connected ? 'Conectada neste computador. Os preços vêm da sua conta de revendedor.' : 'Entre uma vez no site da Exsat para o aplicativo ler os seus preços.'}</span></span>
        <span className={`od-chip ${connected ? 'ok' : 'warn'}`}>{connected ? 'Conectada' : 'Não conectada'}</span>
        {connected
          ? <button type="button" className="od-btn sm s" disabled={busy} onClick={props.onLogout}><LogOut size={14} />Desconectar</button>
          : <button type="button" className="od-btn sm p" disabled={busy} onClick={props.onLogin}><LogIn size={14} />Entrar na Exsat</button>}
      </div>
      <dl className="cid-kv">
        <div><dt>Última sincronização</dt><dd>{formatSyncDate(info.lastSyncAt)}</dd></div>
        <div><dt>Última varredura completa</dt><dd>{formatSyncDate(info.lastFullSyncAt)}</dd></div>
      </dl>
      <div className="cid-actions">
        <button type="button" className="od-btn p" disabled={busy || !connected} onClick={props.onAuto}>
          {busy ? <Loader2 size={16} className="od-spin" /> : <RefreshCw size={16} />}Atualizar catálogo</button>
        <small>{connected ? 'Lê até 24 páginas por vez e faz a varredura completa (60 páginas) a cada 7 dias.' : 'Entre na Exsat para liberar a atualização.'}</small>
      </div>
      {busy && progress && <div className="cid-progress" role="status"><Loader2 size={15} className="od-spin" />{progress}</div>}
    </section>
    <details className="cid-acc">
      <summary>Modo avançado: informar páginas manualmente</summary>
      <div className="cid-acc-body">
        <label className="od-fld"><span>Endereços de categorias ou buscas, um por linha</span>
          <textarea className="cid-area" value={urls} onChange={(event) => props.onUrls(event.target.value)} placeholder="https://exsat.com.br/produtos/departamento/cameras-ip/" /></label>
        <div><button type="button" className="od-btn sm s" disabled={busy || !connected} onClick={props.onManual}>Buscar somente estas páginas</button></div>
      </div>
    </details>
    {info.history.length > 0 && <details className="cid-acc">
      <summary>Histórico das últimas sincronizações</summary>
      <ul className="cid-history">{info.history.slice(0, 10).map((entry) => <li key={entry.id}>
        <b>{formatSyncDate(entry.completedAt)}</b><span>{MODE_LABEL[entry.mode]} · {entry.pagesRead} páginas · {entry.itemsFound} itens</span>
        <span><b>{entry.created}</b> novos · <b>{entry.updated}</b> atualizados{entry.failedPages ? ` · ${entry.failedPages} falhas` : ''}</span>
      </li>)}</ul>
    </details>}
  </div>;
}
