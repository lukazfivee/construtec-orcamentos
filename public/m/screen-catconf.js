// Conferencia de itens antes de gravar no catalogo (lista colada e varredura da Exsat), no celular.
// Mesmo caminho do computador (CatalogImportDialog.tsx, catalogImportChunks.ts): previa em /catalog/import/preview,
// grava so o que e novo ou mudou em /catalog/import/bulk, em lotes de 500. So com p10 (o servidor confere).
(function (OC) {
  const CHUNK = 500, PAGE = 50;
  let pending = null;
  // items: itens no formato do catalogo. opts: { title, note, onDone }.
  OC.reviewImport = function (items, opts) {
    pending = { items: items.map((it, i) => ({ ...it, key: `r${i}` })), opts: opts || {} };
    OC.open('catConf');
  };

  // Mesmas regras de productSchema (src/server/routes/catalog.ts).
  const problemOf = (r) => {
    const len = (v) => String(v == null ? '' : v).trim().length;
    if (len(r.code) < 2 || len(r.code) > 60) return 'Código com 2 a 60 caracteres';
    if (len(r.description) < 3 || len(r.description) > 400) return 'Descrição com pelo menos 3 letras';
    if (len(r.category) < 2 || len(r.category) > 120) return 'Categoria com pelo menos 2 letras';
    if (len(r.unit) < 1 || len(r.unit) > 20) return 'Informe a unidade';
    if (!(Number(r.currentCost) >= 0 && Number(r.currentCost) <= 1e9)) return 'Valor inválido';
    if (len(r.source) < 2 || len(r.source) > 120) return 'Fonte com pelo menos 2 letras';
    return '';
  };
  const clean = (r) => ({ code: String(r.code).trim(), description: String(r.description).trim(), category: String(r.category).trim(), unit: String(r.unit).trim(),
    manufacturer: r.manufacturer ? String(r.manufacturer).trim() || null : null, model: r.model ? String(r.model).trim() || null : null,
    currentCost: Number(r.currentCost) || 0, source: String(r.source).trim(), active: r.active !== false });

  async function preview(rows, onProgress) {
    const valid = rows.filter((r) => !(r.problem = problemOf(r)));
    for (let i = 0; i < valid.length; i += CHUNK) {
      const part = valid.slice(i, i + CHUNK);
      const res = await OC.api('/catalog/import/preview', { method: 'POST', body: { items: part.map(clean) } });
      const byCode = new Map((res.items || []).map((x) => [String(x.code).toLowerCase(), x]));
      part.forEach((r) => { const x = byCode.get(String(r.code).trim().toLowerCase()); r.status = x ? x.status : 'unchanged'; r.previous = x && x.previous; });
      if (onProgress) onProgress(Math.min(valid.length, i + CHUNK), valid.length);
    }
  }

  const GROUPS = [['new', 'Novos'], ['updated', 'Mudaram'], ['unchanged', 'Sem mudança'], ['bad', 'Com problema']];
  const groupOf = (r) => (r.problem ? 'bad' : (r.status === 'new' || r.status === 'updated' ? r.status : 'unchanged'));

  OC.screens.catConf = async function (params) {
    const { esc, icon } = OC;
    if (!pending) { OC.go('cat'); return; }
    const { items: rows, opts } = pending;
    const el = OC.render(`${OC.header('Conferir itens', { back: true })}
      <p class="sub" style="margin:-6px 0 0">${esc(opts.title || 'Importação')} · ${rows.length.toLocaleString('pt-BR')} ${rows.length === 1 ? 'linha' : 'linhas'}</p>
      <div id="cc-body" class="imp-body"><div class="imp-load"><b>Comparando com o catálogo</b><small id="cc-prog">Preparando</small><div class="bar"><span id="cc-bar" style="width:0%"></span></div></div></div>
      <div class="actions"><button class="btn" type="button" id="cc-go" disabled>${icon('check', 18)}<span id="cc-go-t">Gravar alterações</span></button></div>`, true, params);
    const body = OC.$('#cc-body', el), go = OC.$('#cc-go', el);
    let tab = 'new', shown = PAGE, busy = false;
    try {
      await preview(rows, (done, total) => { const p = OC.$('#cc-prog', el); if (p) p.textContent = `${done.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')} itens`; const b = OC.$('#cc-bar', el); if (b) b.style.width = `${Math.round(done / Math.max(1, total) * 100)}%`; });
    } catch (error) {
      if (!el.isConnected) return;
      body.innerHTML = `<div class="empty imp-state">${icon(error.status === 0 ? 'wifi-slash' : 'warning-circle', 32)}<b>Não deu para comparar com o catálogo</b><span>${esc(error.message)}</span><button class="btn" type="button" id="cc-retry" style="padding:0 22px">Tentar de novo</button></div>`;
      OC.$('#cc-retry', body).addEventListener('click', () => OC.reload());
      return;
    }
    if (!el.isConnected) return;
    const importable = () => rows.filter((r) => !r.problem && (r.status === 'new' || r.status === 'updated'));
    if (!importable().length && rows.some((r) => r.problem)) tab = 'bad';
    else if (!rows.some((r) => groupOf(r) === 'new')) tab = rows.some((r) => groupOf(r) === 'updated') ? 'updated' : 'unchanged';

    function paint() {
      const count = (g) => rows.filter((r) => groupOf(r) === g).length;
      const list = rows.filter((r) => groupOf(r) === tab);
      const n = importable().length;
      body.innerHTML = `${opts.note ? `<p class="hint">${esc(opts.note)}</p>` : ''}
        <div class="chips wrap">${GROUPS.map(([k, l]) => `<button class="chip-act" type="button" data-t="${k}" aria-pressed="${tab === k}">${l} · ${count(k).toLocaleString('pt-BR')}</button>`).join('')}</div>
        ${list.length ? `<div class="rows">${list.slice(0, shown).map((r) => `<button class="prow" type="button" data-k="${r.key}"><span class="grow"><b>${esc(r.description || '(sem descrição)')}</b>
            <small>${esc(r.code || 'sem código')} · ${esc(r.unit)} · ${esc(r.category)}</small>${r.problem ? `<small class="warn">${esc(r.problem)}</small>` : ''}
            ${r.status === 'updated' && r.previous ? `<small>Antes ${esc(OC.money(r.previous.currentCost))}${r.previous.description !== r.description ? ' · descrição mudou' : ''}</small>` : ''}${r.status === 'no_price' ? '<small class="warn">Sem preço: não entra</small>' : ''}</span>
            <span class="end"><b>${esc(OC.costText(OC.money(r.currentCost)))}</b><small>${r.problem ? 'corrigir' : 'custo'}</small></span></button>`).join('')}</div>
          ${list.length > shown ? `<button class="btn2" type="button" id="cc-more">Mostrar mais ${Math.min(PAGE, list.length - shown)}</button>` : ''}`
        : `<div class="empty">${icon('check-circle', 28)}Nada neste grupo.</div>`}
        <p class="hint">Só entram itens novos ou com mudança. Linhas com problema ficam de fora até serem corrigidas.</p>`;
      OC.$('#cc-go-t', el).textContent = n ? `Gravar ${n.toLocaleString('pt-BR')} ${n === 1 ? 'alteração' : 'alterações'}` : 'Nada para gravar';
      go.disabled = !n || busy || !OC.canEditCatalog();
      OC.$$('[data-t]', body).forEach((b) => b.addEventListener('click', () => { tab = b.dataset.t; shown = PAGE; paint(); }));
      const more = OC.$('#cc-more', body);
      if (more) more.addEventListener('click', () => { shown += PAGE; paint(); });
      OC.$$('[data-k]', body).forEach((b) => b.addEventListener('click', () => editRow(rows.find((r) => r.key === b.dataset.k))));
    }

    function editRow(r) {
      const f = (id, label, value, extra) => `<label class="field" style="margin-top:12px"><span>${label}</span><input id="${id}" type="text" value="${esc(value == null ? '' : value)}" autocomplete="off"${extra || ''}></label>`;
      const s = OC.sheet(`${OC.sheetHead('Corrigir linha', 'pencil-simple')}${r.problem ? `<p class="sheet-text">${esc(r.problem)}</p>` : ''}
        ${f('cr-desc', 'Descrição', r.description, ' maxlength="400"')}<div class="field-row">${f('cr-code', 'Código', r.code, ' maxlength="60"')}${f('cr-unit', 'Unidade', r.unit, ' maxlength="20"')}</div>
        ${f('cr-cat', 'Categoria', r.category, ' maxlength="120"')}${f('cr-cost', 'Custo unitário (R$)', OC.dec2(r.currentCost), ' inputmode="decimal"')}
        <button class="btn2 danger-btn" type="button" data-del style="width:100%;margin-top:14px">${icon('trash', 18)}Tirar da lista</button>
        <div class="sheet-actions"><button class="btn2" type="button" data-no>Cancelar</button><button class="btn" type="button" data-yes>Salvar linha</button></div>`);
      s.el.firstElementChild.classList.add('sheet-tall');
      OC.$('[data-no]', s.el).addEventListener('click', s.close);
      OC.$('[data-del]', s.el).addEventListener('click', () => { rows.splice(rows.indexOf(r), 1); s.close(); paint(); });
      OC.$('[data-yes]', s.el).addEventListener('click', async (event) => {
        const v = (id) => OC.$(`#${id}`, s.el).value.trim();
        Object.assign(r, { description: v('cr-desc'), code: v('cr-code'), unit: v('cr-unit'), category: v('cr-cat'), currentCost: OC.catManual.moneyValue(v('cr-cost')) });
        event.currentTarget.disabled = true;
        try { await preview([r]); } catch (error) { OC.toast(error.message, 'warning-circle'); }
        s.close();
        paint();
      });
    }

    go.addEventListener('click', async () => {
      const list = importable().map(clean);
      if (!list.length || busy) return;
      busy = true; go.disabled = true;
      const totals = { created: 0, updated: 0, ignored: 0 };
      try {
        for (let i = 0; i < list.length; i += CHUNK) {
          OC.$('#cc-go-t', el).textContent = `Gravando ${Math.min(list.length, i + CHUNK).toLocaleString('pt-BR')} de ${list.length.toLocaleString('pt-BR')}`;
          const res = await OC.api('/catalog/import/bulk', { method: 'POST', body: { items: list.slice(i, i + CHUNK) } });
          totals.created += res.created || 0; totals.updated += res.updated || 0; totals.ignored += res.ignored || 0;
        }
      } catch (error) {
        busy = false;
        OC.toast(`${error.message}${totals.created + totals.updated ? ` Já gravados: ${totals.created + totals.updated}.` : ''}`, 'warning-circle');
        paint();
        return;
      }
      if (opts.onDone) opts.onDone(totals);
      pending = null;
      OC.toast(`${totals.created} ${totals.created === 1 ? 'item cadastrado' : 'itens cadastrados'}, ${totals.updated} ${totals.updated === 1 ? 'atualizado' : 'atualizados'}${totals.ignored ? `, ${totals.ignored} ignorados` : ''}`);
      OC.back();
    });
    paint();
  };
})(window.OC = window.OC || {});
