// Corpo da proposta no celular: mesmas regras de src/shared/proposalBody.ts e src/shared/proposalBodyModels.ts (limites, variaveis,
// ordem, modelos de fabrica). Sem tela aqui: o editor (prop-corpo.js), as Configuracoes (cfg-corpo.js) e a previa do PDF usam isto.
// O teste src/documents/mobile-body.test.ts confere que este arquivo da o mesmo resultado do modulo compartilhado.
// So conteudo comercial: nenhuma variavel le custo, BDI ou margem.
(function (OC) {
  const B = OC.body = {};
  B.LIMITS = { blocks: 60, text: 5000, title: 120, templateName: 80, templates: 40, field: 600, caption: 200, tableCols: 8, tableRows: 120, tableCell: 300 };
  B.LABELS = {
    titulo: 'Título de seção', paragrafo: 'Parágrafo', lista: 'Lista', planilha: 'Planilha própria', itens: 'Tabela de itens', condicoes: 'Condições comerciais',
    carta: 'Carta de abertura', fechamento: 'Fechamento e assinatura',
  };
  B.ITEMS_TITLE = 'Composição e precificação';
  B.COND_TITLE = 'Condições comerciais';
  B.LETTER_TITLE = 'Proposta técnica-comercial';
  B.PLACE = 'Salvador / BA';
  B.VARIABLES = [
    ['cliente', 'Cliente'], ['obra', 'Obra'], ['numero', 'Número da proposta'], ['revisao', 'Revisão'], ['valor_total', 'Valor total'], ['validade', 'Validade'],
    ['responsavel', 'Responsável'], ['escopo', 'Descrição do serviço (escopo da proposta)'], ['contato', 'Contato do cliente (nome e cargo)'],
    ['setor_contato', 'Setor do contato do cliente'], ['email_contato', 'E-mail do contato do cliente'], ['telefone_contato', 'Telefone do contato do cliente'],
  ];
  const LEAD = 'Prezados Senhores,\nApresentamos nossa proposta técnica e comercial para fornecimento de equipamentos, materiais e execução dos serviços descritos a seguir.';
  const PRESENTATION = B.PRESENTATION = 'A CONSTRUTEC atua no desenvolvimento de soluções de engenharia, projetos, automação, elétrica, combate a incêndio e infraestrutura tecnológica. Apresentamos nossa proposta técnica e comercial para atendimento ao escopo descrito a seguir.';

  B.newId = () => {
    try { if (globalThis.crypto && globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID(); } catch { /* fora de https */ }
    return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  };
  B.todayIso = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  B.longDate = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
    const month = m ? MONTHS[Number(m[2]) - 1] : undefined;
    return m && month ? `${m[3]} de ${month} de ${m[1]}` : '';
  };

  // Sem caracteres de controle nem de formatacao; texto longo aceita quebra de linha e tab.
  B.clean = (value, multiline) => {
    const lines = String(value == null ? '' : value).replace(/\r\n?/g, '\n');
    const unified = multiline ? lines : lines.replace(/[\t\n]/g, ' ');
    const cleaned = [...unified].filter((ch) => (multiline && (ch === '\n' || ch === '\t')) || !/[\p{Cf}\p{Cc}]/u.test(ch)).join('');
    return multiline ? cleaned.replace(/[ \t]+\n/g, '\n').trim() : cleaned.replace(/\s+/g, ' ').trim();
  };
  B.emptyTable = () => ({ headers: ['Descrição', 'Quantidade', 'Valor'], rows: [['', '', ''], ['', '', '']] });
  B.normalizeTable = (table) => {
    const cell = (v) => B.clean(typeof v === 'string' ? v : '', false).slice(0, B.LIMITS.tableCell).trim();
    const headers = ((table && table.headers) || []).slice(0, B.LIMITS.tableCols).map(cell);
    if (!headers.length) return B.emptyTable();
    const rows = ((table && table.rows) || []).slice(0, B.LIMITS.tableRows).map((row) => headers.map((_, c) => cell(row && row[c])));
    return { headers, rows };
  };

  B.error = (blocks) => {
    const count = (t) => blocks.filter((b) => b.type === t).length;
    if (blocks.length > B.LIMITS.blocks) return `O corpo aceita até ${B.LIMITS.blocks} blocos.`;
    if (count('itens') !== 1) return 'A tabela de itens precisa existir uma vez no corpo.';
    if (count('condicoes') !== 1) return 'As condições comerciais precisam existir uma vez no corpo.';
    if (count('carta') > 1) return 'A carta de abertura pode existir uma vez só.';
    if (count('fechamento') > 1) return 'O fechamento com assinatura pode existir uma vez só.';
    if (new Set(blocks.map((b) => b.id)).size !== blocks.length) return 'Blocos com identificador repetido.';
    return null;
  };

  const scopeText = (raw) => {
    let value = String(raw || '');
    try { const parsed = JSON.parse(value); if (parsed && typeof parsed.scope === 'string') value = parsed.scope; } catch { /* texto simples */ }
    const text = value.trim();
    return text && text.toLowerCase() !== 'a definir' ? text : '';
  };
  const dateFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  B.variables = (p) => {
    const c = p.clientContact || {};
    const t = (v) => (typeof v === 'string' ? v.trim() : '');
    return {
      cliente: p.clientName || '', obra: p.workName || '', numero: p.number, revisao: String(p.revision).padStart(2, '0'),
      valor_total: brl.format((p.totals && p.totals.finalValue) || 0),
      validade: p.validUntil ? dateFmt.format(new Date(`${p.validUntil.slice(0, 10)}T00:00:00Z`)) : 'a definir',
      responsavel: p.responsibleName || '', escopo: scopeText(p.scope) || 'a definir',
      contato: [c.name, c.role].map((part) => t(part)).filter(Boolean).join(' - '),
      setor_contato: t(c.department), email_contato: t(c.email), telefone_contato: t(c.phone),
    };
  };
  B.fill = (text, vars) => String(text || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, key) => (Object.prototype.hasOwnProperty.call(vars, key.toLowerCase()) ? vars[key.toLowerCase()] : match));

  const NUMERIC = /^[-+]?\s*(R\$\s*)?\d[\d.,\s]*\s*(%|[a-zA-Z²³]{1,4}\.?)?$/;
  B.aligns = (headers, rows) => headers.map((_, c) => {
    const cells = rows.map((row) => (row[c] || '').trim()).filter(Boolean);
    return cells.length > 0 && cells.every((cell) => NUMERIC.test(cell)) ? 'right' : 'left';
  });
  B.paragraphs = (text) => String(text).replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/).map((para) => para.split('\n').map((l) => l.trim()).filter(Boolean)).filter((l) => l.length > 0);
  B.listItems = (text) => String(text).replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim().replace(/^[-*•]\s+/, '').trim()).filter(Boolean);

  // Blocos ligados, na ordem, com as variaveis trocadas (resolveBodyParts). Com "numerar" na carta, titulos ganham 1., 1.1. ...
  B.parts = (p, blocks) => {
    const vars = B.variables(p);
    const fill = (text) => B.fill(text, vars);
    const numbered = blocks.some((b) => b.type === 'carta' && b.enabled && b.numbered);
    let section = 0, subsection = 0;
    const label = (title, sub) => {
      if (!numbered) return title;
      if (sub && section > 0) { subsection += 1; return `${section}.${subsection}. ${title}`; }
      section += 1; subsection = 0; return `${section}. ${title}`;
    };
    const out = [];
    for (const b of blocks) {
      if (!b.enabled && b.type !== 'itens') continue;
      const title = fill(b.title).trim();
      const field = (key) => fill(b.fields && b.fields[key]).trim();
      const heading = () => { if (title) out.push({ kind: 'heading', text: label(title, !!b.sub), sub: !!b.sub }); };
      if (b.type === 'itens') out.push({ kind: 'itens', title: label(title || B.ITEMS_TITLE, false), caption: fill(b.text).trim() });
      else if (b.type === 'condicoes') out.push({ kind: 'condicoes', title: label(title || B.COND_TITLE, false) });
      else if (b.type === 'carta') {
        const place = field('place'), date = B.longDate(b.fields && b.fields.date);
        out.push({ kind: 'carta', dateLine: [place, date].filter(Boolean).join(', ') + (place || date ? '.' : ''), recipient: field('recipient'), attention: field('attention'),
          department: field('department'), reference: field('reference'), title: title || B.LETTER_TITLE, greeting: field('greeting'), intro: field('intro') });
      } else if (b.type === 'fechamento') out.push({ kind: 'fechamento', paragraphs: B.paragraphs(fill(b.text)), signer: field('signer'), role: field('role') });
      else if (b.type === 'planilha') {
        const table = B.normalizeTable(b.table);
        const headers = table.headers.map(fill);
        const rows = table.rows.map((row) => row.map(fill)).filter((row) => row.some(Boolean));
        if (!rows.length) continue;
        heading();
        out.push({ kind: 'planilha', headers, rows, align: B.aligns(headers, rows) });
      } else if (b.type === 'titulo') heading();
      else {
        heading();
        const text = fill(b.text);
        if (b.type === 'lista') { const items = B.listItems(text); if (items.length) out.push({ kind: 'list', items }); }
        else B.paragraphs(text).forEach((lines) => out.push({ kind: 'paragraph', lines }));
      }
    }
    return out;
  };

  // Documento sem corpo montado, em blocos editaveis (legacyBodyBlocks); scope = escopo ja lido das condicoes.
  B.legacy = (scope) => {
    const s = String(scope || '').trim();
    const meaningful = s && s.toLowerCase() !== 'a definir' ? s : '';
    return [
      { id: 'legado-abertura', type: 'paragrafo', text: LEAD, enabled: true },
      { id: 'legado-apresentacao', type: 'paragrafo', title: 'Apresentação', text: PRESENTATION, enabled: true },
      ...(meaningful ? [{ id: 'legado-escopo', type: 'paragrafo', title: 'Escopo', text: meaningful, enabled: true }] : []),
      { id: 'legado-itens', type: 'itens', title: B.ITEMS_TITLE, enabled: true },
      { id: 'legado-condicoes', type: 'condicoes', title: B.COND_TITLE, enabled: true },
    ];
  };
  B.initial = (p) => p.bodyBlocks || B.legacy(OC.parseConditions ? OC.parseConditions(p.scope).scope : p.scope);

  const BLANK = {
    carta: { place: '', recipient: '{{cliente}}', attention: '{{contato}}', department: '{{setor_contato}}', reference: 'Proposta nº {{numero}} - {{escopo}} - {{obra}}', greeting: 'Prezados Senhores:', intro: 'Atendendo à vossa solicitação, segue nossa proposta técnica-comercial, conforme detalhamento abaixo:' },
    fechamento: { signer: '{{responsavel}}', role: '' },
  };
  B.empty = (type, today = B.todayIso(), place = B.PLACE) => {
    const fields = BLANK[type];
    return {
      id: B.newId(), type, enabled: true,
      ...(type === 'titulo' ? { title: '' } : type === 'paragrafo' || type === 'lista' || type === 'fechamento' ? { text: '' } : {}),
      ...(type === 'carta' ? { title: B.LETTER_TITLE } : {}),
      ...(type === 'planilha' ? { title: '', table: B.emptyTable() } : {}),
      ...(fields ? { fields: type === 'carta' ? { ...fields, place, date: today } : { ...fields } } : {}),
    };
  };

  // Operacoes da lista (proposalBodyEdit.ts): a tabela de itens nunca sai; as condicoes so se desligam; singletons nao duplicam.
  B.canAdd = (blocks) => blocks.length < B.LIMITS.blocks;
  B.canRemove = (b) => b.type !== 'itens' && b.type !== 'condicoes';
  B.canDisable = (b) => b.type !== 'itens';
  B.canDuplicate = (b) => ['titulo', 'paragrafo', 'lista', 'planilha'].includes(b.type);
  B.canSub = B.canDuplicate;
  B.has = (blocks, type) => blocks.some((b) => b.type === type);
  B.insert = (blocks, at, block) => { if (!B.canAdd(blocks)) return blocks; const next = [...blocks]; next.splice(Math.min(Math.max(at, 0), next.length), 0, block); return next; };
  B.move = (blocks, from, to) => {
    if (from === to || from < 0 || from >= blocks.length || to < 0 || to >= blocks.length) return blocks;
    const next = [...blocks]; const [b] = next.splice(from, 1); next.splice(to, 0, b); return next;
  };
  B.remove = (blocks, i) => (blocks[i] && B.canRemove(blocks[i]) ? blocks.filter((_, at) => at !== i) : blocks);
  B.duplicate = (blocks, i) => {
    const b = blocks[i];
    if (!b || !B.canDuplicate(b)) return blocks;
    return B.insert(blocks, i + 1, { ...b, id: B.newId(), ...(b.table ? { table: { headers: [...b.table.headers], rows: b.table.rows.map((r) => [...r]) } } : {}) });
  };
  B.update = (blocks, i, patch) => blocks.map((b, at) => (at === i ? { ...b, ...patch } : b));
  B.fromTemplate = (t) => ({ id: B.newId(), type: t.type, enabled: true, ...(t.title ? { title: t.title } : {}), text: t.text });
  B.toTemplate = (b, name) => {
    if (b.type !== 'paragrafo' && b.type !== 'lista') return null;
    const text = (b.text || '').trim(), clean = String(name || '').trim();
    if (!text || !clean) return null;
    return { name: clean.slice(0, B.LIMITS.templateName), type: b.type, ...(b.title && b.title.trim() ? { title: b.title.trim() } : {}), text };
  };
  // Trechos [entre colchetes] ainda por preencher (pendingPlaceholders).
  B.pending = (blocks) => blocks.filter((b) => b.enabled).reduce((n, b) => n + (([b.title, b.text, ...Object.values(b.fields || {})].join('\n').match(/\[[^\][\n]+\]/g) || []).length), 0);
})(window.OC = window.OC || {});
