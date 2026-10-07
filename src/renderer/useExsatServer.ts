// Conta e varredura da Exsat no site (o servidor entra na conta e le o catalogo em segundo plano).
// O app do computador continua com o fluxo dele (useExsatSync / Electron). Aqui a senha so passa pelo "Salvar e conectar".
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CatalogImportItem } from '../shared/contracts';
import type { ExsatAccountStatus } from '../shared/exsatServer';
import { diffAgainstCatalog } from './catalogImportChunks';
import { exsatServerApi } from './exsatServerApi';

export type ExsatServerResults = { items: CatalogImportItem[]; unchanged: number; withoutPrice: number };
type Busy = 'save' | 'remove' | 'start' | 'results' | null;

const POLL_MS = 2500;
const messageOf = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

export function useExsatServer(enabled: boolean, onResults: (results: ExsatServerResults) => void) {
  const [status, setStatus] = useState<ExsatAccountStatus | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const seen = useRef<{ id: string; status: string } | null>(null);
  const loaded = useRef('');
  const deliver = useRef(onResults);
  deliver.current = onResults;

  const refresh = useCallback(async () => {
    try { setStatus((await exsatServerApi.status()).status); } catch (failure) { setError(messageOf(failure, 'Não foi possível consultar a Exsat.')); }
  }, []);

  const job = status?.job ?? null;
  const loadResults = useCallback(async () => {
    if (!job || job.status !== 'done' || loaded.current === job.id) return;
    loaded.current = job.id;
    setBusy('results'); setError('');
    try {
      const all: CatalogImportItem[] = [];
      for (let offset = 0; offset < 100_000; offset += 500) {
        setProgress(`Lendo os itens da varredura · ${all.length.toLocaleString('pt-BR')} de ${job.itemsWithPrice.toLocaleString('pt-BR')}`);
        const page = await exsatServerApi.items(job.id, offset);
        all.push(...page.items);
        if (all.length >= page.total || page.items.length === 0) break;
      }
      const diff = await diffAgainstCatalog(all, (done, total) => setProgress(`Comparando com o catálogo · ${done.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')}`));
      deliver.current({ items: diff.changed, unchanged: diff.unchanged, withoutPrice: job.itemsWithoutPrice });
    } catch (failure) {
      loaded.current = '';
      setError(messageOf(failure, 'Não foi possível ler os itens da varredura.'));
    } finally { setBusy(null); setProgress(''); }
  }, [job]);

  useEffect(() => { if (enabled) void refresh(); }, [enabled, refresh]);

  // Enquanto a varredura roda, acompanha o andamento; ao terminar com a janela aberta, ja traz as alteracoes.
  useEffect(() => {
    if (!enabled || job?.status !== 'running') return;
    const timer = setInterval(() => { void refresh(); }, POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, job?.status, refresh]);
  useEffect(() => {
    const before = seen.current;
    seen.current = job ? { id: job.id, status: job.status } : null;
    if (job?.status === 'done' && before?.id === job.id && before.status === 'running') void loadResults();
  }, [job, loadResults]);

  const run = useCallback(async (kind: Exclude<Busy, null>, action: () => Promise<void>): Promise<boolean> => {
    setBusy(kind); setError('');
    try { await action(); return true; } catch (failure) {
      setError(messageOf(failure, 'Não foi possível concluir.'));
      void refresh();
      return false;
    } finally { setBusy(null); }
  }, [refresh]);

  return {
    status, busy, error, progress, job,
    refresh,
    save: (username: string, password: string) => run('save', async () => { setStatus((await exsatServerApi.saveCredential(username, password)).status); }),
    remove: () => run('remove', async () => { setStatus((await exsatServerApi.removeCredential()).status); }),
    start: () => run('start', async () => { loaded.current = ''; await exsatServerApi.startSync(); await refresh(); }),
    resume: () => run('start', async () => { if (job) await exsatServerApi.resumeSync(job.id); await refresh(); }),
    cancel: () => run('start', async () => { if (job) await exsatServerApi.cancelSync(job.id); await refresh(); }),
    loadResults: () => { loaded.current = ''; void loadResults(); },
  };
}

export type ExsatServer = ReturnType<typeof useExsatServer>;
