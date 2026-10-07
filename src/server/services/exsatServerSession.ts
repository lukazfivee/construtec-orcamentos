import { ExsatServerError } from './exsatErrors';
import { decodeExsatBody, fetchExsatBody, validateExsatUrl } from './exsatFetch';
import { isAuthenticatedResponse, isLoginPage } from './exsatPages';

// Login da Exsat por HTTP, sem navegador. A pagina de login chama POST /ajax/actions (action=enterAccount, email, password)
// e responde JSON: {"redirect": "..."} se entrou ou {"danger": "..."} se recusou. Nao ha captcha nem token de formulario
// hoje; se aparecer, o servidor para (EXSAT_CHALLENGE) em vez de tentar contornar.
export const LOGIN_URL = 'https://exsat.com.br/central-cliente/login/';
export const ACTIONS_URL = 'https://exsat.com.br/ajax/actions';
export const HOME_URL = 'https://exsat.com.br/home/';
const USER_AGENT = 'Construtec-Orcamentos/1.0 (sincronizacao de catalogo de revendedor)';

export type ExsatHttp = (url: URL, init: { method: 'GET' | 'POST'; headers: Record<string, string>; body?: string }) => Promise<Response>;

const realHttp: ExsatHttp = (url, init) => fetch(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(25_000) });

const CHALLENGE_HTML = /g-recaptcha|recaptcha\/api|hcaptcha|cf-turnstile|Just a moment|captcha/i;

const htmlText = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// Le o JSON do login. Sem eco da resposta: so o codigo do erro sai daqui.
export const classifyLoginResponse = (text: string): { ok: true; redirect: string } | { ok: false; code: ExsatServerError['code'] } => {
  let body: { redirect?: unknown; danger?: unknown };
  try { body = JSON.parse(text) as typeof body; } catch {
    return { ok: false, code: CHALLENGE_HTML.test(text) ? 'EXSAT_CHALLENGE' : 'EXSAT_LOGIN_CHANGED' };
  }
  if (typeof body?.redirect === 'string' && body.redirect) return { ok: true, redirect: body.redirect };
  if (typeof body?.danger === 'string') {
    const message = htmlText(body.danger);
    if (/captcha|rob[oô]|verifica[cç][aã]o/i.test(message)) return { ok: false, code: 'EXSAT_CHALLENGE' };
    if (/bloquead|limitad|muitas tentativas|excedeu/i.test(message)) return { ok: false, code: 'EXSAT_LOGIN_BLOCKED' };
    return { ok: false, code: 'EXSAT_LOGIN_REJECTED' };
  }
  return { ok: false, code: 'EXSAT_LOGIN_CHANGED' };
};

// Pausa depois de uma falha de login, para nao bloquear a conta do Lucas: recusa na 1a vez espera 1 minuto, a partir da
// 2a seguida espera 30 minutos; desafio ou bloqueio, 30 minutos; falhas de rede ou de leitura, 2 minutos.
export class ExsatLoginGate {
  private until = 0;
  private rejections = 0;
  constructor(private now: () => number = Date.now) {}
  remainingSeconds() { return Math.max(0, Math.ceil((this.until - this.now()) / 1000)); }
  assertOpen() {
    const wait = this.remainingSeconds();
    if (wait > 0) throw new ExsatServerError('EXSAT_LOGIN_PAUSED', wait);
  }
  fail(code: string) {
    this.rejections = code === 'EXSAT_LOGIN_REJECTED' ? this.rejections + 1 : 0;
    const minutes = code === 'EXSAT_LOGIN_REJECTED' ? (this.rejections >= 2 ? 30 : 1)
      : code === 'EXSAT_CHALLENGE' || code === 'EXSAT_LOGIN_BLOCKED' ? 30 : 2;
    this.until = this.now() + minutes * 60_000;
  }
  succeed() { this.until = 0; this.rejections = 0; }
}

export class ExsatSession {
  private jar = new Map<string, string>();
  connected = false;
  lastLoginAt: Date | null = null;

  constructor(private http: ExsatHttp = realHttp) {}

  clear() { this.jar.clear(); this.connected = false; }
  private cookieHeader() { return [...this.jar].map(([name, value]) => `${name}=${value}`).join('; '); }
  private remember(response: Response) {
    for (const line of response.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(';');
      const eq = pair.indexOf('=');
      if (eq <= 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (!value || /^deleted$/i.test(value)) this.jar.delete(name); else this.jar.set(name, value);
    }
  }

  private async send(rawUrl: string, init?: { method: 'POST'; body: string; headers: Record<string, string> }) {
    let first = true;
    try {
      const { response, finalUrl, body } = await fetchExsatBody(rawUrl, async (url) => {
        const post = first && init;
        first = false;
        const reply = await this.http(url, {
          method: post ? 'POST' : 'GET',
          headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/json', 'Accept-Language': 'pt-BR,pt;q=0.9', Cookie: this.cookieHeader(), ...(post ? init.headers : {}) },
          body: post ? init.body : undefined,
        });
        this.remember(reply);
        return reply;
      }, 4_000_000);
      return { status: response.status, finalUrl, html: decodeExsatBody(response.headers.get('content-type'), body), challenged: response.headers.get('cf-mitigated') === 'challenge' };
    } catch (error) {
      if (error instanceof ExsatServerError) throw error;
      throw new ExsatServerError('EXSAT_UNAVAILABLE');
    }
  }

  // Pagina da Exsat com a sessao atual. 403/429 com desafio vira EXSAT_CHALLENGE; 5xx ou rede, EXSAT_UNAVAILABLE.
  async get(rawUrl: string): Promise<{ html: string; finalUrl: string; status: number }> {
    validateExsatUrl(rawUrl);
    const page = await this.send(rawUrl);
    if (page.challenged || ((page.status === 403 || page.status === 429 || page.status === 503) && CHALLENGE_HTML.test(page.html))) {
      throw new ExsatServerError('EXSAT_CHALLENGE');
    }
    if (page.status >= 500 || page.status === 429) throw new ExsatServerError('EXSAT_UNAVAILABLE');
    return { html: page.html, finalUrl: page.finalUrl, status: page.status };
  }

  // Uma unica tentativa de login. Quem chama decide a pausa (ExsatLoginGate) e nunca chama de novo sozinho.
  async login(username: string, password: string): Promise<void> {
    this.clear();
    const form = await this.get(LOGIN_URL);
    if (CHALLENGE_HTML.test(form.html)) throw new ExsatServerError('EXSAT_CHALLENGE');
    if (!/enterAccount/.test(form.html) || !/name=["']password["']/i.test(form.html)) throw new ExsatServerError('EXSAT_LOGIN_CHANGED');
    const reply = await this.send(ACTIONS_URL, {
      method: 'POST',
      body: new URLSearchParams({ action: 'enterAccount', email: username, password }).toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest',
        Origin: 'https://exsat.com.br', Referer: LOGIN_URL,
      },
    });
    if (reply.challenged || ((reply.status === 403 || reply.status === 429) && CHALLENGE_HTML.test(reply.html))) throw new ExsatServerError('EXSAT_CHALLENGE');
    if (reply.status >= 500) throw new ExsatServerError('EXSAT_UNAVAILABLE');
    const result = classifyLoginResponse(reply.html);
    if (!result.ok) throw new ExsatServerError(result.code);
    // Confirma na pagina inicial (e, se preciso, no destino do redirect) que a conta aparece logada.
    const targets = [HOME_URL];
    try { targets.push(validateExsatUrl(new URL(result.redirect, LOGIN_URL).toString()).toString()); } catch { /* destino fora da Exsat: ignora */ }
    for (const target of targets) {
      const page = await this.get(target);
      if (isAuthenticatedResponse(page)) {
        this.connected = true;
        this.lastLoginAt = new Date();
        return;
      }
    }
    this.clear();
    throw new ExsatServerError('EXSAT_LOGIN_UNVERIFIED');
  }

  // Pagina que so conta se a sessao estiver logada de verdade: sem o marcador da conta, o preco pode ser o publico.
  async getAuthenticated(rawUrl: string) {
    const page = await this.get(rawUrl);
    if (page.status >= 400) return page;
    if (isLoginPage(page) || !isAuthenticatedResponse(page)) {
      this.connected = false;
      throw new ExsatServerError('EXSAT_LOGIN_REQUIRED');
    }
    return page;
  }
}
