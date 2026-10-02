// Integracao EXSAT e preco novo na proposta, no celular (prototipo, Rodada 22: telas 22c a 22f e 22n a 22y).
// A varredura do EXSAT com a conta conectada roda so no aplicativo do computador (a sessao do site fica la);
// aqui o celular mostra o que o catalogo tem de preco novo em relacao as propostas em edicao e atualiza item a item.
(function (OC) {
  const { esc, icon } = OC;
  const fmtN = (n) => Number(n || 0).toLocaleString('pt-BR');
  const signBrl = (v) => `${v > 0 ? '+' : (v < 0 ? '−' : '')}${OC.money(Math.abs(v))}`;
  const pctS = (v) => `${v > 0 ? '+' : (v < 0 ? '−' : '')}${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  const plural = (n, one, many) => `${fmtN(n)} ${n === 1 ? one : many}`;
  const tone = (v) => (v > 0 ? 'up' : 'down');
  const arrow = (v) => icon(v > 0 ? 'caret-up' : 'caret-down', 12);
  const label = (d) => `${esc(d.number)} · ${esc(OC.rev(d.revision))}`;

  // ---------- folha: Atualizar precos desta proposta? ----------
  OC.priceDriftSheet = function (drift, onApplied) {
    const cost = OC.can('p10') && drift.costDelta !== undefined;
    const rows = drift.items.map((it) => `<div class="drift-row"><span class="grow"><b>${esc(it.description)}</b>
        <small>${esc(OC.num(it.quantity))} ${esc(it.unit)}${cost ? ` · custo ${esc(OC.money(it.fromUnit))} → ${esc(OC.money(it.toUnit))}` : ` · ${esc(pctS(it.changePercent))} no preço`}</small></span>
        <b class="delta-t ${tone(cost ? it.costDelta : it.finalDelta)}">${esc(signBrl(cost ? it.costDelta : it.finalDelta))}</b></div>`).join('');
    const s = OC.sheet(`${OC.sheetHead('Atualizar preços desta proposta?', 'trend-up')}
      <p class="sheet-text" style="margin-top:6px">${label(drift)} · ${esc(drift.workName || drift.clientName || '')}</p>
      <div class="drift-list">${rows}</div>
      <div class="card drift-sum">${cost ? `<div class="kv"><span>Custo</span><b class="${tone(drift.costDelta)}">${esc(signBrl(drift.costDelta))}</b></div>` : ''}
        <div class="kv"><span>Valor final</span><b>${esc(OC.money(drift.finalBefore))} → ${esc(OC.money(drift.finalAfter))}</b></div></div>
      <p class="sheet-text">Os itens passam a usar o preço atual do catálogo. Quantidades, BDI e impostos continuam como estão. Proposta em revisão, enviada ou aprovada mantém os preços; os novos entram na próxima revisão.</p>
      <div class="sheet-actions"><button class="btn2" type="button" data-no>Agora não</button><button class="btn" type="button" data-yes>Atualizar ${esc(plural(drift.items.length, 'preço', 'preços'))}</button></div>`);
    OC.$('[data-no]', s.el).addEventListener('click', s.close);
    OC.$('[data-yes]', s.el).addEventListener('click', async (event) => {
      const b = event.currentTarget;
      b.disabled = true;
      try {
        const res = await OC.api(`/proposals/${drift.id}/price-drift/apply`, { method: 'POST', body: {} });
        s.close();
        OC.toast(`${plural(res.updated, 'preço atualizado', 'preços atualizados')} na ${drift.number} · valor final ${OC.money(drift.finalAfter)}`);
        if (onApplied) onApplied(res.proposal);
      } catch (error) { OC.toast(error.message, 'warning-circle'); b.disabled = false; }
    });
  };

  // ---------- aviso na proposta (Resumo e Itens) ----------
  OC.driftBanner = async function (p, ctx, body) {
    if (p.status !== 'draft' || !p.isLatest || !OC.canEdit()) return;
    const stamp = body.dataset.stamp;
    let drift;
    try { drift = (await OC.api(`/proposals/${encodeURIComponent(p.id)}/price-drift`)).drift; } catch { return; }
    if (!drift || drift.frozen || !drift.items.length || !body.isConnected || body.dataset.stamp !== stamp) return;
    const cost = OC.can('p10') && drift.costDelta !== undefined;
    body.insertAdjacentHTML('afterbegin', `<div class="card drift-banner" role="status"><span class="ic">${icon('trend-up', 20)}</span><span class="grow"><b>Atualizar preços desta proposta?</b>
      <small>${esc(plural(drift.items.length, 'item mudou', 'itens mudaram'))} de preço no catálogo desde que ${drift.items.length === 1 ? 'entrou' : 'entraram'} aqui. ${cost ? `Custo ${esc(signBrl(drift.costDelta))}, ` : ''}valor final ${esc(signBrl(drift.finalDelta))}.</small>
      <button class="chip-act" type="button" data-drift>Ver e atualizar</button></span></div>`);
    OC.$('[data-drift]', body).addEventListener('click', () => OC.priceDriftSheet(drift, (proposal) => { if (proposal) ctx.update(proposal); else ctx.reload(); }));
  };

  // ---------- tela: Integracao EXSAT ----------
  OC.screens.exsat = async function (params) {
    const el = OC.render(`${OC.header('Integração EXSAT', { back: true })}<div id="x-body" class="imp-body"></div>`, true, params);
    const body = OC.$('#x-body', el);
    const live = () => OC.nav === params.__nav;
    let filter = 'todos', busy = false, seq = 0;

    const skeleton = () => { body.innerHTML = '<div class="skeleton" style="height:150px"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>'; };

    async function load() {
      const mine = ++seq;
      busy = true; skeleton();
      let proposals, count;
      try {
        [proposals, count] = await Promise.all([
          OC.api('/proposals/price-drift').then((d) => d.proposals || []),
          OC.api('/dashboard').then((d) => (d.summary || {}).totalProductsCount || 0).catch(() => 0),
        ]);
      } catch (error) {
        if (mine !== seq || !live()) return;
        busy = false; return paintError(error);
      }
      if (mine !== seq || !live()) return;
      busy = false;
      paint(proposals, count);
    }

    function paintError(error) {
      const off = error && error.status === 0;
      body.innerHTML = `<div class="empty imp-state">${icon(off ? 'wifi-slash' : 'warning-circle', 32)}<b>${off ? 'Sem internet' : 'Não deu para consultar os preços'}</b>
        <span>${off ? 'Conecte o celular para ver o que mudou. O catálogo e as propostas continuam como estão.' : `${esc(error.message || 'O servidor não respondeu.')} O catálogo e as propostas continuam como estão. Tente de novo em alguns minutos.`}</span>
        <button class="btn" type="button" id="x-retry" style="padding:0 22px">Tentar de novo</button></div>`;
      OC.$('#x-retry', body).addEventListener('click', load);
    }

    function rowsByCode(proposals) {
      const map = new Map();
      for (const d of proposals) for (const it of d.items) {
        const cur = map.get(it.code) || { code: it.code, description: it.description, unit: it.unit, pct: it.changePercent, from: it.fromUnit, to: it.toUnit, used: [] };
        if (!cur.used.includes(d.number)) cur.used.push(d.number);
        map.set(it.code, cur);
      }
      return [...map.values()];
    }

    function paint(proposals, count) {
      const rows = rowsByCode(proposals), up = rows.filter((r) => r.pct > 0).length, down = rows.filter((r) => r.pct < 0).length;
      const itemsN = proposals.reduce((n, d) => n + d.items.length, 0);
      const shown = rows.filter((r) => filter === 'todos' || (filter === 'sub' ? r.pct > 0 : r.pct < 0));
      const cost = OC.can('p10');
      const status = `<div class="card ex-card"><div class="ex-head"><span class="ex-ic">${icon('arrow-square-out', 22)}</span><span class="grow"><b>EXSAT</b>
          <small>${proposals.length ? `${plural(proposals.length, 'proposta com preço novo', 'propostas com preço novo')}` : 'Nenhum preço novo nas propostas'}</small></span>
          <span class="imp-badge sug">Pelo computador</span></div>
        <div class="kv"><span>Itens no catálogo</span><b>${fmtN(count)}</b></div>
        <div class="kv"><span>Itens com preço novo</span><b>${fmtN(rows.length)}${rows.length ? ` · ${fmtN(up)} subiu, ${fmtN(down)} baixou` : ''}</b></div>
        <div class="kv"><span>Propostas em edição afetadas</span><b>${fmtN(proposals.length)}</b></div>
        <p class="hint" style="margin-top:6px">A varredura do EXSAT usa a conta conectada no aplicativo do computador. Aqui você vê o que mudou no catálogo e atualiza as propostas em edição.</p>
        <div class="ex-btns"><button class="btn2" type="button" id="x-reload">Atualizar lista</button>${OC.canEdit() && OC.can('p10') ? `<button class="btn" type="button" id="x-import">Importar página do EXSAT</button>` : ''}</div></div>`;
      const empty = `<div class="empty imp-state">${icon('check-circle', 32)}<b>Nenhum preço mudou</b><span>Os itens das propostas em edição continuam com o mesmo preço do catálogo. Quando o computador atualizar o catálogo pelo EXSAT, os avisos aparecem aqui e dentro de cada proposta.</span></div>`;
      const chips = `<div class="chips wrap" role="group" aria-label="Filtro">${[['todos', `Todos · ${rows.length}`], ['sub', `Subiram · ${up}`], ['des', `Baixaram · ${down}`]].map(([k, l]) => `<button class="chip-act" type="button" data-fil="${k}" aria-pressed="${filter === k}">${l}</button>`).join('')}</div>`;
      const list = rows.length ? `<div class="sec-row"><span class="label">Itens com preço novo</span></div>${chips}
        ${shown.length ? `<div class="rows">${shown.map((r) => `<div class="prow static imp-upd"><span class="grow"><b>${esc(r.description)}</b><small>${esc(r.code)} · ${esc(r.unit)}</small>
            <small class="ba">${cost && r.from != null ? `${esc(OC.money(r.from))} → ${esc(OC.money(r.to))}` : 'Preço do catálogo mudou'}</small>
            <small>Usado na ${esc(r.used.join(' e na '))}</small></span><span class="delta ${tone(r.pct)}">${arrow(r.pct)}${esc(pctS(r.pct))}</span></div>`).join('')}</div>` : `<div class="empty">${icon('funnel', 24)}Nenhum item nesse filtro.</div>`}` : '';
      const props = proposals.length ? `<div class="sec-row"><span class="label">Propostas em edição com preço novo</span></div>
        ${proposals.map((d) => `<div class="card ex-prop"><span class="label">${label(d)}</span><b>${esc(d.workName || d.clientName || '')}</b>
          <small>${esc(plural(d.items.length, 'item com preço novo', 'itens com preço novo'))} · ${cost && d.costDelta !== undefined ? `custo ${esc(signBrl(d.costDelta))} · ` : ''}valor final ${esc(signBrl(d.finalDelta))}</small>
          <div class="row-act"><button class="chip-act ghost" type="button" data-see="${esc(d.id)}">Ver itens</button>${OC.canEdit() ? `<button class="chip-act" type="button" data-upd="${esc(d.id)}">Atualizar preços</button>` : ''}</div></div>`).join('')}
        <p class="hint">Proposta em revisão, enviada ou aprovada mantém os preços; os novos entram na próxima revisão.</p>` : '';
      body.innerHTML = `${status}${proposals.length ? '' : empty}${list}${props}`;
      OC.$('#x-reload', body).addEventListener('click', () => { if (!busy) load(); });
      const imp = OC.$('#x-import', body);
      if (imp) imp.addEventListener('click', () => OC.open('imp'));
      OC.$$('[data-fil]', body).forEach((b) => b.addEventListener('click', () => { filter = b.dataset.fil; paint(proposals, count); }));
      OC.$$('[data-see]', body).forEach((b) => b.addEventListener('click', () => OC.open('prop', { id: b.dataset.see, tab: 'itens' })));
      OC.$$('[data-upd]', body).forEach((b) => b.addEventListener('click', () => {
        const d = proposals.find((x) => x.id === b.dataset.upd);
        if (d) OC.priceDriftSheet(d, () => load());
      }));
    }

    await load();
    return el;
  };
})(window.OC = window.OC || {});
