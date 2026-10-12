// Catalogo no celular: busca, visao geral e filtros do computador (CatalogHome.tsx, GET /catalog/overview: preco mudou,
// itens novos, uso nas propostas) e entradas de cadastro (cat-edit.js), lista colada (cat-manual.js), planilha
// (screen-imp.js) e EXSAT (screen-exsat.js). Custo so com p10; o servidor zera sem ela.
(function (OC) {
  const fmtN = (n) => Number(n || 0).toLocaleString('pt-BR');
  const pctS = (v) => `${v > 0 ? '+' : (v < 0 ? '−' : '')}${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

  function importSheet() {
    const { icon } = OC;
    const s = OC.sheet(`${OC.sheetHead('Importar itens', 'download-simple')}<div class="opts" style="margin-top:12px">
      <button class="opt" type="button" data-a="colar">${icon('copy', 20)}<span><b>Colar lista</b><small>Linhas copiadas de uma planilha ou de um e-mail</small></span>${icon('caret-right', 18)}</button>
      <button class="opt" type="button" data-a="imp">${icon('file-text', 20)}<span><b>Planilha</b><small>Arquivo XLSX, CSV ou TXT do celular</small></span>${icon('caret-right', 18)}</button>
      <button class="opt" type="button" data-a="exsat">${icon('arrow-square-out', 20)}<span><b>EXSAT</b><small>Varredura com a conta de revendedor</small></span>${icon('caret-right', 18)}</button></div>
      <p class="sheet-text">Foto e PDF de orçamento ficam na versão completa.</p>`);
    OC.$('[data-a="colar"]', s.el).addEventListener('click', () => { s.close(); OC.catalogPasteSheet(); });
    OC.$('[data-a="imp"]', s.el).addEventListener('click', () => { s.close(); OC.open('imp'); });
    OC.$('[data-a="exsat"]', s.el).addEventListener('click', () => { s.close(); OC.open('exsat'); });
  }

  OC.screens.cat = async function (params) {
    const { esc, icon } = OC;
    const editor = OC.canEditCatalog();
    const cost = OC.can('p10');
    let overview = null, filter = 'todos', query = '', list = [], timer = 0, seq = 0;
    const el = OC.render(`${OC.header('Catálogo', { back: true })}
      <p class="sub" style="margin:-6px 0 0" id="c-sub">Carregando itens</p>
      <button class="card ex-link" type="button" id="c-ex">${icon('arrow-square-out', 20)}<span class="grow"><b>Integração EXSAT</b><small id="c-ex-s">Conferindo preços das propostas…</small></span>${icon('caret-right', 18)}</button>
      ${cost ? '' : `<p class="hint lock">${icon('lock-simple', 16)}Seu perfil não vê preços de custo. O resto do catálogo funciona igual.</p>`}
      <label class="search">${icon('magnifying-glass', 18)}<input id="c-q" type="search" placeholder="Buscar por nome ou código" autocomplete="off"></label>
      <div class="chips" id="c-fil"></div>
      <div class="rows" id="c-rows"></div>
      <small class="hint" id="c-foot"></small>
      ${editor ? `<div class="actions"><button class="btn2" type="button" id="c-new">${icon('plus', 18)}Novo item</button><button class="btn" type="button" id="c-imp">${icon('download-simple', 18)}Importar</button></div>` : ''}`, true, params);
    const rows = OC.$('#c-rows', el);
    const info = () => new Map(((overview && overview.items) || []).map((x) => [x.code, x]));

    const extra = (x, map) => {
      const o = map.get(x.code);
      if (!o) return '';
      const bits = [];
      if (o.changePercent !== undefined) bits.push(`<span class="delta ${o.changePercent > 0 ? 'up' : 'down'}">${icon(o.changePercent > 0 ? 'caret-up' : 'caret-down', 12)}${esc(pctS(o.changePercent))}</span>${cost && o.fromUnit !== undefined ? `<small>antes ${esc(OC.money(o.fromUnit))}</small>` : ''}`);
      if (o.isNew) bits.push('<span class="tag">Novo</span>');
      if (o.usedIn && o.usedIn.length) bits.push(`<small>Usado em ${esc(o.usedIn.slice(0, 3).join(', '))}${o.usedIn.length > 3 ? ` +${o.usedIn.length - 3}` : ''}</small>`);
      return bits.length ? `<span class="cat-x">${bits.join('')}</span>` : '';
    };
    const paint = () => {
      const map = info(), q = query.trim().toLowerCase();
      const changed = overview ? overview.changedItems.length : 0, novos = overview ? overview.newCount : 0;
      OC.$('#c-fil', el).innerHTML = [['todos', `Todos · ${fmtN(overview ? overview.productCount : list.length)}`], ['mudou', `Preço mudou · ${fmtN(changed)}`], ['novo', `Itens novos · ${fmtN(novos)}`]]
        .map(([k, l]) => `<button class="chip-act" type="button" data-f="${k}" aria-pressed="${filter === k}">${l}</button>`).join('');
      OC.$$('[data-f]', el).forEach((b) => b.addEventListener('click', () => { filter = b.dataset.f; if (filter === 'todos') load(); else paint(); }));
      const shown = filter === 'todos' ? list : ((overview && (filter === 'mudou' ? overview.changedItems : overview.newItems)) || [])
        .filter((x) => !q || `${x.code} ${x.description} ${x.category}`.toLowerCase().includes(q));
      rows.innerHTML = shown.length ? shown.map((x) => `<${editor ? `button type="button" class="prow" data-code="${esc(x.code)}"` : 'div class="prow static"'}><span class="grow"><b>${esc(x.description)}</b><small>${esc(x.code)} · ${esc(x.unit)} · ${esc(x.category)}${x.active === false ? ' · inativo' : ''}</small>${extra(x, map)}</span>
          <span class="end"><b>${esc(OC.costText(OC.money(x.currentCost || 0)))}</b><small>custo</small></span></${editor ? 'button' : 'div'}>`).join('')
        : `<div class="empty">${icon('package', 28)}${filter === 'todos' ? 'Nada encontrado.' : (filter === 'mudou' ? 'Nenhum preço mudou em relação às propostas em edição.' : 'Nenhum item novo nos últimos 7 dias.')}</div>`;
      OC.$('#c-foot', el).textContent = `${fmtN(shown.length)} ${shown.length === 1 ? 'item' : 'itens'}${filter === 'todos' ? ' · a busca procura no catálogo inteiro' : ''}`;
      OC.$$('[data-code]', rows).forEach((b) => b.addEventListener('click', () => openItem(b.dataset.code, shown)));
    };
    // Itens dos filtros vem da visao geral (sem id): busca o cadastro completo pelo codigo antes de editar.
    async function openItem(code, shown) {
      let item = shown.find((x) => x.code === code && x.id);
      if (!item) {
        try { item = ((await OC.api(`/catalog/manage?q=${encodeURIComponent(code)}`)).products || []).find((x) => x.code === code); } catch (error) { OC.toast(error.message, 'warning-circle'); return; }
      }
      if (item) OC.catalogSheet(item, () => { loadOverview(); load(); });
    }
    // Quem edita ve tambem os inativos (cadastro completo, como no computador); os outros, a busca das propostas.
    async function load() {
      const mine = ++seq;
      try {
        list = (await OC.api(editor ? `/catalog/manage?q=${encodeURIComponent(query.trim())}` : `/catalog?q=${encodeURIComponent(query.trim())}&limit=50`)).products || [];
        if (mine === seq && el.isConnected) paint();
      } catch (error) { if (mine === seq) rows.innerHTML = `<div class="empty">${esc(error.message)}</div>`; }
    }
    async function loadOverview() {
      try {
        overview = (await OC.api('/catalog/overview')).overview || null;
        const sub = OC.$('#c-sub', el);
        if (sub && overview) sub.textContent = `${fmtN(overview.productCount)} itens${cost ? ' · preços de custo, sem BDI' : ''}`;
        if (el.isConnected) paint();
      } catch { const sub = OC.$('#c-sub', el); if (sub) sub.textContent = 'Catálogo'; }
    }
    OC.$('#c-q', el).addEventListener('input', (event) => { query = event.target.value; clearTimeout(timer); timer = setTimeout(() => (filter === 'todos' ? load() : paint()), 300); });
    OC.$('#c-ex', el).addEventListener('click', () => OC.open('exsat'));
    const novo = OC.$('#c-new', el);
    if (novo) novo.addEventListener('click', () => OC.catalogSheet(null, () => { loadOverview(); load(); }));
    const imp = OC.$('#c-imp', el);
    if (imp) imp.addEventListener('click', importSheet);
    load();
    loadOverview();
    // Cartao da EXSAT: quantas propostas em edicao tem preco novo (falha de rede nao atrapalha o catalogo).
    OC.api('/proposals/price-drift').then((d) => {
      const n = (d.proposals || []).length, t = OC.$('#c-ex-s', el);
      if (t) t.textContent = n ? `${n} ${n === 1 ? 'proposta com preço novo' : 'propostas com preço novo'}` : 'Conta, varredura e preços novos';
    }).catch(() => { const t = OC.$('#c-ex-s', el); if (t) t.textContent = 'Conta, varredura e preços novos'; });
  };
})(window.OC = window.OC || {});
