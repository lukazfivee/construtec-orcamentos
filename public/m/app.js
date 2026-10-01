// Navegacao, barra de abas e entrada pelo app (handoff) do Orcamentos no celular.
(function (OC) {
  const { esc, icon } = OC;
  OC.screens = OC.screens || {};
  const TABS = [
    ['home', 'Início', 'squares-four', ['home', 'painel', 'avisos']],
    ['props', 'Propostas', 'file-text', ['props', 'prop', 'nova', 'labor', 'pdf', 'cmp']],
    ['kits', 'Kits', 'stack', ['kits', 'kit']],
    ['menu', 'Menu', 'list', ['menu', 'cfg', 'cat', 'cli']],
  ];
  let current = 'home', currentParams = {};
  let lensTimer;
  OC.nav = 0;
  OC.current = () => current;

  function paintTabs() {
    const nav = document.getElementById('tabs');
    const activeIndex = TABS.findIndex(([, , , owns]) => owns.includes(current));
    if (nav.dataset.activeIndex !== undefined && Number(nav.dataset.activeIndex) !== activeIndex) {
      nav.classList.add('is-moving');
      clearTimeout(lensTimer);
      lensTimer = setTimeout(() => nav.classList.remove('is-moving'), 340);
    }
    nav.dataset.activeIndex = String(activeIndex);
    nav.style.setProperty('--active-x', `${Math.max(0, activeIndex) * 100}%`);
    nav.innerHTML = '<span class="tabs-refraction" aria-hidden="true"></span>' + TABS.map(([key, label, ic, owns]) => {
      const on = owns.includes(current);
      return `<button class="tab" type="button" data-go="${key}"${on ? ' aria-current="page"' : ''}>${icon(on ? `${ic}-fill` : ic, 22)}<span>${label}</span></button>`;
    }).join('');
    OC.$$('[data-go]', nav).forEach((b) => b.addEventListener('click', () => OC.go(b.dataset.go)));
    if (!nav.classList.contains('is-ready')) requestAnimationFrame(() => nav.classList.add('is-ready'));
  }

  // Pilha simples para o botao voltar das telas internas (proposta, kit).
  const stack = [];
  OC.go = function (name, params, opts = {}) {
    const screen = OC.screens[name];
    if (!screen) return;
    if (opts.push) stack.push([current, currentParams]);
    else if (!opts.back) stack.length = 0;
    current = name;
    if (OC.suite) OC.suite.context = null;
    currentParams = { ...(params || {}) };
    delete currentParams.__nav;
    OC.nav += 1;
    document.body.classList.remove('no-tabs');
    paintTabs();
    history.replaceState(null, '', `#${name}${currentParams.id ? `=${encodeURIComponent(currentParams.id)}` : ''}`);
    const nav = OC.nav;
    Promise.resolve(screen({ ...currentParams, __nav: nav })).catch((error) => {
      if (error instanceof OC.Stale || nav !== OC.nav) return;
      OC.errorScreen(error, () => OC.go(name, params));
    });
  };
  OC.open = (name, params) => OC.go(name, params, { push: true });
  OC.back = function () {
    const prev = stack.pop();
    if (prev) OC.go(prev[0], prev[1], { back: true });
    else OC.go({ kit: 'kits', painel: 'home', avisos: 'home', cfg: 'menu', cat: 'menu', cli: 'menu' }[current] || 'props');
  };
  OC.reload = () => OC.go(current, currentParams, { back: true });
  document.addEventListener('click', (event) => { if (event.target.closest('[data-back]')) OC.back(); });

  OC.errorScreen = function (error, retry) {
    const offline = error && error.status === 0;
    const text = (error && error.message) || 'Não foi possível carregar agora.';
    const main = OC.render(`${OC.header('')}<div class="empty">${icon(offline ? 'wifi-slash' : 'warning-circle', 28)}${esc(text)}
      <button class="btn2" type="button" id="retry" style="padding:0 18px">Tentar de novo</button></div>`);
    OC.$('#retry', main).addEventListener('click', retry);
  };

  const inApp = () => /SuiteConstrutec/.test(navigator.userAgent);
  function signedOut(message) {
    document.body.classList.add('no-tabs');
    // No iPhone e no navegador o login e aqui mesmo; no app Android volta para a tela do app.
    if (!inApp()) return OC.loginScreen(message, () => start());
    OC.render(`${OC.header('')}<div class="empty" style="padding-top:60px">${icon('shield-check', 32)}
      <b style="color:var(--text);font-size:17px">${esc(message || 'Entre para usar o Orçamentos')}</b>
      <span>Entre de novo no aplicativo.</span>
      <a class="btn" href="suite://entrar" style="padding:0 22px;text-decoration:none">Entrar</a></div>`);
  }
  OC.onUnauthorized = () => signedOut('Sua sessão terminou');
  OC.logout = async function () {
    try { await OC.api('/auth/logout', { method: 'POST', body: {} }); } catch { /* sai mesmo sem rede */ }
    OC.session.clear();
    signedOut('Você saiu da sua conta');
  };

  async function consumeHandoff(code) {
    history.replaceState(null, '', location.pathname + location.search);
    const data = await OC.api('/auth/handoff', { method: 'POST', body: { code } });
    if (!data.token || !data.user) throw new Error('Não foi possível entrar pelo aplicativo.');
    OC.session.save(data);
  }

  // Sessao aberta pela versao completa: o token existe, o usuario ainda nao.
  async function ensureUser() {
    if (OC.session.user()) return;
    const data = await OC.api('/auth/me');
    OC.session.save({ token: OC.session.token(), user: data.user });
  }

  async function boot() {
    OC.theme.apply(OC.theme.get());
    const hash = new URLSearchParams(location.hash.slice(1));
    const code = hash.get('handoff');
    if (code) {
      try { await consumeHandoff(code); } catch (error) { if (!OC.session.token()) return signedOut(error.message); }
    }
    if (!OC.session.token()) return signedOut();
    try { await ensureUser(); } catch (error) { if (error.status === 401) return undefined; }
    return start();
  }

  let started = false;
  function start() {
    if (started) return OC.go('home');
    started = true;
    if (OC.notif) OC.notif.refresh();
    // #proposta=<id> (seletor Suite e avisos) ou #prop=<id> ao recarregar.
    const route = () => {
      const target = new URLSearchParams(location.hash.slice(1));
      return target.get('proposta') || target.get('prop') || '';
    };
    window.addEventListener('hashchange', () => {
      const id = route();
      if (id && OC.session.token() && !(current === 'prop' && currentParams.id === id)) OC.open('prop', { id });
    });
    const id = route();
    if (id) return OC.go('prop', { id });
    // Recarregar numa tela interna (#kit=<id>, #labor=<id>) volta para ela.
    const [first, param] = location.hash.slice(1).split('=');
    if (['kit', 'labor', 'pdf', 'cmp'].includes(first) && param) return OC.go(first, { id: decodeURIComponent(param) });
    return OC.go(OC.screens[first] && !['prop', 'kit', 'labor', 'nova', 'pdf', 'cmp'].includes(first) ? first : 'home');
  }

  document.addEventListener('DOMContentLoaded', boot);
})(window.OC = window.OC || {});
