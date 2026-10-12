// Cadastro do kit no celular: nome, categoria, descricao, ativo e excluir, como KitsEditor.tsx e KitFormFields.tsx
// (POST/PUT/DELETE /api/kits). So com p10, porque o kit carrega custo; o servidor confere.
(function (OC) {
  OC.canEditKits = () => OC.canEdit() && OC.can('p10');

  // kit: detalhe do kit (null = novo). categories: categorias ja usadas. onSaved(kit) e onDeleted().
  OC.kitSheet = function (kit, categories, onSaved, onDeleted) {
    const { esc, icon } = OC;
    const k = kit || { name: '', category: 'Geral', description: '', active: true, items: [] };
    const cats = [...new Set(['Geral', ...(categories || [])].filter(Boolean))];
    const s = OC.sheet(`${OC.sheetHead(kit ? 'Dados do kit' : 'Novo kit', kit ? 'pencil-simple' : 'plus')}
      <label class="field" style="margin-top:12px"><span>Nome do kit</span><input id="ks-name" type="text" maxlength="180" value="${esc(k.name)}" placeholder="Ex.: Kit CFTV 4 câmeras" autocomplete="off"></label>
      <label class="field" style="margin-top:12px"><span>Categoria</span><input id="ks-cat" type="text" maxlength="120" value="${esc(k.category)}" list="ks-cats" placeholder="CFTV, Controle de acesso, Cabeamento" autocomplete="off"></label>
      <datalist id="ks-cats">${cats.map((c) => `<option value="${esc(c)}"></option>`).join('')}</datalist>
      <label class="field" style="margin-top:12px"><span>Descrição ou aplicação · opcional</span><input id="ks-desc" type="text" maxlength="500" value="${esc(k.description || '')}" placeholder="Ex.: por ponto" autocomplete="off"></label>
      <label class="opt" style="margin-top:12px"><span class="grow"><b>Kit ativo</b><small>Inativo some da lista de quem usa kits na proposta</small></span><input type="checkbox" id="ks-active"${k.active !== false ? ' checked' : ''}></label>
      ${kit ? `<button class="btn2 danger-btn" type="button" data-del style="width:100%;margin-top:14px">${icon('trash', 18)}Excluir kit</button>` : ''}
      <div class="sheet-actions"><button class="btn2" type="button" data-no>Cancelar</button><button class="btn" type="button" data-yes>${icon('check', 18)}${kit ? 'Salvar' : 'Criar kit'}</button></div>`);
    s.el.firstElementChild.classList.add('sheet-tall');
    const v = (id) => OC.$(`#${id}`, s.el).value.trim();
    OC.$('[data-no]', s.el).addEventListener('click', s.close);
    const del = OC.$('[data-del]', s.el);
    if (del) del.addEventListener('click', () => {
      s.close();
      OC.confirm('Excluir kit', `"${kit.name}" sai da lista de kits. Propostas que já usaram o kit continuam com os itens.`, 'Excluir', async () => {
        await OC.api(`/kits/${encodeURIComponent(kit.id)}`, { method: 'DELETE' });
        OC.toast('Kit excluído', 'trash');
        if (onDeleted) onDeleted();
      });
    });
    OC.$('[data-yes]', s.el).addEventListener('click', async (event) => {
      const body = { name: v('ks-name'), category: v('ks-cat') || 'Geral', description: v('ks-desc') || null, active: OC.$('#ks-active', s.el).checked,
        items: (k.items || []).map((it) => ({ productId: it.productId, quantity: it.quantity })) };
      if (body.name.length < 2) { OC.toast('Informe o nome do kit (pelo menos 2 letras).', 'warning-circle'); return; }
      const b = event.currentTarget;
      b.disabled = true;
      let saved;
      try {
        saved = (await OC.api(kit ? `/kits/${encodeURIComponent(kit.id)}` : '/kits', { method: kit ? 'PUT' : 'POST', body })).kit;
      } catch (error) { OC.toast(error.message, 'warning-circle'); b.disabled = false; return; }
      s.close();
      OC.toast(kit ? 'Kit atualizado' : 'Kit criado');
      if (onSaved) onSaved(saved);
    });
    if (!kit) setTimeout(() => OC.$('#ks-name', s.el).focus(), 50);
  };

  // Linha de dados do kit na tela de edicao: categoria e situacao, com o botao que abre a folha acima.
  OC.kitMetaRow = (kit, can) => `<div class="card kit-meta"><span class="grow"><small class="label">Categoria</small><b>${OC.esc(kit.category || 'Geral')}</b></span>
    ${kit.active === false ? '<span class="tag warn">Inativo</span>' : '<span class="tag ok">Ativo</span>'}
    ${can ? `<button class="chip-act" type="button" id="k-meta">${OC.icon('pencil-simple', 16)}Dados</button>` : ''}</div>`;
})(window.OC = window.OC || {});
