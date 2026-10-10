// Cadastro do catalogo no celular: novo item, editar, inativar e excluir, com as mesmas rotas e regras do
// computador (CatalogEditor.tsx: POST/PATCH/DELETE /api/catalog). So com p10 (o item carrega custo); o servidor confere.
(function (OC) {
  const { esc, icon } = OC;
  const parse = (v) => Number(String(v).trim().replace(/\./g, '').replace(',', '.'));
  OC.canEditCatalog = () => OC.canEdit() && OC.can('p10');

  // p: item do catalogo (null = novo). onSaved: recarrega a lista.
  OC.catalogSheet = async function (p, onSaved) {
    const item = p || { code: '', description: '', category: '', unit: 'un', manufacturer: '', model: '', currentCost: 0, source: 'CONSTRUTEC', active: true };
    const units = await OC.api('/catalog/units').then((d) => (d.units || []).map((u) => u.unit)).catch(() => []);
    const field = (id, label, value, extra) => `<label class="field" style="margin-top:12px"><span>${label}</span><input id="${id}" type="text" value="${esc(value || '')}" autocomplete="off"${extra || ''}></label>`;
    const s = OC.sheet(`${OC.sheetHead(p ? `Item ${p.code}` : 'Novo item do catálogo', p ? 'pencil-simple' : 'plus')}
      ${field('ce-desc', 'Descrição', item.description, ' maxlength="400"')}
      <div class="field-row">${field('ce-code', 'Código', item.code, ' maxlength="60" autocapitalize="characters"')}
        ${field('ce-unit', 'Unidade', item.unit, ' maxlength="20" list="ce-units"')}</div>
      <datalist id="ce-units">${units.map((u) => `<option value="${esc(u)}"></option>`).join('')}</datalist>
      ${field('ce-cat', 'Categoria', item.category, ' maxlength="120" placeholder="Ex.: CFTV"')}
      <div class="field-row">${field('ce-man', 'Fabricante', item.manufacturer, ' maxlength="120" placeholder="Opcional"')}${field('ce-model', 'Modelo', item.model, ' maxlength="120" placeholder="Opcional"')}</div>
      ${field('ce-cost', 'Custo unitário (R$)', OC.dec2(item.currentCost), ' inputmode="decimal"')}
      <label class="opt" style="margin-top:12px"><span class="grow"><b>Item ativo</b><small>Inativo não aparece na busca das propostas</small></span><input type="checkbox" id="ce-active"${item.active !== false ? ' checked' : ''}></label>
      ${p ? `<button class="btn2 danger-btn" type="button" data-del style="width:100%;margin-top:14px">${icon('trash', 18)}Excluir do catálogo</button>` : ''}
      <div class="sheet-actions"><button class="btn2" type="button" data-no>Cancelar</button><button class="btn" type="button" data-yes>${icon('check', 18)}${p ? 'Salvar' : 'Cadastrar'}</button></div>`);
    s.el.firstElementChild.classList.add('sheet-tall');
    const v = (id) => OC.$(`#${id}`, s.el).value.trim();
    OC.$('[data-no]', s.el).addEventListener('click', s.close);
    const del = OC.$('[data-del]', s.el);
    if (del) del.addEventListener('click', () => {
      s.close();
      OC.confirm('Excluir do catálogo', `"${p.description}" sai do catálogo. Item já usado em proposta não pode ser excluído: inative em vez disso.`, 'Excluir', async () => {
        await OC.api(`/catalog/${p.id}`, { method: 'DELETE' });
        OC.toast('Item excluído do catálogo', 'trash');
        onSaved();
      });
    });
    OC.$('[data-yes]', s.el).addEventListener('click', async (event) => {
      const body = { code: v('ce-code'), description: v('ce-desc'), category: v('ce-cat'), unit: v('ce-unit'), manufacturer: v('ce-man') || null,
        model: v('ce-model') || null, currentCost: parse(v('ce-cost') || '0'), source: item.source || 'CONSTRUTEC', active: OC.$('#ce-active', s.el).checked };
      const problem = body.description.length < 3 ? 'Descreva o item (pelo menos 3 letras).' : (body.code.length < 2 ? 'Informe o código do item.'
        : (body.category.length < 2 ? 'Informe a categoria.' : (!body.unit ? 'Informe a unidade.' : (!(body.currentCost >= 0) ? 'Informe um custo válido, como 1.234,56.' : ''))));
      if (problem) { OC.toast(problem, 'warning-circle'); return; }
      const b = event.currentTarget;
      b.disabled = true;
      try {
        await OC.api(p ? `/catalog/${p.id}` : '/catalog', { method: p ? 'PATCH' : 'POST', body });
      } catch (error) { OC.toast(error.message, 'warning-circle'); b.disabled = false; return; }
      s.close();
      OC.toast(p ? 'Item atualizado' : 'Item cadastrado no catálogo');
      onSaved();
    });
  };
})(window.OC = window.OC || {});
