// Planilha propria do corpo no celular (ProposalBodyGrid.tsx e bodyGridOps.ts): no lugar da grade, um editor por linha. Titulos das
// colunas, linhas abertas uma a uma, adicionar e remover linha ou coluna e colar do Excel. Texto livre: nao entra em nenhum total.
(function (OC) {
  const { esc, icon } = OC;
  const B = OC.body;
  const clip = (v) => String(v).slice(0, B.LIMITS.tableCell);

  // Celulas copiadas do Excel: tab separa coluna, quebra separa linha; celula com quebra ou aspas vem entre aspas.
  B.parseClipboard = (text) => {
    const rows = [];
    let row = [], cell = '', quoted = false;
    const input = String(text).replace(/\r\n?/g, '\n');
    for (let at = 0; at < input.length; at += 1) {
      const ch = input[at];
      if (quoted) {
        if (ch === '"' && input[at + 1] === '"') { cell += '"'; at += 1; } else if (ch === '"') quoted = false; else cell += ch;
      } else if (ch === '"' && cell === '') quoted = true;
      else if (ch === '\t') { row.push(cell); cell = ''; } else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch;
    }
    if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
    return rows.filter((l) => l.some((v) => v.trim() !== '')).map((l) => l.map((v) => clip(v.replace(/\s+/g, ' ').trim())));
  };
  // A primeira linha colada vira o titulo das colunas.
  B.tableFromPaste = (cells) => {
    if (!cells.length) return null;
    const cols = Math.min(Math.max(...cells.map((l) => l.length)), B.LIMITS.tableCols);
    const fit = (l) => Array.from({ length: cols }, (_, c) => l[c] || '');
    return { headers: fit(cells[0]), rows: cells.slice(1, B.LIMITS.tableRows + 1).map(fit) };
  };

  // onDone(table) recebe a planilha nova; a folha do bloco grava junto com o resto.
  OC.bodyGridSheet = function (start, editable, onDone) {
    const t = { headers: [...start.headers], rows: start.rows.map((r) => [...r]) };
    const ro = editable ? '' : ' disabled';
    const s = OC.sheet(`${OC.sheetHead('Planilha', 'list')}<div class="bk-form" data-grid></div>
      <div class="sheet-actions${editable ? '' : ' col'}"><button class="btn2" type="button" data-no>${editable ? 'Cancelar' : 'Fechar'}</button>${editable ? '<button class="btn" type="button" data-yes>Usar planilha</button>' : ''}</div>`);
    s.el.firstElementChild.classList.add('sheet-tall');
    const box = OC.$('[data-grid]', s.el);
    let open = -1;
    const keep = () => {
      OC.$$('[data-h]', box).forEach((el) => { t.headers[Number(el.dataset.h)] = clip(el.value); });
      OC.$$('[data-c]', box).forEach((el) => { const [r, c] = el.dataset.c.split(':').map(Number); if (t.rows[r]) t.rows[r][c] = clip(el.value); });
    };
    const paint = () => {
      const label = (c) => t.headers[c] || `Coluna ${c + 1}`;
      box.innerHTML = `<p class="label">Colunas · ${t.headers.length} de até ${B.LIMITS.tableCols}</p>
        ${t.headers.map((h, c) => `<div class="gr-col"><input data-h="${c}" type="text" maxlength="${B.LIMITS.tableCell}" value="${esc(h)}" placeholder="Coluna ${c + 1}" aria-label="Título da coluna ${c + 1}"${ro}>
          ${editable && t.headers.length > 1 ? `<button class="qbtn" type="button" data-rmc="${c}" aria-label="Remover coluna ${c + 1}">${icon('x', 16)}</button>` : ''}</div>`).join('')}
        ${editable ? `<button class="chip-act" type="button" data-addc${t.headers.length >= B.LIMITS.tableCols ? ' disabled' : ''}>${icon('plus', 16)}Coluna</button>` : ''}
        <p class="label">Linhas · ${t.rows.length} de até ${B.LIMITS.tableRows}</p>
        ${t.rows.map((row, r) => `<div class="card gr-row${open === r ? ' is-open' : ''}"><button class="gr-sum" type="button" data-open="${r}"><b>Linha ${r + 1}</b><span>${esc(row.filter(Boolean).join(' · ') || 'Vazia')}</span>${icon(open === r ? 'caret-up' : 'caret-down', 16)}</button>
          ${open === r ? `${row.map((v, c) => `<label class="field"><span>${esc(label(c))}</span><input data-c="${r}:${c}" type="text" maxlength="${B.LIMITS.tableCell}" value="${esc(v)}"${ro}></label>`).join('')}
            ${editable ? `<button class="btn2 danger-btn" type="button" data-rmr="${r}">${icon('trash', 18)}Remover linha</button>` : ''}` : ''}</div>`).join('') || '<p class="hint">Sem linhas.</p>'}
        ${editable ? `<div class="gr-tools"><button class="chip-act" type="button" data-addr${t.rows.length >= B.LIMITS.tableRows ? ' disabled' : ''}>${icon('plus', 16)}Linha</button>
          <button class="chip-act ghost" type="button" data-paste>${icon('copy', 16)}Colar do Excel</button></div>` : ''}
        <p class="hint">Colunas só de números e valores ficam alinhadas à direita no documento.</p>`;
      const on = (sel, fn) => OC.$$(sel, box).forEach((el) => el.addEventListener('click', () => { keep(); fn(el); paint(); }));
      on('[data-open]', (el) => { const r = Number(el.dataset.open); open = open === r ? -1 : r; });
      on('[data-addc]', () => { t.headers.push(''); t.rows.forEach((row) => row.push('')); });
      on('[data-rmc]', (el) => { const c = Number(el.dataset.rmc); t.headers.splice(c, 1); t.rows.forEach((row) => row.splice(c, 1)); });
      on('[data-addr]', () => { t.rows.push(t.headers.map(() => '')); open = t.rows.length - 1; });
      on('[data-rmr]', (el) => { t.rows.splice(Number(el.dataset.rmr), 1); open = -1; });
      const paste = OC.$('[data-paste]', box);
      if (paste) paste.addEventListener('click', () => { keep(); pasteSheet((next) => { t.headers = next.headers; t.rows = next.rows; open = -1; paint(); }); });
    };
    OC.$('[data-no]', s.el).addEventListener('click', s.close);
    const yes = OC.$('[data-yes]', s.el);
    if (yes) yes.addEventListener('click', () => { keep(); s.close(); onDone({ headers: t.headers, rows: t.rows }); });
    paint();
  };

  function pasteSheet(done) {
    const s = OC.sheet(`${OC.sheetHead('Colar do Excel', 'copy')}<label class="field" style="margin-top:12px"><span>Copie as células no Excel e cole aqui. A primeira linha vira o título das colunas.</span>
      <textarea data-p rows="6" placeholder="Cole aqui as células copiadas"></textarea></label><p class="sheet-text">Isso troca a planilha atual.</p>
      <div class="sheet-actions"><button class="btn2" type="button" data-no>Cancelar</button><button class="btn" type="button" data-yes disabled>Usar como planilha</button></div>`);
    const area = OC.$('[data-p]', s.el), yes = OC.$('[data-yes]', s.el);
    area.addEventListener('input', () => { yes.disabled = !B.tableFromPaste(B.parseClipboard(area.value)); });
    OC.$('[data-no]', s.el).addEventListener('click', s.close);
    yes.addEventListener('click', () => { const next = B.tableFromPaste(B.parseClipboard(area.value)); if (next) { s.close(); done(next); } });
  }
})(window.OC = window.OC || {});
