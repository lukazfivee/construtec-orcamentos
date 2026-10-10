// Excluir, descartar e recuperar proposta no celular (prototipo: Rodada 25, folhas propMenu, propDel e recProp).
// Excluir: proposta nao aprovada, para quem edita (administrador, gestor e comercial; tecnico nao).
// Descartar com registro e Propostas descartadas: so administrador (o servidor confere de novo).
// A obra sem movimento no Centro de Custos sai junto com a proposta e volta se a proposta for recuperada.
(function (OC) {
  const { esc, icon } = OC;
  const user = () => OC.session.user() || {};
  OC.isAdmin = () => user().role === 'admin';
  OC.canDeleteProposal = () => OC.canEdit() && user().suiteRole !== 'tecnico';

  const ERR = {
    net: ['wifi-slash', 'Sem internet', 'Nada foi alterado. Conecte o celular e tente de novo.'],
    mov: ['warning-circle', 'A obra já tem movimento', 'Exclua ou estorne os lançamentos antes.'],
    cc: ['warning-circle', 'O Centro de Custos não respondeu', 'Nada foi alterado. Tente de novo em alguns minutos.'],
  };
  const errKind = (error, discard) => {
    if (!error || error.status === 0) return ERR.net;
    if (discard && error.status === 409 && /movimento|lançamentos/i.test(error.message)) return ERR.mov;
    if (error.status === 503) return ERR.cc;
    return ['warning-circle', 'Não foi possível concluir', error.message];
  };
  const errBox = (e, extra) => `<div class="sheet-err" role="alert">${icon(e[0], 20)}<span><b>${esc(e[1])}</b><small>${esc(e[2])}</small>${extra || ''}</span></div>`;
  const okBox = (title, text) => `<div class="sheet-ok">${icon('check-circle-fill', 34)}<b>${esc(title)}</b><p>${esc(text)}</p></div>`;
  const spin = (label) => `${icon('circle-notch', 18, 'rot')}${esc(label)}`;

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); } catch {
      const t = document.createElement('textarea');
      t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch { /* sem copia */ }
      t.remove();
    }
    OC.toast(`${text} copiado`, 'copy');
  }

  // Menu de tres pontos da proposta: PDF, copiar numero, situacao, validade, nova revisao e, por ultimo, excluir ou descartar.
  OC.propMenu = function (p) {
    const apr = p.status === 'approved';
    const del = !apr && OC.canDeleteProposal(), desc = apr && OC.isAdmin();
    const row = (key, ic, t, s, cls) => `<button class="menu-item${cls ? ` ${cls}` : ''}" type="button" data-m="${key}">${icon(ic, 22)}<span class="grow">${esc(t)}<small>${esc(s)}</small></span>${cls ? '' : icon('caret-right', 18)}</button>`;
    const s = OC.sheet(`${OC.sheetHead(p.number, 'file-text')}<p class="sheet-text" style="margin-top:2px">${esc(p.workName || '')}${p.clientName ? ` · ${esc(p.clientName)}` : ''}</p>
      <div class="menu-card pm-list">
        ${row('pdf', 'file-text', 'PDF da proposta', 'Pré-visualizar, baixar ou enviar')}
        ${row('copy', 'copy', 'Copiar número', p.number)}
        ${OC.canChangeStatus && OC.canChangeStatus(p) ? row('status', 'arrows-left-right', 'Mudar situação', `Agora: ${OC.STATUS[p.status][0]}`) : ''}
        ${OC.canEdit() && p.isLatest && OC.validitySheet ? row('val', 'calendar-blank', 'Validade', p.validUntil ? `Até ${OC.dateFull(p.validUntil)}` : 'Sem validade definida') : ''}
        ${OC.canCreateRevision && OC.canCreateRevision(p) ? row('rev', 'clock-counter-clockwise', 'Criar nova revisão', `${OC.rev(p.revision + 1)} em edição; a atual fica guardada`) : ''}
        ${del ? row('del', 'trash', 'Excluir proposta', `Apaga ${p.number} e as revisões. Não dá para desfazer.`, 'danger') : ''}
        ${desc ? row('desc', 'archive', 'Descartar com registro', 'Sai da lista, fica guardada e pode ser recuperada', 'danger') : ''}
      </div>`);
    s.el.addEventListener('click', (event) => {
      const b = event.target.closest('[data-m]');
      if (!b) return;
      s.close();
      if (b.dataset.m === 'pdf') OC.open('pdf', { id: p.id });
      else if (b.dataset.m === 'copy') copy(p.number);
      else if (b.dataset.m === 'status') OC.statusSheet(p);
      else if (b.dataset.m === 'val') OC.validitySheet(p);
      else if (b.dataset.m === 'rev') OC.createRevision(p);
      else if (b.dataset.m === 'del') deleteSheet(p);
      else if (b.dataset.m === 'desc') discardSheet(p);
    });
  };

  // Folha com estados: form, send, erro (mensagem no topo) e ok. paint(state, error) devolve o html do corpo.
  function stateSheet(head, paint, bind) {
    const s = OC.sheet(`${head}<div data-body></div>`);
    const body = OC.$('[data-body]', s.el);
    let busy = false;
    const state = (name, error) => {
      busy = name === 'send';
      body.innerHTML = paint(name, error);
      bind(body, state);
    };
    // Enquanto envia, a folha nao fecha.
    s.el.addEventListener('click', (event) => { if (busy && (event.target === s.el || event.target.closest('.sheet-x'))) event.stopImmediatePropagation(); }, true);
    return { s, state };
  }

  function deleteSheet(p) {
    const head = `${OC.sheetHead(`Excluir ${p.number}?`, 'trash')}<p class="sheet-text" style="margin-top:2px">${esc(p.workName || '')} · ${esc(p.clientName || '')}</p>`;
    const { s, state } = stateSheet(head, (st, error) => `${st === 'erro' ? errBox(errKind(error)) : ''}
      <p class="sheet-text">A proposta ${esc(OC.rev(p.revision))} e todas as revisões anteriores são apagadas. Não dá para desfazer.</p>
      <div class="sheet-actions"><button class="btn2" type="button" data-no${st === 'send' ? ' disabled' : ''}>Cancelar</button>
        <button class="btn btn-danger" type="button" data-yes${st === 'send' ? ' disabled' : ''}>${st === 'send' ? spin('Excluindo…') : `${icon('trash', 18)}Excluir`}</button></div>`,
    (body, go) => {
      OC.$('[data-no]', body).addEventListener('click', s.close);
      OC.$('[data-yes]', body).addEventListener('click', async () => {
        go('send');
        try {
          await OC.api(`/proposals/${encodeURIComponent(p.id)}?mode=all`, { method: 'DELETE' });
        } catch (error) { if (document.body.contains(s.el)) go('erro', error); return; }
        s.close();
        OC.toast(`${p.number} excluída`, 'trash');
        OC.go('props');
      });
    });
    state('form');
  }

  function discardSheet(p) {
    let typed = '', reason = '';
    const ok = () => typed.trim().toUpperCase() === String(p.number).toUpperCase();
    const head = `${OC.sheetHead(`Descartar ${p.number}?`, 'archive')}<p class="sheet-text" style="margin-top:2px">${esc(p.workName || '')} · ${esc(p.clientName || '')}</p>`;
    const obra = p.costCenterId ? `<p class="sheet-note">${icon('buildings', 18)}<span>A obra no Centro de Custos, sem movimento, sai junto. Se a proposta for recuperada, a obra volta.</span></p>` : '';
    const { s, state } = stateSheet(head, (st, error) => {
      if (st === 'ok') {
        return `${okBox(`${p.number} descartada`, 'Fica guardada em Menu › Propostas descartadas, com o seu nome e a data de hoje. Dá para recuperar quando quiser.')}
          <div class="sheet-actions"><button class="btn2" type="button" data-close>Fechar</button><button class="btn" type="button" data-see>${icon('archive', 18)}Ver descartadas</button></div>`;
      }
      const e = st === 'erro' ? errKind(error, true) : null;
      const link = e === ERR.mov && p.costCenterId ? `<a class="err-link" href="${esc(OC.suite.centroLink(p.costCenterId))}"${/SuiteConstrutec\//.test(navigator.userAgent) ? '' : ' target="_blank" rel="noopener"'}>Ver obra no Centro de Custos${icon('arrow-square-out', 14)}</a>` : '';
      const lock = st === 'send' ? ' disabled' : '';
      return `${e ? errBox(e, link) : ''}
        <p class="sheet-text">A proposta sai da lista de Propostas e fica guardada com quem descartou e quando. Um administrador pode recuperar em Menu › Propostas descartadas.</p>
        ${obra}
        <label class="field" style="margin-top:14px"><span>Motivo (opcional)</span><textarea data-reason maxlength="300" rows="2" placeholder="Ex.: cliente desistiu da obra"${lock}>${esc(reason)}</textarea></label>
        <label class="field" style="margin-top:12px"><span>Para confirmar, digite ${esc(p.number)}</span>
          <input type="text" data-typed value="${esc(typed)}" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${esc(p.number)}"${lock}></label>
        <p class="type-hint" data-hint></p>
        <div class="sheet-actions"><button class="btn2" type="button" data-no${lock}>Cancelar</button>
          <button class="btn btn-danger" type="button" data-yes${lock}>${st === 'send' ? spin('Descartando…') : `${icon('archive', 18)}Descartar`}</button></div>`;
    }, (body, go) => {
      const see = OC.$('[data-see]', body);
      if (see) {
        OC.$('[data-close]', body).addEventListener('click', s.close);
        see.addEventListener('click', () => { s.close(); OC.go('menu'); OC.open('desc'); });
        return;
      }
      const field = OC.$('[data-typed]', body), yes = OC.$('[data-yes]', body), hint = OC.$('[data-hint]', body);
      const sync = () => {
        typed = field.value;
        const has = typed.trim() !== '';
        field.classList.toggle('typed-ok', ok());
        field.classList.toggle('typed-bad', has && !ok());
        hint.textContent = ok() ? 'Número conferido' : (has ? 'O número não confere' : `Digite ${p.number} para liberar`);
        if (!field.disabled) yes.disabled = !ok();
      };
      field.addEventListener('input', sync);
      OC.$('[data-reason]', body).addEventListener('input', (event) => { reason = event.target.value; });
      OC.$('[data-no]', body).addEventListener('click', s.close);
      yes.addEventListener('click', async () => {
        if (!ok()) return;
        go('send');
        try {
          await OC.api(`/proposals/${encodeURIComponent(p.id)}/discard`, { method: 'POST', body: { confirmNumber: typed.trim(), reason: reason.trim() || undefined } });
        } catch (error) { if (document.body.contains(s.el)) go('erro', error); return; }
        OC.toast(`${p.number} descartada · fica em Propostas descartadas`, 'archive');
        go('ok');
        if (OC.current() === 'prop') OC.go('props');
      });
      sync();
    });
    state('form');
  }

  // ===== Menu › Propostas descartadas (so administrador)
  const loadDiscarded = async () => ((await OC.api('/proposals/discarded')).discarded || []).filter((d) => !d.restored_at);
  OC.discardedCount = async () => (OC.isAdmin() ? (await loadDiscarded().catch(() => [])).length : 0);
  // O banco devolve a hora com fuso (UTC); mostra no horario do aparelho.
  const when = (iso) => {
    const d = iso ? new Date(String(iso).replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00')) : null;
    if (!d || Number.isNaN(d.getTime())) return iso ? OC.dateFull(iso) : '';
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };
  const revs = (d) => `${d.revision_count} ${d.revision_count === 1 ? 'revisão' : 'revisões'}`;

  OC.screens.desc = async function (params) {
    const list = await loadDiscarded();
    const el = OC.render(`${OC.header('Propostas descartadas', { back: true })}
      <p class="sub" style="margin:-6px 0 0">${list.length ? `${list.length} ${list.length > 1 ? 'propostas guardadas' : 'proposta guardada'} · só o administrador vê` : 'Só o administrador vê'}</p>
      ${list.length ? `<div class="desc-list">${list.map((d) => `<button class="card desc-row" type="button" data-d="${esc(d.id)}">
          <span class="desc-top"><b>${esc(d.proposal_number)}</b>${d.had_approval ? OC.pill('approved') : ''}<span class="grow"></span>${icon('caret-right', 18)}</span>
          <span class="desc-obra">${esc(d.work_name || 'Sem obra')}</span>
          <small>${esc(d.client_name || '')} · ${esc(revs(d))}</small>
          <small>Descartada por ${esc(d.discarded_by_name || '—')} · ${esc(when(d.discarded_at))}</small>
          <small class="desc-why${d.reason ? '' : ' none'}">${d.reason ? `“${esc(d.reason)}”` : 'Sem motivo informado'}</small></button>`).join('')}</div>`
        : `<div class="empty" style="padding-top:48px">${icon('archive', 32)}<b class="empty-t">Nenhuma proposta descartada</b>
          <span>Quando um administrador descartar uma proposta aprovada, ela fica guardada aqui com quem descartou, quando e o motivo, e pode ser recuperada.</span></div>`}`, true, params);
    OC.$$('[data-d]', el).forEach((b) => b.addEventListener('click', () => OC.open('descDet', { id: b.dataset.d })));
  };

  OC.screens.descDet = async function (params) {
    const d = (await loadDiscarded()).find((x) => x.id === params.id);
    if (!d) { OC.toast('Esta proposta não está mais entre as descartadas.', 'info'); return OC.go('desc', {}, { back: true }); }
    const kv = [['Cliente', d.client_name || '—'], ['Obra', d.work_name || '—'], ['Revisões', `${revs(d)}${d.had_approval ? ' · aprovada' : ''}`], ['Descartada por', d.discarded_by_name || '—'], ['Quando', when(d.discarded_at)]];
    const el = OC.render(`${OC.header(d.proposal_number, { back: true })}
      <div class="card">${kv.map(([k, v]) => `<div class="kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
      <div class="card scope"><small class="label">Motivo</small><p${d.reason ? '' : ' class="none"'}>${esc(d.reason || 'Sem motivo informado.')}</p></div>
      <p class="hint">Se a obra saiu do Centro de Custos junto com a proposta, ela volta ao recuperar.</p>
      <div class="actions"><button class="btn" type="button" data-rec>${icon('arrow-counter-clockwise', 18)}Recuperar proposta</button></div>`, true, params);
    OC.$('[data-rec]', el).addEventListener('click', () => recoverSheet(d));
  };

  function recoverSheet(d) {
    let result = null;
    const head = OC.sheetHead(`Recuperar ${d.proposal_number}?`, 'arrow-counter-clockwise');
    const { s, state } = stateSheet(head, (st, error) => {
      if (st === 'ok') {
        return `${okBox(`${d.proposal_number} recuperada`, `Voltou para Propostas${d.had_approval ? ' como Aprovada' : ''}, com tudo o que tinha quando foi descartada.`)}
          <div class="sheet-actions"><button class="btn2" type="button" data-close>Fechar</button><button class="btn" type="button" data-open${result && result.proposalId ? '' : ' disabled'}>${icon('file-text', 18)}Abrir proposta</button></div>`;
      }
      const lock = st === 'send' ? ' disabled' : '';
      return `${st === 'erro' ? errBox(errKind(error)) : ''}
        <p class="sheet-text">Volta para Propostas${d.had_approval ? ' como Aprovada' : ''}, com as revisões, os itens e a mão de obra.</p>
        <div class="sheet-actions"><button class="btn2" type="button" data-no${lock}>Cancelar</button>
          <button class="btn" type="button" data-yes${lock}>${st === 'send' ? spin('Recuperando…') : `${icon('arrow-counter-clockwise', 18)}Recuperar`}</button></div>`;
    }, (body, go) => {
      const open = OC.$('[data-open]', body);
      if (open) {
        OC.$('[data-close]', body).addEventListener('click', () => { s.close(); OC.go('desc', {}, { back: true }); });
        open.addEventListener('click', () => { s.close(); OC.go('prop', { id: result.proposalId }); });
        return;
      }
      OC.$('[data-no]', body).addEventListener('click', s.close);
      OC.$('[data-yes]', body).addEventListener('click', async () => {
        go('send');
        try {
          result = await OC.api(`/proposals/discarded/${encodeURIComponent(d.id)}/restore`, { method: 'POST', body: {} });
        } catch (error) { if (document.body.contains(s.el)) go('erro', error); return; }
        OC.toast(`${d.proposal_number} voltou para Propostas`);
        go('ok');
      });
    });
    state('form');
  }
})(window.OC = window.OC || {});
