// Itens da proposta no celular: duplicar, subir e descer, "+ catalogo" da linha avulsa e busca com filtro por categoria.
// Mesmas rotas e regras do computador (useProposalItemActions.ts, AddToCatalogDialog.tsx, ProposalItemsFilterBar.tsx).
// "+ catalogo" cria produto com o custo da linha: so para quem edita o catalogo (p10).
(function (OC) {
  const { esc, icon } = OC;
  const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9._\-/ ]*$/;
  const catOf = (it) => it.category || 'Geral';

  // Botoes extras da folha de edicao do item (prop-edit.js chama dentro de OC.itemSheet).
  OC.itemExtraHtml = (p, it) => {
    const toCat = it.inCatalog === false && OC.canEditCatalog && OC.canEditCatalog();
    return `<div class="it-acts"><button class="btn2" type="button" data-x="dup">${icon('copy', 18)}Duplicar</button>
      <button class="btn2" type="button" data-x="up" aria-label="Subir item na lista">${icon('caret-up', 18)}Subir</button>
      <button class="btn2" type="button" data-x="down" aria-label="Descer item na lista">${icon('caret-down', 18)}Descer</button></div>
      ${toCat ? `<button class="btn2 it-cat" type="button" data-x="cat">${icon('package', 18)}Adicionar ao catálogo</button>` : ''}`;
  };

  OC.bindItemExtra = (s, p, it, ctx) => {
    let cur = p;
    const btn = (k) => OC.$(`[data-x="${k}"]`, s.el);
    const up = btn('up'), down = btn('down');
    const sync = () => {
      const i = cur.items.findIndex((x) => x.id === it.id);
      up.disabled = i <= 0;
      down.disabled = i < 0 || i >= cur.items.length - 1;
    };
    const run = async (b, fn) => {
      b.disabled = true;
      try { await fn(); } catch (error) { OC.toast(error.message, 'warning-circle'); } finally { if (b !== up && b !== down) b.disabled = false; sync(); }
    };
    btn('dup').addEventListener('click', (event) => run(event.currentTarget, async () => {
      const data = await OC.api(`/proposals/${p.id}/items/${it.id}/duplicate`, { method: 'POST', body: {} });
      s.close();
      OC.toast('Item duplicado', 'copy');
      ctx.update(data.proposal);
    }));
    // Subir e descer mantem a folha aberta para mover varias posicoes seguidas.
    [[up, 'up'], [down, 'down']].forEach(([b, direction]) => b.addEventListener('click', () => run(b, async () => {
      const data = await OC.api(`/proposals/${p.id}/items/${it.id}/move`, { method: 'POST', body: { direction } });
      cur = data.proposal;
      ctx.update(cur);
    })));
    const cat = btn('cat');
    if (cat) cat.addEventListener('click', () => { s.close(); toCatalogSheet(p, it, ctx); });
    sync();
  };

  function toCatalogSheet(p, it, ctx) {
    const s = OC.sheet(`${OC.sheetHead('Adicionar ao catálogo', 'package')}<p class="sheet-text" style="margin-top:2px">${esc(it.description)}</p>
      <label class="field" style="margin-top:12px"><span>Código no catálogo</span><input id="tc-code" type="text" maxlength="60" value="${esc(it.code || '')}" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>
      <label class="field" style="margin-top:12px"><span>Categoria</span><input id="tc-cat" type="text" maxlength="80" value="${esc(it.category || 'Outros')}" autocomplete="off"></label>
      <p class="sheet-text">Entram no catálogo a descrição, a unidade (${esc(it.unit)}) e o custo desta linha. A proposta passa a usar o produto do catálogo.</p>
      <div class="sheet-actions"><button class="btn2" type="button" data-no>Cancelar</button><button class="btn" type="button" data-yes>Adicionar</button></div>`);
    OC.$('[data-no]', s.el).addEventListener('click', s.close);
    OC.$('[data-yes]', s.el).addEventListener('click', async (event) => {
      const b = event.currentTarget;
      const code = OC.$('#tc-code', s.el).value.trim(), category = OC.$('#tc-cat', s.el).value.trim();
      if (!code || !CODE_RE.test(code)) { OC.toast('Use só letras, números, ponto, hífen, barra e espaço no código.', 'warning-circle'); return; }
      b.disabled = true;
      try {
        const data = await OC.api(`/proposals/${p.id}/items/${it.id}/to-catalog`, { method: 'POST', body: category ? { code, category } : { code } });
        s.close();
        OC.toast('Item adicionado ao catálogo');
        ctx.update(data.proposal);
      } catch (error) { OC.toast(error.message, 'warning-circle'); b.disabled = false; }
    });
  }

  // Busca e categoria da aba Itens: filtram as linhas ja desenhadas. O filtro fica guardado por proposta enquanto o app esta aberto.
  const filters = {};
  OC.itemsTools = function (p, ctx, body) {
    const list = OC.$('.items', body);
    if (!list) return;
    p.items.forEach((it) => {
      const small = it.inCatalog === false && OC.$(`[data-item="${it.id}"] > small`, list);
      if (small) small.insertAdjacentHTML('afterbegin', '<span class="tag it-av">avulso</span> ');
    });
    if (p.items.length < 2) return;
    const st = filters[p.id] = filters[p.id] || { q: '', cat: '' };
    const cats = Array.from(new Set(p.items.map(catOf))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (!cats.includes(st.cat)) st.cat = '';
    const count = (c) => p.items.filter((it) => catOf(it) === c).length;
    list.insertAdjacentHTML('beforebegin', `<div class="it-tools">
      <label class="search">${icon('magnifying-glass', 18)}<input type="search" data-iq placeholder="Buscar item ou código" value="${esc(st.q)}" autocomplete="off" aria-label="Buscar item da proposta"></label>
      ${cats.length > 1 ? `<div class="chips wrap it-cats" role="group" aria-label="Filtrar por categoria">${['', ...cats].map((c) => `<button class="chip-act" type="button" data-icat="${esc(c)}" aria-pressed="${st.cat === c}">${esc(c || 'Todas')}${c ? ` · ${count(c)}` : ''}</button>`).join('')}</div>` : ''}
      <p class="it-count" data-icount hidden></p></div>`);
    const tools = list.previousElementSibling;
    const apply = () => {
      const term = st.q.trim().toLowerCase();
      let shown = 0;
      p.items.forEach((it) => {
        const row = OC.$(`[data-item="${it.id}"]`, list);
        if (!row) return;
        const ok = (!st.cat || catOf(it) === st.cat) && (!term || `${it.code} ${it.description}`.toLowerCase().includes(term));
        row.hidden = !ok;
        if (ok) shown += 1;
      });
      const active = Boolean(term || st.cat);
      const info = OC.$('[data-icount]', tools);
      info.hidden = !active;
      info.innerHTML = active ? `Exibindo <b>${shown}</b> de ${p.items.length} itens <button type="button" class="it-clear" data-iclear>Limpar filtro</button>` : '';
      const none = OC.$('.it-none', list);
      if (active && !shown && !none) list.insertAdjacentHTML('beforeend', `<div class="empty it-none">${icon('funnel', 24)}Nenhum item com esse filtro.</div>`);
      if ((!active || shown) && none) none.remove();
      OC.$$('[data-icat]', tools).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.icat === st.cat)));
    };
    const q = OC.$('[data-iq]', tools);
    q.addEventListener('input', () => { st.q = q.value; apply(); });
    tools.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-icat]');
      if (chip) { st.cat = chip.dataset.icat; apply(); }
      if (event.target.closest('[data-iclear]')) { st.q = ''; st.cat = ''; q.value = ''; apply(); }
    });
    apply();
  };
})(window.OC = window.OC || {});
