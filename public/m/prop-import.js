// Importar itens numa proposta existente, pelo celular: colar do Excel ou CSV (items/import-batch), copiar de outra
// proposta (items/copy-from-proposal) e aplicar kit (kits/:id/apply-to-proposal). Mesmas rotas do computador
// (ProposalImportDialog.tsx, ProposalImportPasteTab.tsx). Custo na planilha so com p10; sem ele a coluna e ignorada.
(function (OC) {
  const { esc, icon } = OC;
  const HEAD = ['codigo', 'código', 'cód', 'cod', 'item', 'descricao', 'descrição'];
  const MAX = 2000;
  const num = (v) => {
    const s = String(v || '').trim().replace(/R\$/gi, '').replace(/\s/g, '');
    const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
    return Number.isFinite(n) ? n : NaN;
  };

  // Linhas coladas: 1 coluna = descricao; 2 = descricao e quantidade; 3+ = codigo, descricao, quantidade, unidade, custo.
  OC.parseSheetText = function (text) {
    const out = [];
    String(text || '').split(/\r?\n/).forEach((raw) => {
      // Sem trim na linha: o tab inicial e a coluna de codigo vazia.
      const line = raw;
      if (!line.trim()) return;
      const sep = line.includes('\t') ? '\t' : (line.includes(';') ? ';' : ',');
      const parts = line.split(sep).map((x) => x.trim().replace(/^["']|["']$/g, ''));
      if (!parts.some(Boolean) || HEAD.includes((parts[0] || '').toLowerCase())) return;
      const two = parts.length === 2;
      const code = parts.length >= 3 ? parts[0] : '';
      const description = (parts.length >= 3 ? parts[1] : parts[0]).slice(0, 500);
      const qty = num(two ? parts[1] : parts[2]);
      const cost = parts.length >= 5 && parts[4] !== '' ? num(parts[4]) : NaN;
      if (description.length < 2) return;
      out.push({
        code: code.slice(0, 80), description, unit: (parts[3] || 'un').slice(0, 20),
        quantity: qty > 0 && qty <= 1000000 ? qty : 1, unitCost: cost >= 0 ? cost : undefined,
      });
    });
    return out;
  };

  // Corpo da importacao em lote. Sem codigo ou sem custo o campo nao vai: o servidor usa o custo do catalogo pelo codigo.
  OC.importBody = (rows, withCost) => ({ items: rows.slice(0, MAX).map((r) => ({
    ...(r.code ? { code: r.code } : {}), description: r.description, unit: r.unit, quantity: r.quantity,
    ...(withCost && r.unitCost !== undefined ? { unitCost: r.unitCost } : {}),
  })) });

  // Opcoes extras da folha "Adicionar item" (prop-edit.js).
  OC.importOpts = () => `<button class="opt" type="button" data-a="paste">${icon('download-simple', 20)}<span><b>Colar do Excel ou CSV</b><small>Várias linhas de uma vez</small></span>${icon('caret-right', 18)}</button>
    <button class="opt" type="button" data-a="prop">${icon('copy', 20)}<span><b>De outra proposta</b><small>Escolha a proposta e os itens</small></span>${icon('caret-right', 18)}</button>
    <button class="opt" type="button" data-a="kit">${icon('stack', 20)}<span><b>De um kit</b><small>Os itens do kit, com o BDI desta proposta</small></span>${icon('caret-right', 18)}</button>`;
  OC.bindImportOpts = (s, p, ctx) => {
    const go = { paste: pasteSheet, prop: proposalSheet, kit: kitSheet };
    Object.keys(go).forEach((k) => OC.$(`[data-a="${k}"]`, s.el).addEventListener('click', () => { s.close(); go[k](p, ctx); }));
  };
  const done = (ctx, s, data, msg) => { s.close(); OC.toast(msg); if (data && data.proposal) ctx.update(data.proposal); else ctx.reload(); };

  function pasteSheet(p, ctx) {
    const cost = OC.can('p10');
    let rows = [];
    const s = OC.sheet(`${OC.sheetHead('Colar do Excel ou CSV', 'download-simple')}
      <p class="sheet-text" style="margin-top:2px">Copie as linhas na planilha e cole aqui. Colunas: código, descrição, quantidade, unidade${cost ? ' e custo unitário' : ''}. Com uma coluna só, ela vira a descrição.</p>
      <label class="field" style="margin-top:12px"><span>Linhas</span><textarea data-txt rows="5" placeholder="CAB-01; Cabo UTP cat6; 305; m" spellcheck="false"></textarea></label>
      <label class="chip-act ghost imp-file">${icon('download-simple', 16)}Carregar arquivo .csv<input type="file" accept=".csv,.txt,text/csv,text/plain" hidden></label>
      ${cost ? '' : '<p class="sheet-text">Seu papel não informa custo: itens com código do catálogo entram com o custo dele; os outros, sem custo.</p>'}
      <div data-prev></div>
      <div class="sheet-actions"><button class="btn2" type="button" data-no>Cancelar</button><button class="btn" type="button" data-yes disabled>Importar</button></div>`);
    const yes = OC.$('[data-yes]', s.el), txt = OC.$('[data-txt]', s.el);
    const paint = () => {
      rows = OC.parseSheetText(txt.value);
      yes.disabled = !rows.length;
      yes.textContent = rows.length ? `Importar ${Math.min(rows.length, MAX)} ${rows.length === 1 ? 'item' : 'itens'}` : 'Importar';
      OC.$('[data-prev]', s.el).innerHTML = rows.length ? `<p class="sheet-sec">Pré-visualização · ${rows.length} ${rows.length === 1 ? 'linha' : 'linhas'}${rows.length > MAX ? ` (entram as ${MAX} primeiras)` : ''}</p>
        <div class="rows">${rows.slice(0, 20).map((r) => `<div class="prow static"><span class="grow"><b>${esc(r.description)}</b><small>${esc(r.code || 'sem código')} · ${esc(OC.num(r.quantity))} ${esc(r.unit)}</small></span>${cost && r.unitCost !== undefined ? `<span class="end"><b>${esc(OC.money(r.unitCost))}</b><small>custo/${esc(r.unit)}</small></span>` : ''}</div>`).join('')}</div>
        ${rows.length > 20 ? `<p class="hint">e mais ${rows.length - 20} ${rows.length - 20 === 1 ? 'linha' : 'linhas'}</p>` : ''}`
        : (txt.value.trim() ? '<div class="empty">Nenhuma linha com descrição de pelo menos 2 letras.</div>' : '');
    };
    txt.addEventListener('input', paint);
    OC.$('.imp-file input', s.el).addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { txt.value = String(reader.result || ''); paint(); };
      reader.readAsText(file);
    });
    OC.$('[data-no]', s.el).addEventListener('click', s.close);
    yes.addEventListener('click', async () => {
      yes.disabled = true;
      try {
        const data = await OC.api(`/proposals/${p.id}/items/import-batch`, { method: 'POST', body: OC.importBody(rows, cost) });
        done(ctx, s, data, `${Math.min(rows.length, MAX)} ${rows.length === 1 ? 'item importado' : 'itens importados'}`);
      } catch (error) { OC.toast(error.message, 'warning-circle'); yes.disabled = false; }
    });
    setTimeout(() => txt.focus(), 50);
  }

  // Copiar de outra proposta: escolhe a proposta, depois os itens (todos marcados).
  function proposalSheet(p, ctx) {
    const s = OC.sheet(`${OC.sheetHead('Copiar de outra proposta', 'copy')}<div data-body><div class="empty">Carregando propostas…</div></div>`);
    const body = OC.$('[data-body]', s.el);
    let list = [];
    const pickList = (q) => {
      const term = q.trim().toLowerCase();
      const rows = list.filter((x) => !term || `${x.number} ${x.clientName} ${x.workName}`.toLowerCase().includes(term)).slice(0, 60);
      OC.$('[data-rows]', body).innerHTML = rows.map((x) => `<button class="prow" type="button" data-src="${esc(x.id)}"><span class="grow"><b>${esc(x.workName || x.clientName)}</b><small>${esc(x.number)} · ${esc(OC.rev(x.revision))} · ${x.itemCount} ${x.itemCount === 1 ? 'item' : 'itens'}</small></span>${OC.pill(x.status)}</button>`).join('')
        || '<div class="empty">Nenhuma proposta encontrada.</div>';
    };
    const step1 = () => {
      body.innerHTML = `<label class="search">${icon('magnifying-glass', 18)}<input data-q type="search" placeholder="Número, cliente ou obra" autocomplete="off"></label><div class="rows" data-rows></div>`;
      OC.$('[data-q]', body).addEventListener('input', (event) => pickList(event.target.value));
      body.onclick = (event) => { const b = event.target.closest('[data-src]'); if (b) step2(b.dataset.src, b); };
      pickList('');
    };
    async function step2(id, b) {
      b.disabled = true;
      let src;
      try { src = (await OC.api(`/proposals/${encodeURIComponent(id)}`)).proposal; } catch (error) { OC.toast(error.message, 'warning-circle'); b.disabled = false; return; }
      const chosen = new Set(src.items.map((it) => it.id));
      body.onclick = null;
      body.innerHTML = `<p class="sheet-text" style="margin-top:2px">${esc(src.number)} · ${esc(src.workName || src.clientName)}</p>
        ${src.items.length ? `<button class="chip-act ghost" type="button" data-all style="margin-top:8px"></button><div class="rows imp-list">${src.items.map((it) => `<button class="prow imp-pick" type="button" data-it="${esc(it.id)}"><span class="imp-box">${icon('check', 14)}</span><span class="grow"><b>${esc(it.description)}</b><small>${esc(it.code || it.category || '')} · ${esc(OC.num(it.quantity))} ${esc(it.unit)}</small></span></button>`).join('')}</div>` : '<div class="empty">Esta proposta não tem itens.</div>'}
        <div class="sheet-actions"><button class="btn2" type="button" data-back>Voltar</button><button class="btn" type="button" data-yes></button></div>`;
      const yes = OC.$('[data-yes]', body), all = OC.$('[data-all]', body);
      const paint = () => {
        OC.$$('[data-it]', body).forEach((r) => r.setAttribute('aria-pressed', String(chosen.has(r.dataset.it))));
        if (all) all.textContent = chosen.size === src.items.length ? 'Desmarcar todos' : 'Marcar todos';
        yes.textContent = chosen.size ? `Copiar ${chosen.size} ${chosen.size === 1 ? 'item' : 'itens'}` : 'Copiar';
        yes.disabled = !chosen.size;
      };
      OC.$$('[data-it]', body).forEach((r) => r.addEventListener('click', () => { if (chosen.has(r.dataset.it)) chosen.delete(r.dataset.it); else chosen.add(r.dataset.it); paint(); }));
      if (all) all.addEventListener('click', () => { if (chosen.size === src.items.length) chosen.clear(); else src.items.forEach((it) => chosen.add(it.id)); paint(); });
      OC.$('[data-back]', body).addEventListener('click', step1);
      yes.addEventListener('click', async () => {
        yes.disabled = true;
        try {
          const data = await OC.api(`/proposals/${p.id}/items/copy-from-proposal`, { method: 'POST', body: { sourceProposalId: src.id, itemIds: [...chosen] } });
          done(ctx, s, data, `${chosen.size} ${chosen.size === 1 ? 'item copiado' : 'itens copiados'} de ${src.number}`);
        } catch (error) { OC.toast(error.message, 'warning-circle'); yes.disabled = false; }
      });
      paint();
    }
    OC.loadProposals().then((all) => { list = all.filter((x) => x.id !== p.id); step1(); })
      .catch((error) => { body.innerHTML = `<div class="empty">${esc(error.message)}</div>`; });
  }

  function kitSheet(p, ctx) {
    const s = OC.sheet(`${OC.sheetHead('Aplicar kit', 'stack')}<label class="search">${icon('magnifying-glass', 18)}<input data-q type="search" placeholder="Buscar kit" autocomplete="off"></label><div class="rows" data-rows><div class="empty">Carregando kits…</div></div>`);
    const rows = OC.$('[data-rows]', s.el);
    let kits = [];
    const paint = (q) => {
      const term = q.trim().toLowerCase();
      const shown = kits.filter((k) => !term || `${k.name} ${k.category || ''} ${k.description || ''}`.toLowerCase().includes(term));
      rows.innerHTML = shown.map((k) => `<button class="prow" type="button" data-kit="${esc(k.id)}"><span class="grow"><b>${esc(k.name)}</b><small>${k.itemCount} ${k.itemCount === 1 ? 'item' : 'itens'}${k.description ? ` · ${esc(k.description)}` : ''}</small></span>${icon('plus', 18)}</button>`).join('')
        || `<div class="empty">${kits.length ? 'Nenhum kit com esse nome.' : 'Nenhum kit cadastrado.'}</div>`;
    };
    OC.$('[data-q]', s.el).addEventListener('input', (event) => paint(event.target.value));
    rows.addEventListener('click', (event) => {
      const b = event.target.closest('[data-kit]');
      if (!b) return;
      const kit = kits.find((k) => k.id === b.dataset.kit);
      if (!kit.itemCount) { OC.toast('O kit está sem itens.', 'warning-circle'); return; }
      OC.confirm(`Aplicar ${kit.name}`, `${kit.itemCount} ${kit.itemCount === 1 ? 'item entra' : 'itens entram'} nesta proposta com o BDI dela.`, 'Aplicar', async () => {
        const data = await OC.api(`/kits/${kit.id}/apply-to-proposal`, { method: 'POST', body: { proposalId: p.id } });
        done(ctx, s, data, 'Kit aplicado na proposta');
      });
    });
    OC.api('/kits').then((d) => { kits = (d.kits || []).filter((k) => k.active !== false); paint(''); })
      .catch((error) => { rows.innerHTML = `<div class="empty">${esc(error.message)}</div>`; });
  }
})(window.OC = window.OC || {});
