import { useState } from 'react';
import { ArrowDownToLine, CircleCheck, LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react';
import { hasUnsavedChanges } from './unsavedChanges';
import { useAppUpdater } from './useAppUpdater';

const NEVER_CHECKED = 'ainda não verificado nesta sessão';
const formatChecked = (iso?: string) => {
  if (!iso) return NEVER_CHECKED;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? NEVER_CHECKED : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

// Configurações > Atualização do aplicativo. Escondido no site: só o aplicativo desktop se atualiza.
export function AppUpdatePanel() {
  const updater = useAppUpdater();
  const [confirmingRestart, setConfirmingRestart] = useState(false);
  const state = updater.state;
  if (!updater.available || !state) return null;

  const phase = state.phase;
  const checking = phase === 'checking';
  const restart = () => {
    if (hasUnsavedChanges() && !confirmingRestart) { setConfirmingRestart(true); return; }
    void updater.install();
  };

  return (
    <section className="settings-card update-card" aria-labelledby="update-title">
      <div className="update-card-head">
        <RefreshCw size={19} aria-hidden="true" />
        <div>
          <h2 id="update-title">Atualização do aplicativo</h2>
          <p>Versão instalada: <b>{state.currentVersion}</b> · Última verificação: {formatChecked(state.checkedAt)}</p>
        </div>
      </div>

      {phase === 'unsupported' && <p className="update-status">A atualização automática funciona no aplicativo instalado pelo instalador oficial. Esta cópia é de desenvolvimento ou foi aberta sem instalação.</p>}
      {phase === 'upToDate' && <p className="update-status ok"><CircleCheck size={16} aria-hidden="true" /> Você está com a versão mais recente.</p>}
      {phase === 'error' && <p className="update-status bad" role="alert"><TriangleAlert size={16} aria-hidden="true" /> {state.error}</p>}
      {(phase === 'available' || phase === 'downloading' || phase === 'downloaded') && (
        <p className="update-status">Versão {state.availableVersion} disponível.{state.notes ? ` ${state.notes.split('\n')[0]}` : ''}</p>
      )}
      {confirmingRestart && <p className="update-warning" role="alert"><TriangleAlert size={15} aria-hidden="true" /> Há alterações ainda não salvas. Salve antes de reiniciar ou continue por sua conta.</p>}

      <div className="update-actions">
        {phase === 'available' && <button type="button" className="primary" onClick={() => void updater.download()}><ArrowDownToLine size={16} /> Baixar e instalar</button>}
        {phase === 'downloading' && <button type="button" disabled><LoaderCircle size={16} className="update-spin" /> Baixando…</button>}
        {phase === 'downloaded' && <button type="button" className="primary" onClick={restart}><RefreshCw size={16} /> {confirmingRestart ? 'Reiniciar mesmo assim' : 'Reiniciar e instalar'}</button>}
        {confirmingRestart && <button type="button" onClick={() => setConfirmingRestart(false)}>Voltar</button>}
        {phase !== 'unsupported' && phase !== 'downloading' && phase !== 'downloaded' && (
          <button type="button" disabled={checking} onClick={() => void updater.check()}>
            {checking ? <LoaderCircle size={16} className="update-spin" /> : <RefreshCw size={16} />} {checking ? 'Verificando…' : 'Verificar atualização'}
          </button>
        )}
      </div>
    </section>
  );
}
