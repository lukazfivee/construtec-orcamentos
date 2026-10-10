// Edicao da proposta no celular, com as mesmas regras e rotas do computador: editar e remover item, linha em branco
// (ProposalItemEditSheet.tsx, useProposalItemActions.ts), situacao (ProposalMetaBar.tsx, src/shared/proposalStatus.ts),
// cliente e obra (PATCH /context) e nova revisao. Custo do item so com p10; enviar, aprovar, reabrir e revisao so com p11.
(function (OC) {
  const { esc, icon } = OC;
  const parse = (v) => Number(String(v).trim().replace(/\./g, '').replace(',', '.'));
  // Sem ctx (menu de tres pontos): recarrega a proposta.
  const ctxOf = OC.propCtx = (p, ctx) => ctx || { reload: () => OC.go('prop', { id: p.id }, { back: true }), update: () => OC.go('prop', { id: p.id }, { back: true }) };
  const actions = (no, yes) => `<div class="sheet-actions"><button class="btn2" type="button" data-no>${no}</button><button class="btn" type="button" data-yes>${yes}</button></div>`;

  // Editar item: descricao, quantidade, unidade, venda unitaria (com imposto, como na tela) e custo (so p10).
  OC.itemSheet = function (p, itemId, ctx) {
    const it = p.items.find((x) => x.id === itemId);
    if (!it) return;
    const cost = OC.can('p10');
    const s = OC.sheet(`${OC.sheetHead(it.code ? `Item ${it.code}` : 'Item fora do catálogo', 'pencil-simple')}
      <label class="field" style="margin-top:12px"><span>Descrição</span><input id="it-desc" type="text" maxlength="240" value="${esc(it.description)}" autocomplete="off"></label>
      <div class="field-row"><label class="field"><span>Quantidade</span><input id="it-qty" type="text" inputmode="decimal" value="${esc(OC.num(it.quantity))}"></label>
        <label class="field"><span>Unidade</span><input id="it-unit" type="text" maxlength="24" value="${esc(it.unit)}" autocomplete="off"></label></div>
      <div class="field-row">${cost ? `<label class="field"><span>Custo unit. (R$)</span><input id="it-cost" type="text" inputmode="decimal" value="${esc(OC.dec2(it.unitCost))}"></label>` : ''}
        <label class="field"><span>Venda unit. (R$)</span><input id="it-sale" type="text" inputmode="decimal" value="${esc(OC.dec2(it.unitSale))}"></label></div>
      <p class="sheet-text">${cost ? 'Venda com imposto, como aparece no PDF. Mudar só o custo recalcula a venda quando ela segue o BDI.' : 'Venda com imposto, como aparece no PDF.'}</p>
      <button class="btn2 danger-btn" type="button" data-del style="width:100%;margin-top:14px">${icon('trash', 18)}Remover item</button>
      ${actions('Cancelar', 'Salvar')}`);
    OC.$('[data-no]', s.el).addEventListener('click', s.close);
    OC.$('[data-del]', s.el).addEventListener('click', () => { s.close(); OC.removeItem(p, it, ctx); });
    OC.$('[data-yes]', s.el).addEventListener('click', async (event) => {
      const b = event.currentTarget;
      const body = {};
      const description = OC.$('#it-desc', s.el).value.trim(), unit = OC.$('#it-unit', s.el).value.trim();
      const quantity = parse(OC.$('#it-qty', s.el).value), unitSale = parse(OC.$('#it-sale', s.el).value);
      const unitCost = cost ? parse(OC.$('#it-cost', s.el).value) : it.unitCost;
      if (description.length < 2) { OC.toast('Informe uma descrição válida.', 'warning-circle'); return; }
      if (!unit) { OC.toast('Informe uma unidade válida.', 'warning-circle'); return; }
      if (!(quantity > 0 && quantity <= 1000000)) { OC.toast('Informe uma quantidade maior que zero.', 'warning-circle'); return; }
      if (![unitSale, unitCost].every((v) => Number.isFinite(v) && v >= 0 && v <= 100000000)) { OC.toast('Informe um valor válido.', 'warning-circle'); return; }
      if (description !== it.description) body.description = description;
      if (unit !== it.unit) body.unit = unit;
      if (quantity !== Math.round(it.quantity * 100) / 100) body.quantity = quantity;
      if (cost && OC.cents(unitCost) !== OC.cents(it.unitCost)) body.unitCost = unitCost;
      if (OC.cents(unitSale) !== OC.cents(it.unitSale)) body.unitSale = unitSale;
      if (!Object.keys(body).length) { s.close(); return; }
      b.disabled = true;
      try {
        const data = await OC.api(`/proposals/${p.id}/items/${it.id}`, { method: 'PATCH', body });
        s.close();
        OC.toast('Item atualizado');
        ctx.update(data.proposal);
      } catch (error) { OC.toast(error.message, 'warning-circle'); b.disabled = false; }
    });
  };

  OC.removeItem = function (p, it, ctx) {
    OC.confirm('Remover item', `"${it.description}" sai desta proposta. O catálogo não muda.`, 'Remover', async () => {
      const data = await OC.api(`/proposals/${p.id}/items/remove`, { method: 'POST', body: { itemIds: [it.id] } });
      OC.toast('Item removido', 'trash');
      ctx.update(data.proposal);
    });
  };

  // Adicionar: do catalogo ou linha em branco (item fora do catalogo, preenchido em seguida).
  OC.addItemSheet = function (p, ctx) {
    const s = OC.sheet(`${OC.sheetHead('Adicionar item', 'plus')}<div class="opts" style="margin-top:12px">
      <button class="opt" type="button" data-a="cat">${icon('package', 20)}<span><b>Do catálogo</b><small>Busque por código ou descrição</small></span>${icon('caret-right', 18)}</button>
      <button class="opt" type="button" data-a="blank">${icon('file-text', 20)}<span><b>Linha em branco</b><small>Item fora do catálogo, você preenche</small></span>${icon('caret-right', 18)}</button></div>`);
    OC.$('[data-a="cat"]', s.el).addEventListener('click', () => {
      s.close();
      OC.pickProduct('Adicionar do catálogo', async (x) => {
        const res = await OC.api(`/proposals/${p.id}/items`, { method: 'POST', body: { productId: x.id, quantity: 1 } });
        OC.toast('Item adicionado');
        if (res.proposal) ctx.update(res.proposal); else ctx.reload();
      });
    });
    const blank = OC.$('[data-a="blank"]', s.el);
    blank.addEventListener('click', async () => {
      blank.disabled = true;
      try {
        const res = await OC.api(`/proposals/${p.id}/items/blank`, { method: 'POST', body: {} });
        s.close();
        ctx.update(res.proposal);
        const created = res.proposal.items[res.proposal.items.length - 1];
        if (created) OC.itemSheet(res.proposal, created.id, ctx);
      } catch (error) { OC.toast(error.message, 'warning-circle'); blank.disabled = false; }
    });
  };

  // Situacao: as transicoes de src/shared/proposalStatus.ts; enviar e aprovar exigem p11, e reabrir uma enviada ou
  // recusada (voltar para edicao ou revisao) tambem (a rota confere). Aprovada nao muda: so com nova revisao.
  const FLOW = { draft: ['review', 'sent', 'approved', 'rejected'], review: ['draft', 'sent', 'approved', 'rejected'], sent: ['draft', 'review', 'approved', 'rejected'], approved: [], rejected: ['draft', 'review', 'sent', 'approved'] };
  OC.canChangeStatus = (p) => OC.canEdit() && p.isLatest && p.status !== 'approved';
  OC.statusSheet = function (p, ctx) {
    ctx = ctxOf(p, ctx);
    const p11 = OC.can('p11');
    const why = (st) => {
      if (st === p.status) return 'Situação atual';
      if (!FLOW[p.status].includes(st)) return 'Não disponível a partir da situação atual';
      if ((st === 'sent' || st === 'approved') && !p11) return 'Seu papel não permite enviar ou aprovar';
      if ((st === 'draft' || st === 'review') && (p.status === 'sent' || p.status === 'rejected') && !p11) return 'Seu papel não permite reabrir';
      return '';
    };
    const sub = { draft: 'Itens e valores liberados para editar', review: 'Conferência interna antes de enviar', sent: 'O cliente já recebeu a proposta', approved: 'Fica travada e vira a base da obra', rejected: 'Depois dá para criar uma nova revisão' };
    let chosen = p.status;
    const s = OC.sheet(`${OC.sheetHead('Mudar situação', 'arrows-left-right')}<div class="opts" style="margin-top:12px">${Object.keys(FLOW).map((st) => {
      const block = why(st);
      return `<button class="opt" type="button" data-st="${st}"${block && st !== p.status ? ' disabled' : ''}><span><b>${esc(OC.STATUS[st][0])}</b><small>${esc(block || sub[st])}</small></span><i class="radio"></i></button>`;
    }).join('')}</div><p class="sheet-text" data-warn></p>${actions('Cancelar', 'Mudar situação')}`);
    const yes = OC.$('[data-yes]', s.el);
    const paint = () => {
      OC.$$('[data-st]', s.el).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.st === chosen)));
      OC.$('[data-warn]', s.el).textContent = chosen === 'approved' ? 'A proposta aprovada fica travada e vira a base de orçado da obra. Não dá para desfazer.' : '';
      yes.disabled = chosen === p.status;
    };
    OC.$$('[data-st]', s.el).forEach((b) => b.addEventListener('click', () => { chosen = b.dataset.st; paint(); }));
    OC.$('[data-no]', s.el).addEventListener('click', s.close);
    yes.addEventListener('click', async () => {
      yes.disabled = true;
      try {
        await OC.api(`/proposals/${p.id}/status`, { method: 'PATCH', body: { status: chosen } });
        s.close();
        OC.toast(`Situação alterada para "${OC.STATUS[chosen][0]}"`);
        ctx.reload();
      } catch (error) { OC.toast(error.message, 'warning-circle'); yes.disabled = false; }
    });
    paint();
  };

  // Nova revisao: copia itens, mao de obra e condicoes para a proxima REV, em edicao. A atual fica guardada.
  OC.canCreateRevision = (p) => OC.canEdit() && p.isLatest && OC.can('p11');
  OC.createRevision = function (p) {
    OC.confirm('Criar nova revisão', `Cria a ${OC.rev((p.revision || 0) + 1)} em edição, com os mesmos itens e condições. A ${OC.rev(p.revision)} fica guardada como está.`, 'Criar revisão', async () => {
      const data = await OC.api(`/proposals/${p.id}/revisions`, { method: 'POST', body: {} });
      OC.toast(`${OC.rev(data.proposal.revision)} criada`);
      OC.go('prop', { id: data.proposal.id, tab: 'itens' }, { back: true });
    });
  };

  // Cliente e obra desta revisao (so obras ativas), como o seletor do computador.
  OC.contextSheet = function (p, ctx) {
    ctx = ctxOf(p, ctx);
    const s = OC.sheet(`${OC.sheetHead('Cliente e obra', 'buildings')}<p class="sheet-text" style="margin-top:2px">A alteração vale só para esta revisão.</p>
      <label class="search">${icon('magnifying-glass', 18)}<input data-q type="search" placeholder="Buscar cliente, documento ou obra" autocomplete="off"></label>
      <div data-rows><div class="empty">Carregando clientes…</div></div>
      <button class="btn2" type="button" data-cli style="width:100%;margin-top:12px">${icon('users', 18)}Gerenciar clientes</button>`);
    s.el.firstElementChild.classList.add('sheet-tall');
    const rows = OC.$('[data-rows]', s.el);
    let timer = 0, seq = 0;
    const load = async (q) => {
      const mine = ++seq;
      try {
        const clients = (await OC.api(`/clients${q ? `?q=${encodeURIComponent(q)}` : ''}`)).clients || [];
        if (mine !== seq) return;
        rows.innerHTML = clients.map((c) => {
          const works = (c.works || []).filter((w) => w.active !== false);
          return `<p class="sheet-sec">${esc(c.tradeName || c.legalName)}</p><div class="rows">${works.map((w) => `<button class="prow" type="button" data-c="${esc(c.id)}" data-w="${esc(w.id)}"><span class="grow"><b>${esc(w.name)}</b><small>${esc(w.address || 'Endereço não informado')}</small></span>${w.id === p.workId ? '<span class="tag">Selecionada</span>' : icon('caret-right', 18)}</button>`).join('') || '<small class="hint">Nenhuma obra ativa</small>'}</div>`;
        }).join('') || '<div class="empty">Nenhum cliente ou obra encontrado.</div>';
        OC.$$('[data-w]', rows).forEach((b) => b.addEventListener('click', async () => {
          if (b.dataset.w === p.workId) { s.close(); return; }
          b.disabled = true;
          try {
            const data = await OC.api(`/proposals/${p.id}/context`, { method: 'PATCH', body: { clientId: b.dataset.c, workId: b.dataset.w } });
            s.close();
            OC.toast('Cliente e obra atualizados nesta revisão');
            ctx.update(data.proposal);
          } catch (error) { OC.toast(error.message, 'warning-circle'); b.disabled = false; }
        }));
      } catch (error) { if (mine === seq) rows.innerHTML = `<div class="empty">${esc(error.message)}</div>`; }
    };
    OC.$('[data-q]', s.el).addEventListener('input', (event) => { clearTimeout(timer); timer = setTimeout(() => load(event.target.value.trim()), 250); });
    OC.$('[data-cli]', s.el).addEventListener('click', () => { s.close(); OC.open('cli'); });
    load('');
  };
})(window.OC = window.OC || {});
