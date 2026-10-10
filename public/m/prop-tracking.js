// Proposta no celular: clonar (POST /:id/clone, CloneProposalDialog.tsx), acompanhamento orcado x realizado do Centro
// (GET /:id/center-tracking, CenterTrackingCard.tsx, so p10) e JSON de integracao, o plano B para o Centro de Custos
// (POST /:id/integration-export, ProposalSyncDirectAction.tsx, p11 e p10 como no computador).
(function (OC) {
  const { esc, icon } = OC;
  const cents = (v) => OC.money((Number(v) || 0) / 100);
  const STATUS = { planejamento: 'Planejamento', execucao: 'Em execução', pausado: 'Pausada', concluido: 'Concluída' };
  const when = (iso) => {
    const d = iso ? new Date(String(iso).includes('T') ? iso : String(iso).replace(' ', 'T')) : null;
    return d && !Number.isNaN(d.getTime()) ? `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '';
  };

  // ===== Clonar: proposta nova (proximo numero, REV 00, em edicao) com itens, mao de obra, BDI e condicoes.
  OC.cloneSheet = function (p) {
    let mode = 'same', clientId = '', workId = '', q = '', clients = [], seq = 0;
    const s = OC.sheet(`${OC.sheetHead('Clonar proposta', 'copy')}<p class="sheet-text" style="margin-top:2px">Origem: ${esc(p.number)} · ${esc(OC.rev(p.revision))}</p>
      <div class="opts" style="margin-top:12px">
        <button class="opt" type="button" data-mode="same"><span><b>Mesmo cliente e obra</b><small>${esc(p.clientName || '')} · ${esc(p.workName || '')}</small></span><i class="radio"></i></button>
        <button class="opt" type="button" data-mode="other"><span><b>Outro cliente ou obra</b><small>Os mesmos itens para outro destinatário</small></span><i class="radio"></i></button></div>
      <div data-other hidden><label class="search">${icon('magnifying-glass', 18)}<input data-q type="search" placeholder="Buscar cliente ou obra" autocomplete="off"></label><div data-rows></div></div>
      <label class="field" style="margin-top:12px"><span>Escopo da nova proposta</span><textarea data-scope rows="3" maxlength="1200" placeholder="Ex.: Instalação de CFTV e controle de acesso">${esc(p.scope || '')}</textarea></label>
      <p class="sheet-text">Entram os itens com o custo congelado, a mão de obra, o BDI, os impostos e as condições da origem. A origem não muda.</p>
      <div class="sheet-actions"><button class="btn2" type="button" data-no>Cancelar</button><button class="btn" type="button" data-yes>${icon('copy', 18)}Criar proposta</button></div>`);
    const other = OC.$('[data-other]', s.el), rows = OC.$('[data-rows]', s.el), yes = OC.$('[data-yes]', s.el);
    const paintRows = () => {
      const term = q.trim().toLowerCase();
      rows.innerHTML = clients.map((c) => {
        const name = c.tradeName || c.legalName;
        const works = (c.works || []).filter((w) => w.active !== false && (!term || `${name} ${w.name}`.toLowerCase().includes(term)));
        if (term && !works.length && !name.toLowerCase().includes(term)) return '';
        return `<p class="sheet-sec">${esc(name)}</p><div class="rows">${works.map((w) => `<button class="prow" type="button" data-c="${esc(c.id)}" data-w="${esc(w.id)}" aria-pressed="${w.id === workId}"><span class="grow"><b>${esc(w.name)}</b><small>${esc(w.address || 'Endereço não informado')}</small></span>${w.id === workId ? '<span class="tag">Selecionada</span>' : ''}</button>`).join('')}
          <button class="chip-act ghost cl-new" type="button" data-new="${esc(c.id)}">${icon('plus', 16)}Nova obra</button></div>`;
      }).join('') || '<div class="empty">Nenhum cliente ou obra encontrado.</div>';
    };
    const load = async () => {
      const mine = ++seq;
      rows.innerHTML = '<div class="empty">Carregando clientes…</div>';
      try {
        const list = (await OC.api('/clients')).clients || [];
        if (mine === seq) { clients = list; paintRows(); }
      } catch (error) { if (mine === seq) rows.innerHTML = `<div class="empty">${esc(error.message)}</div>`; }
    };
    const paint = () => {
      OC.$$('[data-mode]', s.el).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
      other.hidden = mode !== 'other';
      if (mode === 'other' && !clients.length) load();
    };
    OC.$$('[data-mode]', s.el).forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; paint(); }));
    OC.$('[data-q]', s.el).addEventListener('input', (event) => { q = event.target.value; paintRows(); });
    rows.addEventListener('click', (event) => {
      const w = event.target.closest('[data-w]');
      if (w) { clientId = w.dataset.c; workId = w.dataset.w; paintRows(); return; }
      const n = event.target.closest('[data-new]');
      if (n) OC.ask('Nova obra', 'Nome da obra', 'Ex.: Sede, Filial Centro', async (name) => {
        const data = await OC.api(`/clients/${n.dataset.new}/works`, { method: 'POST', body: { name, address: null } });
        clientId = n.dataset.new; workId = data.workId;
        if (data.clients) clients = data.clients;
        paintRows();
        OC.toast('Obra cadastrada e selecionada');
      });
    });
    OC.$('[data-no]', s.el).addEventListener('click', s.close);
    yes.addEventListener('click', async () => {
      const scope = OC.$('[data-scope]', s.el).value.trim();
      if (scope.length < 3) { OC.toast('Informe o escopo com pelo menos 3 letras.', 'warning-circle'); return; }
      if (mode === 'other' && !workId) { OC.toast('Escolha a obra da nova proposta.', 'warning-circle'); return; }
      yes.disabled = true;
      try {
        const body = mode === 'other' ? { clientId, workId, scope } : { scope };
        const data = await OC.api(`/proposals/${p.id}/clone`, { method: 'POST', body });
        s.close();
        OC.toast(`${data.proposal.number} criada a partir de ${p.number}`);
        OC.go('prop', { id: data.proposal.id, tab: 'resumo' }, { back: true });
      } catch (error) { OC.toast(error.message, 'warning-circle'); yes.disabled = false; }
    });
    paint();
  };

  // ===== Acompanhamento da obra (somente leitura; a fonte e o Centro de Custos). Valores em centavos.
  OC.trackingCard = async function (p, body) {
    if (p.status !== 'approved' || !p.costCenterId || !OC.can('p10')) return;
    const stamp = body.dataset.stamp;
    const card = document.createElement('section');
    card.className = 'card trk';
    card.setAttribute('aria-label', 'Acompanhamento da obra');
    const anchor = OC.$(':scope > .hint', body);
    const paint = async () => {
      card.innerHTML = `<div class="trk-head"><b>${icon('trend-up', 18)}Orçado × realizado</b><button class="chip-act ghost" type="button" disabled>${icon('circle-notch', 16, 'rot')}Atualizando</button></div>`;
      let t;
      try { t = await OC.api(`/proposals/${encodeURIComponent(p.id)}/center-tracking`); } catch (error) { t = { error: error.message }; }
      if (!body.isConnected || body.dataset.stamp !== stamp) return;
      if (!t.error && !t.integrated) { card.remove(); return; }
      const sm = t.summary, b = sm && sm.baseline;
      const pct = Math.max(0, Number(sm && sm.realizedPercent) || 0);
      card.innerHTML = `<div class="trk-head"><b>${icon('trend-up', 18)}Orçado × realizado</b><button class="chip-act ghost" type="button" data-trk>${icon('arrow-counter-clockwise', 16)}Atualizar</button></div>
        ${t.error ? `<p class="trk-msg">${esc(t.error)}</p>` : ''}
        ${!t.error && !sm ? '<p class="trk-msg">Sem dados do Centro de Custos ainda. Tente atualizar com conexão.</p>' : ''}
        ${sm && !sm.hasBudget ? `<p class="trk-msg">Obra ${esc(STATUS[sm.costCenterStatus] || sm.costCenterStatus)}, sem orçamento base vigente no Centro de Custos.</p>` : ''}
        ${sm && sm.hasBudget && b ? `<div class="kv"><span>Situação</span><b>${esc(STATUS[sm.costCenterStatus] || sm.costCenterStatus)}</b></div>
          <div class="kv"><span>Contrato (base v${esc(b.version)})</span><b>${esc(cents(b.contractValueCents))}</b></div>
          <div class="kv"><span>Custo orçado</span><b>${esc(cents(b.baseCostCents))}</b></div>
          <div class="kv"><span>Realizado</span><b>${esc(cents(sm.realizedCents))} · ${esc(OC.pct(pct))}</b></div>
          <div class="trk-bar${sm.overBudget ? ' over' : ''}" role="img" aria-label="Realizado ${esc(OC.pct(pct))} do custo orçado"><i style="width:${Math.min(100, pct)}%"></i></div>
          <div class="kv"><span>Saldo</span><b>${esc(cents(sm.balanceCents))}</b></div>` : ''}
        ${sm && sm.overBudget ? `<p class="trk-warn" role="alert">${icon('warning-circle', 16)}O realizado passou do custo orçado.</p>` : ''}
        ${sm && sm.unlinkedExpenseCents ? `<p class="trk-msg">${esc(cents(sm.unlinkedExpenseCents))} em gastos ainda não vinculados a insumos do orçamento.</p>` : ''}
        ${t.fetchedAt ? `<p class="trk-msg">${t.stale ? `Sem conexão com o Centro de Custos. Dados de ${esc(when(t.fetchedAt))}.` : `Atualizado em ${esc(when(t.fetchedAt))}.`}</p>` : ''}`;
      OC.$('[data-trk]', card).addEventListener('click', paint);
    };
    if (anchor) anchor.before(card); else body.appendChild(card);
    await paint();
  };

  // ===== JSON de integracao: arquivo para levar ao Centro de Custos quando a geracao direta falhar.
  OC.canExportIntegration = (p) => p.status === 'approved' && OC.canEdit() && OC.can('p11') && OC.can('p10');
  OC.exportIntegration = async function (p) {
    OC.toast('Preparando o arquivo…', 'circle-notch');
    let envelope;
    try { envelope = await OC.api(`/proposals/${encodeURIComponent(p.id)}/integration-export`, { method: 'POST', body: {} }); } catch (error) { OC.toast(error.message, 'warning-circle'); return; }
    const name = `${p.number}-REV${String(p.revision || 0).padStart(2, '0')}.construtec.json`;
    const file = new File([JSON.stringify(envelope, null, 2)], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return; } catch (error) { if (error && error.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    OC.toast(`${name} baixado`, 'download-simple');
  };
})(window.OC = window.OC || {});
