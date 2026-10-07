// Site da Exsat de mentira para os testes: login por /ajax/actions, cookie de sessao, pagina inicial e departamentos.
// Nenhum teste fala com a Exsat de verdade nem usa a conta real do Lucas.
import type { ExsatHttp } from './exsatServerSession';

export type MockExsatOptions = {
  email?: string;
  password?: string;
  /** departamento -> cartoes: [codigo, titulo, preco (0 = sem preco), marca] */
  departments?: Record<string, Array<[string, string, number, string?]>>;
  /** Responde o login com desafio (captcha) em vez de JSON. */
  challenge?: boolean;
  /** Numero de requisicoes de departamento a partir da qual a sessao "cai" (a pagina volta sem o marcador da conta). */
  dropSessionAfter?: number;
  /** Departamentos que respondem 500. */
  failing?: string[];
};

const brl = (value: number) => `R$ ${value.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

export const createMockExsat = (options: MockExsatOptions = {}) => {
  const email = options.email ?? 'conta@teste.invalid';
  const password = options.password ?? 'senha-de-teste-123';
  const departments = options.departments ?? { 'cameras-ip': [['4570042', 'Câmera IP Dome', 225.65, 'Intelbras'], ['4570099', 'Câmera Sem Preço', 0]] };
  const log: Array<{ method: string; url: string; body?: string; cookie: string }> = [];
  const state = { loggedIn: false, departmentHits: 0, logins: 0 };

  const menu = Object.keys(departments).map((slug) => `<li><a href="/produtos/departamento/${slug}/">${slug}</a></li>`).join('')
    + '<a href="/produtos/departamento/cameras-ip/?busca=x">busca</a><a href="/produtos/detalhes/4570042/x/">produto</a><a href="https://outro.com/produtos/departamento/x/">fora</a>';
  const page = (body: string, marker: boolean, status = 200, extra: Record<string, string> = {}) => new Response(
    `<html><body>${marker ? '<a href="/central-cliente/logout/">Sair</a> Minha conta' : '<a href="/central-cliente/login/">Entrar</a>'}${body}</body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', ...extra } },
  );
  const withCookie = (response: Response, cookie: string) => { response.headers.append('set-cookie', `${cookie}; path=/; Max-Age=3600`); return response; };

  const http: ExsatHttp = async (url, init) => {
    log.push({ method: init.method, url: url.toString(), body: init.body, cookie: init.headers.Cookie ?? '' });
    const cookies = init.headers.Cookie ?? '';
    const authed = state.loggedIn && /(?:^|; )sess=ok/.test(cookies);
    if (url.pathname === '/central-cliente/login/') {
      if (options.challenge) return page('<div class="g-recaptcha"></div>', false);
      return withCookie(page('<form class="login"><input type="hidden" name="action" value="enterAccount"><input type="password" name="password"></form>', false), 'PHPSESSID=abc123');
    }
    if (url.pathname === '/ajax/actions' && init.method === 'POST') {
      if (options.challenge) return new Response('<html>Just a moment...</html>', { status: 403, headers: { 'content-type': 'text/html' } });
      const form = new URLSearchParams(init.body ?? '');
      state.logins += 1;
      if (form.get('action') === 'enterAccount' && form.get('email') === email && form.get('password') === password) {
        state.loggedIn = true;
        return withCookie(Response.json({ redirect: '/central-cliente/' }), 'sess=ok');
      }
      return Response.json({ danger: 'E-mail ou senha inválidos.' });
    }
    if (url.pathname === '/home/' || url.pathname === '/central-cliente/') return page('<h1>Home</h1>', authed);
    const match = /^\/produtos\/departamento\/([a-z0-9-]+)\/$/.exec(url.pathname);
    if (match && match[1] in departments) {
      state.departmentHits += 1;
      if (options.failing?.includes(match[1])) return page('erro', true, 500);
      const dropped = options.dropSessionAfter !== undefined && state.departmentHits > options.dropSessionAfter;
      if (dropped) state.loggedIn = false;
      const marker = authed && !dropped;
      const cards = departments[match[1]].map(([code, title, price]) => `
        <div class="product-card"><div class="product-sku">${code}</div>
        <span class="titprodutoscar"><a href="/produtos/detalhes/${code}/x/" class="product-title">${title}</a></span>
        ${marker && price > 0 ? `<div class="product-pricing"><div class="price-current">${brl(price)}</div><div class="price-installment">10x de ${brl(price / 10)}</div></div>` : ''}
        </div>`).join('');
      // O JSON de analytics traz "price" mesmo sem login; a varredura nao pode usa-lo.
      const layer = departments[match[1]].map(([code, title, , brand]) => `{"id": "${code}", "name": "${title}", "brand": "${brand ?? ''}", "category": "Cat ${match[1]}", "price": "1.00"}`).join(',');
      return page(`<h1>Departamento ${match[1]}</h1><script>var d=[${layer}];</script>${cards}<ul>${menu}</ul>`, marker);
    }
    return page('não encontrado', authed, 404);
  };

  return { http, log, state, email, password };
};
