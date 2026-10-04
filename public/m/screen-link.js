// Link para o cliente ver e aprovar a proposta, lado da equipe no celular (Rodada 27).
// Gerar, desativar e confirmar a aprovacao exigem p11 (o servidor confere de novo). Custo, BDI e margem nunca vao no link.
(function (OC) {
  const { esc, icon } = OC;
  const DAYS = [7, 15, 30];
  const when = (value) => {
    // O Postgres devolve "2026-11-03 20:15:00+00"; o Safari so entende ISO.
    const date = new Date(String(value || '').replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00'));
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };
  const day = (value) => (value ? OC.dateFull(String(value).slice(0, 10)) : '');
  const absolute = (url) => (/^https?:/.test(url) ? url : `${location.origin}${url}`);

  const STATE_TEXT = {
    disabled: ['prohibit', 'Link desativado', 'Quem abrir vê um aviso de link desativado. Gere um novo link para enviar de novo.'],
    expired: ['hourglass-medium', 'Link vencido', 'O prazo do link acabou. Gere um novo link para o cliente.'],
    superseded: ['file-text', 'Link de uma revisão antiga', 'Existe uma revisão mais nova desta proposta; gere o link dela.'],
    adjust: ['paper-plane-tilt', 'Cliente pediu ajuste', 'A proposta voltou para edição como nova revisão. Ajuste e envie de novo.'],
    confirmed: ['check-circle', 'Aprovação confirmada', 'A proposta está aprovada com o aceite do cliente como evidência.'],
  };

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch {
      const area = document.createElement('textarea');
      area.value = text; area.style.position = 'fixed'; area.style.opacity = '0';
      document.body.appendChild(area); area.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      area.remove();
      return ok;
    }
  }

  const message = (p, url) => `Olá! Segue o link para ver e aprovar a proposta ${p.number} (${OC.rev(p.revision)}) da Construtec para ${p.workName || p.clientName}, no valor de ${OC.money0((p.totals || {}).finalValue)}${p.validUntil ? `, válida até ${OC.dateFull(p.validUntil)}` : ''}.\n${url}`;

  function shareSheet(p, link) {
    const url = absolute(link.url);
    const s = OC.sheet(`${OC.sheetHead('Compartilhar o link', 'paper-plane-tilt')}
      <label class="field" style="margin-top:12px"><span>Mensagem</span><textarea rows="5" data-msg>${esc(message(p, url))}</textarea></label>
      <div class="sheet-actions col"><button class="btn" type="button" data-send>${icon('paper-plane-tilt', 18)}WhatsApp ou outro app</button><button class="btn2" type="button" data-copy>${icon('copy', 18)}Copiar a mensagem</button></div>`);
    const text = () => OC.$('[data-msg]', s.el).value;
    OC.$('[data-copy]', s.el).addEventListener('click', async () => { OC.toast((await copyText(text())) ? 'Mensagem copiada' : 'Não deu para copiar', 'copy'); });
    OC.$('[data-send]', s.el).addEventListener('click', async () => {
      if (navigator.share) {
        try { await navigator.share({ text: text() }); s.close(); } catch (error) { if (!error || error.name !== 'AbortError') OC.toast('Não deu para abrir o compartilhamento', 'warning-circle'); }
        return;
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(text())}`, '_blank', 'noopener');
    });
  }

  function views(link) {
    const list = link.views || [];
    return `<div class="card"><div class="sec-row"><b>${icon('eye', 18)}Visualizações</b><span class="tag">${list.length}</span></div>
      ${list.length ? list.slice(0, 6).map((v) => `<div class="kv"><span>${esc(when(v.at))}</span><b>${esc(v.device || 'Aparelho')}</b></div>`).join('') : '<p class="hint">O cliente ainda não abriu o link.</p>'}</div>`;
  }

  const reply = (link) => {
    const r = link.response;
    if (!r) return '';
    const who = [r.name, r.role].filter(Boolean).join(' · ');
    return `<div class="card"><div class="sec-row"><b>${icon(r.kind === 'approved' ? 'check-circle' : 'paper-plane-tilt', 18)}${r.kind === 'approved' ? 'O cliente aprovou' : 'Pedido de ajuste'}</b><span class="tag">${esc(when(r.at))}</span></div>
      ${who ? `<div class="kv"><span>Quem</span><b>${esc(who)}</b></div>` : ''}
      ${r.code ? `<div class="kv"><span>Código do aceite</span><b>${esc(r.code)}</b></div>` : ''}
      ${r.message ? `<p class="sheet-text">${esc(r.message)}</p>` : ''}</div>`;
  };

  function form(p, canSend) {
    if (p.status === 'draft') return `<p class="hint lock">${icon('lock-simple', 15)}<span>Envie a proposta para revisão antes de gerar o link.</span></p>`;
    if (!canSend) return `<p class="hint lock">${icon('lock-simple', 15)}<span>${OC.can('p11') ? 'Só a revisão atual pode ter link.' : 'Seu papel não permite enviar propostas ao cliente.'}</span></p>`;
    const left = OC.daysUntil(p.validUntil);
    return `<div class="card"><span class="label">Validade do link</span>
        <div class="chips wrap" id="l-days">${DAYS.map((d) => `<button class="chip-act" type="button" data-d="${d}">${d} dias</button>`).join('')}</div>
        <p class="hint">${left !== null && left > 0 ? `A proposta vale mais ${left} ${left === 1 ? 'dia' : 'dias'}; o link mais curto não encurta a proposta.` : 'O link vale a partir de agora.'}</p>
        <button class="opt" type="button" id="l-id" aria-pressed="true"><span class="grow"><b>Pedir nome e cargo</b><small>O cliente informa quem está aprovando</small></span><span class="switch"></span></button></div>
      <p class="hint">Gerar o link conta como envio: a proposta passa para Enviada.</p>
      <div class="actions"><button class="btn" type="button" id="l-gen">${icon('paper-plane-tilt', 18)}Gerar link</button></div>`;
  }

  OC.screens.link = async function (params) {
    const el = OC.render(`${OC.header('Link para o cliente', { back: true })}<div id="l-body" class="p-body"><div class="skeleton" style="height:120px"></div><div class="skeleton" style="height:160px"></div></div>`, true, params);
    const body = OC.$('#l-body', el);
    const nav = OC.nav;
    const [{ proposal: p }, data] = await Promise.all([OC.api(`/proposals/${encodeURIComponent(params.id)}`), OC.api(`/proposals/${encodeURIComponent(params.id)}/client-link`)]);
    if (nav !== OC.nav) return;
    const link = data.link;
    const canSend = OC.can('p11') && OC.canEdit() && p.isLatest && (p.status === 'review' || p.status === 'sent');
    const head = `<div class="prop-tags"><span class="tag">${esc(OC.rev(p.revision))}</span><span class="prop-work">${esc(p.number)} · ${esc(p.workName || p.clientName)}</span></div>`;

    if (link && link.state === 'active') {
      const url = link.url ? absolute(link.url) : '';
      body.innerHTML = `${head}<div class="card"><span class="label">Link ativo</span>
          <div class="kv"><span>Vale até</span><b>${esc(day(link.expiresAt))}</b></div>
          <div class="kv"><span>Nome e cargo</span><b>${link.requireIdentity ? 'O cliente informa' : 'Não pede'}</b></div>
          ${url ? `<input class="link-url" type="text" readonly value="${esc(url)}" aria-label="Endereço do link" onfocus="this.select()">
          <div class="pair"><button class="btn2" type="button" data-copy>${icon('copy', 18)}Copiar</button>${OC.can('p11') ? `<button class="btn" type="button" data-share>${icon('paper-plane-tilt', 18)}Compartilhar</button>` : ''}</div>` : ''}</div>
        ${views(link)}
        ${OC.can('p11') ? `<div class="actions"><button class="btn2" type="button" data-off>Desativar o link</button></div>` : '<p class="hint lock">' + icon('lock-simple', 15) + '<span>Você vê o link e as visualizações, sem compartilhar nem desativar.</span></p>'}`;
      const copyButton = OC.$('[data-copy]', body);
      if (copyButton) copyButton.addEventListener('click', async (event) => {
        const label = event.currentTarget; const ok = await copyText(url);
        label.innerHTML = `${icon('check', 18)}${ok ? 'Copiado' : 'Selecione e copie'}`; setTimeout(() => { label.innerHTML = `${icon('copy', 18)}Copiar`; }, 2500);
      });
      const share = OC.$('[data-share]', body);
      if (share) share.addEventListener('click', () => shareSheet(p, link));
      const off = OC.$('[data-off]', body);
      if (off) off.addEventListener('click', () => OC.confirm('Desativar o link', 'O cliente que abrir o link vai ver o aviso de link desativado. Você pode gerar um novo depois.', 'Desativar', async () => {
        await OC.api(`/proposals/${p.id}/client-link/disable`, { method: 'POST', body: {} });
        OC.toast('Link desativado');
        OC.go('link', { id: p.id }, { back: true });
      }));
      return;
    }

    if (link && link.state === 'approved') {
      body.innerHTML = `${head}${reply(link)}<p class="hint">A aprovação do cliente fica como evidência. A proposta só passa para Aprovada quando você confirmar.</p>
        ${OC.can('p11') && p.isLatest ? `<div class="actions"><button class="btn" type="button" data-ok>${icon('check', 18)}Confirmar aprovação</button></div>` : `<p class="hint lock">${icon('lock-simple', 15)}<span>Quem tem permissão de aprovar confirma a aprovação.</span></p>`}${views(link)}`;
      const ok = OC.$('[data-ok]', body);
      if (ok) ok.addEventListener('click', () => OC.confirm('Confirmar aprovação', 'A proposta aprovada fica travada e vira a base de orçado da obra. Não dá para desfazer.', 'Confirmar', async () => {
        await OC.api(`/proposals/${p.id}/client-link/confirm`, { method: 'POST', body: {} });
        OC.toast('Proposta aprovada');
        OC.go('prop', { id: p.id, tab: 'resumo' }, { back: true });
      }));
      return;
    }

    const note = link && STATE_TEXT[link.state];
    body.innerHTML = `${head}${note ? `<div class="card"><div class="sec-row"><b>${icon(note[0] === 'prohibit' ? 'lock-simple' : note[0], 18)}${esc(note[1])}</b></div><p class="sheet-text">${esc(note[2])}</p></div>${reply(link)}` : ''}${form(p, canSend)}`;
    const gen = OC.$('#l-gen', body);
    if (!gen) return;
    let days = 30, identity = true;
    const paint = () => {
      OC.$$('[data-d]', body).forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.d) === days)));
      OC.$('#l-id', body).setAttribute('aria-pressed', String(identity));
    };
    OC.$$('[data-d]', body).forEach((b) => b.addEventListener('click', () => { days = Number(b.dataset.d); paint(); }));
    OC.$('#l-id', body).addEventListener('click', () => { identity = !identity; paint(); });
    paint();
    gen.addEventListener('click', async () => {
      gen.disabled = true; gen.innerHTML = `${icon('circle-notch', 18, 'rot')}Gerando o link…`;
      try {
        await OC.api(`/proposals/${p.id}/client-link`, { method: 'POST', body: { days, requireIdentity: identity } });
        OC.toast('Link gerado');
        OC.go('link', { id: p.id }, { back: true });
      } catch (error) {
        gen.disabled = false; gen.innerHTML = `${icon('paper-plane-tilt', 18)}${error.status === 0 ? 'Tentar de novo' : 'Gerar link'}`;
        OC.toast(error.message, 'warning-circle');
      }
    });
  };

  // Cartao no Resumo da proposta: mostra o link e, se o cliente aprovou, o aviso para confirmar.
  OC.linkCard = async function (p, ctx, body) {
    if (!['review', 'sent', 'approved'].includes(p.status)) return;
    let data;
    try { data = await OC.api(`/proposals/${p.id}/client-link`); } catch { return; }
    const link = data.link;
    if (!link && !(OC.can('p11') && p.isLatest && p.status !== 'approved')) return;
    const awaiting = link && link.state === 'approved';
    const text = !link ? ['Link para o cliente', 'Gere um link para o cliente ver e aprovar'] : awaiting ? ['O cliente aprovou', `${link.response && link.response.name ? link.response.name : 'Aprovação'} · confirme para aprovar a proposta`]
      : link.state === 'active' ? ['Link para o cliente', `Ativo até ${day(link.expiresAt)} · ${(link.views || []).length} visualizações`] : [(STATE_TEXT[link.state] || [])[1] || 'Link para o cliente', 'Toque para ver'];
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `card tile-card${awaiting ? ' hl' : ''}`;
    card.innerHTML = `<span class="tile">${icon(awaiting ? 'check-circle' : 'paper-plane-tilt', 21)}</span><span class="grow"><b>${esc(text[0])}</b><small>${esc(text[1])}</small></span>${icon('caret-right', 18)}`;
    card.addEventListener('click', () => OC.open('link', { id: p.id }, { tab: 'resumo' }));
    const anchor = OC.$('[data-pdf]', body);
    if (anchor) anchor.after(card);
  };
})(window.OC = window.OC || {});
