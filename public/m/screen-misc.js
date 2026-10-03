// Kits, Menu, Configuracoes, Catalogo e Clientes no celular (prototipo: sOrcKits, sKit, sOrcMenu, cfg, cat, cli).
(function (OC) {
  const { esc, icon } = OC;
  const VERSION = '3';
  const inApp = () => /SuiteConstrutec\//.test(navigator.userAgent);
  const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).map((s) => s[0]).slice(0, 2).join('').toUpperCase();

  OC.screens.kits = async function (params) {
    const list = ((await OC.api('/kits')).kits || []).filter((k) => k.active !== false);
    let query = '';
    const el = OC.render(`${OC.header('')}
      <div class="title-row"><h1 class="title">Kits</h1>${OC.canEdit() && OC.can('p10') ? `<button class="chip-act" type="button" id="k-new">${icon('plus', 16)}Novo kit</button>` : ''}</div>
      <p class="sub" style="margin:-6px 0 0">Conjuntos de itens que entram de uma vez na proposta.</p>
      ${list.length > 6 ? `<label class="search">${icon('magnifying-glass', 18)}<input id="k-q" type="search" placeholder="Buscar kit" autocomplete="off"></label>` : ''}
      <div class="kit-list" id="k-rows"></div>`, false, params);
    const paint = () => {
      const q = query.trim().toLowerCase();
      const rows = list.filter((k) => !q || `${k.name} ${k.category}`.toLowerCase().includes(q));
      OC.$('#k-rows', el).innerHTML = rows.length ? rows.map((k) => `<button class="card kit-row" type="button" data-id="${esc(k.id)}">${icon('stack', 20)}
          <span class="grow"><b>${esc(k.name)}</b><small>${k.itemCount} ${k.itemCount === 1 ? 'item' : 'itens'}${k.description ? ` · ${esc(k.description)}` : ''}</small></span>
          <b>${esc(OC.costText(OC.money0(k.totalEstimatedCost)))}</b>${icon('caret-right', 18)}</button>`).join('')
        : `<div class="empty">${icon('stack', 28)}${list.length ? 'Nenhum kit com esse nome.' : 'Nenhum kit cadastrado.'}</div>`;
      OC.$$('[data-id]', el).forEach((b) => b.addEventListener('click', () => OC.open('kit', { id: b.dataset.id })));
    };
    const q = OC.$('#k-q', el);
    if (q) q.addEventListener('input', (event) => { query = event.target.value; paint(); });
    const nk = OC.$('#k-new', el);
    if (nk) nk.addEventListener('click', () => OC.ask('Novo kit', 'Nome do kit', 'Ex.: Kit câmera IP externa', async (name) => {
      const kit = (await OC.api('/kits', { method: 'POST', body: { name, category: 'Geral', items: [] } })).kit;
      OC.open('kit', { id: kit.id });
    }));
    paint();
  };

  // Editar kit: salva sozinho (PUT com o kit inteiro) um pouco depois de cada mudanca.
  OC.screens.kit = async function (params) {
    let kit = (await OC.api(`/kits/${encodeURIComponent(params.id)}`)).kit;
    // Kits carregam o custo: sem p10 o servidor nao deixa gravar, entao o kit abre so para consulta.
    const can = OC.canEdit() && OC.can('p10');
    const el = OC.render(`${OC.header(can ? 'Editar kit' : kit.name, { back: true })}
      <p class="sub" style="margin:-6px 0 0">Custo sem BDI · o BDI entra quando o kit vai para a proposta</p>
      <label class="field"><span>Nome do kit</span><input id="k-name" type="text" value="${esc(kit.name)}"${can ? '' : ' readonly'}></label>
      <label class="field"><span>Referência · opcional</span><input id="k-ref" type="text" value="${esc(kit.description || '')}" placeholder="Ex.: por ponto"${can ? '' : ' readonly'}></label>
      <div class="sec-row"><span class="label" id="k-count"></span><span class="label" id="k-sum"></span></div>
      <div class="items" id="k-items"></div>
      ${can ? `<button class="btn2" type="button" id="k-add">${icon('plus', 18)}Adicionar item</button>` : ''}
      <div class="actions total-bar"><div class="tb-mid"><span><small>Total do kit · custo</small><b class="big" id="k-total"></b></span><small id="k-n"></small></div>
        <button class="btn" type="button" id="k-use">${icon('file-text', 18)}Usar em proposta</button></div>`, true, params);
    let timer = 0;
    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const name = OC.$('#k-name', el).value.trim();
        if (name.length < 2) return;
        try {
          kit = (await OC.api(`/kits/${kit.id}`, { method: 'PUT', body: { name, description: OC.$('#k-ref', el).value.trim() || null, category: kit.category || 'Geral', active: kit.active !== false, items: kit.items.map((it) => ({ productId: it.productId, quantity: it.quantity })) } })).kit;
          paintTotals();
        } catch (error) { OC.toast(error.message, 'warning-circle'); }
      }, 600);
    };
    const total = () => kit.items.reduce((n, it) => n + it.quantity * it.currentCost, 0);
    function paintTotals() {
      OC.$('#k-count', el).textContent = `Itens · ${kit.items.length}`;
      OC.$('#k-sum', el).textContent = OC.costText(OC.money0(total()));
      OC.$('#k-total', el).textContent = OC.costText(OC.money0(total()));
      OC.$('#k-n', el).textContent = `Itens · ${kit.items.length}`;
      kit.items.forEach((it) => { const v = OC.$(`[data-item="${it.productId}"] .val`, el); if (v) v.textContent = OC.costText(OC.money0(it.quantity * it.currentCost)); });
    }
    function paint() {
      OC.$('#k-items', el).innerHTML = kit.items.length ? kit.items.map((it) => `<div class="item" data-item="${esc(it.productId)}">
          <div class="item-top"><b>${esc(it.description)}</b><b class="val"></b></div>
          <small>${esc(it.code)} · ${esc(OC.costText(OC.money(it.currentCost)))}/${esc(it.unit)}</small>
          ${can ? `<div class="qty qty-del"><button class="qbtn" type="button" data-dec aria-label="Diminuir">${icon('minus', 18)}</button>
            <label class="qval"><input type="text" inputmode="decimal" value="${esc(OC.num(it.quantity))}" aria-label="Quantidade"><span>${esc(it.unit)}</span></label>
            <button class="qbtn" type="button" data-inc aria-label="Aumentar">${icon('plus', 18)}</button>
            <button class="qbtn" type="button" data-del aria-label="Tirar do kit">${icon('trash', 18)}</button></div>` : `<small class="qty-ro">${esc(OC.num(it.quantity))} ${esc(it.unit)}</small>`}</div>`).join('')
        : `<div class="empty">${icon('package', 28)}Kit sem itens.</div>`;
      OC.$$('[data-item]', el).forEach((row) => {
        const it = kit.items.find((x) => x.productId === row.dataset.item);
        const input = OC.$('input', row);
        if (!input) return;
        const set = (n) => { it.quantity = Math.max(1, Math.round(n * 100) / 100); input.value = OC.num(it.quantity); paintTotals(); save(); };
        OC.$('[data-dec]', row).addEventListener('click', () => set(it.quantity - 1));
        OC.$('[data-inc]', row).addEventListener('click', () => set(it.quantity + 1));
        input.addEventListener('change', () => { const n = Number(String(input.value).replace(/\./g, '').replace(',', '.')); if (n > 0) set(n); else input.value = OC.num(it.quantity); });
        OC.$('[data-del]', row).addEventListener('click', () => { kit.items = kit.items.filter((x) => x !== it); paint(); save(); });
      });
      paintTotals();
    }
    if (can) {
      OC.$('#k-name', el).addEventListener('input', save);
      OC.$('#k-ref', el).addEventListener('input', save);
      OC.$('#k-add', el).addEventListener('click', () => OC.pickProduct('Adicionar ao kit', (x) => {
        const have = kit.items.find((it) => it.productId === x.id);
        if (have) have.quantity += 1;
        else kit.items.push({ productId: x.id, code: x.code, description: x.description, unit: x.unit, currentCost: x.currentCost, quantity: 1 });
        paint();
        save();
        OC.toast('Item adicionado ao kit');
      }));
    }
    OC.$('#k-use', el).addEventListener('click', () => useKit(kit));
    paint();
  };

  // Usar o kit: numa proposta em edicao ou numa proposta nova.
  async function useKit(kit) {
    if (!kit.items.length) { OC.toast('O kit está sem itens.', 'warning-circle'); return; }
    const drafts = (await OC.loadProposals()).filter((p) => p.status === 'draft' && p.isLatest !== false);
    const s = OC.sheet(`${OC.sheetHead('Usar em proposta', 'file-text')}
      <p class="sheet-text">Os ${kit.items.length} itens entram com o BDI da proposta.</p>
      ${OC.canEdit() ? `<button class="suite-item ctx" type="button" data-new style="width:100%;border:0;text-align:left">${icon('plus', 20)}<span><b>Nova proposta com este kit</b></span>${icon('caret-right', 18)}</button>` : ''}
      <p class="sheet-sec">Propostas em edição</p>
      <div class="rows">${drafts.map((p) => `<button class="prow" type="button" data-p="${esc(p.id)}"><span class="grow"><b>${esc(p.workName || p.clientName)}</b><small>${esc(p.number)} · ${esc(OC.rev(p.revision))}</small></span>${icon('caret-right', 18)}</button>`).join('') || '<div class="empty">Nenhuma proposta em edição.</div>'}</div>`);
    const n = OC.$('[data-new]', s.el);
    if (n) n.addEventListener('click', () => { s.close(); OC.open('nova', { kit: kit.id }); });
    OC.$$('[data-p]', s.el).forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        await OC.api(`/kits/${kit.id}/apply-to-proposal`, { method: 'POST', body: { proposalId: b.dataset.p } });
        s.close();
        OC.toast('Kit aplicado na proposta');
        OC.open('prop', { id: b.dataset.p, tab: 'itens' });
      } catch (error) { OC.toast(error.message, 'warning-circle'); b.disabled = false; }
    }));
  }

  // Busca no catalogo em folha inferior; onPick recebe o produto (usado pela proposta e pelo kit).
  OC.pickProduct = function (title, onPick) {
    const s = OC.sheet(`${OC.sheetHead(title, 'plus')}
      <label class="search">${icon('magnifying-glass', 18)}<input data-q type="search" placeholder="Código ou descrição" autocomplete="off"></label>
      <div class="rows" data-rows><div class="empty">Digite para buscar no catálogo.</div></div>`);
    const rows = OC.$('[data-rows]', s.el);
    let timer = 0, seq = 0;
    OC.$('[data-q]', s.el).addEventListener('input', (event) => {
      clearTimeout(timer);
      const q = event.target.value.trim();
      timer = setTimeout(async () => {
        const mine = ++seq;
        if (q.length < 2) { rows.innerHTML = '<div class="empty">Digite para buscar no catálogo.</div>'; return; }
        try {
          const list = ((await OC.api(`/catalog?q=${encodeURIComponent(q)}&limit=30`)).products || []).filter((x) => x.active !== false);
          if (mine !== seq) return;
          rows.innerHTML = list.length ? list.map((x) => `<button class="prow" type="button" data-pid="${esc(x.id)}"><span class="grow"><b>${esc(x.description)}</b><small>${esc(x.code)} · ${esc(x.category)}</small></span><span class="end"><b>${esc(OC.costText(OC.money(x.currentCost)))}</b><small>custo/${esc(x.unit)}</small></span>${icon('plus', 18)}</button>`).join('')
            : '<div class="empty">Nada encontrado.</div>';
          OC.$$('[data-pid]', rows).forEach((b) => b.addEventListener('click', async () => {
            b.disabled = true;
            try { await onPick(list.find((x) => x.id === b.dataset.pid)); s.close(); } catch (error) { OC.toast(error.message, 'warning-circle'); b.disabled = false; }
          }));
        } catch (error) { if (mine === seq) rows.innerHTML = `<div class="empty">${esc(error.message)}</div>`; }
      }, 300);
    });
    setTimeout(() => OC.$('[data-q]', s.el).focus(), 50);
  };

  // "Versao completa": o site de computador, ate fechar a aba (a raiz nao manda de volta ao /m/).
  OC.fullVersion = function () {
    try { sessionStorage.setItem('orc_versao', 'completa'); } catch { /* nada */ }
    location.href = `/${location.hash.startsWith('#prop=') ? `#proposta=${location.hash.slice(6)}` : ''}`;
  };

  OC.screens.menu = async function (params) {
    const [settings, summary, discarded] = await Promise.all([
      OC.api('/settings').then((d) => d.settings || {}).catch(() => ({})),
      OC.api('/dashboard').then((d) => d.summary || {}).catch(() => ({})),
      OC.discardedCount ? OC.discardedCount() : 0,
    ]);
    const u = OC.session.user() || {};
    const dark = OC.theme.get() === 'escuro';
    const roles = { admin: 'Administrador', commercial: 'Comercial', viewer: 'Consulta' };
    const proposals = (summary.recentProposals || []).length;
    const item = (id, ic, t, s, href) => `${href ? `<a class="menu-item" href="${href}" id="${id}" style="color:inherit;text-decoration:none">` : `<button class="menu-item" type="button" id="${id}">`}${icon(ic, 22)}<span class="grow">${t}${s ? `<small>${s}</small>` : ''}</span>${icon('caret-right', 18)}${href ? '</a>' : '</button>'}`;
    const el = OC.render(`${OC.header('')}
      <h1 class="title">Menu</h1>
      <div class="card who"><span class="avatar" style="--a:44px">${esc(initials(u.name))}</span><span class="grow"><b>${esc(u.name || '')}</b><small>${esc(roles[u.role] || '')} · ${esc(u.email || '')}</small></span></div>
      <div class="card menu-card">
        ${item('m-cfg', 'gear-six', 'Configurações da empresa', `BDI padrão ${OC.can('p10') ? esc(OC.dec2(settings.defaultBdi || 0)) : '—'} · validade ${settings.defaultValidityDays || 30} dias`)}
        ${item('m-cat', 'package', 'Catálogo', `${summary.totalProductsCount || 0} itens`)}
        ${item('m-cli', 'users', 'Clientes e obras', `${summary.totalClientsCount || 0} clientes${proposals ? ` · ${summary.activeProposalsCount || 0} propostas abertas` : ''}`)}
        ${OC.isAdmin && OC.isAdmin() ? `<button class="menu-item" type="button" id="m-desc">${icon('archive', 22)}<span class="grow">Propostas descartadas<small>Guardadas e recuperáveis · só administrador</small></span>${discarded ? `<span class="menu-count">${discarded}</span>` : ''}${icon('caret-right', 18)}</button>` : ''}
        ${inApp() ? item('m-seg', 'shield-check', 'Segurança', 'PIN, digital e bloqueio automático', 'suite://seguranca') : ''}
        ${inApp() ? item('m-tour', 'info', 'Rever o tour', 'Telas rápidas sobre os apps', 'suite://tour') : ''}
        <button class="menu-item" type="button" id="m-tema">${icon(dark ? 'sun' : 'moon', 22)}<span class="grow">${dark ? 'Modo claro' : 'Modo escuro'}</span></button>
        ${item('m-full', 'desktop', 'Versão completa', 'PDF, comparativos e cadastros completos')}
      </div>
      <button class="btn2 danger-btn" type="button" id="m-sair">${icon('sign-out', 20)}Sair</button>
      <p class="hint" style="text-align:center">Construtec Orçamentos · celular ${VERSION}</p>`, false, params);
    OC.$('#m-cfg', el).addEventListener('click', () => OC.open('cfg'));
    OC.$('#m-cat', el).addEventListener('click', () => OC.open('cat'));
    OC.$('#m-cli', el).addEventListener('click', () => OC.open('cli'));
    if (OC.$('#m-desc', el)) OC.$('#m-desc', el).addEventListener('click', () => OC.open('desc'));
    OC.$('#m-tema', el).addEventListener('click', () => { OC.theme.toggle(); OC.go('menu'); });
    OC.$('#m-full', el).addEventListener('click', OC.fullVersion);
    OC.$('#m-sair', el).addEventListener('click', () => OC.logout());
  };

  // Configuracoes da empresa: padroes das proximas propostas (so administrador altera).
  OC.screens.cfg = async function (params) {
    const s = (await OC.api('/settings')).settings || {};
    const admin = (OC.session.user() || {}).role === 'admin';
    const seesBdi = OC.can('p10');
    const v = { defaultBdi: Number(s.defaultBdi) || 1, defaultStandardHours: Number(s.defaultStandardHours) || 220, defaultValidityDays: Number(s.defaultValidityDays) || 30 };
    const el = OC.render(`${OC.header('Configurações da empresa', { back: true })}
      <p class="sub" style="margin:-6px 0 0">Padrões para as próximas propostas</p>
      <div class="card cfg"><span class="label">Proposta</span>
        ${seesBdi ? `<div class="cfg-row"><b>BDI padrão</b><small>Multiplicador sobre o custo base</small>
          <div class="qty"><button class="qbtn" type="button" data-step="defaultBdi:-0.05"${admin ? '' : ' disabled'} aria-label="Diminuir BDI">${icon('minus', 18)}</button><span class="qval" data-v="defaultBdi"></span><button class="qbtn" type="button" data-step="defaultBdi:0.05"${admin ? '' : ' disabled'} aria-label="Aumentar BDI">${icon('plus', 18)}</button></div></div>` : ''}
        <div class="cfg-row"><b>Horas por mês</b><small>Base do custo/hora da mão de obra</small>
          <div class="qty"><button class="qbtn" type="button" data-step="defaultStandardHours:-4"${admin ? '' : ' disabled'} aria-label="Diminuir horas">${icon('minus', 18)}</button><span class="qval" data-v="defaultStandardHours"></span><button class="qbtn" type="button" data-step="defaultStandardHours:4"${admin ? '' : ' disabled'} aria-label="Aumentar horas">${icon('plus', 18)}</button></div></div>
      </div>
      <div class="field"><span>Validade padrão</span><div class="chips wrap" id="c-days"></div></div>
      <div class="card"><div class="kv"><span>Empresa</span><b>${esc(s.tradeName || s.companyName || '')}</b></div><div class="kv"><span>Responsável padrão</span><b>${esc(s.defaultResponsible || '')}</b></div></div>
      <p class="hint">${admin ? 'Propostas já criadas mantêm seus valores.' : 'Só administradores alteram os padrões.'}</p>
      ${admin ? `<div class="actions"><button class="btn" type="button" id="c-save">${icon('check', 18)}Salvar padrões</button></div>` : ''}`, true, params);
    const paint = () => {
      if (seesBdi) OC.$('[data-v="defaultBdi"]', el).textContent = `${OC.dec2(v.defaultBdi)} ×`;
      OC.$('[data-v="defaultStandardHours"]', el).textContent = `${OC.num(v.defaultStandardHours)} h`;
      OC.$('#c-days', el).innerHTML = [15, 30, 45, 60].map((d) => `<button class="chip-act" type="button" data-d="${d}" aria-pressed="${v.defaultValidityDays === d}"${admin ? '' : ' disabled'}>${d} dias</button>`).join('');
      OC.$$('[data-d]', el).forEach((b) => b.addEventListener('click', () => { v.defaultValidityDays = Number(b.dataset.d); paint(); }));
    };
    OC.$$('[data-step]', el).forEach((b) => b.addEventListener('click', () => {
      const [k, d] = b.dataset.step.split(':');
      const lim = k === 'defaultBdi' ? [1, 10] : [1, 720];
      v[k] = Math.min(lim[1], Math.max(lim[0], Math.round((v[k] + Number(d)) * 100) / 100));
      paint();
    }));
    const save = OC.$('#c-save', el);
    if (save) save.addEventListener('click', async () => {
      save.disabled = true;
      try { const { defaultBdi, ...rest } = v; await OC.api('/settings', { method: 'PATCH', body: seesBdi ? v : rest }); OC.toast('Padrões salvos'); } catch (error) { OC.toast(error.message, 'warning-circle'); }
      save.disabled = false;
    });
    paint();
  };

  // Catalogo: consulta, importar planilha e integracao EXSAT (Rodada 22). Foto e PDF ficam na versao completa.
  OC.screens.cat = async function (params) {
    const summary = await OC.api('/dashboard').then((d) => d.summary || {}).catch(() => ({}));
    const el = OC.render(`${OC.header('Catálogo', { back: true })}
      <p class="sub" style="margin:-6px 0 0">${summary.totalProductsCount || 0} itens</p>
      <button class="card ex-link" type="button" id="c-ex">${icon('arrow-square-out', 20)}<span class="grow"><b>Integração EXSAT</b><small id="c-ex-s">Conferindo preços das propostas…</small></span>${icon('caret-right', 18)}</button>
      <label class="search">${icon('magnifying-glass', 18)}<input id="c-q" type="search" placeholder="Buscar por nome ou código" autocomplete="off"></label>
      <div class="rows" id="c-rows"></div>
      <div class="actions">${OC.canEdit() && OC.can('p10') ? `<button class="btn2" type="button" id="c-imp">${icon('plus', 18)}Importar</button>` : ''}<button class="btn" type="button" id="c-sync">${icon('arrow-square-out', 18)}EXSAT</button></div>`, true, params);
    const rows = OC.$('#c-rows', el);
    let timer = 0, seq = 0;
    const load = async (q) => {
      const mine = ++seq;
      try {
        const list = (await OC.api(`/catalog?q=${encodeURIComponent(q)}&limit=50`)).products || [];
        if (mine !== seq) return;
        rows.innerHTML = list.length ? list.map((x) => `<div class="prow static"><span class="grow"><b>${esc(x.description)}</b><small>${esc(x.code)} · ${esc(x.unit)} · ${esc(x.category)}${x.active === false ? ' · inativo' : ''}</small></span>
          <span class="end"><b>${esc(OC.costText(OC.money(x.currentCost)))}</b><small>custo</small></span></div>`).join('') : '<div class="empty">Nada encontrado.</div>';
      } catch (error) { if (mine === seq) rows.innerHTML = `<div class="empty">${esc(error.message)}</div>`; }
    };
    OC.$('#c-q', el).addEventListener('input', (event) => { clearTimeout(timer); timer = setTimeout(() => load(event.target.value.trim()), 300); });
    load('');
    OC.$('#c-ex', el).addEventListener('click', () => OC.open('exsat'));
    OC.$('#c-sync', el).addEventListener('click', () => OC.open('exsat'));
    const imp = OC.$('#c-imp', el);
    if (imp) imp.addEventListener('click', () => OC.open('imp'));
    // Cartao da EXSAT: quantas propostas em edicao tem preco novo (falha de rede nao atrapalha o catalogo).
    OC.api('/proposals/price-drift').then((d) => {
      const n = (d.proposals || []).length, t = OC.$('#c-ex-s', el);
      if (t) t.textContent = n ? `${n} ${n === 1 ? 'proposta com preço novo' : 'propostas com preço novo'}` : 'Nenhum preço novo nas propostas';
    }).catch(() => { const t = OC.$('#c-ex-s', el); if (t) t.textContent = 'Toque para ver preços e propostas'; });
  };

  // Clientes e obras: cartoes que abrem com as obras e o atalho para uma proposta nova.
  OC.screens.cli = async function (params) {
    const [clients, proposals] = await Promise.all([OC.api('/clients').then((d) => d.clients || []), OC.loadProposals().catch(() => [])]);
    let open = '', query = '';
    const count = (c) => proposals.filter((p) => p.clientName === (c.tradeName || c.legalName) || p.clientName === c.legalName);
    const works = clients.reduce((n, c) => n + (c.works || []).length, 0);
    const el = OC.render(`${OC.header('Clientes e obras', { back: true })}
      <p class="sub" style="margin:-6px 0 0">${clients.length} clientes · ${proposals.length} propostas · ${works} obras</p>
      <label class="search">${icon('magnifying-glass', 18)}<input id="c-q" type="search" placeholder="Buscar cliente" autocomplete="off"></label>
      <div class="kit-list" id="c-list"></div>
      ${OC.canEdit() ? `<button class="btn2" type="button" id="c-new">${icon('plus', 18)}Novo cliente</button>` : ''}`, true, params);
    const paint = () => {
      const q = query.trim().toLowerCase();
      const rows = clients.filter((c) => !q || `${c.legalName} ${c.tradeName || ''}`.toLowerCase().includes(q));
      OC.$('#c-list', el).innerHTML = rows.map((c) => {
        const ps = count(c), approved = ps.filter((p) => p.status === 'approved').reduce((n, p) => n + (p.totalSale || 0), 0);
        const on = open === c.id;
        return `<div class="card cli${on ? ' open' : ''}"><button class="cli-head" type="button" data-c="${esc(c.id)}" aria-expanded="${on}"><span class="avatar" style="--a:36px">${esc(initials(c.tradeName || c.legalName))}</span>
          <span class="grow"><b>${esc(c.tradeName || c.legalName)}</b><small>${ps.length} ${ps.length === 1 ? 'proposta' : 'propostas'}${approved ? ` · aprovado ${esc(OC.mi(approved))}` : ''}${(c.works || []).length ? ` · ${c.works.length} ${c.works.length === 1 ? 'obra' : 'obras'}` : ''}</small></span>${icon(on ? 'caret-up' : 'caret-down', 18)}</button>
          ${on ? `<div class="cli-body">${(c.works || []).map((w) => `<div class="kv"><span>${esc(w.name)}</span><b>${esc(w.address || '')}</b></div>`).join('') || '<small class="hint">Sem obras cadastradas.</small>'}
            ${ps.map((p) => `<button class="prow" type="button" data-p="${esc(p.id)}"><span class="grow"><b>${esc(p.workName || p.number)}</b><small>${esc(p.number)} · ${esc(OC.rev(p.revision))}</small></span><span class="end">${OC.pill(p.status)}</span>${icon('caret-right', 18)}</button>`).join('')}
            ${OC.canEdit() ? `<button class="chip-act" type="button" data-nova="${esc(c.id)}">${icon('plus', 16)}Nova proposta</button>` : ''}</div>` : ''}</div>`;
      }).join('') || `<div class="empty">${icon('users', 28)}Nenhum cliente.</div>`;
      OC.$$('[data-c]', el).forEach((b) => b.addEventListener('click', () => { open = open === b.dataset.c ? '' : b.dataset.c; paint(); }));
      OC.$$('[data-p]', el).forEach((b) => b.addEventListener('click', () => OC.open('prop', { id: b.dataset.p })));
      OC.$$('[data-nova]', el).forEach((b) => b.addEventListener('click', () => OC.open('nova', { client: b.dataset.nova })));
    };
    OC.$('#c-q', el).addEventListener('input', (event) => { query = event.target.value; paint(); });
    const nc = OC.$('#c-new', el);
    if (nc) nc.addEventListener('click', () => OC.ask('Novo cliente', 'Razão social ou nome', 'Ex.: Rede São Lucas Saúde', async (name) => {
      const id = (await OC.api('/clients', { method: 'POST', body: { legalName: name } })).clientId;
      clients.unshift({ id, legalName: name, tradeName: null, works: [] });
      open = id;
      paint();
      OC.toast('Cliente cadastrado');
    }));
    paint();
  };
})(window.OC = window.OC || {});
