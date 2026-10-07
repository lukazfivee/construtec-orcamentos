// Contrato do login da Exsat no servidor (site). Nada aqui carrega senha: so o usuario mascarado e datas.
import type { CatalogImportItem } from './contracts';

export type ExsatJobStatus = 'running' | 'paused' | 'done' | 'failed' | 'cancelled';

export type ExsatSyncJob = {
  id: string;
  status: ExsatJobStatus;
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
  pagesRead: number;
  pagesFailed: number;
  /** Paginas ja lidas mais as que ainda estao na fila (cresce enquanto a varredura descobre departamentos). */
  pagesTotal: number;
  itemsWithPrice: number;
  itemsWithoutPrice: number;
  errorCode: string | null;
  message: string | null;
};

export type ExsatFailureInfo = { code: string; message: string; at: string };

export type ExsatAccountStatus = {
  /** Chave de criptografia (EXSAT_CREDENTIAL_KEY) presente e valida no servidor. Sem ela nada e gravado. */
  keyConfigured: boolean;
  configured: boolean;
  /** Usuario mascarado (l***@dominio.com). A senha nunca sai do servidor. */
  usernameHint: string | null;
  configuredAt: string | null;
  lastLoginAt: string | null;
  /** Ha uma sessao da Exsat aberta agora no servidor. */
  connected: boolean;
  lastFailure: ExsatFailureInfo | null;
  /** Segundos ate poder tentar entrar de novo (pausa depois de uma falha). */
  retryAfterSeconds: number;
  /** So administrador cadastra, troca e remove a conta. */
  canManage: boolean;
  job: ExsatSyncJob | null;
};

export type ExsatResultsPage = { items: CatalogImportItem[]; total: number; offset: number };
