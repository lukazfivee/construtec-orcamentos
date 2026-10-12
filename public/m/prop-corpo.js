// Corpo da proposta no celular (ProposalBodyBuilder.tsx, useProposalBody.ts, SaveBodyModel.tsx): blocos na ordem do PDF, do Word e
// da pagina do cliente, salvos sozinhos (PUT /proposals/:id/body) logo depois de cada mudanca. Aplicar modelo, salvar como modelo da
// empresa e voltar ao formato padrao. So edita em proposta editavel (OC.propEditable); o servidor confere de novo.
(function (OC) {
  const { esc, icon } = OC;
  const B = OC.body;
  const AUTOSAVE_MS = 800;

  // Cartao do Resumo da proposta.
  OC.corpoTile = (p) => `<button class="card tile-card" type="button" data-corpo><span class="tile">${icon('list', 21)}</span><span class="grow"><b>Corpo da proposta</b>
    <small>${p.bodyBlocks ? `${p.bodyBlocks.length} ${p.bodyBlocks.length === 1 ? 'bloco' : 'blocos'} · carta, textos e planilhas` : 'Formato padrão do documento'}</small></span>${icon('caret-right', 18)}</button>`;

  OC.screens.corpo = async function (params) {
    let p = (await OC.api(`/proposals/${encodeURIComponent(params.id)}`)).proposal;
    const can = OC.propEditable(p);
    let draft = B.initial(p), saved = JSON.stringify(draft);
    let templates = [], company = [], place = B.PLACE, state = 'idle', timer = 0, queue = Promise.resolve(true);
    const el = OC.render(`${OC.header('Corpo da proposta', { back: true, extra: can ? `<button class="bell-btn" type="button" data-cmenu aria-label="Mais ações do corpo">${icon('dots-three-vertical', 22)}</button>` : '' })}
      <div class="prop-tags"><span class="tag">${esc(OC.rev(p.revision))}</span><span class="prop-work">${esc(p.number)} · ${esc(p.workName || p.clientName)}</span></div>
      <p class="sub" style="margin:-4px 0 0">Monte o texto que o cliente lê, na ordem em que aparece no PDF, no Word e na página do cliente.</p>
      <div class="cp-status" id="cp-status" role="status"></div>
      <div id="cp-banner"></div>
      <div class="bk-list" id="cp-list"></div>
      <div class="actions"><button class="btn2" type="button" data-prev>${icon('eye', 18)}Ver como ficará</button></div>`, true, params);
    history.replaceState(null, '', `#corpo=${encodeURIComponent(p.id)}`);

    const paintStatus = () => {
      const dirty = can && JSON.stringify(draft) !== saved;
      const text = state === 'saving' ? 'Salvando…' : state === 'error' ? 'Não foi possível salvar' : dirty ? 'Alterações não salvas' : p.bodyBlocks ? 'Salvo' : 'Formato padrão do documento';
      const pending = B.pending(draft);
      OC.$('#cp-status', el).innerHTML = `<span class="cp-st${state === 'error' ? ' is-error' : dirty || state === 'saving' ? ' is-dirty' : ''}">${icon(state === 'saving' ? 'circle-notch' : state === 'error' ? 'warning-circle' : 'check', 15)}${text}</span>
        ${state === 'error' ? '<button class="chip-act" type="button" data-retry>Tentar de novo</button>' : ''}
        ${pending ? `<small class="cp-pend">${pending} ${pending === 1 ? 'trecho entre [colchetes] ainda precisa ser preenchido' : 'trechos entre [colchetes] ainda precisam ser preenchidos'}</small>` : ''}`;
      const retry = OC.$('[data-retry]', el);
      if (retry) retry.addEventListener('click', () => flush());
      OC.$('#cp-banner', el).innerHTML = !can
        ? `<p class="hint lock">${icon('lock-simple', 15)}<span>${OC.canEdit() ? 'Esta revisão está fechada para edição. Crie uma revisão para alterar o corpo.' : 'Seu acesso é só para consulta.'}</span></p>`
        : (!p.bodyBlocks ? '<p class="hint cp-banner">Esta proposta usa o documento no formato padrão. Os blocos abaixo mostram o que ele traz hoje; ao editar qualquer um, o corpo passa a ser o que você montar aqui.</p>' : '');
    };
    const persist = async (blocks, json) => {
      const problem = blocks && B.error(blocks);
      if (problem) { state = 'error'; OC.toast(problem, 'warning-circle'); paintStatus(); return false; }
      state = 'saving'; paintStatus();
      try {
        p = (await OC.api(`/proposals/${p.id}/body`, { method: 'PUT', body: { blocks } })).proposal;
        saved = json; state = 'idle';
        return true;
      } catch (error) { state = 'error'; OC.toast(error.message, 'warning-circle'); return false; } finally { paintStatus(); }
    };
    // Uma gravacao por vez: a seguinte espera a anterior e so regrava se ainda houver mudanca.
    const flush = () => {
      clearTimeout(timer);
      queue = queue.then(() => { const json = JSON.stringify(draft); return json === saved ? true : persist(draft, json); });
      return queue;
    };
    const items = p.items.length;
    const editor = OC.bodyEditor(OC.$('#cp-list', el), {
      get: () => draft,
      set: (blocks) => { draft = blocks; editor.paint(); paintStatus(); clearTimeout(timer); timer = setTimeout(flush, AUTOSAVE_MS); },
      editable: can,
      place: () => place,
      templates: () => templates,
      itemsNote: `${items} ${items === 1 ? 'item' : 'itens'} · total ${OC.money((p.totals && p.totals.finalValue) || 0)}. Itens e preços se editam na aba Itens; aqui você escolhe só onde a tabela aparece.`,
      condNote: 'Validade, prazo, pagamento e garantia vêm das condições comerciais da proposta.',
      onConditions: () => OC.conditionsSheet(p, { reload: () => OC.reload(), update: (next) => { p = next; } }),
      saveTemplate: async (input) => { templates = (await OC.api('/proposals/body-templates', { method: 'POST', body: input })).templates || templates; },
    });
    editor.paint();
    paintStatus();
    // Modelos de texto, modelos da empresa e local da carta: sem rede, ficam os de fabrica.
    OC.api('/proposals/body-templates').then((d) => { templates = d.templates || []; }).catch(() => undefined);
    OC.api('/proposals/body-models').then((d) => { company = d.models || []; }).catch(() => undefined);
    OC.api('/settings').then((d) => { if (d.settings && d.settings.letterPlace) place = d.settings.letterPlace; }).catch(() => undefined);

    OC.$('[data-prev]', el).addEventListener('click', async (event) => {
      const b = event.currentTarget; b.disabled = true;
      const ok = await flush();
      b.disabled = false;
      if (ok) OC.open('pdf', { id: p.id });
    });

    const applyModel = () => {
      const all = [...B.MODELS, ...company.map((m) => B.findModel(m.id, company))];
      const s = OC.sheet(`${OC.sheetHead('Aplicar modelo de proposta', 'file-text')}<p class="sheet-text" style="margin-top:2px">Troca todos os blocos do corpo pelos do modelo.</p>
        <div class="opts" style="margin-top:12px">${all.map((m) => `<button class="opt" type="button" data-m="${esc(m.id)}"><span><b>${esc(m.name)}</b><small>${esc(m.description)}</small></span>${icon('caret-right', 18)}</button>`).join('')}</div>`);
      s.el.firstElementChild.classList.add('sheet-tall');
      OC.$$('[data-m]', s.el).forEach((b) => b.addEventListener('click', () => {
        const model = B.findModel(b.dataset.m, company);
        s.close();
        OC.confirm('Aplicar modelo', `Aplicar o modelo "${model.name}"? Todos os blocos atuais do corpo serão trocados pelos do modelo.`, 'Trocar o corpo', async () => {
          draft = B.modelBlocks(model, undefined, place); editor.paint(); paintStatus(); await flush();
          OC.toast(`Modelo aplicado: ${model.name}. Preencha o que está entre colchetes.`);
        });
      }));
    };
    const saveModel = () => OC.ask('Salvar como modelo da empresa', 'Nome do modelo (um nome que já existe atualiza aquele modelo)', 'Ex.: Proposta CFTV padrão', async (name) => {
      if (!(await flush())) throw new Error('Não foi possível salvar o corpo antes. Tente de novo.');
      const replaces = company.some((m) => m.name.toLowerCase() === name.replace(/\s+/g, ' ').toLowerCase());
      company = (await OC.api('/proposals/body-models', { method: 'POST', body: { name, blocks: draft } })).models || company;
      OC.toast(replaces ? 'Modelo da empresa atualizado.' : 'Corpo salvo como modelo da empresa.');
    });
    const reset = () => OC.confirm('Voltar ao formato padrão', 'O documento volta ao layout fixo e os blocos montados são descartados.', 'Descartar blocos', async () => {
      clearTimeout(timer);
      await queue;
      p = (await OC.api(`/proposals/${p.id}/body`, { method: 'PUT', body: { blocks: null } })).proposal;
      draft = B.initial(p); saved = JSON.stringify(draft); state = 'idle';
      editor.paint(); paintStatus();
      OC.toast('O documento voltou ao formato padrão.');
    });
    const menu = OC.$('[data-cmenu]', el);
    if (menu) menu.addEventListener('click', () => {
      const row = (key, ic, t, sub) => `<button class="menu-item" type="button" data-a="${key}">${icon(ic, 22)}<span class="grow">${esc(t)}<small>${esc(sub)}</small></span>${icon('caret-right', 18)}</button>`;
      const s = OC.sheet(`${OC.sheetHead('Corpo da proposta', 'list')}<div class="menu-card pm-list">
        ${row('model', 'file-text', 'Aplicar modelo de proposta', 'Serviço, fornecimento ou modelo da empresa')}
        ${row('save', 'copy', 'Salvar como modelo da empresa', 'Para usar em outras propostas')}
        ${p.bodyBlocks ? row('reset', 'arrow-counter-clockwise', 'Voltar ao formato padrão', 'Descarta os blocos montados') : ''}</div>`);
      OC.$$('[data-a]', s.el).forEach((b) => b.addEventListener('click', () => { s.close(); ({ model: applyModel, save: saveModel, reset })[b.dataset.a](); }));
    });
  };
})(window.OC = window.OC || {});
