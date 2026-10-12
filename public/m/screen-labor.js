// Mao de obra da proposta no celular (prototipo: orcScr 'labor'). O servidor calcula custo e horas.
// Como no computador (ProposalLaborPanel.tsx): renomear funcao, horas mensais de cada funcao e o padrao da proposta (labor-settings).
(function (OC) {
  const { esc, icon } = OC;
  const parse = (v) => { const n = Number(String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const STEP = { plannedHours: 40, standardMonthlyHours: 4 }, MIN = { professionalCount: 1, plannedHours: 0, standardMonthlyHours: 1 };
  const monthly = (it) => it.monthlySalary + it.monthlyFood + it.monthlyTransport + it.monthlyOtherCosts;
  const base = (it) => Number(it.standardMonthlyHours) || 220;
  const input = (it, hours) => ({
    description: it.description, professionalCount: it.professionalCount, monthlySalary: it.monthlySalary, monthlyFood: it.monthlyFood,
    monthlyTransport: it.monthlyTransport, monthlyOtherCosts: it.monthlyOtherCosts, standardMonthlyHours: it.standardMonthlyHours || hours, plannedHours: it.plannedHours,
  });

  OC.screens.labor = async function (params) {
    const [prop, data] = await Promise.all([
      OC.api(`/proposals/${encodeURIComponent(params.id)}`).then((d) => d.proposal),
      OC.api(`/proposals/${encodeURIComponent(params.id)}/labor`),
    ]);
    let items = data.items || [];
    let hours = Number(data.standardMonthlyHours) || 220;
    // Mesma regra dos itens: edicao ou revisao, so na revisao atual (o servidor confere).
    const can = OC.propEditable(prop);
    let open = params.open || (items[0] && items[0].id) || '';
    let finalValue = (prop.totals && prop.totals.finalValue) || 0;
    const el = OC.render(`${OC.header('Mão de obra', { back: true })}
      <div class="prop-tags"><span class="tag">${esc(OC.rev(prop.revision))}</span><span class="prop-work" id="l-sum"></span></div>
      <div class="card">${can ? `<button class="kv kv-btn" type="button" id="l-hours"><span>Horas mensais padrão</span><b><span id="l-hv"></span>${icon('pencil-simple', 14)}</b></button>` : '<div class="kv"><span>Horas mensais padrão</span><b id="l-hv"></b></div>'}
        <small class="hint">Valem para as novas funções; cada função tem as suas horas abaixo.</small></div>
      <div id="l-list" class="labor-list"></div>
      ${can ? `<button class="btn2" type="button" id="l-add">${icon('plus', 18)}Adicionar função</button>` : ''}
      <div class="actions total-bar"><div class="tb-mid"><span><small>Total mão de obra</small><b class="big" id="l-total"></b></span><small id="l-final"></small></div>
        <button class="btn" type="button" data-back>${can ? 'Concluir' : 'Voltar'}</button></div>`, true, params);

    const timers = {};
    async function refreshFinal() {
      try { finalValue = ((await OC.api(`/proposals/${prop.id}`)).proposal.totals || {}).finalValue || 0; } catch { /* segue com o anterior */ }
      OC.$('#l-final', el).textContent = `Valor final · ${OC.money0(finalValue)}`;
    }
    const save = (it) => {
      clearTimeout(timers[it.id]);
      timers[it.id] = setTimeout(async () => {
        try {
          items = (await OC.api(`/proposals/${prop.id}/labor/${it.id}`, { method: 'PATCH', body: input(it, hours) })).items || items;
          paintTotals();
          refreshFinal();
        } catch (error) { OC.toast(error.message, 'warning-circle'); }
      }, 600);
    };

    function paintTotals() {
      const pros = items.reduce((n, it) => n + (Number(it.professionalCount) || 0), 0);
      OC.$('#l-sum', el).textContent = `${OC.num(pros)} ${pros === 1 ? 'profissional' : 'profissionais'}`;
      OC.$('#l-total', el).textContent = OC.money0(items.reduce((n, it) => n + (Number(it.totalCost) || 0), 0));
      OC.$('#l-final', el).textContent = `Valor final · ${OC.money0(finalValue)}`;
      OC.$('#l-hv', el).textContent = `${OC.num(hours)} h`;
      items.forEach((it) => {
        const card = OC.$(`[data-l="${it.id}"]`, el);
        if (!card) return;
        OC.$('.l-cost', card).textContent = OC.money0(it.totalCost);
        OC.$('.l-meta', card).textContent = `${OC.num(it.professionalCount)} prof. × ${OC.num(it.plannedHours)} h`;
        const m = OC.$('.l-month', card), h = OC.$('.l-hour', card);
        if (m) m.textContent = OC.money(it.monthlyCost || monthly(it));
        if (h) h.textContent = OC.money(it.hourlyRate || 0);
      });
    }

    const stepper = (key, label, value, unit) => `<div class="l-step"><span class="l-lab">${label}</span><div class="qty"><button class="qbtn" type="button" data-dec="${key}" aria-label="Diminuir ${label}"${can ? '' : ' disabled'}>${icon('minus', 18)}</button>
      <label class="qval"><input type="text" inputmode="decimal" data-f="${key}" value="${esc(OC.num(value))}"${can ? '' : ' readonly'} aria-label="${label}">${unit ? `<span>${unit}</span>` : ''}</label>
      <button class="qbtn" type="button" data-inc="${key}" aria-label="Aumentar ${label}"${can ? '' : ' disabled'}>${icon('plus', 18)}</button></div></div>`;
    const money = (key, label, value) => `<label class="field"><span>${label}</span><span class="money-in"><em>R$</em><input type="text" inputmode="decimal" data-f="${key}" value="${esc(OC.dec2(value))}"${can ? '' : ' readonly'}></span></label>`;

    function paint() {
      OC.$('#l-list', el).innerHTML = items.length ? items.map((it) => `<div class="card lcard${open === it.id ? ' open' : ''}" data-l="${esc(it.id)}">
          <button class="lhead" type="button" data-toggle aria-expanded="${open === it.id}"><span class="grow"><b>${esc(it.description)}</b><small class="l-meta"></small></span><b class="l-cost"></b>${icon(open === it.id ? 'caret-up' : 'caret-down', 18)}</button>
          ${open === it.id ? `<div class="lbody">
            <div class="grid2 one">${stepper('professionalCount', 'Profissionais', it.professionalCount)}${stepper('plannedHours', 'Horas por prof.', it.plannedHours, 'h')}${stepper('standardMonthlyHours', 'Horas por mês', base(it), 'h')}</div>
            <small class="hint">≈ ${OC.num(Math.round((it.plannedHours / base(it)) * 10) / 10)} ${it.plannedHours / base(it) === 1 ? 'mês' : 'meses'} por profissional · passo de 40 h</small>
            <div class="grid2">${money('monthlySalary', 'Salário', it.monthlySalary)}${money('monthlyFood', 'Alimentação', it.monthlyFood)}${money('monthlyTransport', 'Transporte', it.monthlyTransport)}${money('monthlyOtherCosts', 'Encargos e outros', it.monthlyOtherCosts)}</div>
            <div class="l-calc"><div class="kv"><span>Custo mensal por profissional</span><b class="l-month"></b></div><div class="kv"><span>Custo por hora (÷ ${OC.num(base(it))} h)</span><b class="l-hour"></b></div></div>
            ${can ? `<button class="menu-item l-del" type="button" data-ren>${icon('pencil-simple', 20)}<span>Renomear função</span></button>` : ''}
            ${can ? `<button class="menu-item danger l-del" type="button" data-del>${icon('trash', 20)}<span>Remover função</span></button>` : ''}</div>` : ''}</div>`).join('')
        : `<div class="empty">${icon('hard-hat', 28)}Nenhuma função de mão de obra.</div>`;
      OC.$$('[data-l]', el).forEach((card) => {
        const it = items.find((x) => x.id === card.dataset.l);
        OC.$('[data-toggle]', card).addEventListener('click', () => { open = open === it.id ? '' : it.id; paint(); });
        if (!can || open !== it.id) return;
        const set = (key, v) => { it[key] = v; const f = OC.$(`[data-f="${key}"]`, card); if (f) f.value = key.startsWith('monthly') ? OC.dec2(v) : OC.num(v); if (key === 'standardMonthlyHours') paint(); else paintTotals(); save(it); };
        if (!it.standardMonthlyHours) it.standardMonthlyHours = hours;
        OC.$$('[data-dec]', card).forEach((b) => b.addEventListener('click', () => { const k = b.dataset.dec; set(k, Math.max(MIN[k], it[k] - (STEP[k] || 1))); }));
        OC.$$('[data-inc]', card).forEach((b) => b.addEventListener('click', () => { const k = b.dataset.inc; set(k, Math.min(k === 'standardMonthlyHours' ? 1000 : Infinity, it[k] + (STEP[k] || 1))); }));
        OC.$$('[data-f]', card).forEach((f) => f.addEventListener('change', () => { const k = f.dataset.f, v = parse(f.value); if (v >= 0) set(k, k in MIN ? Math.min(k === 'standardMonthlyHours' ? 1000 : Infinity, Math.max(MIN[k], v)) : v); }));
        OC.$('[data-ren]', card).addEventListener('click', () => OC.ask('Renomear função', 'Nome da função', 'Ex.: Técnico de CFTV', async (name) => {
          clearTimeout(timers[it.id]);
          const old = it.description;
          it.description = name;
          try { items = (await OC.api(`/proposals/${prop.id}/labor/${it.id}`, { method: 'PATCH', body: input(it, hours) })).items || items; } catch (error) { it.description = old; throw error; }
          OC.toast('Função renomeada');
          paint();
        }, it.description));
        const del = OC.$('[data-del]', card);
        if (del) del.addEventListener('click', async () => {
          del.disabled = true;
          try {
            items = (await OC.api(`/proposals/${prop.id}/labor/${it.id}/remove`, { method: 'POST', body: {} })).items || [];
            OC.toast('Função removida');
            open = '';
            paint();
            refreshFinal();
          } catch (error) { OC.toast(error.message, 'warning-circle'); del.disabled = false; }
        });
      });
      paintTotals();
    }

    const hb = OC.$('#l-hours', el);
    if (hb) hb.addEventListener('click', () => OC.ask('Horas mensais padrão', 'Horas por mês para novas funções', 'Ex.: 220', async (text) => {
      const v = parse(text);
      if (!(v > 0 && v <= 1000)) throw new Error('Informe entre 1 e 1000 horas.');
      await OC.api(`/proposals/${prop.id}/labor-settings`, { method: 'PATCH', body: { standardMonthlyHours: v } });
      hours = v;
      paintTotals();
      OC.toast('Horas mensais padrão atualizadas');
    }, OC.num(hours)));
    const add = OC.$('#l-add', el);
    if (add) add.addEventListener('click', () => OC.ask('Nova função', 'Nome da função', 'Ex.: Técnico de CFTV', async (name) => {
      const body = { description: name, professionalCount: 1, monthlySalary: 0, monthlyFood: 0, monthlyTransport: 0, monthlyOtherCosts: 0, standardMonthlyHours: hours, plannedHours: hours };
      items = (await OC.api(`/proposals/${prop.id}/labor`, { method: 'POST', body })).items || items;
      open = (items[items.length - 1] || {}).id || '';
      paint();
    }));
    paint();
  };
})(window.OC = window.OC || {});
