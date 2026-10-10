// Importacao manual do catalogo no celular: colar linhas (aba "Manual" de CatalogImportDialog.tsx).
// Leitor igual a parseCatalogText (catalogImportHelpers.ts) para tabela com cabecalho e linhas por posicao;
// o texto de orcamento da Exsat (sem colunas) fica no computador. A conferencia e a gravacao: screen-catconf.js.
(function (OC) {
  const ALIASES = {
    codigo: 'code', cod: 'code', sku: 'code', code: 'code',
    descricao: 'description', produto: 'description', item: 'description', description: 'description',
    categoria: 'category', grupo: 'category', category: 'category', fabricante: 'manufacturer', marca: 'manufacturer',
    modelo: 'model', model: 'model', unidade: 'unit', unid: 'unit', und: 'unit', unit: 'unit',
    custo: 'currentCost', preco: 'currentCost', valor: 'currentCost',
    total: 'currentCost', valortotal: 'currentCost', totalitem: 'currentCost', totalproduto: 'currentCost',
    parcela: null, parcelas: null, valorparcela: null, valordaparcela: null,
    fonte: 'source', fornecedor: 'source', source: 'source', ativo: 'active', active: 'active',
  };
  const M = OC.catManual = {};
  M.HEADER = 'Código\tDescrição\tCategoria\tFabricante\tModelo\tUnidade\tValor total\tFonte';
  M.normalizeHeader = (v) => String(v).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const costPriority = (h) => (/parcela/.test(h) ? 0 : (/total/.test(h) ? 3 : (/liq|liquido/.test(h) ? 2 : (ALIASES[h] === 'currentCost' ? 1 : 0))));
  M.moneyValue = (value) => {
    if (typeof value === 'number') return value;
    const clean = String(value).trim().replace(/R\$/gi, '').replace(/\s/g, '');
    const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean.replace(/\.(?=.*\.)/g, '');
    const n = Number(normalized.replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  M.splitLine = (line, delimiter) => {
    const values = [];
    let value = '', quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if (c === '"' && line[i + 1] === '"') { value += '"'; i += 1; }
      else if (c === '"') quoted = !quoted;
      else if (c === delimiter && !quoted) { values.push(value.trim()); value = ''; }
      else value += c;
    }
    values.push(value.trim());
    return values;
  };
  const newRow = (partial) => ({ code: '', description: '', category: 'Importado', manufacturer: null, model: null, unit: 'un', currentCost: 0, source: 'IMPORTAÇÃO', active: true, ...partial });

  M.parseStructured = (text, source) => {
    const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return null;
    const d = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : (lines[0].includes(',') ? ',' : ''));
    if (!d) return null;
    const first = M.splitLine(lines[0], d);
    const mapped = first.map((h) => ALIASES[M.normalizeHeader(h)]);
    if (!(mapped.includes('code') && mapped.includes('description'))) return null;
    return lines.slice(1).map((line) => {
      const values = M.splitLine(line, d);
      const partial = { source, active: true };
      let best = 0;
      mapped.forEach((field, i) => {
        if (!field) return;
        const value = values[i] ?? '';
        if (field === 'currentCost') {
          const pr = costPriority(M.normalizeHeader(first[i] ?? ''));
          if (pr >= best) { partial.currentCost = M.moneyValue(value); best = pr; }
        } else if (field === 'active') partial.active = !/^(nao|não|0|false|inativo)$/i.test(value);
        else if (field === 'manufacturer' || field === 'model') partial[field] = value || null;
        else partial[field] = value;
      });
      return newRow(partial);
    }).filter((r) => r.code || r.description);
  };

  M.parse = (text, source) => {
    const structured = M.parseStructured(text, source);
    if (structured) return structured;
    const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return [];
    const d = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',');
    return lines.map((line) => {
      const v = M.splitLine(line, d);
      if (v.length >= 2) return newRow({ code: v[0], description: v[1], category: v[2] || 'Importado', manufacturer: v[3] || (/intelbras/i.test(v[1]) ? 'Intelbras' : null),
        model: v[4] || null, unit: v[5] || 'un', currentCost: M.moneyValue(v[6] ?? v[v.length - 1] ?? '0'), source });
      const code = (line.match(/^([A-Za-z0-9./_-]{3,60})\s+/) || [])[1] || '';
      const price = (line.match(/R\$\s*[\d.]+,\d{2}|[\d.]+,\d{2}\s*$/) || [])[0] || '0';
      const description = line.replace(code, '').replace(price, '').trim().replace(/^[-–—|;]+|[-–—|;]+$/g, '').trim();
      return newRow({ code, description, manufacturer: /intelbras/i.test(description) ? 'Intelbras' : null, currentCost: M.moneyValue(price), source });
    }).filter((r) => r.code || r.description);
  };

  // Folha para colar: a primeira linha ja traz as colunas na ordem do computador.
  let lastText = '';
  OC.catalogPasteSheet = function () {
    const { esc, icon } = OC;
    const s = OC.sheet(`${OC.sheetHead('Colar lista', 'copy')}
      <p class="sheet-text" style="margin-top:2px">Cole linhas de uma planilha, separadas por TAB, ponto e vírgula ou vírgula. Com cabeçalho (Código, Descrição, Unidade, Valor) as colunas são reconhecidas pelo nome; sem cabeçalho vale a ordem abaixo.</p>
      <label class="field" style="margin-top:12px"><span>Linhas</span><textarea id="cm-text" rows="8" spellcheck="false" autocapitalize="off" placeholder="Cole aqui">${esc(lastText || `${M.HEADER}\n`)}</textarea></label>
      <p class="hint" style="margin-top:8px">Ordem: código, descrição, categoria, fabricante, modelo, unidade, valor e fonte.</p>
      <div class="sheet-actions"><button class="btn2" type="button" data-no>Cancelar</button><button class="btn" type="button" data-yes>${icon('check', 18)}Conferir itens</button></div>`);
    s.el.firstElementChild.classList.add('sheet-tall');
    OC.$('[data-no]', s.el).addEventListener('click', s.close);
    OC.$('[data-yes]', s.el).addEventListener('click', () => {
      lastText = OC.$('#cm-text', s.el).value;
      const rows = M.parse(lastText, 'MANUAL');
      if (!rows.length) { OC.toast('Nenhum item reconhecido. Confira as colunas.', 'warning-circle'); return; }
      s.close();
      OC.reviewImport(rows, { title: 'Lista colada', onDone: () => { lastText = ''; } });
    });
  };
})(window.OC = window.OC || {});
