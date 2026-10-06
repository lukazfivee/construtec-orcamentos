import { useCallback, useEffect, useState } from 'react';
import type { UpdaterState } from '../main/updater';

// Atualização do aplicativo desktop. Só existe no Electron (window.construtec com updaterState); no site fica indisponível.
export function useAppUpdater() {
  const bridge = typeof window === 'undefined' ? undefined : window.construtec;
  const available = Boolean(bridge?.updaterState);
  const [state, setState] = useState<UpdaterState | null>(null);

  useEffect(() => {
    if (!bridge?.updaterState) return undefined;
    let active = true;
    void bridge.updaterState().then((next) => { if (active) setState(next); }).catch(() => undefined);
    const unsubscribe = bridge.onUpdaterChange?.((next) => { if (active) setState(next); });
    return () => { active = false; unsubscribe?.(); };
  }, [bridge]);

  const run = useCallback(async (action: 'checkForUpdate' | 'downloadUpdate' | 'installUpdate') => {
    try {
      const next = await window.construtec?.[action]?.();
      if (next) setState(next);
    } catch {
      setState((current) => (current ? { ...current, phase: 'error', error: 'Não foi possível falar com o aplicativo. Feche e abra novamente.' } : current));
    }
  }, []);

  return {
    available,
    state,
    check: () => run('checkForUpdate'),
    download: () => run('downloadUpdate'),
    install: () => run('installUpdate'),
  };
}
