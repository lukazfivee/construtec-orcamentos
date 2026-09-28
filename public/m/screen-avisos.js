// Notificacoes no celular (Fase 4, mesmo desenho do /m/ do Centro): sino com contador,
// lista por dia, filtro por app, marcar como lidas, preferencias e teste.
// Os avisos ficam no Worker do Centro; o servidor do Orcamentos repassa (/api/notifications).
(function (OC) {
  const { esc, icon } = OC;
  const APPS = [['', 'Todos'], ['orcamentos', 'Orçamentos'], ['centro-custos', 'Centro de Custos'], ['conta', 'Conta']];
  const PREFS = [['proposta_aprovada', 'Proposta aprovada'], ['acima_orcado', 'Item acima do orçado'], ['conta_vencer', 'Contas a vencer'], ['novo_acesso', 'Novo acesso à conta'], ['pedido_acesso', 'Pedido de acesso (admin)']];
  const inApp = () => /SuiteConstrutec\//.test(navigator.userAgent);

  OC.notif = { unread: 0 };
  const label = (n) => `Notificações${n ? `, ${n} ${n === 1 ? 'nova' : 'novas'}` : ''}`;
  OC.bellBtn = () => {
    const n = OC.notif.unread;
    return `<button class="bell-btn" type="button" data-avisos aria-label="${label(n)}">${icon('bell', 22)}<span class="bell-count"${n ? '' : ' hidden'}>${n > 99 ? '99+' : n}</span></button>`;
  };
  function paintBell() {
    const n = OC.notif.unread;
    OC.$$('.bell-count').forEach((el) => { el.hidden = !n; el.textContent = n > 99 ? '99+' : String(n); });
    OC.$$('.bell-btn').forEach((el) => el.setAttribute('aria-label', label(n)));
  }
  OC.notif.refresh = async function () {
    try { OC.notif.unread = Number((await OC.api('/notifications?limit=1')).unread) || 0; } catch { /* sem central: o sino fica sem numero */ }
    paintBell();
  };
  document.addEventListener('click', (event) => { if (event.target.closest('[data-avisos]')) OC.open('avisos'); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && OC.session.token()) OC.notif.refresh(); });

  const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA');
  function group(iso) {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86400000);
    if (dayKey(iso) === today.toLocaleDateString('en-CA')) return 'Hoje';
    if (dayKey(iso) === yesterday.toLocaleDateString('en-CA')) return 'Ontem';
    return 'Anteriores';
  }
  const hour = (iso) => new Date(iso).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Destino do aviso: proposta aqui; obra ou pedidos no Centro (troca de app dentro do Suite).
  function follow(link) {
    const [app, query] = String(link || '').split('?');
    const params = new URLSearchParams(query || '');
    if (app === 'orcamentos') { if (params.get('proposta')) OC.open('prop', { id: params.get('proposta') }); return; }
    if (app !== 'centro-custos') return;
    const pedidos = params.get('pedidos') === '1';
    const url = pedidos
      ? (inApp() ? 'suite://app/centro-custos?pedidos=1' : 'https://centro-custos-api.construtec-reports.workers.dev/m/#pedidos=1')
      : OC.suite.centroLink(params.get('obra'));
    if (inApp()) location.href = url; else window.open(url, '_blank', 'noopener');
  }

  const row = (n) => `<button class="aviso${n.read ? '' : ' novo'}" type="button" data-id="${esc(n.id)}" data-link="${esc(n.link || '')}">
      <span class="aviso-dot" aria-hidden="true"></span>
      <span class="aviso-text"><b>${esc(n.title)}</b><span>${esc(n.body)}</span><small>${esc(hour(n.createdAt))}</small></span></button>`;

  OC.screens.avisos = async function (params) {
    const filter = params.app || '';
    const [list, prefs] = await Promise.all([OC.api('/notifications'), OC.api('/notifications/prefs').catch(() => ({ prefs: {} }))]);
    OC.notif.unread = Number(list.unread) || 0;
    const items = (list.items || []).filter((n) => !filter || n.app === filter);
    const groups = ['Hoje', 'Ontem', 'Anteriores'].map((g) => [g, items.filter((n) => group(n.createdAt) === g)]).filter(([, l]) => l.length);
    const el = OC.render(`${OC.header('Notificações', { back: true })}
      <div class="chips" role="group" aria-label="Filtrar por app">${APPS.map(([k, l]) => `<button type="button" class="chip-act" data-app="${k}" aria-pressed="${k === filter}">${l}</button>`).join('')}</div>
      ${OC.notif.unread ? `<button class="btn2 lidas" type="button" id="lidas">${icon('check', 18)}Marcar todas como lidas</button>` : ''}
      ${groups.length ? groups.map(([g, l]) => `<p class="sheet-sec">${g}</p><div class="avisos">${l.map(row).join('')}</div>`).join('')
        : `<div class="empty">${icon('bell', 28)}Nenhuma notificação${filter ? ' neste filtro' : ''} por enquanto.</div>`}
      <p class="sheet-sec">Receber no celular</p>
      <div class="card menu-card">${PREFS.map(([k, l]) => `<label class="menu-item pref"><span>${l}</span><input type="checkbox" data-pref="${k}"${prefs.prefs && prefs.prefs[k] === false ? '' : ' checked'}></label>`).join('')}</div>
      <button class="btn2" type="button" id="teste">${icon('bell', 18)}Enviar notificação de teste</button>`, true, params);
    paintBell();
    OC.$$('[data-app]', el).forEach((b) => b.addEventListener('click', () => OC.go('avisos', { app: b.dataset.app }, { back: true })));
    const lidas = OC.$('#lidas', el);
    if (lidas) lidas.addEventListener('click', async () => { await OC.api('/notifications/read', { method: 'POST', body: { all: true } }).catch(() => {}); OC.go('avisos', { app: filter }, { back: true }); });
    OC.$$('.aviso', el).forEach((b) => b.addEventListener('click', async () => {
      if (b.classList.contains('novo')) await OC.api('/notifications/read', { method: 'POST', body: { ids: [b.dataset.id] } }).catch(() => {});
      OC.notif.refresh();
      follow(b.dataset.link);
    }));
    OC.$$('[data-pref]', el).forEach((input) => input.addEventListener('change', async () => {
      try { await OC.api('/notifications/prefs', { method: 'PUT', body: { type: input.dataset.pref, enabled: input.checked } }); }
      catch (error) { input.checked = !input.checked; OC.toast(error.message, 'warning-circle'); }
    }));
    OC.$('#teste', el).addEventListener('click', async () => {
      try {
        const data = await OC.api('/notifications/test', { method: 'POST', body: {} });
        OC.toast(data.devices ? `Enviada para ${data.devices === 1 ? '1 aparelho' : `${data.devices} aparelhos`}.` : 'Nenhum celular com o app registrado nesta conta.');
      } catch (error) { OC.toast(error.message, 'warning-circle'); }
      OC.notif.refresh();
    });
  };
})(window.OC = window.OC || {});
