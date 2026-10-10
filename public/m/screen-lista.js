// Lista de propostas no celular, com os filtros, a ordenacao, o CSV e o rodape do computador
// (ProposalsListWorkspace.tsx, ProposalsListFilterBar.tsx, ProposalsListFooterSummary.tsx, proposalsListExport.ts).
// Situacao na linha: OC.statusSheet (prop-edit.js, transicoes de proposalStatus.ts e p11). Validade: OC.validitySheet.
(function (OC) {
  const STATUS_ORDER = ['draft', 'review', 'sent', 'approved', 'rejected'];
  const NEG = ['draft', 'review', 'sent'];
  const place = (p) => [p.workName, p.clientName].filter(Boolean)[0] || p.number;

  // ---------- regras puras (iguais as do computador; testadas em src/documents/mobile-listas.test.ts) ----------
  const L = OC.lista = {};
  L.DATE = [['all', 'Todas as datas'], ['today', 'Hoje'], ['month', 'Este mês'], ['last30', 'Últimos 30 dias'], ['year', 'Este ano']];
  L.VALUE = [['all', 'Todas as faixas'], ['under10k', 'Até R$ 10.000'], ['10k-50k', 'R$ 10.000 a R$ 50.000'], ['50k-100k', 'R$ 50.000 a R$ 100.000'], ['above100k', 'Acima de R$ 100.000']];
  L.VALIDITY = [['all', 'Todas as validades'], ['expiringSoon', 'Vencendo em breve (3d)'], ['expired', 'Vencidas'], ['valid', 'No prazo'], ['none', 'Sem validade']];
  L.LABEL = { draft: 'Em edição', review: 'Em revisão', sent: 'Enviada', approved: 'Aprovada', rejected: 'Recusada' };
  L.SORT = [['date', 'Data'], ['number', 'Número'], ['client', 'Cliente'], ['value', 'Valor']];

  // getProposalValidityStatus (proposalValidityHelpers.ts): estado e rotulo.
  L.validity = (validUntil, status) => {
    if (!validUntil) return { state: 'none', label: 'A definir', alert: false };
    if (status === 'approved' || status === 'rejected') return { state: 'valid', label: status === 'approved' ? 'Aprovada' : 'Recusada', alert: false, closed: true };
    const [y, m, d] = String(validUntil).slice(0, 10).split('-').map(Number);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86400000);
    if (days < 0) return { state: 'expired', label: -days === 1 ? 'Venceu ontem' : `Vencida há ${-days}d`, alert: true };
    if (days === 0) return { state: 'expiringSoon', label: 'Vence hoje', alert: true };
    if (days <= 3) return { state: 'expiringSoon', label: days === 1 ? 'Vence amanhã' : `Vence em ${days}d`, alert: true };
    return { state: 'valid', label: `Válida (${days}d)`, alert: false };
  };
  L.matchDate = (updatedAt, opt) => {
    if (opt === 'all') return true;
    const item = new Date(updatedAt), now = new Date();
    if (opt === 'today') return item.toDateString() === now.toDateString();
    if (opt === 'month') return item.getMonth() === now.getMonth() && item.getFullYear() === now.getFullYear();
    if (opt === 'last30') return item.getTime() >= now.getTime() - 30 * 86400000;
    if (opt === 'year') return item.getFullYear() === now.getFullYear();
    return true;
  };
  L.matchValue = (total, opt) => {
    const v = Number(total) || 0;
    if (opt === 'under10k') return v < 10000;
    if (opt === '10k-50k') return v >= 10000 && v <= 50000;
    if (opt === '50k-100k') return v > 50000 && v <= 100000;
    if (opt === 'above100k') return v > 100000;
    return true;
  };
  L.apply = (list, f) => {
    const q = String(f.q || '').trim().toLowerCase();
    const rows = list.filter((p) => (f.validity === 'all' || L.validity(p.validUntil, p.status).state === f.validity)
      && (f.status === 'all' || p.status === f.status) && L.matchDate(p.updatedAt, f.date) && L.matchValue(p.totalSale, f.value)
      && (!q || `${p.number} ${p.clientName || ''} ${p.workName || ''}`.toLowerCase().includes(q)));
    const diff = (a, b) => (f.sort === 'number' ? a.number.localeCompare(b.number) : (f.sort === 'client' ? String(a.clientName || '').localeCompare(String(b.clientName || ''))
      : (f.sort === 'value' ? (a.totalSale || 0) - (b.totalSale || 0) : new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())));
    return rows.sort((a, b) => (f.order === 'desc' ? -diff(a, b) : diff(a, b)));
  };
  L.totals = (rows) => {
    const sum = (xs) => xs.reduce((n, p) => n + (Number(p.totalSale) || 0), 0);
    const apr = rows.filter((p) => p.status === 'approved'), neg = rows.filter((p) => NEG.includes(p.status));
    const total = sum(rows);
    return { count: rows.length, total, average: rows.length ? total / rows.length : 0, approved: apr.length, approvedTotal: sum(apr), negotiation: neg.length, negotiationTotal: sum(neg) };
  };
  // exportProposalsToCsv: mesmas colunas, ponto e virgula, aspas em toda celula e BOM para o Excel. Nunca leva custo.
  L.csv = (rows) => {
    const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    const cell = (v) => (v === undefined || v === null ? '""' : `"${String(v).replace(/"/g, '""')}"`);
    const head = ['Número', 'Revisão', 'Cliente', 'Obra / Projeto', 'Status', 'Qtd de Itens', 'Valor Total de Venda', 'Última Atualização'];
    const lines = rows.map((p) => [p.number, `REV ${String(p.revision).padStart(2, '0')}`, p.clientName, p.workName, (L.LABEL[p.status] || p.status),
      p.itemCount, money.format(p.totalSale || 0), p.updatedAt ? dateTime.format(new Date(p.updatedAt)) : '-'].map(cell).join(';'));
    return `﻿${[head.map(cell).join(';'), ...lines].join('\r\n')}`;
  };

  // Filtros ficam guardados enquanto o app esta aberto (abrir uma proposta e voltar mantem a lista como estava).
  const DEFAULT = { q: '', status: 'all', date: 'all', value: 'all', validity: 'all', sort: 'date', order: 'desc' };
  let f = { ...DEFAULT };
  const extraCount = () => ['date', 'value', 'validity'].filter((k) => f[k] !== 'all').length;
  const sortLabel = () => `${L.SORT.find(([k]) => k === f.sort)[1]} ${f.order === 'desc' ? '(maior primeiro)' : '(menor primeiro)'}`;

  // CSV: compartilhar (WhatsApp, e-mail, Drive) quando o aparelho deixa; senao baixa o arquivo.
  async function exportCsv(rows) {
    if (!rows.length) { OC.toast('Nenhuma proposta para exportar.', 'warning-circle'); return; }
    const name = `propostas-construtec-${new Date().toISOString().slice(0, 10)}.csv`;
    const file = new File([L.csv(rows)], name, { type: 'text/csv;charset=utf-8' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return; } catch (error) { if (error && error.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    OC.toast(`${rows.length} ${rows.length === 1 ? 'proposta exportada' : 'propostas exportadas'} em CSV`);
  }

  function filterSheet(onDone) {
    const { esc, icon } = OC;
    const draft = { ...f };
    const group = (key, title, options) => `<p class="sheet-sec">${title}</p><div class="chips wrap" data-g="${key}">${options.map(([k, l]) => `<button class="chip-act" type="button" data-k="${k}">${esc(l)}</button>`).join('')}</div>`;
    const s = OC.sheet(`${OC.sheetHead('Filtrar e ordenar', 'funnel')}
      ${group('validity', 'Validade', L.VALIDITY)}${group('date', 'Última atualização', L.DATE)}${group('value', 'Faixa de valor', L.VALUE)}
      ${group('sort', 'Ordenar por', L.SORT)}<div class="seg" style="margin-top:10px" data-ord><button type="button" data-o="desc">Maior primeiro</button><button type="button" data-o="asc">Menor primeiro</button></div>
      <div class="sheet-actions"><button class="btn2" type="button" data-clear>Limpar</button><button class="btn" type="button" data-yes>${icon('check', 18)}Aplicar</button></div>`);
    s.el.firstElementChild.classList.add('sheet-tall');
    const paint = () => {
      OC.$$('[data-g]', s.el).forEach((g) => OC.$$('[data-k]', g).forEach((b) => b.setAttribute('aria-pressed', String(draft[g.dataset.g] === b.dataset.k))));
      OC.$$('[data-o]', s.el).forEach((b) => b.setAttribute('aria-pressed', String(draft.order === b.dataset.o)));
    };
    OC.$$('[data-g]', s.el).forEach((g) => OC.$$('[data-k]', g).forEach((b) => b.addEventListener('click', () => { draft[g.dataset.g] = b.dataset.k; paint(); })));
    OC.$$('[data-o]', s.el).forEach((b) => b.addEventListener('click', () => { draft.order = b.dataset.o; paint(); }));
    OC.$('[data-clear]', s.el).addEventListener('click', () => { f = { ...DEFAULT, q: f.q, status: f.status }; s.close(); onDone(); });
    OC.$('[data-yes]', s.el).addEventListener('click', () => { f = draft; s.close(); onDone(); });
    paint();
  }

  OC.screens.props = async function (params) {
    const { esc, icon } = OC;
    let list = await OC.loadProposals();
    if (params.filter) f = { ...DEFAULT };
    const el = OC.render(`${OC.header('')}
      <div class="title-row"><h1 class="title">Propostas</h1><span class="lst-acts"><button class="chip-act ghost" type="button" id="p-csv" aria-label="Exportar CSV">${icon('download-simple', 16)}CSV</button>${OC.canEdit() ? `<button class="chip-act" type="button" id="p-new">${icon('plus', 16)}Nova</button>` : ''}</span></div>
      <label class="search">${icon('magnifying-glass', 18)}<input id="p-q" type="search" placeholder="Buscar obra, cliente ou número" autocomplete="off" value="${esc(f.q)}"></label>
      <div class="chips" id="p-chips"></div>
      <div class="lst-tools"><button class="chip-act ghost" type="button" id="p-fil">${icon('funnel', 16)}<span id="p-fil-t"></span></button><small id="p-sort"></small></div>
      <span class="group" id="p-count"></span>
      <div class="lst-rows" id="p-rows"></div>
      <div class="card lst-sum" id="p-sum"></div>`, false, params);
    const ctx = { reload: () => refresh(), update: () => refresh() };
    async function refresh() {
      try { list = await OC.loadProposals(); } catch (error) { OC.toast(error.message, 'warning-circle'); }
      if (el.isConnected) paint();
    }
    const validityChip = (p) => {
      if (!NEG.includes(p.status)) return '';
      const v = L.validity(p.validUntil, p.status);
      const cls = `lst-val${v.alert ? ' warn' : ''}`;
      return OC.canEdit() && p.isLatest !== false ? `<button class="${cls}" type="button" data-val="${esc(p.id)}">${icon('calendar-blank', 14)}${esc(v.label)}</button>` : `<span class="${cls}">${icon('calendar-blank', 14)}${esc(v.label)}</span>`;
    };
    const statusChip = (p) => (OC.canChangeStatus && OC.canChangeStatus({ ...p, isLatest: p.isLatest !== false })
      ? `<button class="pill-btn" type="button" data-st="${esc(p.id)}" aria-label="Mudar situação">${OC.pill(p.status)}${icon('caret-down', 14)}</button>` : OC.pill(p.status));
    function paint() {
      const rows = L.apply(list, f), t = L.totals(rows), n = extraCount();
      OC.$('#p-chips', el).innerHTML = [['all', 'Todas', list.length], ...STATUS_ORDER.map((st) => [st, OC.STATUS[st][0], list.filter((p) => p.status === st).length])]
        .map(([k, l, c]) => `<button class="chip-act" type="button" data-f="${k}" aria-pressed="${f.status === k}">${esc(l)} ${c}</button>`).join('');
      OC.$('#p-fil-t', el).textContent = n ? `Filtros · ${n}` : 'Filtrar e ordenar';
      OC.$('#p-sort', el).textContent = `Ordem: ${sortLabel()}`;
      OC.$('#p-count', el).textContent = `${rows.length} de ${list.length} ${list.length === 1 ? 'proposta' : 'propostas'}${rows.length < list.length ? ' · filtro aplicado' : ''}`;
      OC.$('#p-rows', el).innerHTML = rows.length ? rows.map((p) => `<div class="lst-row">
          <button class="lst-main" type="button" data-id="${esc(p.id)}"><span class="grow"><b>${esc(place(p))}</b><small>${esc(p.number)} · ${esc(OC.rev(p.revision))}${p.isLatest === false ? ' · revisão antiga' : ''}${p.clientName && p.workName ? ` · ${esc(p.clientName)}` : ''}</small></span>
            <b class="lst-money">${p.totalSale ? esc(OC.money0(p.totalSale)) : 'Sem itens'}</b>${icon('caret-right', 18)}</button>
          <div class="lst-foot">${statusChip(p)}${validityChip(p)}<small class="lst-date">${esc(OC.dateBr(p.updatedAt))}</small></div></div>`).join('')
        : `<div class="empty">${icon('file-text', 28)}${list.length ? 'Nenhuma proposta com esses filtros.' : 'Nenhuma proposta ainda.'}${list.length ? '<button class="btn2" type="button" id="p-clear" style="padding:0 18px">Limpar filtros</button>' : ''}</div>`;
      OC.$('#p-sum', el).innerHTML = `<div class="grid2"><div class="stat"><small>Total filtrado</small><b>${esc(OC.money(t.total))}</b></div><div class="stat"><small>Ticket médio</small><b>${esc(OC.money(t.average))}</b></div></div>
        <div class="kv"><span>Aprovadas · ${t.approved}</span><b>${esc(OC.money(t.approvedTotal))}</b></div><div class="kv"><span>Em negociação · ${t.negotiation}</span><b>${esc(OC.money(t.negotiationTotal))}</b></div>`;
      OC.$$('[data-f]', el).forEach((b) => b.addEventListener('click', () => { f.status = b.dataset.f; paint(); }));
      OC.$$('[data-id]', el).forEach((b) => b.addEventListener('click', () => OC.open('prop', { id: b.dataset.id })));
      OC.$$('[data-st]', el).forEach((b) => b.addEventListener('click', () => OC.statusSheet(list.find((p) => p.id === b.dataset.st), ctx)));
      OC.$$('[data-val]', el).forEach((b) => b.addEventListener('click', () => { const p = list.find((x) => x.id === b.dataset.val); OC.validitySheet({ ...p, isLatest: p.isLatest !== false }, ctx); }));
      const clear = OC.$('#p-clear', el);
      if (clear) clear.addEventListener('click', () => { f = { ...DEFAULT }; OC.$('#p-q', el).value = ''; paint(); });
    }
    const nova = OC.$('#p-new', el);
    if (nova) nova.addEventListener('click', () => OC.open('nova'));
    OC.$('#p-q', el).addEventListener('input', (event) => { f.q = event.target.value; paint(); });
    OC.$('#p-fil', el).addEventListener('click', () => filterSheet(paint));
    OC.$('#p-csv', el).addEventListener('click', () => exportCsv(L.apply(list, f)));
    paint();
  };
})(window.OC = window.OC || {});
