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
  // Mao de obra no documento do cliente: uma linha de venda (custo x BDI, como no PDF do servidor). Sem p10 o servidor
  // zera custo e BDI; ai vale o que sobra do valor final depois dos itens.
  OC.laborSale = (p) => {
    if (!(p.laborItems || []).length) return 0;
    const t = p.totals || {};
    if (t.labor > 0 && p.bdiMultiplier > 0) return OC.cents(t.labor * p.bdiMultiplier);
    const itemsSale = (p.items || []).reduce((s, it) => s + (it.totalSale || 0), 0);
    return Math.max(0, OC.cents((t.finalValue || 0) - itemsSale));
  };

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
  // Permissao da Suite (p10: custo, BDI e margem; p11: enviar e aprovar). Sem a lista (sessao antiga) nada some; o servidor recusa.
  OC.costText = (text) => (OC.can('p10') ? text : '—');
  OC.can = (permission) => { const u = OC.session.user(); return !u || !Array.isArray(u.permissions) || u.permissions.includes(permission); };

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

  // Teclado: o iOS nao encolhe a pagina; a folha acompanha a area visivel e o campo focado sobe para o meio da tela.
  const fitSheets = () => {
    const vv = window.visualViewport;
    document.documentElement.style.setProperty('--vvh', vv && vv.scale <= 1.01 ? `${Math.round(vv.height)}px` : '100dvh');
  };
  if (window.visualViewport) { window.visualViewport.addEventListener('resize', fitSheets); fitSheets(); }
  document.addEventListener('focusin', (event) => {
    const field = event.target;
    if (field && field.matches && field.matches('input:not([type=checkbox]):not([type=radio]), textarea, select')) setTimeout(() => { try { field.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch { /* nada */ } }, 320);
  });

  // Folhas inferiores (mesmo desenho do seletor Suite): confirmar, perguntar um texto.
  OC.sheet = function (html) {
    const el = document.createElement('div');
    el.className = 'sheet-backdrop';
    el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-handle"></div>${html}</div>`;
    const close = () => el.remove();
    el.addEventListener('click', (event) => { if (event.target === el || event.target.closest('.sheet-x')) close(); });
    document.body.appendChild(el);
    return { el, close };
  };
  OC.sheetHead = (title, ic) => `<div class="sheet-head"><b>${OC.icon(ic, 18)}${OC.esc(title)}</b><button type="button" class="sheet-x" aria-label="Fechar">${OC.icon('x', 20)}</button></div>`;
  OC.confirm = function (title, text, label, onYes) {
    const s = OC.sheet(`${OC.sheetHead(title, 'info')}<p class="sheet-text">${OC.esc(text)}</p>
      <div class="sheet-actions"><button class="btn2" type="button" data-no>Cancelar</button><button class="btn" type="button" data-yes>${OC.esc(label)}</button></div>`);
    OC.$('[data-no]', s.el).addEventListener('click', s.close);
    OC.$('[data-yes]', s.el).addEventListener('click', async (event) => {
      const b = event.currentTarget;
      b.disabled = true;
      try { await onYes(); s.close(); } catch (error) { OC.toast(error.message, 'warning-circle'); b.disabled = false; }
    });
  };
  // Pede um texto; onDone recebe o valor e pode lancar erro para manter a folha aberta.
  OC.ask = function (title, label, placeholder, onDone, value) {
    const s = OC.sheet(`${OC.sheetHead(title, 'pencil-simple')}<label class="field" style="margin-top:12px"><span>${OC.esc(label)}</span>
      <input type="text" data-ask placeholder="${OC.esc(placeholder || '')}" value="${OC.esc(value || '')}" autocomplete="off"></label>
      <div class="sheet-actions"><button class="btn2" type="button" data-no>Cancelar</button><button class="btn" type="button" data-yes>Salvar</button></div>`);
    const field = OC.$('[data-ask]', s.el);
    OC.$('[data-no]', s.el).addEventListener('click', s.close);
    const go = async () => {
      const text = field.value.trim();
      if (text.length < 2) { field.focus(); return; }
      const b = OC.$('[data-yes]', s.el);
      b.disabled = true;
      try { await onDone(text); s.close(); } catch (error) { OC.toast(error.message, 'warning-circle'); b.disabled = false; }
    };
    OC.$('[data-yes]', s.el).addEventListener('click', go);
    field.addEventListener('keydown', (event) => { if (event.key === 'Enter') go(); });
    setTimeout(() => field.focus(), 50);
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
      OC.$$('meta[name="theme-color"]').forEach((meta) => { meta.content = value === 'escuro' ? '#031f29' : '#f2f8fa'; });
      document.documentElement.style.colorScheme = value === 'escuro' ? 'dark' : 'light';
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
    return `<div class="top">${back}${brand}${opts.extra || ''}<button class="suite-pill" type="button" data-suite aria-label="Suíte">${OC.icon('stack', 18)}<span class="sp-t">Suíte</span>${OC.icon('caret-down', 14)}</button></div>`;
  };
})(window.OC = window.OC || {});
