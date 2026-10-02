// Comparativo de revisoes no celular (prototipo: Rodada 21, telas 21k-21o e 21s-21u).
// Usa so o que a API ja entrega: sem p10 o servidor zera custo e BDI, e aqui os valores sao de venda.
(function (OC) {
  const { esc, icon } = OC;
  const key = (it) => `${(it.code || '').trim().toLowerCase()}|${(it.description || '').trim().toLowerCase()}`;
  const same = (a, b) => Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.005;
  const signed = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${OC.money0(Math.abs(v))}`;

  // A mao de obra entra como uma linha de venda por revisao, como no PDF do cliente.
  const withLabor = (P) => {
    const labor = OC.laborSale(P);
    return labor > 0 ? { ...P, items: [...P.items, { code: '', description: 'Mão de obra e serviços técnicos', category: 'Mão de obra', quantity: 1, unit: 'vb', unitSale: labor, totalSale: labor }] } : P;
  };

  // Linhas por sistema: entrou, saiu, quantidade ou preco mudou, igual.
  function diff(A, B) {
    const mapA = new Map(A.items.map((it) => [key(it), it]));
    const rows = [];
    B.items.forEach((b) => {
      const a = mapA.get(key(b));
      mapA.delete(key(b));
      if (!a) rows.push({ kind: 'add', it: b, d: b.totalSale || 0 });
      else {
        const qty = !same(a.quantity, b.quantity), price = !same(a.unitSale, b.unitSale);
        rows.push({ kind: qty ? 'qty' : price ? 'price' : 'same', it: b, a, qty, price, d: (b.totalSale || 0) - (a.totalSale || 0) });
      }
    });
    mapA.forEach((a) => rows.push({ kind: 'del', it: a, d: -(a.totalSale || 0) }));
    return rows;
  }

  function rowHtml(r) {
    const up = r.d > 0.004, down = r.d < -0.004;
    const meta = r.kind === 'add' ? `Incluído · ${OC.num(r.it.quantity)} ${r.it.unit}`
      : r.kind === 'del' ? `Removido · era ${OC.num(r.it.quantity)} ${r.it.unit}`
      : r.kind === 'same' ? `${OC.num(r.it.quantity)} ${r.it.unit} · ${OC.money(r.it.unitSale)} por ${r.it.unit}`
      : [r.qty ? `${OC.num(r.a.quantity)} → ${OC.num(r.it.quantity)} ${r.it.unit}` : '', r.price ? `${OC.money(r.a.unitSale)} → ${OC.money(r.it.unitSale)}/${r.it.unit}` : ''].filter(Boolean).join(' · ');
    const ic = r.kind === 'add' ? 'plus' : r.kind === 'del' ? 'minus' : r.kind === 'same' ? 'equals' : 'pencil-simple';
    const tag = r.kind === 'add' ? 'Incluído' : r.kind === 'del' ? 'Removido' : r.kind === 'same' ? 'Igual' : r.qty && r.price ? 'Qtd. e preço' : r.qty ? 'Quantidade' : 'Preço';
    return `<div class="cmp-row ${up ? 'up' : down ? 'down' : 'eq'}${r.kind === 'same' ? ' same' : r.kind === 'del' ? ' del' : ''}"><span class="cmp-ic">${icon(ic, 14)}</span>
      <span class="grow"><b>${esc(r.it.description)}</b><small>${esc(meta)}</small></span><span class="cmp-val"><b class="val">${r.kind === 'same' ? esc(OC.money0(r.it.totalSale)) : esc(signed(r.d))}</b><small class="cmp-tag">${tag}</small></span></div>`;
  }

  function pickSheet(list, side, a, b, choose) {
    const s = OC.sheet(`${OC.sheetHead(side === 'a' ? 'Comparar de' : 'Comparar para', 'clock-counter-clockwise')}
      <div class="timeline">${list.map((r) => `<button class="rev${r.id === (side === 'a' ? a : b) ? ' cur' : ''}" type="button" data-pick="${esc(r.id)}"><i class="dot"></i>
        <span class="grow"><span class="rev-top"><b>${esc(OC.rev(r.revision))}</b>${OC.pill(r.status)}${r.id === (side === 'a' ? b : a) ? '<span class="tag">No outro lado</span>' : ''}</span>
        <small>${r.itemCount} ${r.itemCount === 1 ? 'item' : 'itens'} · ${esc(OC.dateFull(r.updatedAt))}</small></span><b class="val">${r.totalSale ? esc(OC.money0(r.totalSale)) : 'Sem itens'}</b></button>`).join('')}</div>
      <p class="sheet-text">Escolher a revisão que está do outro lado troca as duas de lugar.</p>`);
    OC.$$('[data-pick]', s.el).forEach((btn) => btn.addEventListener('click', () => { s.close(); choose(btn.dataset.pick); }));
  }

  const skeleton = () => `<div class="cmp-pick"><div class="skeleton" style="height:96px"></div><span></span><div class="skeleton" style="height:96px"></div></div>
    <div class="skeleton" style="height:150px"></div><div class="skeleton" style="height:56px"></div>${'<div class="skeleton" style="height:48px"></div>'.repeat(4)}`;

  OC.screens.cmp = async function (params) {
    const el = OC.render(`${OC.header('Comparar revisões', { back: true })}<div class="prop-tags"><span class="prop-work" id="cmp-sub">Carregando as revisões…</span></div><div id="cmp-body" class="p-body">${skeleton()}</div>`, true, params);
    const body = OC.$('#cmp-body', el);
    const nav = OC.nav;
    const fail = (error) => {
      if (nav !== OC.nav || error.status === 401) return;
      OC.$('#cmp-sub', el).textContent = '';
      body.innerHTML = `<div class="empty">${icon(error.status === 0 ? 'wifi-slash' : 'warning-circle', 28)}<b class="empty-t">Não deu para comparar agora</b>
        <span>${error.status === 0 ? 'As revisões antigas ficam no servidor e o celular está sem internet. A revisão atual continua aberta na proposta.' : esc(error.message)}</span>
        <button class="btn" type="button" data-retry style="padding:0 18px">Tentar de novo</button><button class="btn2" type="button" data-back style="padding:0 18px">Voltar às revisões</button></div>`;
      OC.$('[data-retry]', body).addEventListener('click', () => OC.go('cmp', params, { back: true }));
    };
    let list;
    try { list = ((await OC.api(`/proposals/${encodeURIComponent(params.id)}/history`)).revisions || []).slice().sort((x, y) => x.revision - y.revision); } catch (error) { fail(error); return; }
    if (nav !== OC.nav) return;
    history.replaceState(null, '', `#cmp=${encodeURIComponent(params.id)}`);
    if (list.length < 2) {
      OC.$('#cmp-sub', el).textContent = list[0] ? `${OC.rev(list[0].revision)} · revisão única` : '';
      body.innerHTML = `<div class="empty">${icon('clock-counter-clockwise', 28)}<b class="empty-t">Só existe uma revisão</b>
        <span>Quando a proposta ganhar uma nova revisão, dá para comparar o que mudou entre elas.</span>
        <button class="btn2" type="button" data-back style="padding:0 18px">Voltar às revisões</button></div>`;
      return;
    }
    const ids = list.map((r) => r.id);
    let a = ids.includes(params.a) ? params.a : ids[0];
    let b = ids.includes(params.b) && params.b !== a ? params.b : ids[ids.length - 1];
    let only = !!params.only;
    const cache = {};
    const load = (id) => (cache[id] = cache[id] || OC.api(`/proposals/${encodeURIComponent(id)}`).then((d) => d.proposal).catch((error) => { delete cache[id]; throw error; }));

    async function paint() {
      let A, B;
      try { [A, B] = await Promise.all([load(a), load(b)]); } catch (error) { fail(error); return; }
      if (nav !== OC.nav) return;
      const cost = OC.can('p10');
      const rows = diff(withLabor(A), withLabor(B));
      const fa = (A.totals && A.totals.finalValue) || 0, fb = (B.totals && B.totals.finalValue) || 0;
      const itemsD = rows.reduce((s, r) => s + r.d, 0);
      const geral = fb - fa - itemsD;
      const pct = fa ? ((fb - fa) / fa) * 100 : 0;
      const count = (k) => rows.filter((r) => (k === 'price' ? r.kind === 'price' || (r.kind === 'qty' && r.price) : r.kind === k)).length;
      const counters = [['add', 'Incluídos'], ['del', 'Removidos'], ['qty', 'Quantidade'], ['price', 'Preço']];
      const systems = [...new Set(rows.map((r) => r.it.category || 'Itens'))];
      const changed = rows.filter((r) => r.kind !== 'same').length;
      const revA = list.find((r) => r.id === a), revB = list.find((r) => r.id === b);
      const label = (r) => OC.rev(r.revision);
      OC.$('#cmp-sub', el).textContent = `${B.number} · ${OC.rev(revA.revision)} × ${OC.rev(revB.revision)}`;
      const dir = (v) => (v > 0.5 ? 'up' : v < -0.5 ? 'down' : 'eq');
      body.innerHTML = `<div class="cmp-pick">
          <button class="card pick" type="button" data-side="a" aria-label="Trocar a revisão de partida"><span class="pick-top"><small>De</small>${icon('caret-down', 14)}</span><b>${esc(label(revA))}</b><span>${OC.pill(A.status)}</span><small>${esc(OC.dateFull(revA.updatedAt))}</small></button>
          <button class="swap" type="button" data-swap aria-label="Trocar a ordem das revisões">${icon('arrows-left-right', 20)}</button>
          <button class="card pick" type="button" data-side="b" aria-label="Trocar a revisão de chegada"><span class="pick-top"><small>Para</small>${icon('caret-down', 14)}</span><b>${esc(label(revB))}</b><span>${OC.pill(B.status)}</span><small>${esc(OC.dateFull(revB.updatedAt))}</small></button></div>
        ${B.status === 'draft' && revB.isLatest ? '<p class="hint">Comparando com o que está sendo editado agora.</p>' : ''}
        <div class="card"><div class="kv top-kv"><span><small>Valor final</small><b>${esc(OC.money0(fa))} → ${esc(OC.money0(fb))}</b></span>
            <span class="right cmp-d ${dir(fb - fa)}"><b>${esc(signed(fb - fa))}</b><small>${pct ? `${pct > 0 ? '+' : '−'}${esc(OC.pct(Math.abs(pct)))} no valor final` : 'sem mudança'}</small></span></div>
          <div class="kv sep"><span>Itens</span><b class="cmp-d ${dir(itemsD)}">${esc(signed(itemsD))}</b></div>
          ${Math.abs(geral) > 0.5 ? `<div class="kv"><span>${cost && Math.abs(A.bdiMultiplier - B.bdiMultiplier) > 1e-6 ? `BDI ${esc(OC.dec2(A.bdiMultiplier))} → ${esc(OC.dec2(B.bdiMultiplier))}` : 'Ajuste geral de preço'}</span><b class="cmp-d ${dir(geral)}">${esc(signed(geral))}</b></div>` : ''}
          <div class="cmp-count">${counters.map(([k, l]) => `<span><b>${count(k)}</b><small>${l}</small></span>`).join('')}</div></div>
        ${cost ? '' : '<p class="hint">Valores de venda. Custo e BDI ficam com quem tem essa permissão.</p>'}
        <button class="opt" type="button" data-only aria-pressed="${only}"><span class="grow"><b>Só o que mudou</b><small>${changed} de ${rows.length} itens mudaram</small></span><span class="switch"></span></button>
        <p class="hint cmp-legend"><span class="cmp-d up">${icon('caret-up', 12)}entrou ou aumentou</span> <span class="cmp-d down">${icon('caret-down', 12)}saiu ou diminuiu</span></p>
        ${changed || !only ? systems.map((sys) => {
          const own = rows.filter((r) => (r.it.category || 'Itens') === sys);
          const shown = only ? own.filter((r) => r.kind !== 'same') : own;
          if (!shown.length) return '';
          const mod = own.filter((r) => r.kind !== 'same');
          const sum = own.reduce((s, r) => s + r.d, 0);
          return `<div class="cmp-group"><div class="sec-row"><span class="label">${esc(sys)}</span><span class="label">${mod.length ? `${mod.length} ${mod.length === 1 ? 'mudou' : 'mudaram'} · ${esc(signed(sum))}` : `nada mudou · ${own.length} ${own.length === 1 ? 'item' : 'itens'}`}</span></div>
            ${shown.map(rowHtml).join('')}</div>`;
        }).join('') : `<div class="empty">${icon('check-circle', 28)}Nada mudou entre as duas revisões.</div>`}`;
      OC.$$('[data-side]', body).forEach((btn) => btn.addEventListener('click', () => pickSheet(list, btn.dataset.side, a, b, (id) => {
        const side = btn.dataset.side;
        if (side === 'a') { if (id === b) [a, b] = [b, a]; else a = id; } else if (id === a) [a, b] = [b, a]; else b = id;
        if (a === b) return;
        paint();
      })));
      OC.$('[data-swap]', body).addEventListener('click', () => { [a, b] = [b, a]; paint(); });
      OC.$('[data-only]', body).addEventListener('click', () => { only = !only; paint(); });
    }
    await paint();
  };

  // Cartao do topo da aba Revisoes: primeira x ultima, com a diferenca no valor final.
  OC.cmpCard = function (list, current) {
    if (list.length < 2) return '';
    const sorted = list.slice().sort((x, y) => x.revision - y.revision);
    const first = sorted[0], last = sorted[sorted.length - 1];
    const d = (last.totalSale || 0) - (first.totalSale || 0);
    const dir = d > 0.5 ? 'up' : d < -0.5 ? 'down' : 'eq';
    return `<button class="card tile-card" type="button" data-cmp="${esc(current)}"><span class="tile">${icon('clock-counter-clockwise', 21)}</span>
      <span class="grow"><b>Comparar ${esc(OC.rev(first.revision))} × ${esc(OC.rev(last.revision))}</b>
      <small>${dir === 'eq' ? 'Sem diferença no valor final' : `<span class="cmp-d ${dir}">${esc(signed(d))}</span> no valor final`} · item a item, por sistema</small></span>${icon('caret-right', 18)}</button>`;
  };
})(window.OC = window.OC || {});
