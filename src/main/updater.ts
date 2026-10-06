// Atualizador do app desktop (Squirrel.Windows). Toda a lógica fica aqui, sem importar o Electron: o autoUpdater, a rede
// e o disco entram por injeção, então os testes usam módulos falsos. O feed é o par RELEASES + nupkg publicado na release
// "windows-updates" do GitHub (repositório público, sem token). O Squirrel baixa sozinho; por isso o aviso de "nova versão"
// vem da leitura do RELEASES, e o download só começa quando a pessoa pede.
export type UpdaterPhase = 'unsupported' | 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'upToDate' | 'error';

export interface UpdaterState {
  phase: UpdaterPhase;
  currentVersion: string;
  availableVersion?: string;
  notes?: string;
  checkedAt?: string;
  error?: string;
}

export interface AutoUpdaterLike {
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  setFeedURL(options: { url: string }): void;
  checkForUpdates(): void;
  quitAndInstall(): void;
}

export interface UpdaterDeps {
  autoUpdater: AutoUpdaterLike;
  fetchText: (url: string) => Promise<string>;
  currentVersion: string;
  feedUrl: string;
  supported: boolean;
  now?: () => number;
  loadLastCheck?: () => Promise<number | undefined>;
  saveLastCheck?: (time: number) => Promise<void>;
  onChange?: (state: UpdaterState) => void;
}

export const AUTO_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const NOTES_LIMIT = 4000;
const FULL_PACKAGE = /^.+?-(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)-full\.nupkg$/;

const versionParts = (version: string) => version.split('-')[0].split('.').map((part) => Number.parseInt(part, 10) || 0);

export function compareVersions(a: string, b: string): number {
  const left = versionParts(a);
  const right = versionParts(b);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  // 1.0.6-beta vem antes de 1.0.6
  const preA = a.includes('-');
  const preB = b.includes('-');
  return preA === preB ? 0 : preA ? -1 : 1;
}

/** Maior versão com pacote completo listada no arquivo RELEASES do Squirrel. */
export function latestVersionFromReleases(releases: string): string | undefined {
  let latest: string | undefined;
  for (const line of releases.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2 || !/^[0-9a-fA-F]{40}$/.test(parts[0])) continue;
    const version = FULL_PACKAGE.exec(parts[1])?.[1];
    if (version && (!latest || compareVersions(version, latest) > 0)) latest = version;
  }
  return latest;
}

export function parseReleaseNotes(raw: string, version: string): string | undefined {
  try {
    const data = JSON.parse(raw) as { version?: unknown; notes?: unknown };
    if (data.version !== version || typeof data.notes !== 'string') return undefined;
    const notes = data.notes.trim().slice(0, NOTES_LIMIT);
    return notes || undefined;
  } catch { return undefined; }
}

export function friendlyUpdateError(error: unknown): string {
  const text = error instanceof Error ? `${error.message} ${String((error.cause as Error | undefined)?.message ?? '')}` : String(error);
  if (/\b404\b|not found/i.test(text)) return 'Nenhuma versão foi publicada para atualização ainda. Tente novamente mais tarde.';
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ERR_INTERNET|ERR_NAME|ERR_CONNECTION|ERR_NETWORK|fetch failed|network|timeout|aborted/i.test(text)) {
    return 'Sem conexão com a internet. Confira a rede e tente novamente.';
  }
  if (/EPERM|EACCES|access is denied|permission/i.test(text)) return 'O Windows bloqueou a atualização. Feche e abra o aplicativo ou peça ajuda ao suporte.';
  return 'Não foi possível concluir a atualização. Tente novamente em alguns minutos.';
}

export function createUpdater(deps: UpdaterDeps) {
  const now = deps.now ?? Date.now;
  let state: UpdaterState = deps.supported
    ? { phase: 'idle', currentVersion: deps.currentVersion }
    : { phase: 'unsupported', currentVersion: deps.currentVersion };
  let feedConfigured = false;

  const set = (patch: Partial<UpdaterState>) => {
    state = { ...state, ...patch };
    deps.onChange?.(state);
  };
  const stamp = () => new Date(now()).toISOString();

  if (deps.supported) {
    deps.autoUpdater.on('update-downloaded', () => set({ phase: 'downloaded', error: undefined }));
    deps.autoUpdater.on('update-not-available', () => {
      if (state.phase === 'downloading') set({ phase: 'error', error: friendlyUpdateError('not found') });
    });
    deps.autoUpdater.on('error', (error) => {
      if (state.phase === 'downloading') set({ phase: 'error', error: friendlyUpdateError(error) });
    });
  }

  const busy = () => state.phase === 'checking' || state.phase === 'downloading' || state.phase === 'downloaded';

  async function check(): Promise<UpdaterState> {
    if (!deps.supported || busy()) return state;
    set({ phase: 'checking', error: undefined });
    try {
      const latest = latestVersionFromReleases(await deps.fetchText(`${deps.feedUrl}/RELEASES`));
      const checkedAt = stamp();
      await deps.saveLastCheck?.(now()).catch(() => undefined);
      if (!latest || compareVersions(latest, deps.currentVersion) <= 0) {
        set({ phase: 'upToDate', checkedAt, availableVersion: undefined, notes: undefined });
        return state;
      }
      const notes = await deps.fetchText(`${deps.feedUrl}/latest.json`).then((raw) => parseReleaseNotes(raw, latest)).catch(() => undefined);
      set({ phase: 'available', availableVersion: latest, notes, checkedAt });
    } catch (error) {
      set({ phase: 'error', error: friendlyUpdateError(error), checkedAt: stamp() });
    }
    return state;
  }

  /** Verificação automática: no máximo uma a cada 6 horas, mesmo reiniciando o app. */
  async function autoCheck(): Promise<UpdaterState> {
    const last = await deps.loadLastCheck?.().catch(() => undefined);
    if (last !== undefined && now() - last < AUTO_CHECK_INTERVAL_MS) return state;
    return check();
  }

  function download(): UpdaterState {
    if (!deps.supported || state.phase !== 'available') return state;
    try {
      if (!feedConfigured) { deps.autoUpdater.setFeedURL({ url: deps.feedUrl }); feedConfigured = true; }
      set({ phase: 'downloading', error: undefined });
      deps.autoUpdater.checkForUpdates();
    } catch (error) {
      set({ phase: 'error', error: friendlyUpdateError(error) });
    }
    return state;
  }

  function install(): UpdaterState {
    if (state.phase !== 'downloaded') return state;
    deps.autoUpdater.quitAndInstall();
    return state;
  }

  return { getState: () => state, check, autoCheck, download, install };
}

export type Updater = ReturnType<typeof createUpdater>;
