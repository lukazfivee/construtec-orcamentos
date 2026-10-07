// Importar catalogo no celular (prototipo, Rodada 22: telas 22b e 22g a 22v).
// Planilha XLSX, CSV, TSV ou TXT lida aqui no aparelho. Preco da EXSAT so entra com a conta conectada (aplicativo do computador ou site de computador).
// Foto, PDF e OCR ficam na versao completa (o reconhecimento de imagem roda so no aplicativo do computador).
// Passos: 1 arquivo, 2 colunas, 3 revisar, 4 importar. Linhas com erro nao entram: corrige-se na hora ou ficam de fora.
(function (OC) {
  const { esc, icon } = OC;
  const MAX_BYTES = 12 * 1024 * 1024, MAX_ROWS = 5000, CHUNK = 500, PAGE = 20;
  const FIELDS = [['cod', 'Código', true], ['desc', 'Descrição', true], ['un', 'Unidade', true], ['custo', 'Custo', true], ['cat', 'Categoria', false]];
  const FIELD_NAME = Object.fromEntries(FIELDS.map(([k, l]) => [k, l]));
  const UNIT_SYN = { und: 'un', unid: 'un', unidade: 'un', unid_: 'un', pc: 'pç', pca: 'pç', pcs: 'pç', 'pç': 'pç', 'peça': 'pç', peca: 'pç', mt: 'm', mts: 'm', metro: 'm', metros: 'm', caixa: 'cx', rolo: 'rl' };

  const norm = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const colLetter = (i) => { let n = i, s = ''; do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0); return s; };
  const fmtN = (n) => Number(n || 0).toLocaleString('pt-BR');
  const pctS = (d) => `${d > 0 ? '+' : (d < 0 ? '−' : '')}${Math.abs(d * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  const money = (v) => OC.money(v);

  // ---------- leitura de arquivo ----------
  class ReadError extends Error { constructor(kind, message) { super(message); this.kind = kind; } }

  function decodeText(buffer) {
    const bytes = new Uint8Array(buffer);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, ''); } catch { return new TextDecoder('windows-1252').decode(bytes); }
  }

  // Delimitador pela primeira linha com conteudo; aspas duplas e quebras de linha dentro de aspas valem.
  function parseDelimited(text) {
    const first = text.split(/\r?\n/).find((l) => l.trim()) || '';
    const counts = [';', '\t', ','].map((d) => [d, first.split(d).length - 1]);
    const delim = counts.sort((a, b) => b[1] - a[1])[0][1] > 0 ? counts[0][0] : ';';
    const rows = []; let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (c === '"') quoted = false; else cell += c;
      } else if (c === '"' && cell === '') quoted = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i += 1; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') throw new ReadError('unsupported', 'Este navegador não abre arquivos .xlsx. Salve a planilha como CSV e importe de novo.');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function unzip(buffer) {
    const u8 = new Uint8Array(buffer), dv = new DataView(buffer);
    let e = u8.length - 22;
    for (; e >= Math.max(0, u8.length - 65557); e -= 1) if (dv.getUint32(e, true) === 0x06054b50) break;
    if (e < 0 || dv.getUint32(e, true) !== 0x06054b50) throw new ReadError('corrupt', 'O arquivo não parece uma planilha do Excel.');
    const total = dv.getUint16(e + 10, true);
    let p = dv.getUint32(e + 16, true);
    const files = {}, dec = new TextDecoder();
    for (let i = 0; i < total; i += 1) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new ReadError('corrupt', 'A planilha está danificada.');
      const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), cmtLen = dv.getUint16(p + 32, true);
      files[dec.decode(u8.subarray(p + 46, p + 46 + nameLen))] = { method: dv.getUint16(p + 10, true), size: dv.getUint32(p + 20, true), header: dv.getUint32(p + 42, true) };
      p += 46 + nameLen + extraLen + cmtLen;
    }
    return {
      names: () => Object.keys(files),
      async text(name) {
        const f = files[name];
        if (!f) return null;
        const start = f.header + 30 + dv.getUint16(f.header + 26, true) + dv.getUint16(f.header + 28, true);
        const data = u8.subarray(start, start + f.size);
        if (f.method === 0) return dec.decode(data);
        if (f.method === 8) return dec.decode(await inflateRaw(data));
        throw new ReadError('corrupt', 'A planilha usa um formato de compressão que não dá para abrir aqui.');
      },
    };
  }

  const xml = (text) => new DOMParser().parseFromString(text, 'application/xml');
  const colIndex = (ref) => { const m = /^([A-Z]+)/.exec(ref || ''); if (!m) return -1; let n = 0; for (const ch of m[1]) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

  async function parseXlsx(buffer) {
    const head = new Uint8Array(buffer, 0, 8);
    if (head[0] === 0xD0 && head[1] === 0xCF && head[2] === 0x11 && head[3] === 0xE0) throw new ReadError('locked', 'protegido por senha');
    const zip = await unzip(buffer);
    if (zip.names().some((n) => n === 'EncryptedPackage')) throw new ReadError('locked', 'protegido por senha');
    let sheetPath = '';
    const wb = await zip.text('xl/workbook.xml'), rels = await zip.text('xl/_rels/workbook.xml.rels');
    if (wb && rels) {
      const sheet = xml(wb).getElementsByTagName('sheet')[0];
      const rid = sheet && (sheet.getAttribute('r:id') || sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
      const rel = Array.from(xml(rels).getElementsByTagName('Relationship')).find((r) => r.getAttribute('Id') === rid);
      if (rel) { const t = rel.getAttribute('Target') || ''; sheetPath = t.startsWith('/') ? t.slice(1) : `xl/${t}`; }
    }
    if (!sheetPath || !zip.names().includes(sheetPath)) sheetPath = zip.names().filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()[0] || '';
    if (!sheetPath) throw new ReadError('corrupt', 'Não achei nenhuma aba na planilha.');
    const shared = [];
    const sst = await zip.text('xl/sharedStrings.xml');
    if (sst) for (const si of Array.from(xml(sst).getElementsByTagName('si'))) shared.push(Array.from(si.getElementsByTagName('t')).map((t) => t.textContent).join(''));
    const doc = xml(await zip.text(sheetPath));
    const rows = [];
    for (const r of Array.from(doc.getElementsByTagName('row'))) {
      const line = [];
      for (const c of Array.from(r.getElementsByTagName('c'))) {
        const idx = colIndex(c.getAttribute('r'));
        if (idx < 0) continue;
        const type = c.getAttribute('t'), v = c.getElementsByTagName('v')[0], raw = v ? v.textContent : '';
        let value = '';
        if (type === 's') value = shared[Number(raw)] || '';
        else if (type === 'inlineStr') value = Array.from(c.getElementsByTagName('t')).map((t) => t.textContent).join('');
        else if (type === 'str' || type === 'b') value = raw;
        else if (type === 'e') value = '';
        else if (raw !== '') { const n = Number(raw); value = Number.isFinite(n) && /[.eE]/.test(raw) ? String(n).replace('.', ',') : raw; }
        line[idx] = value;
      }
      rows.push(Array.from(line, (x) => (x == null ? '' : x)));
    }
    return rows;
  }

  // Devolve a tabela crua (linhas de celulas). Erros: ReadError com kind locked, corrupt, unsupported.
  async function readFile(file, stage) {
    if (file.size > MAX_BYTES) throw new ReadError('big', `O arquivo tem ${kb(file.size)}. O limite aqui é ${kb(MAX_BYTES)}.`);
    stage(20);
    const buffer = await file.arrayBuffer();
    stage(55);
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    let rows;
    if (ext === 'xlsx' || ext === 'xlsm') rows = await parseXlsx(buffer);
    else if (['csv', 'tsv', 'txt'].includes(ext)) rows = parseDelimited(decodeText(buffer));
    else if (ext === 'xls') throw new ReadError('unsupported', 'Arquivos .xls antigos não abrem aqui. Salve como .xlsx ou CSV e importe de novo.');
    else if (['pdf', 'png', 'jpg', 'jpeg', 'bmp', 'heic'].includes(ext)) throw new ReadError('unsupported', 'Foto e PDF precisam de reconhecimento de imagem, que fica na versão completa. Aqui use planilha (XLSX, CSV) ou a página do EXSAT.');
    else throw new ReadError('unsupported', 'Formato não aceito. Use XLSX, CSV, TSV ou TXT.');
    stage(90);
    return rows.map((cells, i) => ({ ln: i + 1, cells })).filter((r) => r.cells.some((c) => String(c).trim() !== ''));
  }

  // ---------- colunas ----------
  const TESTS = {
    cod: [/^(codigo|cod|sku|code|referencia|ref)$/, /^(cod|codigo|ref|sku)/],
    un: [/^(un|und|unid|unidade|um|unit)$/, /^(un|und|unid)/],
    custo: [/^(custo|preco|valor|price)$/, /(custo|preco|valor|vlunit|unitario)/],
    desc: [/^(descricao|produto|item|nome|description)$/, /(descri|produto|item|nome)/],
    cat: [/^(categoria|grupo|linha|familia|category)$/, /(categ|grupo|linha|famil)/],
  };
  const AVOID = { custo: /parcela|estoque|qtd|quantidade|total|desconto|icms|ipi/, cod: /fornecedor|fabricante/, desc: /codigo|cod\b/ };

  function suggest(header) {
    const heads = header.map((h) => norm(h)), used = new Set(), map = {}, conf = {};
    for (const key of ['cod', 'un', 'custo', 'desc', 'cat']) {
      const [exact, fuzzy] = TESTS[key];
      const ok = (i) => !used.has(i) && heads[i] && !(AVOID[key] && AVOID[key].test(heads[i]));
      const exactHits = heads.map((h, i) => (ok(i) && exact.test(h) ? i : -1)).filter((i) => i >= 0);
      const fuzzyHits = heads.map((h, i) => (ok(i) && fuzzy.test(h) ? i : -1)).filter((i) => i >= 0);
      const pick = exactHits.length ? exactHits[0] : (fuzzyHits.length ? fuzzyHits[0] : -1);
      if (pick >= 0) { map[key] = pick; used.add(pick); conf[key] = (exactHits.length || fuzzyHits.length) > 1; }
    }
    return { map, conf };
  }

  // ---------- validacao das linhas ----------
  const brNumber = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function parseNumber(text) {
    const t = String(text).replace(/R\s*\$/gi, '').replace(/\s/g, '');
    if (!/^-?[\d.,]+$/.test(t)) return NaN;
    let s = t;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\.(?=.*\.)/g, '');
    return Number(s);
  }
  function checkCost(raw) {
    const t = String(raw == null ? '' : raw).trim();
    if (!t) return { prob: 'Custo vazio', fx: 'custo' };
    const n = parseNumber(t);
    if (Number.isNaN(n)) {
      const fixed = parseNumber(t.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1'));
      return { prob: `Custo "${t}" tem letra no lugar de número`, fx: 'custo', sug: Number.isFinite(fixed) && fixed > 0 ? brNumber(fixed) : '' };
    }
    if (n < 0) return { prob: `Custo negativo (−${brNumber(Math.abs(n))})`, fx: 'custo', sug: brNumber(Math.abs(n)) };
    if (n === 0) return { prob: 'Custo zerado', fx: 'custo' };
    if (n > 1e9) return { prob: 'Custo acima do limite', fx: 'custo' };
    return { value: Math.round(n * 100) / 100 };
  }
  const normUnit = (raw) => { const u = String(raw || '').trim().toLowerCase().replace(/\.$/, ''); return UNIT_SYN[u] || u; };

  // Analisa as linhas com o mapeamento e as correcoes; devolve itens validos e linhas com erro.
  function analyse(S) {
    const { rows } = S.table, map = S.map, units = S.units, seen = new Map(), good = [], errs = [];
    for (const row of rows) {
      const id = `r${row.ln}`, fx = S.fix[id] || {};
      const cell = (k) => (k in fx ? fx[k] : (map[k] >= 0 && map[k] != null ? row.cells[map[k]] : ''));
      const code = String(cell('cod') || '').trim().toUpperCase(), desc = String(cell('desc') || '').trim().replace(/\s+/g, ' ');
      const base = { id, ln: row.ln, code, desc };
      let bad = null;
      if (!code) bad = { prob: 'Código vazio', fx: 'cod' };
      else if (code.length < 2) bad = { prob: 'Código com menos de 2 caracteres', fx: 'cod' };
      else if (code.length > 60) bad = { prob: 'Código com mais de 60 caracteres', fx: 'cod' };
      else if (desc.length < 3) bad = { prob: desc ? 'Descrição curta demais' : 'Descrição vazia', fx: 'desc' };
      else if (desc.length > 400) bad = { prob: 'Descrição com mais de 400 caracteres', fx: 'desc' };
      let unit = '';
      if (!bad) {
        unit = normUnit(cell('un'));
        if (!unit) bad = { prob: 'Unidade vazia', fx: 'un' };
        else if (unit.length > 20 || (units.length && !units.includes(unit))) bad = { prob: `Unidade "${String(cell('un')).trim()}" não existe no catálogo`, fx: units.length ? 'un' : '' };
      }
      let cost = null;
      if (!bad) { const c = checkCost(cell('custo')); if (c.prob) bad = c; else cost = c.value; }
      if (!bad) {
        const key = code.toLowerCase();
        if (seen.has(key)) bad = { prob: `Código repetido · já está na linha ${seen.get(key)}`, fx: '' };
        else seen.set(key, row.ln);
      }
      if (bad) { errs.push({ ...base, ...bad, fixed: false, left: !!S.out[id] }); continue; }
      let category = String(cell('cat') || '').trim();
      if (category.length < 2) category = '';
      good.push({ ...base, unit, cost, category, fixed: id in S.fix, source: S.forn || (S.exsat ? 'EXSAT' : 'IMPORTAÇÃO') });
    }
    return { good, errs };
  }

  // Item no formato da API; no que ja existe preserva fabricante, modelo, categoria e origem quando o arquivo nao traz.
  function toItem(g, prev) {
    return {
      code: g.code, manufacturer: prev ? prev.manufacturer : null, model: prev ? prev.model : null, description: g.desc,
      category: g.category || (prev ? prev.category : (S0.exsatCategory || 'Materiais')),
      unit: g.unit, currentCost: g.cost, source: S0.forn || (prev ? prev.source : (S0.exsat ? 'EXSAT' : 'IMPORTAÇÃO')), active: true,
    };
  }
  let S0 = {};

  // ---------- chamadas ----------
  async function previewItems(items) {
    const out = [];
    for (let i = 0; i < items.length; i += CHUNK) out.push(...(await OC.api('/catalog/import/preview', { method: 'POST', body: { items: items.slice(i, i + CHUNK) } })).items);
    return out;
  }

  // Previa em duas passadas: a primeira acha quem ja existe; a segunda repete com fabricante, modelo, categoria e origem
  // do que ja esta no catalogo (como a importacao grava), para o "igual ao catalogo" ser verdadeiro.
  async function previewSmart(goods) {
    const first = await previewItems(goods.map((g) => toItem(g, null)));
    const byCode = new Map(goods.map((g) => [g.code.toLowerCase(), g]));
    const again = first.filter((r) => r.previous);
    const second = again.length ? await previewItems(again.map((r) => toItem(byCode.get(r.code.toLowerCase()), r.previous))) : [];
    const merged = new Map(first.map((r) => [r.code.toLowerCase(), r]));
    second.forEach((r) => merged.set(r.code.toLowerCase(), r));
    return [...merged.values()];
  }

  function download(name, text) {
    const url = URL.createObjectURL(new Blob([`﻿${text}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  const csvCell = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const errorsCsv = (S, list) => ['Linha;Código;Descrição;Problema', ...list.map((e) => [e.ln, e.code, e.desc, e.prob].map(csvCell).join(';'))].join('\r\n');

  // ---------- tela ----------
  OC.screens.imp = async function (params) {
    const allowed = OC.canEdit() && OC.can('p10');
    if (!allowed) {
      const el = OC.render(`${OC.header('Importar catálogo', { back: true })}<div class="empty">${icon('shield-check', 28)}<b style="color:var(--text)">Importar catálogo não está liberado para o seu papel.</b>
        ${OC.canEdit() ? 'O catálogo carrega o custo dos itens; só quem vê custo pode importar.' : 'Seu acesso é só para consulta.'}</div>`, true, params);
      return el;
    }
    const S = S0 = {
      phase: 'file', step: 1, file: null, forn: '', head: true, table: { header: [], rows: [] }, map: {}, mapUser: {}, conf: {}, err: '',
      fix: {}, out: {}, tab: 'novos', shown: { novos: PAGE, atu: PAGE, err: 50 }, units: [], prev: new Map(), previewFail: '',
      load: null, token: 0, result: null, exsat: false, exsatCategory: '', failMsg: '', runDone: 0, runTotal: 0, fileMsg: '',
    };
    const el = OC.render(`<div class="top"><button class="back" type="button" data-back aria-label="Voltar">${icon('caret-left', 22)}</button><h1>Importar catálogo</h1><span class="grow"></span>
        <button class="suite-pill" type="button" data-suite aria-label="Suíte">${icon('stack', 18)}<span class="sp-t">Suíte</span>${icon('caret-down', 14)}</button></div>
      <p class="sub" id="i-sub" style="margin:-6px 0 0"></p><div id="i-steps"></div><div id="i-body" class="imp-body"></div>`, true, params);
    const body = OC.$('#i-body', el);
    const live = () => OC.nav === params.__nav;
    const set = (patch) => { Object.assign(S, patch); paint(); };

    // Voltar volta o passo; no primeiro passo (ou lendo, importando) sai da tela.
    OC.$('[data-back]', el).addEventListener('click', (event) => {
      if (S.phase === 'run') { event.stopPropagation(); OC.toast('Aguarde: a importação está em andamento', 'info'); return; }
      if (S.phase === 'map' || S.phase === 'review') { event.stopPropagation(); S.token += 1; set({ phase: S.phase === 'review' && !S.exsat ? 'map' : 'file', step: S.phase === 'review' && !S.exsat ? 2 : 1, err: '' }); return; }
      S.token += 1;
    }, true);

    const stepsHtml = () => {
      const st = S.phase === 'done' ? 4 : S.step, doneAll = S.phase === 'done';
      const labels = ['Arquivo', 'Colunas', 'Revisar', 'Pronto'];
      const pct = Math.round((Math.min(3, (st - 1) + (doneAll ? 1 : 0)) / 3) * 100);
      return `<div class="imp-steps" role="list"><div class="bar"><span style="width:${pct}%"></span></div><div class="imp-labels">${labels.map((l, i) => {
        const done = i + 1 < st || doneAll, cur = i + 1 === st && !done;
        return `<span role="listitem" class="${done ? 'done' : (cur ? 'cur' : '')}"${cur ? ' aria-current="step"' : ''}><i>${done ? icon('check', 11) : ''}</i>${l}</span>`;
      }).join('')}</div></div>`;
    };
    const subText = () => ({
      file: 'Passo 1 de 4 · escolha o arquivo', read: S.load && S.load.sub, vazio: 'Passo 1 de 4 · arquivo', erro: 'Passo 1 de 4 · arquivo', map: 'Passo 2 de 4 · ligue as colunas',
      conferir: 'Passo 3 de 4 · conferindo', review: 'Passo 3 de 4 · revise antes de importar', run: 'Passo 4 de 4 · importando', done: 'Pronto', fail: 'Passo 4 de 4 · importando',
    }[S.phase] || '');

    function paint() {
      if (!live()) return;
      OC.$('#i-sub', el).textContent = S.phase === 'read' || S.phase === 'conferir' ? (S.step === 1 ? 'Passo 1 de 4 · lendo o arquivo' : 'Passo 3 de 4 · conferindo com o catálogo') : subText();
      OC.$('#i-steps', el).innerHTML = stepsHtml();
      const view = { file: vFile, read: vLoad, conferir: vLoad, vazio: vEmpty, erro: vError, map: vMap, review: vReview, run: vRun, done: vDone, fail: vFail }[S.phase];
      const scroll = window.scrollY;
      body.innerHTML = view.html();
      view.bind(body);
      if (S.keepScroll) { window.scrollTo(0, scroll); S.keepScroll = false; }
    }

    // --- passo 1: arquivo ---
    const vFile = {
      html: () => `<label class="field"><span>Fornecedor ou origem (opcional)</span><input id="i-forn" type="text" maxlength="100" placeholder="Ex.: Seg Distribuidora" value="${esc(S.forn)}" autocomplete="off">
          <small class="hint">Fica gravado como origem dos itens. Em branco, entra como IMPORTAÇÃO.</small></label>
        <div class="card imp-pick"><span class="imp-ic">${icon('file-text', 26)}</span><span class="grow"><b>Planilha do celular</b><small>XLSX, CSV, TSV ou TXT · até ${kb(MAX_BYTES)}. A primeira linha traz os nomes das colunas.</small></span></div>
        ${S.fileMsg ? `<p class="alert">${icon('warning-circle', 16)}<span>${esc(S.fileMsg)}</span></p>` : ''}
        <button class="btn" type="button" id="i-choose">${icon('plus', 18)}Escolher arquivo</button>
        <input id="i-file" type="file" accept=".xlsx,.xlsm,.csv,.tsv,.txt,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
        <p class="hint">Foto da lista impressa e PDF ficam na versão completa: o reconhecimento de imagem roda só no aplicativo do computador.</p>`,
      bind(b) {
        OC.$('#i-forn', b).addEventListener('input', (e) => { S.forn = e.target.value.trim(); });
        OC.$('#i-choose', b).addEventListener('click', () => OC.$('#i-file', b).click());
        OC.$('#i-file', b).addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) { openFile(f); e.target.value = ''; } });
      },
    };

    // --- carregando (lendo o arquivo, conferindo) ---
    const vLoad = {
      html: () => {
        const L = S.load || { title: '', sub: '', steps: [], pct: 0 };
        return `<div class="card imp-load"><span class="spin" aria-hidden="true"></span><b>${esc(L.title)}</b><small>${esc(L.sub)}</small>
          <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${L.pct}"><span style="width:${L.pct}%"></span></div>
          <ul class="imp-checks">${L.steps.map(([t, th], i) => {
            const done = L.pct >= th, cur = !done && (i === 0 || L.pct >= L.steps[i - 1][1]);
            return `<li class="${done ? 'done' : (cur ? 'cur' : '')}">${done ? icon('check-circle', 18) : '<i class="dot"></i>'}<span>${esc(t)}</span></li>`;
          }).join('')}</ul></div>
          <button class="btn2" type="button" id="i-cancel">Cancelar</button>`;
      },
      bind(b) {
        OC.$('#i-cancel', b).addEventListener('click', () => {
          S.token += 1;
          if (S.phase === 'conferir' && !S.exsat) set({ phase: 'map', step: 2 });
          else set({ phase: 'file', step: 1, file: null });
        });
      },
    };

    const vEmpty = {
      html: () => `<div class="empty imp-state">${icon('file-text', 32)}<b>Nenhum item no arquivo</b><span>${esc(S.file ? S.file.name : 'O arquivo')} só tem o cabeçalho. Preencha uma linha por item com código, descrição, unidade e custo e importe de novo.</span>
        <button class="btn" type="button" id="i-again" style="padding:0 22px">Escolher outro arquivo</button></div>`,
      bind(b) { OC.$('#i-again', b).addEventListener('click', () => set({ phase: 'file', file: null })); },
    };
    const vError = {
      html: () => `<div class="empty imp-state">${icon('warning-circle', 32)}<b>${esc(S.failTitle || 'Não deu para abrir o arquivo')}</b><span>${esc(S.failMsg)}</span>
        <button class="btn" type="button" id="i-again" style="padding:0 22px">Escolher outro arquivo</button></div>`,
      bind(b) { OC.$('#i-again', b).addEventListener('click', () => set({ phase: 'file', file: null })); },
    };

    const progress = (title, sub, steps) => (pct) => { if (S.token !== S.runToken || !live()) return; S.load = { title, sub: sub(pct), steps, pct }; paint(); };
    function beginLoad(title, subFn, steps) {
      S.token += 1; S.runToken = S.token;
      const my = S.token, tick = progress(title, subFn, steps);
      return { my, tick, alive: () => S.token === my && live() };
    }

    async function openFile(file) {
      const reading = beginLoad('Lendo a planilha', (p) => `Abrindo o arquivo · ${p}%`, [['Abrindo o arquivo', 20], ['Encontrando as colunas', 60], ['Separando as linhas', 95]]);
      S.fileMsg = ''; S.failTitle = '';
      S.file = { name: file.name, size: file.size };
      set({ phase: 'read', step: 1, exsat: false, exsatCategory: '', load: { title: 'Lendo a planilha', sub: 'Abrindo o arquivo · 5%', steps: [['Abrindo o arquivo', 20], ['Encontrando as colunas', 60], ['Separando as linhas', 95]], pct: 5 } });
      try {
        const rows = await readFile(file, reading.tick);
        if (!reading.alive()) return;
        if (rows.length > MAX_ROWS + 1) throw new ReadError('big', `A planilha tem ${fmtN(rows.length - 1)} linhas. O limite aqui é ${fmtN(MAX_ROWS)}; divida o arquivo ou use a versão completa.`);
        reading.tick(100);
        if (rows.length < 2) { set({ phase: 'vazio', step: 1 }); return; }
        S.rawRows = rows;
        S.head = true; applyHead(); S.mapUser = {};
        set({ phase: 'map', step: 2, err: '' });
      } catch (error) {
        if (!reading.alive()) return;
        if (error instanceof ReadError && error.kind === 'locked') set({ phase: 'erro', step: 1, failMsg: `${file.name} está protegido por senha. Abra no Excel, salve uma cópia sem senha e importe de novo.` });
        else if (error instanceof ReadError) set({ phase: 'erro', step: 1, failMsg: error.message });
        else set({ phase: 'erro', step: 1, failMsg: `${file.name} não abriu. Confira se é uma planilha válida (XLSX ou CSV) e tente de novo.` });
      }
    }

    // Cabecalho ligado/desligado: sem cabecalho as colunas viram "Coluna A", "Coluna B".
    function applyHead() {
      const all = S.rawRows, width = Math.max(...all.map((r) => r.cells.length));
      const header = S.head ? Array.from({ length: width }, (_, i) => String(all[0].cells[i] || '').trim() || `Coluna ${colLetter(i)}`) : Array.from({ length: width }, (_, i) => `Coluna ${colLetter(i)}`);
      const rows = (S.head ? all.slice(1) : all).map((r) => ({ ln: r.ln, cells: Array.from({ length: width }, (_, i) => String(r.cells[i] == null ? '' : r.cells[i]).trim()) }));
      const s = suggest(header);
      S.table = { header, rows }; S.suggested = s.map; S.conf = s.conf;
      S.map = { ...s.map }; Object.entries(S.mapUser).forEach(([k, v]) => { S.map[k] = v; });
      S.fix = {}; S.out = {}; S.prev = new Map();
    }


    // --- passo 2: colunas ---
    const vMap = {
      html: () => {
        const T = S.table, hasEx = (i) => (T.rows.find((r) => r.cells[i]) || { cells: [] }).cells[i] || '';
        const used = Object.values(S.map).filter((v) => v != null && v >= 0);
        const unused = T.header.map((h, i) => [h, i]).filter(([, i]) => !used.includes(i));
        const fieldRow = ([k, label, req]) => {
          const idx = S.map[k], has = idx != null && idx >= 0, mine = k in S.mapUser;
          const badge = !has ? (req ? 'Falta' : '') : (mine ? 'Você escolheu' : (S.conf[k] ? 'Confira' : 'Sugerido'));
          const cls = !has ? 'miss' : (mine ? 'mine' : (S.conf[k] ? 'conf' : 'sug'));
          return `<button class="card imp-field${!has && req && S.err ? ' bad' : ''}" type="button" data-f="${k}"><span class="grow"><small class="label">${esc(label)} · ${req ? 'obrigatório' : 'opcional'}</small>
            <b>${has ? `Coluna ${colLetter(idx)} · ${esc(T.header[idx])}` : (req ? 'Escolha a coluna' : 'Sem coluna · entra como Materiais')}</b>
            ${has ? `<small>ex.: ${esc(hasEx(idx)) || '(vazio)'}</small>` : ''}</span>${badge ? `<span class="imp-badge ${cls}">${badge}</span>` : ''}${icon('caret-right', 18)}</button>`;
        };
        return `<p class="sub" style="margin:0">${esc(S.file.name)} · ${fmtN(T.rows.length)} linhas</p>
          ${S.err ? `<p class="alert">${icon('warning-circle', 16)}<span>${esc(S.err)}</span></p>` : ''}
          <div class="imp-fields">${FIELDS.map(fieldRow).join('')}</div>
          ${unused.length ? `<p class="hint">${unused.map(([h, i]) => `Coluna ${colLetter(i)} · ${esc(h)}`).join(', ')} ${unused.length > 1 ? 'não entram' : 'não entra'} no catálogo.</p>` : ''}
          <label class="card imp-head"><span class="grow"><b>A primeira linha é o cabeçalho</b><small>Desligue se a planilha já começa pelos itens.</small></span>
            <input type="checkbox" id="i-head" role="switch"${S.head ? ' checked' : ''}></label>
          <div class="actions"><button class="btn" type="button" id="i-next2">Revisar ${fmtN(T.rows.length)} linhas</button></div>`;
      },
      bind(b) {
        OC.$$('[data-f]', b).forEach((x) => x.addEventListener('click', () => colSheet(x.dataset.f)));
        OC.$('#i-head', b).addEventListener('change', (e) => { S.head = e.target.checked; applyHead(); set({ err: '' }); });
        OC.$('#i-next2', b).addEventListener('click', next2);
      },
    };

    function colSheet(key) {
      const T = S.table, field = FIELDS.find((f) => f[0] === key), cur = S.map[key];
      const exOf = (i) => (T.rows.find((r) => r.cells[i]) || { cells: [] }).cells[i] || '';
      const opt = (i, t, s) => `<button class="opt" type="button" data-pick="${i}" aria-pressed="${cur === i || (i === -1 && (cur == null || cur < 0))}"><span><b>${esc(t)}</b><small>${esc(s)}</small></span><i class="radio"></i></button>`;
      const s = OC.sheet(`${OC.sheetHead(`Coluna para ${field[1]}`, 'file-text')}<div class="opts" style="margin-top:12px">
        ${T.header.map((h, i) => opt(i, `Coluna ${colLetter(i)} · ${h}`, `ex.: ${exOf(i) || '(vazio)'}`)).join('')}
        ${field[2] ? '' : opt(-1, 'Sem coluna', 'Os itens entram como Materiais')}</div>`);
      OC.$$('[data-pick]', s.el).forEach((x) => x.addEventListener('click', () => {
        const v = Number(x.dataset.pick);
        S.mapUser[key] = v; S.map[key] = v; S.err = '';
        s.close(); paint();
      }));
    }

    function next2() {
      const miss = FIELDS.filter(([k, , req]) => req && !(S.map[k] >= 0));
      if (miss.length) { set({ err: `Escolha a coluna de ${miss.map((m) => m[1]).join(' e ')} para continuar.` }); return; }
      const vals = FIELDS.filter(([k]) => S.map[k] >= 0).map(([k]) => [k, S.map[k]]);
      const dup = vals.find(([, v], i) => vals.findIndex(([, w]) => w === v) !== i);
      if (dup) {
        const names = vals.filter(([, v]) => v === dup[1]).map(([k]) => FIELD_NAME[k]);
        set({ err: `A coluna ${colLetter(dup[1])} está ligada a ${names.join(' e ')}. Cada coluna vale para um campo só.` }); return;
      }
      S.err = '';
      goReview();
    }

    // Confere com o catalogo: unidades existentes e, no servidor, quem e novo, atualizado ou igual.
    async function goReview(existing) {
      const n = S.table.rows.length;
      const loading = existing || beginLoad('Conferindo com o catálogo', (p) => `Comparando ${fmtN(n)} linhas com o catálogo · ${p}%`, [['Procurando códigos iguais', 30], ['Comparando preços', 70], ['Checando erros', 95]]);
      S.step = 3; S.phase = 'conferir'; loading.tick(10);
      try {
        if (!S.units.length) S.units = ((await OC.api('/catalog/units')).units || []).map((u) => u.unit);
        if (!loading.alive()) return;
        loading.tick(35);
        const { good } = analyse(S);
        let done = 0;
        S.prev = new Map();
        for (let i = 0; i < good.length; i += CHUNK) {
          const res = await previewSmart(good.slice(i, i + CHUNK));
          if (!loading.alive()) return;
          res.forEach((r) => S.prev.set(r.code.toLowerCase(), r));
          done += Math.min(CHUNK, good.length - i);
          loading.tick(35 + Math.round((done / Math.max(1, good.length)) * 55));
        }
        loading.tick(100);
        S.tab = 'novos'; S.shown = { novos: PAGE, atu: PAGE, err: 50 };
        set({ phase: 'review', step: 3 });
      } catch (error) {
        if (!loading.alive()) return;
        set({ phase: 'erro', step: 1, failTitle: 'Não deu para conferir com o catálogo', failMsg: error.message });
      }
    }

    // --- passo 3: revisar ---
    function model() {
      const { good, errs } = analyse(S);
      const rowOf = (g) => ({ g, p: S.prev.get(g.code.toLowerCase()) });
      const all = good.map(rowOf);
      const status = (r) => (r.p ? r.p.status : 'new');
      const novos = all.filter((r) => status(r) === 'new'), atu = all.filter((r) => status(r) === 'updated'), same = all.filter((r) => status(r) === 'unchanged');
      const fixedN = good.filter((g) => g.fixed).length;
      const pend = errs.filter((e) => !e.left);
      return { novos, atu, same, errs, pend, fixedN, outN: errs.length, importN: novos.length + atu.length, good };
    }

    const vReview = {
      html: () => {
        const m = model(), tabs = [['novos', 'Novos', m.novos.length], ['atu', 'Atualizados', m.atu.length], ['err', 'Com erro', m.errs.length]];
        const cost = (v) => esc(money(v));
        const list = {
          novos: () => m.novos.length ? `<div class="rows">${m.novos.slice(0, S.shown.novos).map(({ g }) => `<div class="prow static"><span class="grow"><b>${esc(g.desc)}</b><small>${esc(g.code)} · ${esc(g.unit)}${g.category ? ` · ${esc(g.category)}` : ''}</small></span><span class="end"><b>${cost(g.cost)}</b></span></div>`).join('')}</div>
            ${m.novos.length > S.shown.novos ? `<button class="btn2" type="button" data-more="novos">Ver mais ${Math.min(PAGE, m.novos.length - S.shown.novos)} de ${fmtN(m.novos.length - S.shown.novos)} itens novos</button>` : ''}` : `<div class="empty">${icon('package', 28)}Nenhum item novo neste arquivo.</div>`,
          atu: () => m.atu.length ? `<div class="rows">${m.atu.slice(0, S.shown.atu).map(({ g, p }) => {
            const before = p && p.previous ? p.previous.currentCost : null, d = before ? g.cost / before - 1 : 0, same = before != null && Math.abs(g.cost - before) < 0.005;
            return `<div class="prow static imp-upd"><span class="grow"><b>${esc(g.desc)}</b><small>Código ${esc(g.code)}</small>
              <small class="ba">${same ? 'Mesmo preço · outros dados mudaram' : `${cost(before)} → ${cost(g.cost)}`}</small></span>
              ${same ? '' : `<span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? icon('caret-up', 12) : icon('caret-down', 12)}${esc(pctS(d))}</span>`}</div>`;
          }).join('')}</div>
            ${m.atu.length > S.shown.atu ? `<button class="btn2" type="button" data-more="atu">Ver mais ${Math.min(PAGE, m.atu.length - S.shown.atu)} de ${fmtN(m.atu.length - S.shown.atu)} preços atualizados</button>` : ''}` : `<div class="empty">${icon('package', 28)}Nenhum item existente muda de preço.</div>`,
          err: () => m.errs.length ? `<div class="imp-errs">${m.errs.slice(0, S.shown.err).map((e) => {
            return `<div class="card imp-err${e.left ? ' left' : ''}"><span class="label">Linha ${e.ln}</span><b>${esc(e.desc || 'Sem descrição')}</b><small>${e.code ? `Código ${esc(e.code)}` : 'Sem código'}</small>
              <p class="why">${icon('warning-circle', 15)}<span>${esc(e.prob)}</span></p>
              ${e.left ? `<div class="row-act"><span class="imp-badge left">Fica de fora</span><button class="chip-act" type="button" data-undo="${e.id}">Desfazer</button></div>`
              : `<div class="row-act">${e.fx ? `<button class="chip-act" type="button" data-fix="${e.id}">Corrigir</button>` : ''}<button class="chip-act ghost" type="button" data-leave="${e.id}">Deixar de fora</button></div>`}</div>`;
          }).join('')}</div>
            ${m.errs.length > S.shown.err ? `<button class="btn2" type="button" data-more="err">Ver mais linhas com erro</button>` : ''}` : `<div class="empty">${icon('check-circle', 28)}Nenhuma linha com erro.</div>`,
        }[S.tab]();
        const fixedList = m.good.filter((g) => g.fixed);
        return `<p class="sub" style="margin:0">${esc(S.file.name)} · ${S.forn ? `${esc(S.forn)} · ` : ''}${fmtN(S.table.rows.length)} linhas</p>
          <div class="imp-tabs" role="tablist">${tabs.map(([k, l, n]) => `<button type="button" role="tab" aria-selected="${S.tab === k}" data-tab="${k}" class="${k === 'err' && n ? 'bad' : ''}"><b>${fmtN(n)}</b><span>${l}</span></button>`).join('')}</div>
          ${list}
          ${S.tab === 'err' && fixedList.length ? `<p class="hint">${fixedList.length} ${fixedList.length === 1 ? 'linha corrigida entra' : 'linhas corrigidas entram'} na importação (nas abas Novos e Atualizados).</p>` : ''}
          ${S.tab !== 'err' && m.same.length ? `<p class="hint">${fmtN(m.same.length)} ${m.same.length === 1 ? 'linha igual ao catálogo fica' : 'linhas iguais ao catálogo ficam'} como estão.</p>` : ''}
          ${S.tab === 'err' && m.errs.some((e) => e.left) ? `<button class="btn2" type="button" id="i-csv">${icon('arrow-square-out', 18)}Baixar linhas de fora (CSV)</button>` : ''}
          ${S.previewFail ? `<p class="alert">${icon('warning-circle', 16)}<span>${esc(S.previewFail)}</span></p>` : ''}
          <div class="actions imp-go"><span class="imp-go-t"><b>${fmtN(m.importN)} ${m.importN === 1 ? 'item entra' : 'itens entram'}</b><small>${m.outN ? `${fmtN(m.outN)} ${m.outN === 1 ? 'linha com erro fica' : 'linhas com erro ficam'} de fora` : 'Nenhuma linha fica de fora'}</small></span>
            <button class="btn" type="button" id="i-go"${m.importN ? '' : ' disabled'}>Importar ${fmtN(m.importN)} ${m.importN === 1 ? 'item' : 'itens'}</button></div>`;
      },
      bind(b) {
        OC.$$('[data-tab]', b).forEach((x) => x.addEventListener('click', () => set({ tab: x.dataset.tab })));
        OC.$$('[data-more]', b).forEach((x) => x.addEventListener('click', () => { S.shown[x.dataset.more] += x.dataset.more === 'err' ? 50 : PAGE; S.keepScroll = true; paint(); }));
        OC.$$('[data-fix]', b).forEach((x) => x.addEventListener('click', () => fixSheet(x.dataset.fix)));
        OC.$$('[data-leave]', b).forEach((x) => x.addEventListener('click', () => { S.out[x.dataset.leave] = true; S.keepScroll = true; paint(); }));
        OC.$$('[data-undo]', b).forEach((x) => x.addEventListener('click', () => { delete S.out[x.dataset.undo]; S.keepScroll = true; paint(); }));
        const csv = OC.$('#i-csv', b);
        if (csv) csv.addEventListener('click', () => { const left = model().errs.filter((e) => e.left); download('linhas-com-erro.csv', errorsCsv(S, left)); OC.toast(`linhas-com-erro.csv · ${left.length} ${left.length === 1 ? 'linha' : 'linhas'}`); });
        OC.$('#i-go', b).addEventListener('click', run);
      },
    };

    function fixSheet(id) {
      const e = model().errs.find((x) => x.id === id);
      if (!e) return;
      const titles = { custo: 'Custo (R$)', un: 'Unidade', desc: 'Descrição', cod: 'Código' };
      const topUnits = S.units.slice(0, 10);
      const s = OC.sheet(`${OC.sheetHead(`Corrigir a linha ${e.ln}`, 'pencil-simple')}<p class="sheet-text">${esc(e.desc || 'Sem descrição')} · ${esc(e.prob)}</p>
        ${e.fx === 'un' ? `<div class="field" style="margin-top:12px"><span>${titles.un}</span><div class="chips wrap" id="f-units">${topUnits.map((u) => `<button class="chip-act" type="button" data-u="${esc(u)}" aria-pressed="false">${esc(u)}</button>`).join('')}</div></div>`
          : `<label class="field" style="margin-top:12px"><span>${titles[e.fx]}</span><input id="f-val" type="text" ${e.fx === 'custo' ? 'inputmode="decimal" placeholder="Ex.: 1.200,00"' : 'maxlength="400"'} value="${esc(e.sug || '')}" autocomplete="off"></label>`}
        ${e.sug ? `<button class="chip-act" type="button" id="f-sug" style="margin-top:10px">Usar ${esc(e.sug)}</button>` : ''}
        <p class="alert" id="f-err" style="margin-top:10px"></p>
        <div class="sheet-actions"><button class="btn2" type="button" data-no>Cancelar</button><button class="btn" type="button" data-yes>Salvar correção</button></div>`);
      let value = e.sug || '';
      const input = OC.$('#f-val', s.el);
      if (input) { input.addEventListener('input', () => { value = input.value; }); setTimeout(() => input.focus(), 50); }
      OC.$$('[data-u]', s.el).forEach((x) => x.addEventListener('click', () => { value = x.dataset.u; OC.$$('[data-u]', s.el).forEach((y) => y.setAttribute('aria-pressed', String(y === x))); }));
      const sug = OC.$('#f-sug', s.el);
      if (sug) sug.addEventListener('click', () => { value = e.sug; if (input) input.value = e.sug; });
      OC.$('[data-no]', s.el).addEventListener('click', s.close);
      OC.$('[data-yes]', s.el).addEventListener('click', async (ev) => {
        const v = String(value).trim(), bad = (t) => { OC.$('#f-err', s.el).textContent = t; };
        if (!v) { bad(e.fx === 'un' ? 'Escolha a unidade.' : 'Preencha o campo para salvar.'); return; }
        if (e.fx === 'custo') { const c = checkCost(v); if (c.prob) { bad('Digite um custo maior que zero, como 1.200,00.'); return; } }
        const next = { ...S.fix, [id]: { ...(S.fix[id] || {}), [e.fx]: v } };
        const saved = S.fix; S.fix = next;
        const probe = analyse(S).good.find((g) => g.id === id);
        if (probe) {
          ev.currentTarget.disabled = true;
          try { const [res] = await previewSmart([probe]); S.prev.set(res.code.toLowerCase(), res); }
          catch (error) { S.fix = saved; ev.currentTarget.disabled = false; bad(error.message); return; }
        }
        delete S.out[id];
        s.close(); S.keepScroll = true; paint();
        OC.toast(`Linha ${e.ln} corrigida`);
      });
    }

    // --- passo 4: importar ---
    async function run() {
      const m = model();
      const items = [...m.novos, ...m.atu].map(({ g, p }) => toItem(g, p && p.previous ? p.previous : null));
      if (!items.length) return;
      S.token += 1; const my = S.token;
      set({ phase: 'run', step: 4, runDone: 0, runTotal: items.length, previewFail: '' });
      const totals = { created: 0, updated: 0, ignored: 0 };
      try {
        for (let i = 0; i < items.length; i += CHUNK) {
          const part = items.slice(i, i + CHUNK);
          const res = await OC.api('/catalog/import/bulk', { method: 'POST', body: { items: part } });
          totals.created += res.created; totals.updated += res.updated; totals.ignored += res.ignored || 0;
          S.runDone = Math.min(items.length, i + part.length);
          if (S.token === my && live()) paint();
        }
        if (!live()) return;
        set({ phase: 'done', step: 4, result: { ...totals, fixed: m.fixedN, same: m.same.length, leftRows: m.errs.map((e) => ({ ...e, left: true })) } });
        OC.toast(`${fmtN(totals.created + totals.updated)} itens importados no catálogo`);
      } catch (error) {
        if (!live()) return;
        set({ phase: 'fail', step: 4, failMsg: error.message, result: { ...totals } });
      }
    }

    const vRun = {
      html: () => `<div class="card imp-load"><span class="spin" aria-hidden="true"></span><b>Importando ${fmtN(S.runDone)} de ${fmtN(S.runTotal)} itens</b><small>Não feche esta tela até terminar.</small>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round((S.runDone / Math.max(1, S.runTotal)) * 100)}"><span style="width:${Math.round((S.runDone / Math.max(1, S.runTotal)) * 100)}%"></span></div></div>`,
      bind() { /* sem acoes: o voltar fica travado */ },
    };
    const vFail = {
      html: () => `<div class="empty imp-state">${icon('warning-circle', 32)}<b>A importação parou</b><span>${esc(S.failMsg)}${S.result && (S.result.created + S.result.updated) ? ` Já entraram ${fmtN(S.result.created + S.result.updated)} itens; importar de novo é seguro, quem já entrou só é atualizado.` : ' Nada foi gravado.'}</span>
        <button class="btn" type="button" id="i-retry" style="padding:0 22px">Tentar de novo</button><button class="btn2" type="button" id="i-back3" style="padding:0 22px">Voltar à revisão</button></div>`,
      bind(b) {
        OC.$('#i-retry', b).addEventListener('click', run);
        OC.$('#i-back3', b).addEventListener('click', () => set({ phase: 'review', step: 3 }));
      },
    };
    const vDone = {
      html: () => {
        const r = S.result, total = r.created + r.updated, leftN = r.leftRows.length;
        const line = ([k, v]) => `<div class="kv"><span>${k}</span><b>${fmtN(v)}</b></div>`;
        return `<div class="card imp-ok"><span class="ok-ic">${icon('check-circle-fill', 34)}</span><b class="big">${fmtN(total)} ${total === 1 ? 'item importado' : 'itens importados'}</b>
            <small>De ${esc(S.file.name)}${S.forn ? ` · ${esc(S.forn)}` : ''}</small></div>
          <div class="card">${[['Itens novos', r.created], ['Preços e dados atualizados', r.updated], ['Corrigidas por você', r.fixed], ['Ficaram de fora', leftN], ['Iguais ao catálogo', r.same]].map(line).join('')}</div>
          ${leftN ? `<button class="btn2" type="button" id="i-csv2">${icon('arrow-square-out', 18)}${leftN === 1 ? 'Baixar a linha de fora (CSV)' : `Baixar as ${fmtN(leftN)} linhas de fora (CSV)`}</button>` : ''}
          <p class="hint">Propostas em edição com itens de preço novo mostram o aviso “Atualizar preços desta proposta?”.</p>
          <div class="actions"><button class="btn2" type="button" id="i-again">Importar outro</button><button class="btn" type="button" id="i-cat">Ver catálogo</button></div>`;
      },
      bind(b) {
        const csv = OC.$('#i-csv2', b);
        if (csv) csv.addEventListener('click', () => download('linhas-com-erro.csv', errorsCsv(S, S.result.leftRows)));
        OC.$('#i-again', b).addEventListener('click', () => OC.go('imp', {}, { back: true }));
        OC.$('#i-cat', b).addEventListener('click', () => OC.go('cat', {}, { back: true }));
      },
    };

    paint();
    return el;
  };
})(window.OC = window.OC || {});
