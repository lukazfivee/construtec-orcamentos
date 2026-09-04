import { app } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ExsatSyncHistoryEntry, ExsatSyncInfo } from '../shared/contracts';

export const MAX_AUTO_PAGES = 60;
export const MAX_INCREMENTAL_PAGES = 24;
export const MAX_AUTO_ITEMS = 500;
export const MAX_HISTORY = 20;
export const FULL_SYNC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export type ExsatSyncPage = {
  url: string;
  productCount: number;
  lastSeenAt: string;
};

export type ExsatPendingSync = Omit<ExsatSyncHistoryEntry, 'completedAt' | 'created' | 'updated'>;

export type ExsatSyncState = {
  lastSyncAt?: string;
  lastFullSyncAt?: string;
  pages: ExsatSyncPage[];
  history: ExsatSyncHistoryEntry[];
  pendingSync?: ExsatPendingSync;
};

export const syncStatePath = () => path.join(app.getPath('userData'), 'exsat-sync-state.json');

export const isHistoryEntry = (entry: unknown): entry is ExsatSyncHistoryEntry => {
  if (!entry || typeof entry !== 'object') return false;
  const value = entry as Partial<ExsatSyncHistoryEntry>;
  return typeof value.id === 'string' && typeof value.startedAt === 'string' && typeof value.completedAt === 'string'
    && (value.mode === 'full' || value.mode === 'incremental' || value.mode === 'manual')
    && typeof value.pagesRead === 'number' && typeof value.itemsFound === 'number'
    && typeof value.created === 'number' && typeof value.updated === 'number'
    && typeof value.ignored === 'number' && typeof value.failedPages === 'number';
};

export const loadSyncState = async (): Promise<ExsatSyncState> => {
  try {
    const state = JSON.parse(await readFile(syncStatePath(), 'utf8')) as Partial<ExsatSyncState>;
    return {
      lastSyncAt: state.lastSyncAt,
      lastFullSyncAt: state.lastFullSyncAt,
      pages: Array.isArray(state.pages) ? state.pages.filter((page): page is ExsatSyncPage => (
        Boolean(page) && typeof page.url === 'string' && typeof page.productCount === 'number' && typeof page.lastSeenAt === 'string'
      )).slice(0, MAX_AUTO_PAGES) : [],
      history: Array.isArray(state.history) ? state.history.filter(isHistoryEntry).slice(0, MAX_HISTORY) : [],
      pendingSync: state.pendingSync,
    };
  } catch {
    return { pages: [], history: [] };
  }
};

export const saveSyncState = async (state: ExsatSyncState) => {
  await mkdir(path.dirname(syncStatePath()), { recursive: true });
  await writeFile(syncStatePath(), JSON.stringify(state, null, 2), 'utf8');
};

export const getExsatSyncInfo = async (): Promise<ExsatSyncInfo> => {
  const state = await loadSyncState();
  return {
    lastSyncAt: state.lastSyncAt,
    lastFullSyncAt: state.lastFullSyncAt,
    history: state.history,
  };
};

export const recordExsatSyncResult = async (result: { created: number; updated: number }) => {
  const state = await loadSyncState();
  if (!state.pendingSync) return getExsatSyncInfo();
  const completedAt = new Date().toISOString();
  const completed: ExsatSyncHistoryEntry = {
    ...state.pendingSync,
    completedAt,
    created: Math.max(0, Math.trunc(result.created)),
    updated: Math.max(0, Math.trunc(result.updated)),
  };
  await saveSyncState({
    ...state,
    lastSyncAt: completedAt,
    lastFullSyncAt: state.pendingSync.mode === 'full' ? completedAt : state.lastFullSyncAt,
    pendingSync: undefined,
    history: [completed, ...state.history].slice(0, MAX_HISTORY),
  });
  return getExsatSyncInfo();
};
