// Painel no celular: Principais clientes e Curva ABC, como HomeTopClientsCard.tsx e HomeAbcItemsCard.tsx.
// Os dados vem do /api/dashboard (intelligence.topClients e topItems): valores de venda, sem custo.
(function (OC) {
  const ABC = { A: 'Top 80% do valor orçado', B: 'Próximos 15%', C: 'Últimos 5%' };

  OC.painelMais = function (intel) {
    const { esc } = OC;
    const clients = ((intel && intel.topClients) || []).slice(0, 8);
    const items = ((intel && intel.topItems) || []).slice(0, 10);
    const max = Math.max(1, ...clients.map((c) => Number(c.totalValue) || 0));
    const clientRows = clients.map((c, i) => {
      const rel = (Number(c.totalValue) || 0) / max * 100;
      const apr = c.totalValue > 0 ? c.approvedValue / c.totalValue : 0;
      return `<div class="pn-cli"><div class="line"><span class="pn-rank">${i + 1}</span><b class="grow">${esc(c.clientName)}</b><b>${esc(OC.money0(c.totalValue))}</b></div>
        <small>${c.proposalsCount} ${c.proposalsCount === 1 ? 'orçamento' : 'orçamentos'} · aprovado ${esc(OC.money0(c.approvedValue))} · em negociação ${esc(OC.money0(c.inNegotiationValue))}</small>
        <div class="pn-bar" aria-hidden="true"><span class="ok" style="width:${(rel * apr).toFixed(1)}%"></span><span style="width:${(rel * (1 - apr)).toFixed(1)}%"></span></div></div>`;
    }).join('');
    const itemRows = items.map((it) => `<div class="pn-abc"><span class="pn-cls c-${esc(it.abcClass)}" title="${esc(ABC[it.abcClass] || '')}">${esc(it.abcClass)}</span>
        <span class="grow"><b>${esc(it.description)}</b><small>${it.code ? `${esc(it.code)} · ` : ''}${esc(OC.num(it.totalQuantity))} ${esc(it.unit)} · ${it.proposalsCount} ${it.proposalsCount === 1 ? 'proposta' : 'propostas'}</small></span>
        <span class="end"><b>${esc(OC.money0(it.totalValue))}</b><small>${esc(OC.num(it.cumulativePercentage))}% acum.</small></span></div>`).join('');
    return `<div class="card"><div class="sec-row"><span class="label">Principais clientes</span><small class="hint">${clients.length} ${clients.length === 1 ? 'cliente' : 'clientes'}</small></div>
        ${clientRows || '<div class="empty">Nenhum cliente com propostas registradas ainda.</div>'}
        ${clients.length ? '<p class="hint pn-legend"><i class="ok"></i>Aprovado <i></i>Em negociação</p>' : ''}</div>
      <div class="card"><div class="sec-row"><span class="label">Curva ABC dos itens</span><small class="hint">A 80% · B 15% · C 5%</small></div>
        ${itemRows || '<div class="empty">Nenhum item orçado nas propostas vigentes ainda.</div>'}
        ${items.length ? '<p class="hint">Valor de venda somado nas revisões vigentes das propostas ativas e aprovadas.</p>' : ''}</div>`;
  };
})(window.OC = window.OC || {});
