// Kits e Menu do Orcamentos no celular (prototipo: sOrcKits, sKit e sOrcMenu).
(function (OC) {
  const { esc, icon } = OC;
  const VERSION = '1';

  OC.screens.kits = async function (params) {
    const list = ((await OC.api('/kits')).kits || []).filter((k) => k.active !== false);
    let query = '';
    const el = OC.render(`${OC.header('')}
      <h1 class="title">Kits</h1>
      <p class="sub" style="margin:0">Conjuntos de itens prontos para usar nas propostas.</p>
      <label class="search">${icon('magnifying-glass', 18)}<input id="k-q" type="search" placeholder="Buscar kit" autocomplete="off"></label>
      <div class="rows" id="k-rows"></div>`, false, params);
    const paint = () => {
      const q = query.trim().toLowerCase();
      const rows = list.filter((k) => !q || `${k.name} ${k.category}`.toLowerCase().includes(q));
      OC.$('#k-rows', el).innerHTML = rows.length ? rows.map((k) => `<button class="prow" type="button" data-id="${esc(k.id)}">
          <span class="grow"><b>${esc(k.name)}</b><small>${esc(k.category)} · ${k.itemCount} ${k.itemCount === 1 ? 'item' : 'itens'}</small></span>
          <span class="end"><b>${esc(OC.money0(k.totalEstimatedCost))}</b><small>custo</small></span>${icon('caret-right', 18)}</button>`).join('')
        : `<div class="empty">${icon('stack', 28)}${list.length ? 'Nenhum kit com esse nome.' : 'Nenhum kit cadastrado.'}</div>`;
      OC.$$('[data-id]', el).forEach((b) => b.addEventListener('click', () => OC.open('kit', { id: b.dataset.id })));
    };
    OC.$('#k-q', el).addEventListener('input', (event) => { query = event.target.value; paint(); });
    paint();
  };

  OC.screens.kit = async function (params) {
    const kit = (await OC.api(`/kits/${encodeURIComponent(params.id)}`)).kit;
    OC.render(`${OC.header(kit.name, { back: true })}
      <div class="card"><div class="kv"><span>Categoria</span><b>${esc(kit.category)}</b></div>
        <div class="kv"><span>Itens</span><b>${kit.itemCount}</b></div>
        <div class="kv"><span>Custo estimado</span><b>${esc(OC.money(kit.totalEstimatedCost))}</b></div>
        ${kit.description ? `<p class="sheet-text" style="margin:8px 0 0">${esc(kit.description)}</p>` : ''}</div>
      <span class="group">Itens do kit</span>
      <div class="rows">${(kit.items || []).map((it) => `<div class="prow static"><span class="grow"><b>${esc(it.description)}</b><small>${esc(it.code)} · ${esc(OC.num(it.quantity))} ${esc(it.unit)}</small></span>
        <span class="end"><b>${esc(OC.money(it.totalCost))}</b><small>${esc(OC.money(it.currentCost))}/${esc(it.unit)}</small></span></div>`).join('')}</div>
      <p class="hint">Para aplicar o kit numa proposta, use a versão completa por enquanto.</p>`, true, params);
  };

  // "Versao completa": o site de computador, ate fechar a aba (a raiz nao manda de volta ao /m/).
  OC.fullVersion = function () {
    try { sessionStorage.setItem('orc_versao', 'completa'); } catch { /* nada */ }
    location.href = `/${location.hash.startsWith('#prop=') ? `#proposta=${location.hash.slice(6)}` : ''}`;
  };

  OC.screens.menu = function (params) {
    const u = OC.session.user() || {};
    const dark = OC.theme.get() === 'escuro';
    const roles = { admin: 'Administrador', commercial: 'Comercial', viewer: 'Consulta' };
    const initials = String(u.name || '?').split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
    const el = OC.render(`${OC.header('')}
      <h1 class="title">Menu</h1>
      <div class="card who"><span class="avatar" style="--a:44px">${esc(initials)}</span><span class="grow"><b>${esc(u.name || '')}</b><small>${esc(u.email || '')} · ${esc(roles[u.role] || '')}</small></span></div>
      <div class="menu">
        <button class="menu-item" type="button" id="m-tema">${icon(dark ? 'sun' : 'moon', 22)}<span>${dark ? 'Modo claro' : 'Modo escuro'}</span></button>
        <button class="menu-item" type="button" id="m-full">${icon('desktop', 22)}<span>Versão completa<small>Catálogo, clientes, PDF e comparativos</small></span></button>
        <button class="menu-item danger" type="button" id="m-sair">${icon('sign-out', 22)}<span>Sair</span></button>
      </div>
      <p class="hint" style="text-align:center">Construtec Orçamentos · celular ${VERSION}</p>`, false, params);
    OC.$('#m-tema', el).addEventListener('click', () => { OC.theme.toggle(); OC.go('menu'); });
    OC.$('#m-full', el).addEventListener('click', OC.fullVersion);
    OC.$('#m-sair', el).addEventListener('click', () => OC.logout());
  };
})(window.OC = window.OC || {});
