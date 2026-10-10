// Proposta no celular (prototipo: orcScr 'prop', abas Resumo, Itens e Revisoes).
// Custo, BDI e margem aparecem aqui porque e a tela interna; nunca no PDF do cliente.
(function (OC) {
  const { esc, icon } = OC;
  const STEPS = ['Edição', 'Revisão', 'Enviada', 'Aprovada', 'Obra'];
  const ORDER = ['draft', 'review', 'sent', 'approved'];

  const totals = (p) => {
    const t = p.totals || {};
    const materials = t.materials ?? t.sale ?? 0;
    const labor = t.labor ?? 0;
    const base = t.baseCost ?? (materials + labor);
    return { materials, labor, base, additions: t.additions ?? 0, tax: t.taxAmount ?? 0, final: t.finalValue ?? t.sale ?? 0, margin: t.marginPercent ?? 0 };
  };
  // Mesma regra do computador (ProposalEditorWorkspace): itens e condicoes mudam em edicao ou revisao, so na revisao atual.
  const editable = OC.propEditable = (p) => (p.status === 'draft' || p.status === 'review') && p.isLatest && OC.canEdit();
  // Linha do cartao que vira botao quando ha acao (validade, cliente e obra).
  const kvRow = (key, label, value, on) => (on ? `<button class="kv kv-btn" type="button" data-${key}><span>${label}</span><b>${value}${icon('pencil-simple', 14)}</b></button>` : `<div class="kv"><span>${label}</span><b>${value}</b></div>`);

  const { sheet, sheetHead, confirm: confirmSheet } = OC;

  // Proximo passo da proposta, pelas regras do prototipo; o servidor confere a transicao.
  function nextStep(p, ctx) {
    if (!OC.canEdit()) return { hint: 'Seu acesso é só para consulta.' };
    if (!p.isLatest) return { hint: `Esta é uma revisão antiga (${OC.rev(p.revision)}).` };
    const sends = p.status === 'review' || p.status === 'sent' || (p.status === 'approved' && !p.costCenterId);
    if (sends && !(OC.can('p11') && OC.can('p10'))) return { hint: 'Seu papel não permite enviar ou aprovar propostas.' };
    const status = (s, msg) => async () => { await OC.api(`/proposals/${p.id}/status`, { method: 'PATCH', body: { status: s } }); OC.toast(msg); ctx.reload(); };
    if (p.status === 'draft' && p.items.length) return { hint: 'Próximo passo: revisão interna do orçamento', prim: ['Enviar para revisão', 'paper-plane-tilt', status('review', 'Enviada para revisão interna')] };
    if (p.status === 'draft') return { hint: 'A proposta ainda não tem itens', prim: ['Adicionar itens', 'plus', () => ctx.tab('itens')] };
    if (p.status === 'review') return { hint: 'Gere o PDF do cliente e envie. Custo, BDI e margem não aparecem nele.', prim: ['Gerar PDF e enviar', 'paper-plane-tilt', () => OC.open('pdf', { id: p.id })], sec: ['Só marcar enviada', () => confirmSheet('Marcar como enviada', 'Use quando o PDF já foi mandado ao cliente por outro caminho.', 'Marcar enviada', status('sent', 'Proposta marcada como enviada'))] };
    if (p.status === 'sent') {
      return {
        hint: 'Resposta do cliente',
        prim: ['Registrar aprovação', 'check', () => confirmSheet('Registrar aprovação', 'A proposta aprovada fica travada e vira a base de orçado da obra. Não dá para desfazer.', 'Aprovar', status('approved', 'Proposta aprovada pelo cliente'))],
        sec: ['Recusada', () => confirmSheet('Marcar como recusada', 'Depois você pode criar uma nova revisão para renegociar.', 'Marcar recusada', status('rejected', 'Proposta marcada como recusada'))],
      };
    }
    if (p.status === 'approved' && !p.costCenterId) {
      return { hint: 'O orçamento aprovado vira a base de orçado × gasto da obra', prim: ['Gerar Centro de Custo', 'buildings', () => confirmSheet('Gerar Centro de Custo', 'Cria a obra no Centro de Custos com este orçamento como base.', 'Gerar', async () => {
        const result = await OC.api(`/proposals/${p.id}/direct-sync`, { method: 'POST', body: {} });
        if (!result.ok) throw new Error(result.message || result.error || 'Não foi possível gerar agora.');
        OC.toast(result.status === 'already_imported' ? 'A obra já existia no Centro de Custos' : 'Centro de Custo criado');
        ctx.reload();
      })] };
    }
    if (p.status === 'approved') return { hint: 'Obra em andamento no Centro de Custos', link: ['Abrir obra no Centro de Custos', 'arrow-square-out', OC.suite.centroLink(p.costCenterId)] };
    if (p.status === 'rejected') {
      if (!OC.can('p11')) return { hint: 'Recusada. Seu papel não permite criar revisão.' };
      return { hint: 'Recusada: crie uma revisão para renegociar', prim: ['Criar nova revisão', 'copy', () => OC.createRevision(p)] };
    }
    return {};
  }

  function resumo(p, ctx) {
    const t = totals(p);
    const cost = OC.can('p10');
    const cur = p.status === 'approved' ? (p.costCenterId ? 5 : 4) : ORDER.indexOf(p.status);
    const days = OC.daysUntil(p.validUntil);
    const next = nextStep(p, ctx);
    const stepper = `<div class="steps" style="--p:${Math.min(Math.max(cur, 0), 4) / 4}">${STEPS.map((l, i) => `<span class="step${i < cur ? ' done' : ''}${i === cur ? ' cur' : ''}"><i></i>${l}</span>`).join('')}</div>`;
    const actions = next.prim || next.link || next.sec ? `<div class="actions">${next.sec ? `<button class="btn2" type="button" data-sec>${esc(next.sec[0])}</button>` : ''}
      ${next.prim ? `<button class="btn" type="button" data-prim>${icon(next.prim[1], 18)}${esc(next.prim[0])}</button>` : ''}
      ${next.link ? `<a class="btn" href="${esc(next.link[2])}"${/SuiteConstrutec\//.test(navigator.userAgent) ? '' : ' target="_blank" rel="noopener"'} style="text-decoration:none">${icon(next.link[1], 18)}${esc(next.link[0])}</a>` : ''}</div>` : '';
    return {
      html: `${stepper}
        <div class="card"><div class="kv top-kv"><span><small>Valor final</small><b class="big">${esc(OC.money0(t.final))}</b></span>
          ${cost ? `<span class="right"><small>Margem</small><b>${esc(OC.pct(t.margin))}</b></span>` : ''}</div>
          ${cost ? `<div class="kv"><span>Materiais</span><b>${esc(OC.money0(t.materials))}</b></div>
          <div class="kv"><span>Mão de obra</span><b>${esc(OC.money0(t.labor))}</b></div>
          <div class="kv sep"><span class="strong">Custo base</span><b>${esc(OC.money0(t.base))}</b></div>
          <div class="kv"><span>+ BDI ${esc(OC.dec2(p.bdiMultiplier))} ×</span><b>${esc(OC.money0(t.additions))}</b></div>` : ''}
          <div class="kv"><span>+ Impostos ${esc(OC.dec2(p.taxPercentage || 0))}%</span><b>${esc(OC.money0(t.tax))}</b></div></div>
        <button class="card tile-card" type="button" data-pdf><span class="tile">${icon('file-text', 21)}</span><span class="grow"><b>PDF da proposta</b><small>${p.items.length ? 'Pré-visualizar, baixar e compartilhar' : 'Adicione itens para gerar o PDF'}</small></span>${icon('caret-right', 18)}</button>
        <div class="card">
          ${kvRow('val', 'Validade', p.validUntil ? `${esc(OC.dateFull(p.validUntil))}${days !== null ? ` · ${days < 0 ? 'vencida' : `${days} ${days === 1 ? 'dia' : 'dias'}`}` : ''}` : 'Sem validade', OC.canEdit() && p.isLatest)}
          ${kvRow('ctx', 'Cliente', esc(p.clientName), editable(p))}
          ${kvRow('ctx', 'Obra', esc(p.workName || '—'), editable(p))}
          <div class="kv"><span>Responsável</span><b>${esc(p.responsibleName || '')}</b></div>
          <div class="kv"><span>Itens</span><b>${p.items.length} ${p.items.length === 1 ? 'item' : 'itens'}</b></div></div>
        ${OC.condCard(p, editable(p))}
        ${next.hint ? `<p class="hint">${esc(next.hint)}</p>` : ''}${actions}`,
      bind(el) {
        OC.$('[data-pdf]', el).addEventListener('click', () => OC.open('pdf', { id: p.id }));
        if (next.prim) OC.$('[data-prim]', el).addEventListener('click', async (event) => {
          const b = event.currentTarget; b.disabled = true;
          try { await next.prim[2](); } catch (error) { OC.toast(error.message, 'warning-circle'); } finally { b.disabled = false; }
        });
        if (next.sec) OC.$('[data-sec]', el).addEventListener('click', () => next.sec[1]());
        OC.$$('[data-val]', el).forEach((b) => b.addEventListener('click', () => OC.validitySheet(p, ctx)));
        OC.$$('[data-ctx]', el).forEach((b) => b.addEventListener('click', () => OC.contextSheet(p, ctx)));
        OC.$$('[data-cond]', el).forEach((b) => b.addEventListener('click', () => OC.conditionsSheet(p, ctx)));
      },
    };
  }

  function itens(p, ctx) {
    const t = totals(p);
    const can = editable(p);
    const labor = p.laborItems || [];
    const cost = OC.can('p10');
    return {
      html: `${cost ? `<button class="card labor-card" type="button" data-labor>${icon('hard-hat', 20)}<span class="grow"><b>Mão de obra · ${labor.length} ${labor.length === 1 ? 'função' : 'funções'}</b><small>Salário, encargos e horas</small></span><b>${esc(OC.money0(t.labor))}</b>${icon('caret-right', 18)}</button>` : ''}
        <div class="sec-row"><span class="label">Materiais e equipamentos · ${p.items.length}</span>${cost ? `<span class="label">${esc(OC.money0(t.materials))}</span>` : ''}</div>
        <div class="items">${p.items.length ? p.items.map((it) => `<div class="item" data-item="${esc(it.id)}">
            <div class="item-top"><b>${esc(it.description)}</b><b class="val">${esc(OC.money0(it.totalSale))}</b></div>
            <small>${esc(it.code || it.category || '')} · ${esc(OC.money(it.unitSale))}/${esc(it.unit)}</small>
            ${can ? `<div class="qty qty-del"><button class="qbtn" type="button" data-dec aria-label="Diminuir">${icon('minus', 18)}</button>
              <label class="qval"><input type="text" inputmode="decimal" value="${esc(OC.num(it.quantity))}" aria-label="Quantidade de ${esc(it.description)}"><span>${esc(it.unit)}</span>${icon('pencil-simple', 14)}</label>
              <button class="qbtn" type="button" data-inc aria-label="Aumentar">${icon('plus', 18)}</button>
              <button class="qbtn" type="button" data-edit aria-label="Editar ou remover ${esc(it.description)}">${icon('dots-three-vertical', 18)}</button></div>`
              : `<small class="qty-ro">${esc(OC.num(it.quantity))} ${esc(it.unit)}</small>`}</div>`).join('')
          : `<div class="empty">${icon('package', 28)}Nenhum item ainda.</div>`}</div>
        <div class="actions total-bar"><div class="tb-top"><small>Valor final${cost ? ` · BDI ${esc(OC.dec2(p.bdiMultiplier))}` : ''} · imp. ${esc(OC.dec2(p.taxPercentage || 0))}%</small></div>
          <div class="tb-mid"><b class="big">${esc(OC.money0(t.final))}</b>${cost ? `<small>Margem ${esc(OC.pct(t.margin))}</small>` : ''}</div>
          ${can ? `<div class="tb-btns">${cost ? `<button class="btn2" type="button" data-bdi>${icon('percent', 18)}BDI e impostos</button>` : ''}<button class="btn" type="button" data-add>${icon('plus', 18)}Adicionar</button></div>` : ''}</div>`,
      bind(el) {
        const laborButton = OC.$('[data-labor]', el);
        if (laborButton) laborButton.addEventListener('click', () => OC.open('labor', { id: p.id }));
        if (!can) return;
        const timers = {};
        const save = (id, quantity) => {
          clearTimeout(timers[id]);
          timers[id] = setTimeout(async () => {
            try {
              const data = await OC.api(`/proposals/${p.id}/items/${id}`, { method: 'PATCH', body: { quantity } });
              ctx.update(data.proposal);
            } catch (error) { OC.toast(error.message, 'warning-circle'); ctx.reload(); }
          }, 500);
        };
        OC.$$('[data-item]', el).forEach((row) => {
          const id = row.dataset.item, input = OC.$('input', row);
          const current = () => { const n = Number(String(input.value).replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
          const set = (n) => { const v = Math.max(0.01, Math.round(n * 100) / 100); input.value = OC.num(v); save(id, v); };
          OC.$('[data-dec]', row).addEventListener('click', () => set(Math.max(1, current() - 1)));
          OC.$('[data-inc]', row).addEventListener('click', () => set(current() + 1));
          input.addEventListener('change', () => { if (current() > 0) set(current()); else ctx.reload(); });
          OC.$('[data-edit]', row).addEventListener('click', () => OC.itemSheet(p, id, ctx));
        });
        const bdiButton = OC.$('[data-bdi]', el);
        if (bdiButton) bdiButton.addEventListener('click', () => bdiSheet(p, ctx));
        OC.$('[data-add]', el).addEventListener('click', () => OC.addItemSheet(p, ctx));
      },
    };
  }

  function bdiSheet(p, ctx) {
    const s = sheet(`${sheetHead('BDI e impostos', 'percent')}
      <label class="field"><span>Multiplicador BDI</span><input id="b-bdi" type="text" inputmode="decimal" value="${esc(OC.dec2(p.bdiMultiplier))}"></label>
      <label class="field" style="margin-top:12px"><span>Impostos (%)</span><input id="b-tax" type="text" inputmode="decimal" value="${esc(OC.dec2(p.taxPercentage || 0))}"></label>
      <p class="sheet-text">Esses valores não aparecem no PDF do cliente.</p>
      <div class="sheet-actions"><button class="btn2" type="button" data-no>Cancelar</button><button class="btn" type="button" data-yes>Salvar</button></div>`);
    const parse = (v) => Number(String(v).replace(/\./g, '').replace(',', '.'));
    OC.$('[data-no]', s.el).addEventListener('click', s.close);
    OC.$('[data-yes]', s.el).addEventListener('click', async (event) => {
      const bdi = parse(OC.$('#b-bdi', s.el).value), tax = parse(OC.$('#b-tax', s.el).value);
      if (!(bdi > 0 && bdi <= 100) || !(tax >= 0 && tax <= 100)) { OC.toast('Confira os valores digitados.', 'warning-circle'); return; }
      event.currentTarget.disabled = true;
      try {
        await OC.api(`/proposals/${p.id}/bdi`, { method: 'PATCH', body: { bdiMultiplier: bdi } });
        const data = await OC.api(`/proposals/${p.id}/tax`, { method: 'PATCH', body: { taxPercentage: tax } });
        s.close();
        OC.toast('BDI e impostos atualizados');
        if (data.proposal) ctx.update(data.proposal); else ctx.reload();
      } catch (error) { OC.toast(error.message, 'warning-circle'); event.currentTarget.disabled = false; }
    });
  }

  async function revisoes(p) {
    const data = await OC.api(`/proposals/${p.id}/history`);
    const list = data.revisions || [];
    return {
      html: `${OC.cmpCard ? OC.cmpCard(list, p.id) : ''}<div class="timeline">${list.map((r) => `<button class="rev${r.id === p.id ? ' cur' : ''}" type="button" data-rev="${esc(r.id)}">
          <i class="dot"></i><span class="grow"><span class="rev-top"><b>${esc(OC.rev(r.revision))}</b>${OC.pill(r.status)}${r.isLatest ? '<span class="tag">Atual</span>' : ''}</span>
          <small>${r.itemCount} ${r.itemCount === 1 ? 'item' : 'itens'} · ${esc(r.responsibleName || '')} · ${esc(OC.dateFull(r.updatedAt))}</small></span>
          <b class="val">${r.totalSale ? esc(OC.money0(r.totalSale)) : 'Sem itens'}</b></button>`).join('')}</div>
`,
      bind(el) {
        const cmp = OC.$('[data-cmp]', el);
        if (cmp) cmp.addEventListener('click', () => OC.open('cmp', { id: p.id }, { tab: 'revisoes' }));
        OC.$$('[data-rev]', el).forEach((b) => b.addEventListener('click', () => { if (b.dataset.rev !== p.id) OC.go('prop', { id: b.dataset.rev, tab: 'resumo' }, { back: true }); }));
      },
    };
  }

  OC.screens.prop = async function (params) {
    let p = (await OC.api(`/proposals/${encodeURIComponent(params.id)}`)).proposal;
    let tab = params.tab || 'resumo';
    const el = OC.render(`${OC.header(p.number, { back: true, extra: `<button class="bell-btn" type="button" data-pdf-top aria-label="PDF da proposta">${icon('file-text', 22)}</button><button class="bell-btn" type="button" data-dots aria-label="Mais ações da proposta">${icon('dots-three-vertical', 22)}</button>` })}
      <div class="prop-tags"><span class="tag">${esc(OC.rev(p.revision))}</span><button class="pill-btn" type="button" id="p-pill" aria-label="Mudar situação da proposta"></button><span class="prop-work">${esc(p.workName || p.clientName)}</span></div>
      <div class="seg" id="p-tabs">${[['resumo', 'Resumo'], ['itens', 'Itens'], ['revisoes', 'Revisões']].map(([k, l]) => `<button type="button" data-tab="${k}">${l}</button>`).join('')}</div>
      <div id="p-body" class="p-body"></div>`, true, params);
    if (p.costCenterId) OC.suite.context = { obra: { id: p.costCenterId, nome: p.workName } };
    const ctx = {
      tab: (k) => { tab = k; paint(); },
      reload: () => OC.go('prop', { id: p.id, tab }, { back: true }),
      update: (next) => { p = next; paint(); },
    };
    async function paint() {
      const pill = OC.$('#p-pill', el);
      pill.innerHTML = `${OC.pill(p.status)}${OC.canChangeStatus(p) ? icon('caret-down', 14) : ''}`;
      pill.disabled = !OC.canChangeStatus(p);
      OC.$('.prop-work', el).textContent = p.workName || p.clientName;
      OC.$$('[data-tab]', el).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
      const body = OC.$('#p-body', el);
      const nav = OC.nav;
      const view = tab === 'itens' ? itens(p, ctx) : (tab === 'revisoes' ? await revisoes(p) : resumo(p, ctx));
      if (nav !== OC.nav) return;
      body.innerHTML = view.html;
      body.dataset.stamp = String((Number(body.dataset.stamp) || 0) + 1);
      view.bind(body);
      if (tab !== 'revisoes' && OC.driftBanner) OC.driftBanner(p, ctx, body);
      if (tab === 'resumo' && OC.linkCard) OC.linkCard(p, ctx, body);
      history.replaceState(null, '', `#prop=${encodeURIComponent(p.id)}`);
    }
    OC.$$('[data-tab]', el).forEach((b) => b.addEventListener('click', () => ctx.tab(b.dataset.tab)));
    OC.$('[data-pdf-top]', el).addEventListener('click', () => OC.open('pdf', { id: p.id }));
    OC.$('[data-dots]', el).addEventListener('click', () => OC.propMenu(p));
    OC.$('#p-pill', el).addEventListener('click', () => OC.statusSheet(p, ctx));
    await paint();
    // Vindo do aviso de validade no Inicio: abre a validade direto.
    if (params.acao === 'validade' && params.__nav === OC.nav) OC.validitySheet(p, ctx);
  };
})(window.OC = window.OC || {});
