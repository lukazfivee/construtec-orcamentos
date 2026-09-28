// Nova proposta no celular (prototipo: orcScr 'nova'): cliente, obra, validade e "Comecar com".
(function (OC) {
  const { esc, icon } = OC;
  const VALID = [15, 30, 45, 60];
  const START = [
    ['branco', 'file-text', 'Em branco', 'Comece do zero'],
    ['copy', 'copy', 'Copiar itens de outra proposta', 'Quantidades e mão de obra vêm juntos'],
    ['kit', 'stack', 'Começar com um kit', 'Os itens do kit entram de uma vez'],
  ];
  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

  OC.screens.nova = async function (params) {
    const [clients, settings, proposals, kits] = await Promise.all([
      OC.api('/clients').then((d) => d.clients || []),
      OC.api('/settings').then((d) => d.settings || d).catch(() => ({})),
      OC.loadProposals().catch(() => []),
      OC.api('/kits').then((d) => (d.kits || []).filter((k) => k.active !== false && k.itemCount > 0)).catch(() => []),
    ]);
    const state = {
      client: params.client || '', newClient: '', work: '', city: '',
      days: VALID.includes(Number(settings.defaultValidityDays)) ? Number(settings.defaultValidityDays) : 30,
      start: params.kit ? 'kit' : 'branco', copy: '', kit: params.kit || '',
    };
    let made = {}; // o que ja foi criado, para tentar de novo sem duplicar
    const copyable = proposals.filter((p) => p.itemCount > 0).slice(0, 12);
    const el = OC.render(`${OC.header('Nova proposta', { back: true })}
      <div class="field"><span>Cliente</span><div class="chips wrap" id="n-cli"></div>
        <input id="n-newcli" type="text" placeholder="Nome do novo cliente" autocomplete="off" hidden></div>
      <label class="field"><span>Obra</span><input id="n-work" type="text" placeholder="Ex.: Hospital São Lucas · Ala B" autocomplete="off"></label>
      <label class="field"><span>Cidade · opcional</span><input id="n-city" type="text" placeholder="Ex.: Jundiaí/SP" autocomplete="off"></label>
      <div class="field"><span>Validade da proposta</span><div class="chips wrap" id="n-days"></div><small class="hint" id="n-until"></small></div>
      <div class="field"><span>Começar com</span><div class="opts" id="n-start"></div><div class="chips wrap" id="n-pick"></div></div>
      <p class="hint" id="n-hint"></p>
      <div class="actions"><button class="btn" type="button" id="n-go">${icon('file-text', 18)}Criar proposta</button></div>`, true, params);

    const ready = () => (state.client === 'novo' ? state.newClient.trim().length >= 2 : !!state.client) && state.work.trim().length >= 2
      && (state.start !== 'copy' || state.copy) && (state.start !== 'kit' || state.kit);
    function paint() {
      OC.$('#n-cli', el).innerHTML = clients.map((c) => `<button class="chip-act" type="button" data-c="${esc(c.id)}" aria-pressed="${state.client === c.id}">${esc(c.tradeName || c.legalName)}</button>`).join('')
        + `<button class="chip-act" type="button" data-c="novo" aria-pressed="${state.client === 'novo'}">${icon('plus', 16)}Novo cliente</button>`;
      OC.$('#n-newcli', el).hidden = state.client !== 'novo';
      OC.$('#n-days', el).innerHTML = VALID.map((d) => `<button class="chip-act" type="button" data-d="${d}" aria-pressed="${state.days === d}">${d} dias</button>`).join('');
      OC.$('#n-until', el).textContent = `Vale até ${OC.dateFull(addDays(state.days))}`;
      OC.$('#n-start', el).innerHTML = START.map(([k, ic, t, s]) => `<button class="opt" type="button" data-s="${k}" aria-pressed="${state.start === k}">${icon(ic, 20)}<span><b>${t}</b><small>${s}</small></span><i class="radio"></i></button>`).join('');
      const pick = state.start === 'copy' ? copyable.map((p) => `<button class="chip-act" type="button" data-p="${esc(p.id)}" aria-pressed="${state.copy === p.id}">${esc(p.number)} · ${esc(p.workName || p.clientName)}</button>`).join('') || '<small class="hint">Nenhuma proposta com itens para copiar.</small>'
        : state.start === 'kit' ? kits.map((k) => `<button class="chip-act" type="button" data-k="${esc(k.id)}" aria-pressed="${state.kit === k.id}">${esc(k.name)}</button>`).join('') || '<small class="hint">Nenhum kit com itens.</small>' : '';
      OC.$('#n-pick', el).innerHTML = pick;
      OC.$('#n-hint', el).textContent = ready() ? '' : 'Escolha o cliente e dê um nome à obra';
      OC.$('#n-go', el).disabled = !ready();
      OC.$$('[data-c]', el).forEach((b) => b.addEventListener('click', () => { state.client = b.dataset.c; paint(); if (state.client === 'novo') OC.$('#n-newcli', el).focus(); }));
      OC.$$('[data-d]', el).forEach((b) => b.addEventListener('click', () => { state.days = Number(b.dataset.d); paint(); }));
      OC.$$('[data-s]', el).forEach((b) => b.addEventListener('click', () => { state.start = b.dataset.s; paint(); }));
      OC.$$('[data-p]', el).forEach((b) => b.addEventListener('click', () => { state.copy = b.dataset.p; paint(); }));
      OC.$$('[data-k]', el).forEach((b) => b.addEventListener('click', () => { state.kit = b.dataset.k; paint(); }));
    }
    const bindText = (sel, key) => OC.$(sel, el).addEventListener('input', (event) => {
      state[key] = event.target.value;
      OC.$('#n-go', el).disabled = !ready();
      OC.$('#n-hint', el).textContent = ready() ? '' : 'Escolha o cliente e dê um nome à obra';
    });
    bindText('#n-newcli', 'newClient');
    bindText('#n-work', 'work');
    bindText('#n-city', 'city');

    OC.$('#n-go', el).addEventListener('click', async (event) => {
      const b = event.currentTarget;
      b.disabled = true;
      try {
        let clientId = state.client;
        if (clientId === 'novo') {
          // Guarda o cliente criado: se a obra falhar, tentar de novo nao duplica o cliente.
          clientId = (await OC.api('/clients', { method: 'POST', body: { legalName: state.newClient.trim() } })).clientId;
          clients.push({ id: clientId, legalName: state.newClient.trim() });
          state.client = clientId;
        }
        const work = state.work.trim();
        const key = `${clientId}|${work}`;
        if (made.key !== key) made = { key };
        if (!made.workId) made.workId = (await OC.api(`/clients/${clientId}/works`, { method: 'POST', body: { name: work, address: state.city.trim() || null } })).workId;
        if (!made.proposal) made.proposal = (await OC.api('/proposals', { method: 'POST', body: { clientId, workId: made.workId, scope: `Proposta para ${work}`, validUntil: addDays(state.days) } })).proposal;
        const created = made.proposal;
        if (state.start === 'copy') await OC.api(`/proposals/${created.id}/items/copy-from-proposal`, { method: 'POST', body: { sourceProposalId: state.copy } });
        if (state.start === 'kit') await OC.api(`/kits/${state.kit}/apply-to-proposal`, { method: 'POST', body: { proposalId: created.id } });
        OC.toast(`${created.number} criada`);
        OC.go('prop', { id: created.id, tab: 'itens' }, { back: true });
      } catch (error) {
        OC.toast(error.message, 'warning-circle');
        b.disabled = false;
      }
    });
    paint();
  };
})(window.OC = window.OC || {});
