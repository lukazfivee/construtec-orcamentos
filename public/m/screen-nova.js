// Nova proposta no celular (prototipo: orcScr 'nova'): cliente, obra, validade e "Comecar com".
// Obra: uma obra ativa do cliente ou uma nova, como no computador (NewProposalDialog.tsx).
(function (OC) {
  const { esc, icon } = OC;
  const VALID = [15, 30, 45, 60];
  const CLIENT_PAGE = 20;
  const clientName = (client) => client.tradeName || client.legalName;
  const searchClientText = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const START = [
    ['branco', 'file-text', 'Em branco', 'Comece do zero'],
    ['copy', 'copy', 'Copiar de outra proposta', 'Itens, mão de obra e condições comerciais vêm juntos'],
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
      client: '', newClient: '', workId: '', work: '', city: '',
      days: VALID.includes(Number(settings.defaultValidityDays)) ? Number(settings.defaultValidityDays) : 30,
      start: params.kit ? 'kit' : 'branco', copy: '', kit: params.kit || '',
    };
    let made = {}; // o que ja foi criado, para tentar de novo sem duplicar
    // Quem teve proposta mais recente vem primeiro; ao copiar, as propostas do cliente escolhido vem na frente.
    const same = (p, c) => p.clientId === c.id || p.clientName === (c.tradeName || c.legalName);
    // Compara o texto da data (mesmo formato em todas): o Safari nao le a data do PostgreSQL com espaco.
    const last = (c) => proposals.reduce((max, p) => (same(p, c) && String(p.updatedAt || '') > max ? String(p.updatedAt) : max), '');
    clients.sort((a, b) => (last(a) < last(b) ? 1 : last(a) > last(b) ? -1 : 0));
    const indexedClients = clients.map((client) => ({
      client,
      text: searchClientText([client.tradeName, client.legalName].filter(Boolean).join(' ')),
    }));
    const withItems = proposals.filter((p) => p.itemCount > 0);
    const copyable = () => {
      const c = clients.find((x) => x.id === state.client);
      return [...withItems.filter((p) => c && same(p, c)), ...withItems.filter((p) => !(c && same(p, c)))].slice(0, 12);
    };
    const el = OC.render(`${OC.header('Nova proposta', { back: true })}
      <div class="field"><span>Cliente</span>
        <div class="n-client-actions">
          <button class="btn2 n-client-toggle" id="n-cli-toggle" type="button" aria-controls="n-cli" aria-expanded="false">
            ${icon('magnifying-glass', 18)}<span id="n-cli-label">Buscar cliente</span>${icon('caret-down', 16)}
          </button>
          <button class="chip-act ghost" type="button" id="n-new-toggle" aria-pressed="false">${icon('plus', 16)}Novo cliente</button>
        </div>
        <div id="n-cli" class="n-client-picker" hidden>
          <input id="n-cli-search" type="search" enterkeyhint="search" aria-label="Buscar cliente por nome ou razão social" placeholder="Nome ou razão social" autocomplete="off">
          <p class="hint" id="n-cli-status" role="status"></p>
          <div class="n-client-results" id="n-cli-results" role="group" aria-label="Clientes encontrados"></div>
          <button class="chip-act ghost" type="button" id="n-cli-more" hidden>Mostrar mais clientes</button>
        </div>
        <input id="n-newcli" type="text" aria-label="Nome do novo cliente" placeholder="Nome do novo cliente" autocomplete="off" hidden>
      </div>
      <div class="field"><span>Obra</span><div class="chips wrap" id="n-works"></div>
        <input id="n-work" type="text" aria-label="Nome da obra" placeholder="Ex.: Hospital São Lucas · Ala B" autocomplete="off"></div>
      <label class="field" id="n-city-f"><span>Cidade · opcional</span><input id="n-city" type="text" placeholder="Ex.: Jundiaí/SP" autocomplete="off"></label>
      <div class="field"><span>Validade da proposta</span><div class="chips wrap" id="n-days"></div><small class="hint" id="n-until"></small></div>
      <div class="field"><span>Começar com</span><div class="opts" id="n-start"></div><div class="chips wrap" id="n-pick"></div></div>
      <p class="hint" id="n-hint"></p>
      <div class="actions"><button class="btn" type="button" id="n-go">${icon('file-text', 18)}Criar proposta</button></div>`, true, params);

    const activeWorks = () => ((clients.find((c) => c.id === state.client) || {}).works || []).filter((w) => w.active !== false);
    const newWork = () => state.workId === 'nova' || !activeWorks().length;
    // Escolher o cliente: a primeira obra ativa ja vem marcada; sem obras, cadastra uma nova.
    const pickClient = (id) => {
      if (state.client === id) return;
      state.client = id;
      state.work = '';
      state.city = '';
      OC.$('#n-work', el).value = '';
      OC.$('#n-city', el).value = '';
      const works = activeWorks();
      state.workId = works.length ? works[0].id : 'nova';
    };
    if (clients.some((client) => client.id === params.client)) pickClient(params.client);
    const clientToggle = OC.$('#n-cli-toggle', el);
    const clientPicker = OC.$('#n-cli', el);
    const clientSearch = OC.$('#n-cli-search', el);
    const clientResults = OC.$('#n-cli-results', el);
    const clientMore = OC.$('#n-cli-more', el);
    const newToggle = OC.$('#n-new-toggle', el);
    let clientLimit = CLIENT_PAGE;

    function renderClientResults() {
      const terms = searchClientText(clientSearch.value.trim()).split(/\s+/).filter(Boolean);
      const matches = indexedClients.filter(({ text }) => terms.every((term) => text.includes(term)));
      const count = matches.length;
      OC.$('#n-cli-status', el).textContent = !count ? (terms.length ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.')
        : terms.length ? (count === 1 ? '1 cliente encontrado' : `${count} clientes encontrados`) : 'Clientes recentes';
      clientResults.innerHTML = matches.slice(0, clientLimit).map(({ client }) => `<button class="prow n-client-result" type="button" data-c="${esc(client.id)}" aria-pressed="${state.client === client.id}">
        <span class="grow"><b>${esc(clientName(client))}</b>${client.tradeName && client.legalName !== client.tradeName ? `<small>${esc(client.legalName)}</small>` : ''}</span>
        ${state.client === client.id ? icon('check', 16) : icon('caret-right', 16)}</button>`).join('');
      clientMore.hidden = count <= clientLimit;
    }

    function closeClientPicker() {
      clientPicker.hidden = true;
      clientToggle.setAttribute('aria-expanded', 'false');
    }

    clientToggle.addEventListener('click', () => {
      if (!clientPicker.hidden) return closeClientPicker();
      clientPicker.hidden = false;
      clientToggle.setAttribute('aria-expanded', 'true');
      clientSearch.value = '';
      clientLimit = CLIENT_PAGE;
      clientResults.scrollTop = 0;
      renderClientResults();
      clientSearch.focus();
    });
    clientSearch.addEventListener('input', () => {
      clientLimit = CLIENT_PAGE;
      clientResults.scrollTop = 0;
      renderClientResults();
    });
    clientPicker.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeClientPicker();
        clientToggle.focus();
      }
    });
    clientMore.addEventListener('click', () => {
      const firstNew = clientLimit;
      clientLimit += CLIENT_PAGE;
      renderClientResults();
      clientResults.children[firstNew]?.focus();
    });
    clientResults.addEventListener('click', (event) => {
      const button = event.target.closest('[data-c]');
      if (!button) return;
      pickClient(button.dataset.c);
      closeClientPicker();
      paint();
      clientToggle.focus();
    });
    newToggle.addEventListener('click', () => {
      closeClientPicker();
      pickClient('novo');
      paint();
      OC.$('#n-newcli', el).focus();
    });
    const ready = () => (state.client === 'novo' ? state.newClient.trim().length >= 2 : !!state.client) && (newWork() ? state.work.trim().length >= 2 : !!state.workId)
      && (state.start !== 'copy' || state.copy) && (state.start !== 'kit' || state.kit);
    const hint = () => {
      if (ready()) return '';
      if (!state.client) return 'Escolha o cliente';
      if (state.client === 'novo' && state.newClient.trim().length < 2) return 'Digite o nome do novo cliente';
      if (newWork() ? state.work.trim().length < 2 : !state.workId) return 'Dê um nome à obra';
      return state.start === 'copy' ? 'Escolha a proposta para copiar' : 'Escolha o kit';
    };
    function paint() {
      const selected = clients.find((client) => client.id === state.client);
      OC.$('#n-cli-label', el).textContent = selected ? clientName(selected) : 'Buscar cliente';
      if (selected) clientToggle.setAttribute('aria-label', `Trocar cliente: ${clientName(selected)}`);
      else clientToggle.removeAttribute('aria-label');
      newToggle.setAttribute('aria-pressed', String(state.client === 'novo'));
      OC.$('#n-newcli', el).hidden = state.client !== 'novo';
      const works = activeWorks();
      OC.$('#n-works', el).innerHTML = works.length ? works.map((w) => `<button class="chip-act" type="button" data-w="${esc(w.id)}" aria-pressed="${state.workId === w.id}">${esc(w.name)}</button>`).join('')
        + `<button class="chip-act" type="button" data-w="nova" aria-pressed="${state.workId === 'nova'}">${icon('plus', 16)}Nova obra</button>` : '';
      OC.$('#n-work', el).hidden = !newWork();
      OC.$('#n-city-f', el).style.display = newWork() ? '' : 'none'; // .field tem display proprio: hidden nao esconde
      OC.$('#n-days', el).innerHTML = VALID.map((d) => `<button class="chip-act" type="button" data-d="${d}" aria-pressed="${state.days === d}">${d} dias</button>`).join('');
      OC.$('#n-until', el).textContent = `Vale até ${OC.dateFull(addDays(state.days))}`;
      OC.$('#n-start', el).innerHTML = START.map(([k, ic, t, s]) => `<button class="opt" type="button" data-s="${k}" aria-pressed="${state.start === k}">${icon(ic, 20)}<span><b>${t}</b><small>${s}</small></span><i class="radio"></i></button>`).join('');
      const pick = state.start === 'copy' ? copyable().map((p) => `<button class="chip-act" type="button" data-p="${esc(p.id)}" aria-pressed="${state.copy === p.id}">${esc(p.number)} · ${esc(p.workName || p.clientName)}</button>`).join('') || '<small class="hint">Nenhuma proposta com itens para copiar.</small>'
        : state.start === 'kit' ? kits.map((k) => `<button class="chip-act" type="button" data-k="${esc(k.id)}" aria-pressed="${state.kit === k.id}">${esc(k.name)}</button>`).join('') || '<small class="hint">Nenhum kit com itens.</small>' : '';
      OC.$('#n-pick', el).innerHTML = pick;
      OC.$('#n-hint', el).textContent = hint();
      OC.$('#n-go', el).disabled = !ready();
      OC.$$('[data-w]', el).forEach((b) => b.addEventListener('click', () => { state.workId = b.dataset.w; paint(); if (state.workId === 'nova') OC.$('#n-work', el).focus(); }));
      OC.$$('[data-d]', el).forEach((b) => b.addEventListener('click', () => { state.days = Number(b.dataset.d); paint(); }));
      OC.$$('[data-s]', el).forEach((b) => b.addEventListener('click', () => { state.start = b.dataset.s; paint(); }));
      OC.$$('[data-p]', el).forEach((b) => b.addEventListener('click', () => { state.copy = b.dataset.p; paint(); }));
      OC.$$('[data-k]', el).forEach((b) => b.addEventListener('click', () => { state.kit = b.dataset.k; paint(); }));
    }
    const bindText = (sel, key) => OC.$(sel, el).addEventListener('input', (event) => {
      state[key] = event.target.value;
      OC.$('#n-go', el).disabled = !ready();
      OC.$('#n-hint', el).textContent = hint();
    });
    bindText('#n-newcli', 'newClient');
    bindText('#n-work', 'work');
    bindText('#n-city', 'city');

    OC.$('#n-go', el).addEventListener('click', async (event) => {
      const b = event.currentTarget;
      if (b.disabled || !ready()) return;
      b.disabled = true;
      el.inert = true;
      try {
        let clientId = state.client;
        if (clientId === 'novo') {
          // Guarda o cliente criado: se a obra falhar, tentar de novo nao duplica o cliente.
          clientId = (await OC.api('/clients', { method: 'POST', body: { legalName: state.newClient.trim() } })).clientId;
          const client = { id: clientId, legalName: state.newClient.trim() };
          clients.push(client);
          indexedClients.unshift({ client, text: searchClientText(clientName(client)) });
          state.client = clientId;
        }
        const creating = newWork();
        const work = creating ? state.work.trim() : (activeWorks().find((w) => w.id === state.workId) || {}).name || '';
        const key = `${clientId}|${creating ? `nova:${work}` : state.workId}`;
        if (made.key !== key) made = { key, workId: creating ? '' : state.workId };
        if (!made.workId) made.workId = (await OC.api(`/clients/${clientId}/works`, { method: 'POST', body: { name: work, address: state.city.trim() || null } })).workId;
        if (!made.proposal) made.proposal = (await OC.api('/proposals', { method: 'POST', body: { clientId, workId: made.workId, scope: `Proposta para ${work}`, validUntil: addDays(state.days) } })).proposal;
        const created = made.proposal;
        if (state.start === 'copy') {
          await OC.api(`/proposals/${created.id}/items/copy-from-proposal`, { method: 'POST', body: { sourceProposalId: state.copy } });
          // Condicoes comerciais da origem (pagamento, prazo, garantia); se falhar, a proposta segue sem elas.
          try {
            const c = OC.parseConditions((await OC.api(`/proposals/${state.copy}`)).proposal.scope);
            if (c.executionTerm || c.paymentTerms || c.warranty || c.notes) await OC.api(`/proposals/${created.id}/details`, { method: 'PATCH', body: { scope: JSON.stringify({ ...c, scope: `Proposta para ${work}` }) } });
          } catch { /* fica so com os itens */ }
        }
        if (state.start === 'kit') await OC.api(`/kits/${state.kit}/apply-to-proposal`, { method: 'POST', body: { proposalId: created.id } });
        OC.toast(`${created.number} criada`);
        OC.go('prop', { id: created.id, tab: 'itens' }, { back: true });
      } catch (error) {
        OC.toast(error.message, 'warning-circle');
        paint();
      } finally {
        el.inert = false;
      }
    });
    paint();
  };
})(window.OC = window.OC || {});
