// Cartao "Conta Exsat" da aba Exsat no site: o servidor guarda a conta criptografada e varre o catalogo em segundo plano.
// A senha so existe no campo enquanto se digita; depois do envio o campo e limpo e ela nunca volta do servidor.
import { useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, FileSpreadsheet, KeyRound, ListChecks, Loader2, Pause, RefreshCw, Square, Trash2, WifiOff } from 'lucide-react';
import type { ExsatSyncJob } from '../shared/exsatServer';
import { formatSyncDate } from './catalogImportHelpers';
import type { ExsatServer } from './useExsatServer';

type Props = { server: ExsatServer; onUseSheet: () => void; onOpenExsat?: () => void };

const num = (value: number) => value.toLocaleString('pt-BR');
const plural = (count: number, one: string, many: string) => `${num(count)} ${count === 1 ? one : many}`;
export const jobPercent = (job: ExsatSyncJob) => (job.pagesTotal > 0 ? Math.min(100, Math.round(((job.pagesRead + job.pagesFailed) / job.pagesTotal) * 100)) : 0);
export const ignoredText = (count: number) => `${count} ${count === 1 ? 'item sem preço ignorado' : 'itens sem preço ignorados'}`;

function AccountForm({ server, configured }: { server: ExsatServer; configured: boolean }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const typed = password;
    setPassword('');
    if (await server.save(username.trim(), typed)) setUsername('');
  };
  return <form className="cid-form" onSubmit={(event) => void submit(event)} autoComplete="off">
    <label className="od-fld"><span>E-mail da conta Exsat</span>
      <input className="cid-input" type="email" name="exsat-email" autoComplete="off" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="nome@empresa.com.br" required /></label>
    <label className="od-fld"><span>Senha</span>
      <input className="cid-input" type="password" name="exsat-senha" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={configured ? 'Digite a nova senha' : 'Senha da conta'} required /></label>
    <div className="cid-actions">
      <button type="submit" className="od-btn p" disabled={server.busy !== null || !username.trim() || !password}>
        {server.busy === 'save' ? <Loader2 size={16} className="od-spin" /> : <KeyRound size={16} />}Salvar e conectar</button>
      <small>Uma tentativa por clique. A senha viaja protegida (HTTPS) e fica guardada criptografada no servidor; o site nunca a mostra de volta.</small>
    </div>
  </form>;
}

function JobPanel({ server, job }: { server: ExsatServer; job: ExsatSyncJob }) {
  const pct = jobPercent(job);
  const wait = server.status?.retryAfterSeconds ?? 0;
  if (job.status === 'running') return <div className="cid-job" role="status">
    <div className="cid-prog" role="progressbar" aria-label="Andamento da varredura" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div className="cid-prog-bar" style={{ width: `${pct}%` }} /></div>
    <div className="cid-actions">
      <span className="cid-grow">{pct}% · {num(job.pagesRead + job.pagesFailed)} de {num(job.pagesTotal)} páginas · {plural(job.itemsWithPrice, 'item com preço', 'itens com preço')}</span>
      <button type="button" className="od-btn sm s" disabled={server.busy !== null} onClick={() => void server.cancel()}><Square size={14} />Cancelar</button>
    </div>
    <small>Mantenha esta janela aberta. A leitura é feita devagar, uma página por vez, para não sobrecarregar a Exsat.</small>
  </div>;
  if (job.status === 'paused') return <div className="od-note warn" role="alert"><Pause size={17} aria-hidden="true" />
    <span className="cid-grow">{job.message ?? 'A varredura foi pausada.'} Foram lidas {num(job.pagesRead)} de {num(job.pagesTotal)} páginas.{wait > 0 ? ` Nova tentativa em ${Math.ceil(wait / 60)} min.` : ''}</span>
    <button type="button" className="od-btn sm s" disabled={server.busy !== null || wait > 0} onClick={() => void server.resume()}><RefreshCw size={14} />Retomar</button></div>;
  if (job.status === 'failed') return <div className="od-note bad" role="alert"><AlertTriangle size={17} aria-hidden="true" /><span>{job.message ?? 'A varredura não terminou.'}</span></div>;
  if (job.status === 'cancelled') return <div className="od-note"><Square size={17} aria-hidden="true" /><span>Varredura cancelada. Nada foi importado.</span></div>;
  return <div className="cid-stack">
    <dl className="cid-kv">
      <div><dt>Última varredura</dt><dd>{formatSyncDate(job.finishedAt ?? job.updatedAt)}</dd></div>
      <div><dt>Páginas lidas</dt><dd>{num(job.pagesRead)}{job.pagesFailed > 0 ? ` · ${num(job.pagesFailed)} com falha` : ''}</dd></div>
      <div><dt>Itens com preço</dt><dd>{num(job.itemsWithPrice)}</dd></div>
      <div><dt>Sem preço</dt><dd>{ignoredText(job.itemsWithoutPrice)}</dd></div>
    </dl>
    <div className="cid-actions">
      <button type="button" className="od-btn s" disabled={server.busy !== null} onClick={server.loadResults}><ListChecks size={16} />Conferir alterações</button>
      <small>Compara os {num(job.itemsWithPrice)} preços lidos com o catálogo e mostra só o que é novo ou mudou.</small>
    </div>
  </div>;
}

export function ExsatAccountCard({ server, onUseSheet, onOpenExsat }: Props) {
  const { status, job, busy, error, progress } = server;
  if (!status) return <section className="cid-card" aria-label="Conta Exsat">
    <div className="cid-status"><span className="cid-ico"><Loader2 size={20} className="od-spin" aria-hidden="true" /></span>
      <span className="cid-grow"><b>Conta Exsat</b><span>{error || 'Consultando o servidor…'}</span></span></div>
  </section>;
  const ready = status.keyConfigured;
  const running = job?.status === 'running';
  const wait = status.retryAfterSeconds;
  return <div className="cid-stack">
    <section className="cid-card" aria-label="Conta Exsat">
      <div className="cid-status">
        <span className="cid-ico">{status.connected ? <CheckCircle2 size={20} aria-hidden="true" /> : <WifiOff size={20} aria-hidden="true" />}</span>
        <span className="cid-grow"><b>Conta Exsat</b>
          <span>{status.configured
            ? `${status.usernameHint ?? 'Conta'} · cadastrada em ${formatSyncDate(status.configuredAt ?? undefined)}. ${status.connected ? 'O servidor está conectado e lê os seus preços de revendedor.' : 'O servidor entra na Exsat quando você atualiza o catálogo.'}`
            : 'Informe a conta de revendedor da Exsat. O servidor entra nela e lê os seus preços; preço público sem login nunca é importado.'}</span></span>
        <span className={`od-chip ${status.connected ? 'ok' : 'warn'}`}>{status.connected ? 'Conectada' : 'Não conectada'}</span>
        {status.canManage && status.configured && <button type="button" className="od-btn sm s" disabled={busy !== null || running} onClick={() => void server.remove()}><Trash2 size={14} />Remover conta</button>}
      </div>
      {!ready && <div className="od-note warn" role="alert"><AlertTriangle size={17} aria-hidden="true" />
        <span>O servidor ainda não tem a chave de criptografia da conta (EXSAT_CREDENTIAL_KEY), então nada é guardado. Peça ao responsável pelo servidor para cadastrá-la.</span></div>}
      {error && <div className="od-note bad" role="alert"><AlertTriangle size={17} aria-hidden="true" /><span>{error}</span></div>}
      {!error && status.lastFailure && !status.connected && <div className="od-note bad" role="alert"><AlertTriangle size={17} aria-hidden="true" />
        <span>{status.lastFailure.message}{wait > 0 ? ` Nova tentativa liberada em ${Math.ceil(wait / 60)} min.` : ''}</span></div>}
      {status.canManage && ready && (status.configured
        ? <details className="cid-acc"><summary>Trocar a conta ou a senha</summary><div className="cid-acc-body"><AccountForm server={server} configured /></div></details>
        : <AccountForm server={server} configured={false} />)}
      {!status.canManage && !status.configured && <small className="cid-hint">Só administradores cadastram a conta da Exsat.</small>}
      {status.configured && ready && <>
        {job && <JobPanel server={server} job={job} />}
        <div className="cid-actions">
          <button type="button" className="od-btn p" disabled={busy !== null || running || wait > 0} onClick={() => void server.start()}>
            {busy === 'start' || running ? <Loader2 size={16} className="od-spin" /> : <RefreshCw size={16} />}Atualizar catálogo</button>
          <small>Lê todos os departamentos da Exsat com a sua conta, em segundo plano. Só entram itens com preço real.</small>
        </div>
      </>}
      {busy === 'results' && progress && <div className="cid-progress" role="status"><Loader2 size={15} className="od-spin" />{progress}</div>}
      <div className="cid-actions">
        <button type="button" className="od-btn sm s" onClick={onUseSheet}><FileSpreadsheet size={14} />Importar por planilha</button>
        {onOpenExsat && <button type="button" className="od-btn sm g" onClick={onOpenExsat}><ExternalLink size={14} />Ver integração Exsat</button>}
      </div>
    </section>
  </div>;
}
