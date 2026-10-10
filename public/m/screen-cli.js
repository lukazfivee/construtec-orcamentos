// Clientes e obras no celular: cartoes que abrem com as obras, propostas e atalho para proposta nova; cadastro e edicao
// completos do cliente (razao social, nome fantasia, documento e contato da carta), como ClientsRegistry.tsx e
// ClientContactFields.tsx no computador. POST /clients e PATCH /clients/:id devolvem a lista atualizada.
(function (OC) {
  const { esc, icon } = OC;
  const CONTACT = [['name', 'Nome', 120, 'text'], ['role', 'Cargo', 120, 'text'], ['department', 'Setor', 120, 'text'], ['email', 'E-mail', 160, 'email'], ['phone', 'Telefone', 40, 'tel']];
  const input = (id, label, value, max, type, extra) => `<label class="field" style="margin-top:12px"><span>${label}</span><input id="${id}" type="${type || 'text'}" maxlength="${max}" value="${esc(value || '')}" autocomplete="off"${extra || ''}></label>`;

  // Folha do cliente: sem cliente, cadastra; com cliente, edita. onSaved recebe { id, clients }.
  OC.clientSheet = function (client, onSaved) {
    const c = client || {};
    const contact = c.contact || {};
    const s = OC.sheet(`${OC.sheetHead(client ? 'Editar cliente' : 'Novo cliente', client ? 'pencil-simple' : 'plus')}
      ${input('cl-legal', 'Razão social', c.legalName, 180, 'text', ' placeholder="Ex.: Rede São Lucas Saúde Ltda."')}
      ${input('cl-trade', 'Nome fantasia · opcional', c.tradeName, 180)}
      ${input('cl-doc', 'CPF ou CNPJ · opcional', c.document, 30, 'text', ' inputmode="numeric"')}
      <p class="sheet-sec">Contato na carta da proposta</p>
      <p class="sheet-text" style="margin-top:0">Quem recebe a proposta neste cliente. Entra sozinho na linha A/C da carta.</p>
      ${CONTACT.map(([key, label, max, type]) => input(`cl-c-${key}`, label, contact[key], max, type)).join('')}
      <div class="sheet-actions"><button class="btn2" type="button" data-no>Cancelar</button><button class="btn" type="button" data-yes>Salvar cliente</button></div>`);
    s.el.firstElementChild.classList.add('sheet-tall');
    OC.$('[data-no]', s.el).addEventListener('click', s.close);
    OC.$('[data-yes]', s.el).addEventListener('click', async (event) => {
      const b = event.currentTarget;
      const legalName = OC.$('#cl-legal', s.el).value.trim();
      if (legalName.length < 2) { OC.toast('Informe a razão social.', 'warning-circle'); OC.$('#cl-legal', s.el).focus(); return; }
      const body = {
        legalName,
        tradeName: OC.$('#cl-trade', s.el).value.trim() || null,
        document: OC.$('#cl-doc', s.el).value.trim() || null,
        contact: Object.fromEntries(CONTACT.map(([key]) => [key, OC.$(`#cl-c-${key}`, s.el).value.trim()])),
      };
      b.disabled = true;
      try {
        const data = client
          ? await OC.api(`/clients/${client.id}`, { method: 'PATCH', body })
          : await OC.api('/clients', { method: 'POST', body });
        s.close();
        OC.toast(client ? 'Cliente atualizado' : 'Cliente cadastrado');
        onSaved({ id: client ? client.id : data.clientId, clients: data.clients || [] });
      } catch (error) { OC.toast(error.message, 'warning-circle'); b.disabled = false; }
    });
    setTimeout(() => { if (!client) OC.$('#cl-legal', s.el).focus(); }, 50);
  };

  OC.screens.cli = async function (params) {
    let [clients, proposals] = await Promise.all([OC.api('/clients').then((d) => d.clients || []), OC.loadProposals().catch(() => [])]);
    let open = '', query = '';
    const count = (c) => proposals.filter((p) => p.clientName === (c.tradeName || c.legalName) || p.clientName === c.legalName);
    const el = OC.render(`${OC.header('Clientes e obras', { back: true })}
      <p class="sub" style="margin:-6px 0 0" id="c-sub"></p>
      <label class="search">${icon('magnifying-glass', 18)}<input id="c-q" type="search" placeholder="Buscar cliente" autocomplete="off"></label>
      <div class="kit-list" id="c-list"></div>
      ${OC.canEdit() ? `<button class="btn2" type="button" id="c-new">${icon('plus', 18)}Novo cliente</button>` : ''}`, true, params);
    const saved = (result) => { clients = result.clients.length ? result.clients : clients; open = result.id; paint(); };
    const paint = () => {
      const works = clients.reduce((n, c) => n + (c.works || []).length, 0);
      OC.$('#c-sub', el).textContent = `${clients.length} clientes · ${proposals.length} propostas · ${works} obras`;
      const q = query.trim().toLowerCase();
      const rows = clients.filter((c) => !q || `${c.legalName} ${c.tradeName || ''} ${c.document || ''}`.toLowerCase().includes(q));
      OC.$('#c-list', el).innerHTML = rows.map((c) => {
        const ps = count(c), approved = ps.filter((p) => p.status === 'approved').reduce((n, p) => n + (p.totalSale || 0), 0);
        const on = open === c.id;
        const ct = c.contact || {};
        const who = [ct.name, ct.role].filter(Boolean).join(' · ');
        return `<div class="card cli${on ? ' open' : ''}"><button class="cli-head" type="button" data-c="${esc(c.id)}" aria-expanded="${on}"><span class="avatar" style="--a:36px">${esc(OC.initials(c.tradeName || c.legalName))}</span>
          <span class="grow"><b>${esc(c.tradeName || c.legalName)}</b><small>${ps.length} ${ps.length === 1 ? 'proposta' : 'propostas'}${approved ? ` · aprovado ${esc(OC.mi(approved))}` : ''}${(c.works || []).length ? ` · ${c.works.length} ${c.works.length === 1 ? 'obra' : 'obras'}` : ''}</small></span>${icon(on ? 'caret-up' : 'caret-down', 18)}</button>
          ${on ? `<div class="cli-body">
            ${c.tradeName ? `<div class="kv"><span>Razão social</span><b>${esc(c.legalName)}</b></div>` : ''}
            ${c.document ? `<div class="kv"><span>CPF ou CNPJ</span><b>${esc(c.document)}</b></div>` : ''}
            ${who || ct.email || ct.phone ? `<div class="kv"><span>Contato</span><b>${esc([who, ct.email, ct.phone].filter(Boolean).join(' · '))}</b></div>` : ''}
            ${(c.works || []).map((w) => `<div class="kv"><span>${esc(w.name)}${w.active === false ? ' · inativa' : ''}</span><b>${esc(w.address || '')}</b></div>`).join('') || '<small class="hint">Sem obras cadastradas.</small>'}
            ${ps.map((p) => `<button class="prow" type="button" data-p="${esc(p.id)}"><span class="grow"><b>${esc(p.workName || p.number)}</b><small>${esc(p.number)} · ${esc(OC.rev(p.revision))}</small></span><span class="end">${OC.pill(p.status)}</span>${icon('caret-right', 18)}</button>`).join('')}
            ${OC.canEdit() ? `<div class="chips wrap"><button class="chip-act" type="button" data-nova="${esc(c.id)}">${icon('plus', 16)}Nova proposta</button><button class="chip-act" type="button" data-edit="${esc(c.id)}">${icon('pencil-simple', 16)}Editar cliente</button></div>` : ''}</div>` : ''}</div>`;
      }).join('') || `<div class="empty">${icon('users', 28)}Nenhum cliente.</div>`;
      OC.$$('[data-c]', el).forEach((b) => b.addEventListener('click', () => { open = open === b.dataset.c ? '' : b.dataset.c; paint(); }));
      OC.$$('[data-p]', el).forEach((b) => b.addEventListener('click', () => OC.open('prop', { id: b.dataset.p })));
      OC.$$('[data-nova]', el).forEach((b) => b.addEventListener('click', () => OC.open('nova', { client: b.dataset.nova })));
      OC.$$('[data-edit]', el).forEach((b) => b.addEventListener('click', () => OC.clientSheet(clients.find((c) => c.id === b.dataset.edit), saved)));
    };
    OC.$('#c-q', el).addEventListener('input', (event) => { query = event.target.value; paint(); });
    const nc = OC.$('#c-new', el);
    if (nc) nc.addEventListener('click', () => OC.clientSheet(null, saved));
    paint();
  };
})(window.OC = window.OC || {});
