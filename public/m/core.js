// Nucleo do Orcamentos no celular: sessao, API, formatos, avisos e tema. Sem dependencias.
// Mesma base do /m/ do Centro de Custos (public/m/core.js no repositorio do Centro).
(function (OC) {
  const app = () => document.getElementById('view');

  OC.esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  OC.$ = (sel, scope) => (scope || document).querySelector(sel);
  OC.$$ = (sel, scope) => Array.from((scope || document).querySelectorAll(sel));

  // Centavos com arredondamento HALF_UP (regra do repositorio).
  OC.cents = (value) => {
    const n = Number(value) || 0;
    return Math.sign(n) * Math.round(Math.abs(n) * 100 + 1e-7) / 100;
  };
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  OC.money = (value) => brl.format(OC.cents(value));
  OC.money0 = (value) => brl0.format(Math.round(Number(value) || 0));
  OC.mi = (value) => {
    const n = Math.abs(Number(value) || 0);
    if (n >= 1e6) return `R$ ${(n / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;
    if (n >= 1e3) return `R$ ${(n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
    return OC.money0(n);
  };
  OC.num = (value) => (Number(value) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  OC.dec2 = (value) => (Number(value) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  OC.pct = (value) => `${(Number(value) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  OC.dateBr = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
  OC.dateFull = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
  OC.daysUntil = (iso) => {
    if (!iso) return null;
    const end = new Date(`${iso.slice(0, 10)}T00:00:00`);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.round((end - now) / 86400000);
  };
  OC.daysSince = (iso) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : 0);
  OC.greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Bom dia' : (h < 18 ? 'Boa tarde' : 'Boa noite');
  };
  OC.firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';
  OC.rev = (n) => `REV ${String(n || 0).padStart(2, '0')}`;

  // Status da proposta: rotulo e classe da etiqueta (cores do prototipo).
  OC.STATUS = {
    draft: ['Em edição', 'ed'],
    review: ['Em revisão', 'rev'],
    sent: ['Enviada', 'env'],
    approved: ['Aprovada', 'apr'],
    rejected: ['Recusada', 'rec'],
  };
  OC.pill = (status) => {
    const [label, cls] = OC.STATUS[status] || [status, 'rec'];
    return `<span class="pill st-${cls}">${OC.esc(label)}</span>`;
  };

  // Sessao: mesma chave do token do Orcamentos web (AuthGate), para trocar de versao sem entrar de novo.
  const TOKEN_KEY = 'construtec.auth.session', USER_KEY = 'construtec.m.user';
  OC.session = {
    token: () => { try { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } },
    user: () => { try { return JSON.parse(localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY) || 'null'); } catch { return null; } },
    save(data) {
      try {
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      } catch { /* sem armazenamento: vale so nesta aba */ }
    },
    clear() { try { [TOKEN_KEY, USER_KEY].forEach((k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); }); } catch { /* nada */ } },
  };
  OC.canEdit = () => { const u = OC.session.user(); return !!u && u.role !== 'viewer'; };

  class ApiError extends Error {
    constructor(status, message) { super(message); this.status = status; }
  }
  OC.ApiError = ApiError;

  // status 0 = sem rede. 401 limpa a sessao e mostra a tela de entrar de novo.
  OC.api = async function (path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const token = OC.session.token();
    if (token) headers['X-Construtec-Session'] = token;
    let response;
    try {
      response = await fetch(`/api${path}`, { method: options.method || 'GET', headers, body: options.body === undefined ? undefined : JSON.stringify(options.body), cache: 'no-store' });
    } catch {
      throw new ApiError(0, 'Sem internet. Confira a conexão e tente de novo.');
    }
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && !path.startsWith('/auth/login')) {
      OC.session.clear();
      if (OC.onUnauthorized) OC.onUnauthorized();
      throw new ApiError(401, 'Sua sessão terminou. Entre de novo.');
    }
    if (!response.ok) throw new ApiError(response.status, data.error || 'Não foi possível concluir agora.');
    return data;
  };

  // Tela antiga que termina de carregar depois de trocar de aba nao desenha por cima da nova.
  class Stale extends Error {}
  OC.Stale = Stale;
  OC.render = function (html, inner, params) {
    if (params && params.__nav && params.__nav !== OC.nav) throw new Stale();
    const el = app();
    el.innerHTML = `<main class="screen${inner ? ' inner' : ''}">${html}</main>`;
    window.scrollTo(0, 0);
    return el.firstElementChild;
  };

  let toastTimer = 0;
  OC.toast = function (message, iconName) {
    OC.$$('.toast').forEach((t) => t.remove());
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.innerHTML = `${OC.icon(iconName || 'check-circle', 18)}<span>${OC.esc(message)}</span>`;
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 2600);
  };

  // Tema: escolha salva, depois ?tema= (o app Android pode mandar), depois o do aparelho.
  OC.theme = {
    get() {
      let saved = '';
      try { saved = localStorage.getItem('orc_m_tema') || ''; } catch { /* nada */ }
      const asked = new URLSearchParams(location.search).get('tema');
      return saved || (asked === 'escuro' || asked === 'claro' ? asked : '') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro');
    },
    apply(value) {
      document.documentElement.dataset.theme = value;
      const meta = OC.$('meta[name="theme-color"]');
      if (meta) meta.content = value === 'escuro' ? '#031f29' : '#f2f8fa';
    },
    toggle() {
      const next = OC.theme.get() === 'escuro' ? 'claro' : 'escuro';
      try { localStorage.setItem('orc_m_tema', next); } catch { /* nada */ }
      OC.theme.apply(next);
      return next;
    },
  };

  // Cabecalho padrao: marca, sino opcional e seletor Suite.
  OC.header = function (title, opts = {}) {
    const back = opts.back ? `<button class="back" type="button" data-back aria-label="Voltar">${OC.icon('caret-left', 22)}</button>` : '';
    const brand = opts.back ? `<h1>${OC.esc(title)}</h1><span class="grow"></span>` : `<span class="brand"><img src="simbolo.png" alt="">Orçamentos</span>`;
    return `<div class="top">${back}${brand}${opts.extra || ''}<button class="suite-pill" type="button" data-suite>${OC.icon('stack', 18)}Suíte${OC.icon('caret-down', 14)}</button></div>`;
  };
})(window.OC = window.OC || {});
