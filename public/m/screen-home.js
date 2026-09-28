// Inicio e lista de propostas do Orcamentos no celular (prototipo: sOrcHome e sOrcProps).
(function (OC) {
  const { esc, icon } = OC;
  const NEG = ['draft', 'review', 'sent'];
  const GROUPS = { and: (p) => NEG.includes(p.status), apr: (p) => p.status === 'approved', rec: (p) => p.status === 'rejected' };
  const place = (p) => [p.workName, p.clientName].filter(Boolean)[0] || p.number;
  const meta = (p) => `${p.number} · ${OC.rev(p.revision)}`;

  OC.loadProposals = async () => (await OC.api('/proposals')).proposals || [];

  // O que precisa de acao, na ordem do prototipo: aprovada sem obra, validade, revisao, edicao.
  function tasks(list) {
    const out = [];
    list.forEach((p) => {
      const value = p.totalSale ? OC.money0(p.totalSale) : '';
      if (p.status === 'approved' && p.syncStatus !== 'delivered') {
        out.push({ rank: 0, ic: 'buildings', t: 'Aprovada sem Centro de Custo', s: `${place(p)} · ${meta(p)}`, v: value, cta: 'Gerar Centro de Custo', id: p.id });
      }
      const days = OC.daysUntil(p.validUntil);
      if (p.status === 'sent' && days !== null && days <= 7) {
        const t = days < 0 ? 'Validade vencida' : (days === 0 ? 'Validade termina hoje' : `Validade termina em ${days} ${days === 1 ? 'dia' : 'dias'}`);
        out.push({ rank: 1, warn: true, ic: 'hourglass-medium', t, s: `${place(p)} · ${p.number} · enviada`, v: value, cta: 'Abrir proposta', id: p.id });
      }
      if (p.status === 'review') out.push({ rank: 2, ic: 'magnifying-glass', t: 'Aguardando revisão', s: `${place(p)} · ${meta(p)}`, v: value, cta: 'Revisar', id: p.id });
      if (p.status === 'draft') {
        const d = OC.daysSince(p.updatedAt);
        const t = !p.itemCount ? 'Proposta sem itens' : (d === 0 ? 'Em edição hoje' : `Em edição há ${d} ${d === 1 ? 'dia' : 'dias'}`);
        out.push({ rank: 3, ic: 'pencil-simple', t, s: `${place(p)} · ${meta(p)}`, v: value, cta: 'Continuar', id: p.id, tab: 'itens' });
      }
    });
    return out.sort((a, b) => a.rank - b.rank);
  }

  OC.screens.home = async function (params) {
    const list = await OC.loadProposals();
    const todo = tasks(list);
    const neg = list.filter(GROUPS.and), apr = list.filter(GROUPS.apr);
    const sum = (rows) => rows.reduce((total, p) => total + (Number(p.totalSale) || 0), 0);
    const user = OC.session.user() || {};
    const title = todo.length ? `${todo.length} ${todo.length > 1 ? 'propostas precisam de ação' : 'proposta precisa de ação'}` : 'Nenhuma proposta pendente';
    const el = OC.render(`${OC.header('')}
      <p class="hello">${esc(OC.greeting())}${user.name ? `, ${esc(OC.firstName(user.name))}` : ''}</p>
      <h1 class="title">${esc(title)}</h1>
      <button class="summary" type="button" id="h-sum" aria-label="Ver propostas em andamento">
        <span><small>Em negociação</small><b>${esc(OC.mi(sum(neg)))}</b></span>
        <span><small>Aprovadas</small><b>${esc(OC.mi(sum(apr)))}</b></span>
        <span><small>Ativas</small><b>${neg.length}</b></span>${icon('caret-right', 18)}</button>
      ${todo.length ? todo.slice(0, 12).map((k, i) => `<div class="card task-card${k.warn ? ' hot' : ''}">
          <span class="ic">${icon(k.ic, 18)}</span>
          <div class="txt"><div class="task-top"><b>${esc(k.t)}</b><span class="val">${esc(k.v)}</span></div>
          <small>${esc(k.s)}</small>
          <button class="chip-act" type="button" data-task="${i}">${esc(k.cta)}${icon('arrow-right', 16)}</button></div></div>`).join('')
        : `<div class="empty">${icon('check-circle', 28)}Tudo em dia. As propostas que precisarem de você aparecem aqui.</div>`}`, false, params);
    OC.$('#h-sum', el).addEventListener('click', () => OC.go('props', { filter: 'and' }));
    OC.$$('[data-task]', el).forEach((b) => b.addEventListener('click', () => {
      const k = todo[Number(b.dataset.task)];
      OC.open('prop', { id: k.id, tab: k.tab });
    }));
  };

  OC.screens.props = async function (params) {
    const list = await OC.loadProposals();
    let filter = params.filter || null;
    let query = params.q || '';
    const el = OC.render(`${OC.header('')}
      <div class="title-row"><h1 class="title">Propostas</h1></div>
      <label class="search">${icon('magnifying-glass', 18)}<input id="p-q" type="search" placeholder="Buscar obra, cliente ou número" autocomplete="off" value="${esc(query)}"></label>
      <div class="chips wrap" id="p-chips"></div>
      <span class="group" id="p-count"></span>
      <div class="rows" id="p-rows"></div>`, false, params);
    const paint = () => {
      const q = query.trim().toLowerCase();
      const rows = list.filter((p) => (!filter || GROUPS[filter](p)) && (!q || `${p.workName} ${p.clientName} ${p.number}`.toLowerCase().includes(q)));
      OC.$('#p-chips', el).innerHTML = [['and', 'Em andamento'], ['apr', 'Aprovadas'], ['rec', 'Recusadas']].map(([k, l]) => `<button class="chip-act" type="button" data-f="${k}" aria-pressed="${filter === k}">${l} ${list.filter(GROUPS[k]).length}</button>`).join('');
      OC.$('#p-count', el).textContent = `${rows.length} ${rows.length === 1 ? 'proposta' : 'propostas'}`;
      OC.$('#p-rows', el).innerHTML = rows.length ? rows.map((p) => `<button class="prow" type="button" data-id="${esc(p.id)}">
          <span class="grow"><b>${esc(place(p))}</b><small>${esc(meta(p))}${p.clientName && p.workName ? ` · ${esc(p.clientName)}` : ''}</small></span>
          <span class="end"><b>${p.totalSale ? esc(OC.money0(p.totalSale)) : 'Sem itens'}</b>${OC.pill(p.status)}</span>${icon('caret-right', 18)}</button>`).join('')
        : `<div class="empty">${icon('file-text', 28)}${list.length ? 'Nenhuma proposta com esse filtro.' : 'Nenhuma proposta ainda.'}</div>`;
      OC.$$('[data-f]', el).forEach((b) => b.addEventListener('click', () => { filter = filter === b.dataset.f ? null : b.dataset.f; paint(); }));
      OC.$$('[data-id]', el).forEach((b) => b.addEventListener('click', () => OC.open('prop', { id: b.dataset.id })));
    };
    OC.$('#p-q', el).addEventListener('input', (event) => { query = event.target.value; paint(); });
    paint();
  };
})(window.OC = window.OC || {});
