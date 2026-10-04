// Cliente do diretorio central de contas (Centro de Custos, rotas /v1).
// Conta e senha vivem la; o Orcamentos so guarda o espelho da conta e o papel
// dentro do Orcamentos. Ver centro-custos-construtec-v3/docs/superpowers/specs/
// 2026-09-19-identidade-compartilhada-design.md.

const DEFAULT_IDENTITY_URL = 'https://centro-custos-api.construtec-reports.workers.dev';
const MIN_SERVICE_KEY_LENGTH = 32;
const TIMEOUT_MS = 8000;

export type CentroUser = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'gestor' | 'supervisor';
  /** Papel novo e apps (D6); contas e Centro antigos nao os enviam. */
  suiteRole?: string;
  apps?: string[];
  active: boolean;
};

export type AuthorizedEmail = { email: string; note: string | null; authorizedAt: string; authorizedByName: string | null };

export class CentroIdentityError extends Error {
  constructor(message: string, readonly status: number, readonly code = '') {
    super(message);
    this.name = 'CentroIdentityError';
  }
}

const identityUrl = () => String(process.env.CENTRO_CUSTOS_IDENTITY_URL || DEFAULT_IDENTITY_URL).replace(/\/+$/, '');

const serviceKey = () => {
  // Segredo colado com BOM (U+FEFF) ou espacos quebra o cabecalho HTTP; o Centro normaliza igual.
  const key = (process.env.CONSTRUTEC_IDENTITY_KEY || '').replace(/^\uFEFF/, '').trim();
  return key.length >= MIN_SERVICE_KEY_LENGTH ? key : '';
};

type CallOptions = { method?: string; token?: string; body?: unknown; clientIp?: string; service?: boolean };

const call = async <T>(path: string, options: CallOptions = {}): Promise<T> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.service) {
    const key = serviceKey();
    if (!key) throw new CentroIdentityError('Integração de contas com o Centro de Custos não configurada neste servidor.', 503, 'IDENTITY_NOT_CONFIGURED');
    headers['X-Construtec-Identity-Key'] = key;
  }
  if (options.clientIp && serviceKey()) {
    headers['X-Construtec-Identity-Key'] = serviceKey();
    headers['X-Construtec-Client-IP'] = options.clientIp;
  }
  let response: Response;
  try {
    response = await fetch(`${identityUrl()}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    // Codigo de rede (ex.: ENOTFOUND, ECONNREFUSED, TimeoutError) para diagnostico; nunca inclui dados da requisicao.
    const inner = (error as { cause?: { name?: string; code?: string; message?: string; errors?: { code?: string }[] } })?.cause;
    const cause = inner
      ? [inner.name, inner.code, inner.errors?.map(item => item.code).join('/'), inner.message].filter(Boolean).join(' ').slice(0, 160)
      : String((error as Error)?.message || (error as Error)?.name || 'erro').slice(0, 160);
    console.error('[centro-identity] sem conexao', path, cause);
    throw new CentroIdentityError('Não foi possível conectar ao Centro de Custos para validar o acesso. Verifique a internet e tente novamente.', 503, 'IDENTITY_UNAVAILABLE');
  }
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new CentroIdentityError(String(data.error || `Centro de Custos respondeu HTTP ${response.status}.`), response.status, String(data.code || ''));
  }
  return data as T;
};

export const centroLogin = (email: string, password: string, clientIp?: string) =>
  call<{ sessionToken: string; expiresAt: number; user: CentroUser }>('/v1/auth/login', {
    method: 'POST', body: { email, password }, clientIp,
  });

export const centroSession = (token: string) =>
  call<{ user: CentroUser; expiresAt: number }>('/v1/auth/session', { token, service: Boolean(serviceKey()) });

// Handoff do app Suite Construtec (contrato §6): so o servidor do Orcamentos,
// com a chave de servico, troca o codigo por uma sessao central filha.
export const centroConsumeHandoff = (code: string) =>
  call<{ sessionToken: string; expiresAt: number; user: CentroUser }>('/v1/auth/handoff/consume', {
    method: 'POST', service: true, body: { code, target: 'orcamentos' },
  });

export const centroPermissions = (token: string) =>
  call<{ ok: boolean; matrix: Record<string, Record<string, boolean>> }>('/v1/permissions', { token });

export const centroLogout = (token: string) => call<{ ok: boolean }>('/v1/auth/logout', { method: 'POST', token });

export const centroListUsers = (token: string) => call<{ users: CentroUser[] }>('/v1/users', { token, service: true });

export const centroCreateUser = (token: string, input: { name: string; email: string; password: string }) =>
  call<{ user: CentroUser }>('/v1/users', { method: 'POST', token, service: true, body: input });

export const centroSetUserStatus = (token: string, email: string, active: boolean, id?: string | null) =>
  call<{ ok: boolean }>('/v1/users/status', { method: 'POST', token, service: true, body: { email, active, id: id || undefined } });

export const centroDeleteUser = (token: string, email: string, id?: string | null) =>
  call<{ ok: boolean }>('/v1/users/delete', { method: 'POST', token, service: true, body: { email, id: id || undefined } });

export const centroListAuthorizedEmails = (token: string) =>
  call<{ emails: AuthorizedEmail[] }>('/v1/authorized-emails', { token, service: true });

export const centroAuthorizeEmail = (token: string, email: string, note: string) =>
  call<{ ok: boolean }>('/v1/authorized-emails', { method: 'POST', token, service: true, body: { email, note } });

export const centroRevokeEmail = (token: string, email: string) =>
  call<{ ok: boolean }>('/v1/authorized-emails/revoke', { method: 'POST', token, service: true, body: { email } });

// Central de notificacoes da Suite (Worker do Centro, Fase 4): o Orcamentos so repassa
// a sessao central do usuario; a lista, as lidas e as preferencias vivem la.
export type CentroNotification = { id: string; type: string; app: string; title: string; body: string; link: string | null; createdAt: string; read: boolean };
type NotificationPath = '/v1/notifications' | '/v1/notifications/read' | '/v1/notifications/prefs' | '/v1/notifications/test';
export const centroNotifications = <T>(token: string, path: NotificationPath, method = 'GET', body?: unknown, query = '') =>
  call<T>(`${path}${query}`, { method, token, body });

// Aviso no sino da equipe quando o cliente responde ao link. O Centro monta o texto; aqui vai so o fato.
// Nunca derruba a resposta do cliente: sem integracao configurada ou sem rede, so registra no log.
export const centroNotifyClientReply = async (input: { event: 'approved' | 'adjust'; proposalId: string; proposalNumber: string; responsibleCentroUserId: string | null }) => {
  try {
    await call('/v1/internal/orcamentos-notify', { method: 'POST', body: input, service: true });
  } catch (error) {
    console.error('[centro-identity] aviso do link nao enviado', error instanceof Error ? error.message : 'erro');
  }
};
