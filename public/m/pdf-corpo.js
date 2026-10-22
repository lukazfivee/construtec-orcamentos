// Previa do documento do cliente no celular, na ordem do documento do servidor (buildProposalHtml + buildMobileProposalHtml): capa,
// corpo montado (carta, titulos, textos, listas, planilhas, tabela de itens, condicoes, fechamento) ou o layout padrao, e o aviso de
// validade. As paginas sao medidas de verdade numa folha escondida. Opcoes do documento iguais as do computador (ProposalExportDialog):
// agrupar, codigos, mao de obra, clausulas, observacoes, notas complementares e marca d'agua. So precos de venda.
(function (OC) {
  const { esc } = OC;
  const B = OC.body;
  const LIMIT = 498; // altura util da pagina da previa (560 - margens)
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const qty = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
  const dateFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
  const fmtDate = (iso) => (iso ? dateFmt.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : '');
  const flag = (v) => (v ? 1 : 0);

  OC.docDefaults = () => ({ capa: true, condicoes: true, validade: true, agrupar: false, codigos: false, mao: true, obs: true, notas: '' });
  // Parametros do documento do servidor (HTML e Word). marca so vai quando a pessoa mudou; sem ela vale o padrao da empresa.
  OC.docQuery = (c) => [
    `modelo=${c.obs ? 'completo' : 'resumido'}`, `capa=${flag(c.capa)}`, `condicoes=${flag(c.condicoes)}`, `validade=${flag(c.validade)}`,
    `agrupar=${flag(c.agrupar)}`, `codigos=${flag(c.codigos)}`, `mao=${flag(c.mao)}`, `observacoes=${flag(c.obs)}`,
    ...(c.marca === undefined ? [] : [`marca=${flag(c.marca)}`]),
    ...(c.obs && c.notas.trim() ? [`notas=${encodeURIComponent(c.notas.trim().slice(0, 1000))}`] : []),
  ].join('&');

  // Preco final da mao de obra no documento (commercialLaborTotal): custo x BDI x (1 + imposto). Sem p10 o custo vem zerado:
  // vale o que sobra do valor final depois dos itens.
  OC.docLabor = (p) => {
    if (!(p.laborItems || []).length) return 0;
    const t = p.totals || {};
    if (t.labor > 0 && p.bdiMultiplier > 0) return OC.cents(t.labor * p.bdiMultiplier * (1 + (p.taxPercentage || 0) / 100));
    return Math.max(0, OC.cents((t.finalValue || 0) - (p.items || []).reduce((s, it) => s + (it.totalSale || 0), 0)));
  };
  // Clausulas do documento (proposalPresentation.ts), com as notas complementares junto das observacoes.
  OC.docTerms = (p, c) => {
    const k = OC.parseConditions(p.scope);
    const notes = [k.notes, (c.notas || '').trim()].filter(Boolean).join('\n\n');
    const obs = c.obs && notes ? [['Observações', notes]] : [];
    if (!c.condicoes) return obs;
    return [['Forma de pagamento', k.paymentTerms || 'A combinar com o cliente'], ['Validade da proposta', p.validUntil ? fmtDate(p.validUntil) : '30 dias'],
      ['Prazo de execução', k.executionTerm || 'A combinar após o aceite da proposta'], ['Garantia', k.warranty || 'Conforme normas técnicas aplicáveis'], ...obs];
  };

  // Pecas do documento: html inteiro ou lista de linhas que pode quebrar entre paginas (open tem data-rows onde as linhas entram).
  function pieces(p, c, s) {
    const total = (p.totals && p.totals.finalValue) || 0;
    const labor = c.mao ? OC.docLabor(p) : 0;
    const out = [];
    const add = (label, html) => out.push({ label, html });
    const text = (t) => esc(t).replace(/\n/g, '<br>');
    const pricing = (title, caption) => {
      add('Itens', `<h2 class="pd-h">${esc(title)}</h2>${caption ? `<div class="pd-cap">${esc(caption)}</div>` : ''}`);
      let n = 0;
      const row = (it) => `<tr><td>${++n}</td><td>${esc(it.description)}${c.codigos && it.code ? `<small>${esc(it.code)}</small>` : ''}</td><td>${esc(qty.format(it.quantity))} ${esc(it.unit)}</td><td>${esc(brl.format(it.unitSale))}</td><td>${esc(brl.format(it.totalSale))}</td></tr>`;
      const cat = (name) => `<tr class="pg-cat"><td colspan="5">${esc(name)}</td></tr>`;
      const rows = [];
      if (c.agrupar) {
        const groups = new Map();
        p.items.forEach((it) => { const key = String(it.category || 'Outros').trim() || 'Outros'; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(it); });
        groups.forEach((list, name) => { rows.push(cat(name)); list.forEach((it) => rows.push(row(it))); });
      } else p.items.forEach((it) => rows.push(row(it)));
      if (labor > 0) { if (c.agrupar) rows.push(cat('Mão de Obra e Serviços Técnicos')); rows.push(row({ description: 'Mão de obra', unit: 'vb', quantity: 1, unitSale: labor, totalSale: labor })); }
      if (!rows.length) rows.push('<tr><td colspan="5" class="pd-muted">Nenhum item incluído nesta revisão.</td></tr>');
      out.push({ label: 'Itens', open: '<table class="pd-items"><thead><tr><th>Item</th><th>Descrição</th><th>Qtd.</th><th>Unit.</th><th>Total</th></tr></thead><tbody data-rows>', close: '</tbody></table>', rows });
      const sums = labor > 0 ? [['Total de Materiais', brl.format(OC.cents(total - labor))], ['Total de Mão de Obra', brl.format(labor)]] : [];
      add('Itens', `<div class="pd-sum">${sums.map(([l, v]) => `<div><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}<div class="pg-total"><small>Valor total da proposta</small><b>${esc(brl.format(total))}</b></div></div>`);
    };
    const conditions = (title) => add('Condições', `<h2 class="pd-h">${esc(title)}</h2><dl class="pg-terms">${OC.docTerms(p, c).map(([dt, dd]) => `<dt>${esc(dt)}</dt><dd>${text(dd)}</dd>`).join('')}</dl><p class="pd-p">Valores expressos em moeda corrente nacional (BRL).</p>`);
    const signature = (name, role) => (s.pdfShowSignature === false ? '' : `<div class="pd-sign"><i></i><b>${esc(name)}</b>${role ? `<span>${esc(role)}</span>` : ''}<span>${esc(s.company)}</span></div>`);
    const parts = p.bodyBlocks ? B.parts(p, p.bodyBlocks) : null;
    if (!parts) {
      add('Texto', `<p class="pd-p pd-lead">${text('Prezados Senhores,\nApresentamos nossa proposta técnica e comercial para fornecimento de equipamentos, materiais e execução dos serviços descritos a seguir.')}</p>`);
      add('Texto', `<h2 class="pd-h">Apresentação — ${esc(s.brand)}</h2><p class="pd-p">${esc(B.PRESENTATION)}</p>`);
      pricing('1. Composição e Precificação', '');
      conditions('2. Condições Comerciais');
    } else parts.forEach((part) => {
      if (part.kind === 'heading') add('Texto', part.sub ? `<h3 class="pd-h sub">${esc(part.text)}</h3>` : `<h2 class="pd-h">${esc(part.text)}</h2>`);
      else if (part.kind === 'paragraph') add('Texto', `<p class="pd-p">${part.lines.map(esc).join('<br>')}</p>`);
      else if (part.kind === 'list') out.push({ label: 'Texto', open: '<ul class="pd-ul" data-rows>', close: '</ul>', rows: part.items.map((it) => `<li>${esc(it)}</li>`) });
      else if (part.kind === 'planilha') {
        const cls = (i) => (part.align[i] === 'right' ? ' class="r"' : '');
        const head = part.headers.some(Boolean) ? `<thead><tr>${part.headers.map((h, i) => `<th${cls(i)}>${esc(h)}</th>`).join('')}</tr></thead>` : '';
        out.push({ label: 'Planilha', open: `<table class="pd-tab">${head}<tbody data-rows>`, close: '</tbody></table>', rows: part.rows.map((r) => `<tr>${r.map((v, i) => `<td${cls(i)}>${esc(v)}</td>`).join('')}</tr>`) });
      } else if (part.kind === 'itens') pricing(part.title, part.caption);
      else if (part.kind === 'condicoes') conditions(part.title);
      else if (part.kind === 'carta') {
        add('Carta', `<div class="pd-letter">${part.dateLine ? `<p>${esc(part.dateLine)}</p>` : ''}${part.recipient ? `<p class="pd-rec">${esc(part.recipient)}</p>` : ''}
          ${part.attention || part.department ? `<p class="pd-att"><b>At.:</b><span>${[part.attention, part.department].filter(Boolean).map(esc).join('<br>')}</span></p>` : ''}
          ${part.reference ? `<p class="pd-ref">REF.: ${esc(part.reference)}</p>` : ''}<h1>${esc(part.title)}</h1>${part.greeting ? `<p>${esc(part.greeting)}</p>` : ''}${part.intro ? `<p class="pd-p">${esc(part.intro)}</p>` : ''}</div>`);
      } else if (part.kind === 'fechamento') add('Fechamento', `${part.paragraphs.map((l) => `<p class="pd-p">${l.map(esc).join('<br>')}</p>`).join('')}${signature(part.signer || s.brand, part.role)}`);
    });
    if (!(parts && parts.some((x) => x.kind === 'fechamento'))) {
      add('Fechamento', `<p class="pd-p pd-close">Permanecemos à disposição para quaisquer esclarecimentos técnicos ou comerciais referentes a esta proposta.</p>${signature(p.responsibleName || s.brand, '')}`);
    }
    if (c.validade && p.validUntil) add('Fechamento', `<p class="pg-note">Proposta válida até ${esc(fmtDate(p.validUntil))}. Depois disso, os preços dos equipamentos podem mudar.</p>`);
    return { list: out, letter: !!(parts && parts.some((x) => x.kind === 'carta')) };
  }

  // settings: GET /settings (marca, assinatura, nome da empresa); sem rede, os padroes do documento.
  OC.pdfPages = function (p, c, settings) {
    const st = settings || {};
    const s = { brand: (st.tradeName || '').trim() || 'CONSTRUTEC', company: (st.companyName || '').trim() || 'LAC CONSTRUTEC CONSTRUTORA EIRELI', pdfShowSignature: st.pdfShowSignature };
    const watermark = c.marca === undefined ? st.pdfWatermark === true : c.marca;
    const total = (p.totals && p.totals.finalValue) || 0;
    const ref = `${p.number} • Revisão ${String(p.revision).padStart(2, '0')}`;
    const { list, letter } = pieces(p, c, s);
    const firstHead = letter ? '' : `<div class="pg-head"><b>${esc(s.brand)}</b><span>Proposta comercial · ${esc(ref)}</span></div>
      <div class="pd-id"><span><b>Cliente:</b> ${esc(p.clientName)}</span><span><b>Local / Obra:</b> ${esc(p.workName || '—')}</span><span><b>Referência:</b> ${esc(p.number)} | Rev. ${String(p.revision).padStart(2, '0')}</span></div>
      <div class="pg-title pd-center">Proposta técnica comercial</div>`;
    const runHead = letter ? `<div class="pg-head"><b>${esc(s.brand)}</b><span>${esc(ref)}</span></div>` : '';
    const meas = document.createElement('div');
    meas.className = 'pd-meas';
    meas.innerHTML = '<div class="pg"><div class="pd-in"></div></div>';
    document.body.appendChild(meas);
    const box = OC.$('.pd-in', meas);
    const pages = [];
    let count = 0, label = '';
    // Rotulo da pagina com a regra do computador (proposalPdfFlow): Itens se tem a planilha, senao Condicoes, senao Texto.
    const seen = new Set();
    const pageLabel = () => (seen.has('Itens') ? 'Itens' : seen.has('Condições') ? 'Condições' : 'Texto');
    const fits = () => box.scrollHeight <= LIMIT;
    const start = () => { box.innerHTML = pages.length ? runHead : (firstHead || runHead); count = 0; label = ''; seen.clear(); };
    const commit = () => { pages.push({ label: pageLabel(), html: box.innerHTML }); start(); };
    const place = (html, lbl) => {
      box.insertAdjacentHTML('beforeend', html);
      if (!fits() && count > 0) { box.lastElementChild.remove(); commit(); box.insertAdjacentHTML('beforeend', html); }
      count += 1; if (!label) label = lbl; seen.add(lbl);
    };
    try {
      start();
      list.forEach((piece) => {
        if (!piece.rows) { place(`<div class="pd-piece">${piece.html}</div>`, piece.label); return; }
        place(`${piece.open}${piece.close}`, piece.label);
        let target = OC.$$('[data-rows]', box).pop(), inTarget = 0;
        piece.rows.forEach((row) => {
          target.insertAdjacentHTML('beforeend', row);
          if (!fits() && (inTarget > 0 || count > 1)) {
            target.lastElementChild.remove();
            if (!inTarget) target.closest('table, ul').remove();
            target.removeAttribute('data-rows');
            commit();
            place(`${piece.open}${piece.close}`, piece.label);
            target = OC.$$('[data-rows]', box).pop(); inTarget = 0;
            target.insertAdjacentHTML('beforeend', row);
          }
          inTarget += 1;
        });
        target.removeAttribute('data-rows');
      });
      if (count > 0 || !pages.length) commit();
    } finally { meas.remove(); }
    const cover = c.capa ? [{ label: 'Capa', html: `<div class="pg-cover"><small>Proposta comercial</small><b class="pg-h1">${esc(p.workName || p.clientName || '')}</b><span>${esc(p.clientName || '')}</span>
      <dl><dt>Proposta</dt><dd>${esc(`${p.number} · REV ${String(p.revision || 0).padStart(2, '0')}`)}</dd>${c.validade && p.validUntil ? `<dt>Válida até</dt><dd>${esc(fmtDate(p.validUntil))}</dd>` : ''}
      ${p.responsibleName ? `<dt>Responsável</dt><dd>${esc(p.responsibleName)}</dd>` : ''}<dt>Valor total</dt><dd><b>${esc(brl.format(total))}</b></dd></dl></div>` }] : [];
    const all = [...cover, ...pages];
    return all.map((pg, i) => ({ label: pg.label, html: `<div class="pg${watermark ? ' wm' : ''}">${pg.html}<div class="pg-foot"><span>${esc(s.company)}</span><span>Pág. ${i + 1} / ${all.length}</span></div></div>` }));
  };
})(window.OC = window.OC || {});
