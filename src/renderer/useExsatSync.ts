// Sincronizacao com o EXSAT no computador (Rodada 24). A conta conectada e a varredura vivem no Electron (sessao do
// site fica la); no site de computador sem o aplicativo nada disso roda e a tela explica. Atualiza o catalogo com os
// itens confirmados pela varredura (novos e com preco diferente); o que nao foi confirmado fica de fora, como no dialogo.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CatalogImportItem, ExsatSyncInfo } from '../shared/contracts';
import { catalogApi } from './api';
import { CHUNK } from './catalogImportFlow';
import { exsatErrorMessage } from './catalogImportDialogModel';
import { hasDesktopApp } from './orcDeskUi';

export type SyncResult = {
  created: number; updated: number; same: number; skipped: number; failedPages: number; at: string;
  rose: number; fell: number;
};
export type SyncError = { kind: 'offline' | 'timeout' | 'login' | 'other'; message: string };
export type SyncPhase = { pct: number; text: string };

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

export const classifyError = (error: unknown): SyncError => {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('EXSAT_LOGIN_REQUIRED')) return { kind: 'login', message: 'Sua sessão da Exsat expirou. Entre de novo para sincronizar.' };
  if (isOffline() || /ENOTFOUND|ECONNREFUSED|ECONNRESET|EAI_AGAIN|net::ERR_INTERNET|Failed to fetch|fetch failed|offline/i.test(message)) {
    return { kind: 'offline', message: 'Sem internet.' };
  }
  if (/timeout|timed out|ETIMEDOUT/i.test(message)) return { kind: 'timeout', message: 'A conexão passou de 30 segundos sem resposta.' };
  return { kind: 'other', message: exsatErrorMessage(error, 'Não foi possível consultar a Exsat.') };
};

export function useExsatSync(onFinished: () => void) {
  const desktop = hasDesktopApp() && !!window.construtec?.previewExsatAuto;
  const [connected, setConnected] = useState(false);
  const [info, setInfo] = useState<ExsatSyncInfo>({ history: [] });
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<SyncPhase>({ pct: 0, text: '' });
  const [error, setError] = useState<SyncError | null>(null);
  const [last, setLast] = useState<SyncResult | null>(null);
  const [statusReady, setStatusReady] = useState(!desktop);
  const running = useRef(false);

  const refresh = useCallback(async () => {
    if (!desktop) { setStatusReady(true); return; }
    try {
      const [status, syncInfo] = await Promise.all([window.construtec!.exsatStatus(), window.construtec!.exsatSyncInfo?.() ?? Promise.resolve({ history: [] } as ExsatSyncInfo)]);
      setConnected(status.connected);
      setInfo(syncInfo);
    } catch { setConnected(false); }
    finally { setStatusReady(true); }
  }, [desktop]);

  useEffect(() => { void refresh(); }, [refresh]);

  const login = useCallback(async () => {
    if (!desktop) return;
    try {
      const status = await window.construtec!.exsatLogin();
      setConnected(status.connected);
      if (status.connected) setError(null);
    } catch (loginError) { setError(classifyError(loginError)); }
  }, [desktop]);

  const logout = useCallback(async () => {
    if (!desktop) return;
    try { await window.construtec!.exsatLogout(); setConnected(false); } catch (logoutError) { setError(classifyError(logoutError)); }
  }, [desktop]);

  const run = useCallback(async () => {
    if (!desktop || running.current) return;
    running.current = true;
    setBusy(true); setError(null);
    const api = window.construtec!;
    const stage = (pct: number, text: string) => setPhase({ pct, text });
    stage(5, 'Conectando ao EXSAT');
    const unsubscribe = api.onExsatValidationProgress?.((data) => {
      stage(15 + Math.round(55 * (data.current / Math.max(1, data.total))), `Baixando itens · ${data.current.toLocaleString('pt-BR')} de ${data.total.toLocaleString('pt-BR')}`);
    });
    try {
      if (isOffline()) throw new Error('offline');
      const preview = await api.previewExsatAuto();
      setConnected(preview.connected);
      stage(72, 'Comparando preços com o catálogo');
      const ok = (item: CatalogImportItem) => (item.validationStatus ?? 'confirmed') === 'confirmed' && item.currentCost > 0
        && item.code.trim().length >= 2 && item.description.trim().length >= 3 && item.category.trim().length >= 2 && !!item.unit.trim();
      const confirmed = preview.items.filter(ok).map(({ validationStatus, ...item }) => { void validationStatus; return item; });
      const skipped = preview.items.length - confirmed.length;
      const changed: CatalogImportItem[] = [];
      let same = 0, rose = 0, fell = 0;
      for (let i = 0; i < confirmed.length; i += CHUNK) {
        const part = confirmed.slice(i, i + CHUNK);
        const result = await catalogApi.previewImport(part);
        const byCode = new Map(part.map((item) => [item.code.toLowerCase(), item]));
        for (const row of result.items) {
          if (row.status === 'new') { const item = byCode.get(row.code.toLowerCase()); if (item) changed.push(item); }
          else if (row.status === 'updated') {
            const item = byCode.get(row.code.toLowerCase());
            if (item) {
              changed.push(item);
              const before = row.previous?.currentCost ?? 0;
              if (before > 0 && item.currentCost > before + 0.004) rose += 1; else if (before > 0 && item.currentCost < before - 0.004) fell += 1;
            }
          } else same += 1;
        }
      }
      stage(88, 'Gravando no catálogo');
      let created = 0, updated = 0;
      for (let i = 0; i < changed.length; i += CHUNK) {
        const result = await catalogApi.importBulk(changed.slice(i, i + CHUNK));
        created += result.created; updated += result.updated;
      }
      stage(96, 'Finalizando');
      if (api.recordExsatSync) setInfo(await api.recordExsatSync({ created, updated }));
      const finished: SyncResult = { created, updated, same, skipped, failedPages: preview.failures.length, at: new Date().toISOString(), rose, fell };
      setLast(finished);
      stage(100, 'Pronto');
      onFinished();
    } catch (syncError) {
      const classified = classifyError(syncError);
      if (classified.kind === 'login') { setConnected(false); void api.exsatLogout?.(); }
      setError(classified);
    } finally {
      unsubscribe?.();
      running.current = false;
      setBusy(false);
    }
  }, [desktop, onFinished]);

  return { desktop, connected, info, busy, phase, error, last, statusReady, refresh, login, logout, run, clearError: () => setError(null) };
}

export type ExsatSync = ReturnType<typeof useExsatSync>;
