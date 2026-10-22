// Configuracoes > Corpo padrao e modelos no celular (CompanyDefaultBody.tsx, CompanyBodyModelsList.tsx): corpo que toda proposta nova
// recebe, modelos de proposta da empresa (renomear e excluir) e modelos de texto (remover). So administrador altera (o servidor confere
// em /api/settings); os demais veem. Propostas que ja existem nao mudam.
(function (OC) {
  const { esc, icon } = OC;
  const B = OC.body;
  // A lista gravada nao leva a marca "builtin" dos modelos de fabrica (o servidor recusa campo a mais).
  const plain = (list) => list.map(({ id, name, type, title, text }) => ({ id, name, type, ...(title ? { title } : {}), text }));

  OC.screens.cfgCorpo = async function (params) {
    const [body, tpl, models, settings] = await Promise.all([
      OC.api('/settings/default-body'), OC.api('/settings/body-templates'), OC.api('/settings/body-models'),
      OC.api('/settings').then((d) => d.settings || {}).catch(() => ({})),
    ]);
    const admin = (OC.session.user() || {}).role === 'admin';
    const place = settings.letterPlace || B.PLACE;
    let saved = body.blocks || null, draft = saved, templates = tpl.templates || [], company = models.models || [], busy = false;
    const el = OC.render(`${OC.header('Corpo padrão e modelos', { back: true })}
      <p class="sub" style="margin:-6px 0 0">Os blocos que toda proposta nova recebe; cada uma pode mudar depois</p>
      <span class="label">Corpo padrão de novas propostas</span>
      <div id="cc-body"></div>
      <span class="label">Modelos de proposta da empresa</span>
      <div class="card" id="cc-models"></div>
      <span class="label">Modelos de texto da empresa</span>
      <div class="card" id="cc-tpl"></div>
      <p class="hint">${admin ? 'Propostas já criadas mantêm o corpo delas.' : 'Só administradores alteram os padrões.'}</p>
      ${admin ? `<div class="actions"><button class="btn2" type="button" id="cc-undo">Descartar</button><button class="btn" type="button" id="cc-save">${icon('check', 18)}Salvar</button></div>` : ''}`, true, params);
    const host = document.createElement('div');
    host.className = 'bk-list';
    const editor = OC.bodyEditor(host, {
      get: () => draft || [],
      set: (blocks) => { draft = blocks; paint(); },
      editable: admin,
      place: () => place,
      templates: () => templates,
      itemsNote: 'A tabela de itens de cada proposta entra aqui, com os preços de venda.',
      condNote: 'Validade, prazo, pagamento e garantia são preenchidos em cada proposta.',
      saveTemplate: async (input) => {
        const id = `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        templates = (await OC.api('/settings/body-templates', { method: 'PUT', body: { templates: [...plain(templates), { ...input, id }] } })).templates || templates;
        paintLists();
      },
    });

    function paint() {
      const box = OC.$('#cc-body', el);
      const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
      if (!draft) {
        box.innerHTML = `<div class="card"><p class="hint">Sem corpo padrão: as propostas novas usam o documento no formato padrão.</p>
          ${admin ? `<div class="cc-start"><button class="btn2" type="button" data-def>${icon('file-text', 18)}Definir corpo padrão</button><button class="btn2" type="button" data-from>${icon('copy', 18)}Começar de um modelo</button></div>` : ''}</div>`;
      } else {
        box.innerHTML = '';
        box.appendChild(host);
        editor.paint();
        if (admin) box.insertAdjacentHTML('beforeend', `<button class="btn2 danger-btn" type="button" data-rm style="width:100%;margin-top:10px">${icon('trash', 18)}Remover o corpo padrão</button>`);
      }
      box.insertAdjacentHTML('beforeend', `<p class="hint" style="margin-top:8px">${dirty ? 'Alterações ainda não salvas · valem para as próximas propostas' : 'Propostas já criadas mantêm o corpo delas'}</p>`);
      const on = (sel, fn) => { const b = OC.$(sel, box); if (b) b.addEventListener('click', fn); };
      on('[data-def]', () => { draft = B.legacy(''); paint(); });
      on('[data-from]', fromModel);
      on('[data-rm]', () => { draft = null; paint(); });
      const save = OC.$('#cc-save', el), undo = OC.$('#cc-undo', el);
      if (save) { save.disabled = !dirty || busy; undo.disabled = !dirty || busy; }
    }

    function fromModel() {
      const all = [...B.MODELS, ...company.map((m) => B.findModel(m.id, company))];
      const s = OC.sheet(`${OC.sheetHead('Começar de um modelo', 'file-text')}<div class="opts" style="margin-top:12px">${all.map((m) => `<button class="opt" type="button" data-m="${esc(m.id)}"><span><b>${esc(m.name)}</b><small>${esc(m.description)}</small></span>${icon('caret-right', 18)}</button>`).join('')}</div>`);
      s.el.firstElementChild.classList.add('sheet-tall');
      OC.$$('[data-m]', s.el).forEach((b) => b.addEventListener('click', () => { s.close(); draft = B.modelBlocks(B.findModel(b.dataset.m, company), undefined, place); paint(); }));
    }

    const run = async (action, done) => {
      busy = true; paint();
      try { await action(); OC.toast(done); } catch (error) { OC.toast(error.message, 'warning-circle'); }
      busy = false; paint(); paintLists();
    };

    function paintLists() {
      const mbox = OC.$('#cc-models', el), tbox = OC.$('#cc-tpl', el);
      mbox.innerHTML = company.length ? `<div class="rows">${company.map((m) => `<div class="prow static"><span class="grow"><b>${esc(m.name)}</b><small>${m.blocks.length} blocos</small></span>
          ${admin ? `<button class="qbtn" type="button" data-ren="${esc(m.id)}" aria-label="Renomear o modelo ${esc(m.name)}">${icon('pencil-simple', 18)}</button><button class="qbtn" type="button" data-delm="${esc(m.id)}" aria-label="Excluir o modelo ${esc(m.name)}">${icon('trash', 18)}</button>` : ''}</div>`).join('')}</div>`
        : '<p class="hint">Nenhum modelo da empresa. No corpo de uma proposta, use Salvar como modelo da empresa.</p>';
      tbox.innerHTML = templates.length ? `<div class="rows">${templates.map((t) => `<div class="prow static"><span class="grow"><b>${esc(t.name)}</b><small>${t.type === 'lista' ? 'Lista' : 'Parágrafo'} · ${t.text.length.toLocaleString('pt-BR')} caracteres</small></span>
          ${admin ? `<button class="qbtn" type="button" data-delt="${esc(t.id)}" aria-label="Remover o modelo ${esc(t.name)}">${icon('trash', 18)}</button>` : ''}</div>`).join('')}</div>`
        : '<p class="hint">Nenhum modelo. Salve um parágrafo como modelo no corpo de uma proposta.</p>';
      OC.$$('[data-ren]', mbox).forEach((b) => b.addEventListener('click', () => {
        const m = company.find((x) => x.id === b.dataset.ren);
        OC.ask('Renomear modelo', 'Nome do modelo', '', async (name) => {
          company = (await OC.api(`/settings/body-models/${encodeURIComponent(m.id)}`, { method: 'PATCH', body: { name } })).models || company;
          OC.toast('Modelo renomeado.'); paintLists();
        }, m.name);
      }));
      OC.$$('[data-delm]', mbox).forEach((b) => b.addEventListener('click', () => {
        const m = company.find((x) => x.id === b.dataset.delm);
        OC.confirm('Excluir modelo', `O modelo "${m.name}" sai da lista da empresa. Propostas que já usaram o modelo não mudam.`, 'Excluir', async () => {
          company = (await OC.api(`/settings/body-models/${encodeURIComponent(m.id)}`, { method: 'DELETE' })).models || [];
          OC.toast('Modelo excluído.', 'trash'); paintLists();
        });
      }));
      OC.$$('[data-delt]', tbox).forEach((b) => b.addEventListener('click', () => {
        const t = templates.find((x) => x.id === b.dataset.delt);
        OC.confirm('Remover modelo de texto', `O modelo "${t.name}" sai da biblioteca da empresa.`, 'Remover', async () => {
          templates = (await OC.api('/settings/body-templates', { method: 'PUT', body: { templates: plain(templates.filter((x) => x.id !== t.id)) } })).templates || [];
          OC.toast('Modelo removido da biblioteca.', 'trash'); paintLists();
        });
      }));
    }

    const save = OC.$('#cc-save', el);
    if (save) {
      save.addEventListener('click', () => {
        const problem = draft && B.error(draft);
        if (problem) { OC.toast(problem, 'warning-circle'); return; }
        run(async () => { saved = (await OC.api('/settings/default-body', { method: 'PUT', body: { blocks: draft } })).blocks || null; draft = saved; },
          draft ? 'Corpo padrão salvo. Vale para as próximas propostas.' : 'Corpo padrão removido. As próximas propostas usam o formato padrão.');
      });
      OC.$('#cc-undo', el).addEventListener('click', () => { draft = saved; paint(); });
    }
    paint();
    paintLists();
  };
})(window.OC = window.OC || {});
