import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, LoaderCircle, RefreshCw, TriangleAlert, X } from 'lucide-react';
import { hasUnsavedChanges } from './unsavedChanges';
import { useAppUpdater } from './useAppUpdater';

// Aviso discreto na barra superior: aparece só no aplicativo desktop e só quando há versão nova (ou download em andamento).
export function UpdateNotice() {
  const updater = useAppUpdater();
  const [open, setOpen] = useState(false);
  const [confirmingRestart, setConfirmingRestart] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const state = updater.state;
  const visible = state && ['available', 'downloading', 'downloaded'].includes(state.phase);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: MouseEvent) => { if (!anchor.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!updater.available || !state || !visible) return null;
  const restart = () => {
    if (hasUnsavedChanges() && !confirmingRestart) { setConfirmingRestart(true); return; }
    void updater.install();
  };

  return (
    <div className="top-action-anchor update-notice" ref={anchor}>
      <button type="button" className={`update-pill${state.phase === 'downloaded' ? ' ready' : ''}`} aria-expanded={open} onClick={() => setOpen((prev) => !prev)}>
        <ArrowDownToLine size={14} aria-hidden="true" />
        <span>{state.phase === 'downloaded' ? 'Pronta para instalar' : `Nova versão ${state.availableVersion ?? ''}`}</span>
      </button>
      {open && (
        <section className="update-panel" role="dialog" aria-label="Atualização do aplicativo">
          <header>
            <b>Versão {state.availableVersion} disponível</b>
            <button type="button" className="update-close" aria-label="Fechar" onClick={() => setOpen(false)}><X size={15} /></button>
          </header>
          <p className="update-meta">Você está na versão {state.currentVersion}. Seus dados e propostas continuam no computador.</p>
          {state.notes && <pre className="update-notes">{state.notes}</pre>}
          {state.phase === 'available' && (
            <button type="button" className="primary" onClick={() => void updater.download()}><ArrowDownToLine size={16} /> Baixar e instalar</button>
          )}
          {state.phase === 'downloading' && (
            <div className="update-progress" role="status">
              <span className="update-bar" aria-hidden="true"><i /></span>
              <small><LoaderCircle size={13} className="update-spin" aria-hidden="true" /> Baixando a atualização. Pode continuar trabalhando.</small>
            </div>
          )}
          {state.phase === 'downloaded' && (
            <>
              {confirmingRestart && (
                <p className="update-warning" role="alert"><TriangleAlert size={15} aria-hidden="true" /> Há alterações ainda não salvas. Salve antes de reiniciar ou continue por sua conta.</p>
              )}
              <div className="update-actions">
                <button type="button" className="primary" onClick={restart}><RefreshCw size={16} /> {confirmingRestart ? 'Reiniciar mesmo assim' : 'Reiniciar e instalar'}</button>
                {confirmingRestart && <button type="button" onClick={() => setConfirmingRestart(false)}>Voltar</button>}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
