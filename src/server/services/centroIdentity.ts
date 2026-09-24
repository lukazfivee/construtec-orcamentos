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
  const key = process.env.CONSTRUTEC_IDENTITY_KEY || '';
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
  } catch {
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
