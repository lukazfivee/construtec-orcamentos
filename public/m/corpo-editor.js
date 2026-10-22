// Editor dos blocos do corpo no celular (mesmas regras de ProposalBodyBuilder.tsx, ProposalBodyCard.tsx e ProposalBodyFields.tsx):
// lista de cartoes na ordem do documento, folha para editar cada bloco, subir/descer, duplicar, remover e inserir bloco ou modelo de
// texto. Usado pela proposta (prop-corpo.js) e pelo corpo padrao das Configuracoes (cfg-corpo.js); quem chama grava.
(function (OC) {
  const { esc, icon } = OC;
  const B = OC.body;
  const LETTER_ROWS = [
    ['place', 'Local', 'Ex.: Salvador / BA'], ['date', 'Data', '', 'date'], ['recipient', 'Empresa destinatária', '{{cliente}}'],
    ['attention', 'A/C (nome e tratamento)', 'Ex.: Sr. Fulano de Tal'], ['department', 'Setor', 'Ex.: Engenharia'],
    ['reference', 'REF. (assunto da proposta)', 'Proposta nº {{numero}} - {{escopo}} - {{obra}}', 'long'], ['greeting', 'Saudação', 'Prezados Senhores:'],
    ['intro', 'Frase de abertura', 'Atendendo à vossa solicitação, segue nossa proposta...', 'long'],
  ];
  const SIGN_ROWS = [['signer', 'Nome na assinatura', '{{responsavel}}'], ['role', 'Cargo ou setor (opcional)', 'Ex.: Engenharia']];
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const tableSize = (t) => { const x = t || B.emptyTable(); return `${plural(x.rows.length, 'linha', 'linhas')} × ${plural(x.headers.length, 'coluna', 'colunas')}`; };

  function preview(b, o) {
    const off = !b.enabled;
    if (b.type === 'itens') return [b.title || B.ITEMS_TITLE, o.itemsNote];
    if (b.type === 'condicoes') return [b.title || B.COND_TITLE, off ? 'Desligado: validade, prazo, pagamento e garantia não saem no documento.' : o.condNote];
    if (b.type === 'carta') return [b.title || B.LETTER_TITLE, [b.fields && b.fields.recipient, b.fields && b.fields.reference].filter(Boolean).join(' · ')];
    if (b.type === 'fechamento') return ['Fechamento', `${(b.text || '').split('\n')[0]}${b.fields && b.fields.signer ? ` · assinatura de ${b.fields.signer}` : ''}`];
    if (b.type === 'planilha') return [b.title || 'Planilha sem título', tableSize(b.table)];
    if (b.type === 'titulo') return [b.title || 'Título sem texto', b.sub ? 'Subtítulo' : ''];
    return [b.title || '', b.text || 'Sem texto ainda'];
  }

  // host: elemento onde a lista e desenhada. o: { get, set(blocks), editable, place, templates(), itemsNote, condNote, onConditions, saveTemplate(input) }.
  OC.bodyEditor = function (host, o) {
    const paint = () => {
      const blocks = o.get();
      const full = !B.canAdd(blocks);
      const addRow = (at) => (o.editable ? `<button class="bk-add" type="button" data-add="${at}"${full ? ' disabled' : ''}>${icon('plus', 16)}${at === 0 ? 'Adicionar no início' : 'Adicionar aqui'}</button>` : '');
      host.innerHTML = `${addRow(0)}${blocks.map((b, i) => {
        const [title, sub] = preview(b, o);
        return `<article class="card bk${b.enabled ? '' : ' is-off'}${b.type === 'itens' || b.type === 'condicoes' ? ' is-special' : ''}" data-i="${i}" aria-label="${esc(B.LABELS[b.type])} ${i + 1} de ${blocks.length}">
          <div class="bk-head"><span class="bk-kind">${esc(B.LABELS[b.type])}<small>${i + 1}</small></span>${b.type === 'itens' || b.type === 'condicoes' ? '<span class="bk-auto">Gerado pelo sistema</span>' : ''}
            ${B.canDisable(b) ? `<button class="bk-sw" type="button" role="switch" aria-checked="${b.enabled}" data-sw${o.editable ? '' : ' disabled'}><span>${b.enabled ? 'Ligado' : 'Desligado'}</span><i></i></button>` : ''}</div>
          <button class="bk-body" type="button" data-edit>${title ? `<b class="${b.sub ? 'is-sub' : ''}">${esc(title)}</b>` : ''}${sub ? `<span>${esc(sub)}</span>` : ''}</button>
          ${o.editable ? `<div class="bk-tools">
            <button class="qbtn" type="button" data-mv="-1" aria-label="Subir bloco"${i === 0 ? ' disabled' : ''}>${icon('caret-up', 18)}</button>
            <button class="qbtn" type="button" data-mv="1" aria-label="Descer bloco"${i === blocks.length - 1 ? ' disabled' : ''}>${icon('caret-down', 18)}</button>
            ${B.canDuplicate(b) ? `<button class="qbtn" type="button" data-dup aria-label="Duplicar bloco"${full ? ' disabled' : ''}>${icon('copy', 18)}</button>` : ''}
            ${B.canRemove(b) ? `<button class="qbtn" type="button" data-del aria-label="Remover bloco">${icon('trash', 18)}</button>` : ''}
            <span class="grow"></span><button class="qbtn" type="button" data-edit aria-label="Editar bloco">${icon('pencil-simple', 18)}</button></div>` : ''}
        </article>${addRow(i + 1)}`;
      }).join('')}${full ? `<p class="hint">O corpo chegou ao limite de ${B.LIMITS.blocks} blocos.</p>` : ''}`;
      OC.$$('[data-add]', host).forEach((btn) => btn.addEventListener('click', () => addSheet(Number(btn.dataset.add))));
      OC.$$('[data-i]', host).forEach((card) => {
        const i = Number(card.dataset.i);
        const on = (sel, fn) => OC.$$(sel, card).forEach((el) => el.addEventListener('click', fn));
        on('[data-edit]', () => blockSheet(i));
        if (!o.editable) return;
        on('[data-sw]', () => o.set(B.update(o.get(), i, { enabled: !o.get()[i].enabled })));
        on('[data-mv]', (event) => o.set(B.move(o.get(), i, i + Number(event.currentTarget.dataset.mv))));
        on('[data-dup]', () => o.set(B.duplicate(o.get(), i)));
        on('[data-del]', () => OC.confirm('Remover bloco', `O bloco "${B.LABELS[o.get()[i].type]}" sai do corpo.`, 'Remover', async () => { o.set(B.remove(o.get(), i)); OC.toast('Bloco removido', 'trash'); }));
      });
    };

    // Inserir bloco ou modelo de texto na posicao escolhida; carta e fechamento so quando ainda nao existem.
    function addSheet(at) {
      const blocks = o.get();
      const types = [['paragrafo', 'Parágrafo', 'Texto corrido; linha em branco separa parágrafos'], ['titulo', 'Título de seção', 'Abre uma seção do documento'],
        ['lista', 'Lista', 'Um tópico por linha'], ['planilha', 'Planilha própria', 'Colunas e linhas digitadas, sem cálculo'],
        ...(B.has(blocks, 'carta') ? [] : [['carta', 'Carta de abertura', 'Local, data, destinatário e referência']]),
        ...(B.has(blocks, 'fechamento') ? [] : [['fechamento', 'Fechamento e assinatura', 'Parágrafo final e quem assina']])];
      const templates = o.templates();
      const s = OC.sheet(`${OC.sheetHead('Adicionar bloco', 'plus')}<div class="opts" style="margin-top:12px">${types.map(([t, l, d]) => `<button class="opt" type="button" data-t="${t}"><span><b>${l}</b><small>${d}</small></span>${icon('plus', 18)}</button>`).join('')}</div>
        ${templates.length ? `<p class="sheet-sec">Modelos de texto</p><div class="rows">${templates.map((t) => `<button class="prow" type="button" data-tpl="${esc(t.id)}"><span class="grow"><b>${esc(t.name)}</b><small>${t.type === 'lista' ? 'Lista' : 'Parágrafo'}</small></span>${icon('plus', 18)}</button>`).join('')}</div>` : ''}`);
      s.el.firstElementChild.classList.add('sheet-tall');
      const put = (block) => { s.close(); o.set(B.insert(o.get(), at, block)); blockSheet(at); };
      OC.$$('[data-t]', s.el).forEach((btn) => btn.addEventListener('click', () => put(B.empty(btn.dataset.t, undefined, o.place()))));
      OC.$$('[data-tpl]', s.el).forEach((btn) => btn.addEventListener('click', () => put(B.fromTemplate(templates.find((t) => t.id === btn.dataset.tpl)))));
    }

    function blockSheet(i) {
      const block = o.get()[i];
      if (!block) return;
      const d = JSON.parse(JSON.stringify(block));
      const ro = o.editable ? '' : ' disabled';
      const isText = ['paragrafo', 'lista', 'fechamento'].includes(d.type);
      const titleLabel = d.type === 'titulo' ? 'Texto do título' : d.type === 'carta' ? 'Título do documento' : 'Título da seção (opcional)';
      const titlePh = d.type === 'itens' ? B.ITEMS_TITLE : d.type === 'condicoes' ? B.COND_TITLE : d.type === 'carta' ? B.LETTER_TITLE : 'Ex.: Escopo dos serviços';
      const field = (key, label, ph, kind) => `<label class="field"><span>${esc(label)}</span>${kind === 'long'
        ? `<textarea data-f="${key}" rows="2" maxlength="${B.LIMITS.field}" placeholder="${esc(ph)}"${ro}>${esc((d.fields || {})[key] || '')}</textarea>`
        : `<input data-f="${key}" type="${kind === 'date' ? 'date' : 'text'}" maxlength="${B.LIMITS.field}" placeholder="${esc(ph)}" value="${esc((d.fields || {})[key] || '')}" autocomplete="off"${ro}>`}</label>`;
      const sw = (key, label) => `<button class="opt" type="button" data-bool="${key}" aria-pressed="${!!d[key]}"${ro}><span><b>${esc(label)}</b></span><span class="switch"></span></button>`;
      const s = OC.sheet(`${OC.sheetHead(B.LABELS[d.type], 'pencil-simple')}<div class="bk-form">
        <label class="field"><span>${titleLabel}</span><input data-k="title" type="text" maxlength="${B.LIMITS.title}" placeholder="${esc(titlePh)}" value="${esc(d.title || '')}" autocomplete="off"${ro}></label>
        ${B.canSub(d) ? sw('sub', 'Subtítulo (nível abaixo do título da seção anterior)') : ''}
        ${d.type === 'itens' ? `<label class="field"><span>Título da planilha (opcional)</span><input data-k="text" type="text" maxlength="${B.LIMITS.caption}" placeholder="Ex.: Planilha de mão de obra - {{obra}}" value="${esc(d.text || '')}" autocomplete="off"${ro}></label><p class="hint">${esc(o.itemsNote)}</p>` : ''}
        ${d.type === 'carta' ? `${LETTER_ROWS.map((r) => field(...r)).join('')}${sw('numbered', 'Numerar os títulos das seções (1., 2. ... e 1.1. nos subtítulos)')}` : ''}
        ${d.type === 'fechamento' ? SIGN_ROWS.map((r) => field(...r)).join('') : ''}
        ${d.type === 'carta' || d.type === 'fechamento' ? '<p class="hint">Os campos aceitam variáveis como {{cliente}}, {{obra}}, {{numero}} e {{escopo}}. Campo em branco não sai no documento.</p>' : ''}
        ${d.type === 'planilha' ? `<div class="kv"><span>Planilha</span><b data-tsize>${esc(tableSize(d.table))}</b></div><button class="btn2" type="button" data-grid>${icon('pencil-simple', 18)}${o.editable ? 'Editar planilha' : 'Ver planilha'}</button><p class="hint">Texto livre, sem cálculo: a planilha não entra no valor da proposta.</p>` : ''}
        ${d.type === 'condicoes' ? `${sw('enabled', 'Sai no documento')}<p class="hint">${esc(o.condNote)}</p>${o.onConditions && o.editable ? `<button class="btn2" type="button" data-cond>${icon('pencil-simple', 18)}Editar condições comerciais</button>` : ''}` : ''}
        ${isText ? `<label class="field"><span>${d.type === 'lista' ? 'Itens da lista (um por linha, pode começar com -)' : d.type === 'fechamento' ? 'Texto de fechamento' : 'Texto'}</span>
          <textarea data-k="text" rows="7" maxlength="${B.LIMITS.text}" placeholder="${d.type === 'lista' ? '- Primeiro item\n- Segundo item' : 'Escreva o parágrafo. Linha em branco separa parágrafos.'}"${ro}>${esc(d.text || '')}</textarea></label>
          <div class="bk-foot"><small data-count></small>${o.editable ? `<select class="bk-var" data-var aria-label="Inserir variável"><option value="">Inserir variável</option>${B.VARIABLES.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select>` : ''}</div>
          ${o.editable && o.saveTemplate && d.type !== 'fechamento' ? `<button class="btn2" type="button" data-tplsave>${icon('copy', 18)}Salvar como modelo de texto</button>` : ''}` : ''}
        </div>
        <div class="sheet-actions${o.editable ? '' : ' col'}"><button class="btn2" type="button" data-no>${o.editable ? 'Cancelar' : 'Fechar'}</button>${o.editable ? '<button class="btn" type="button" data-yes>Salvar</button>' : ''}</div>`);
      s.el.firstElementChild.classList.add('sheet-tall');
      const text = OC.$('textarea[data-k="text"]', s.el);
      const count = () => { const c = OC.$('[data-count]', s.el); if (c && text) c.textContent = `${text.value.length.toLocaleString('pt-BR')} / ${B.LIMITS.text.toLocaleString('pt-BR')} caracteres`; };
      if (text) { text.addEventListener('input', count); count(); }
      OC.$$('[data-bool]', s.el).forEach((btn) => btn.addEventListener('click', () => { d[btn.dataset.bool] = !d[btn.dataset.bool]; btn.setAttribute('aria-pressed', String(!!d[btn.dataset.bool])); }));
      const read = () => {
        OC.$$('[data-k]', s.el).forEach((el) => { d[el.dataset.k] = el.value; });
        if (OC.$('[data-f]', s.el)) d.fields = { ...(d.fields || {}), ...Object.fromEntries(OC.$$('[data-f]', s.el).map((el) => [el.dataset.f, el.value])) };
        return d;
      };
      const vsel = OC.$('[data-var]', s.el);
      if (vsel) vsel.addEventListener('change', () => {
        if (!vsel.value || !text) return;
        const token = `{{${vsel.value}}}`, a = text.selectionStart ?? text.value.length, z = text.selectionEnd ?? text.value.length;
        text.value = `${text.value.slice(0, a)}${token}${text.value.slice(z)}`.slice(0, B.LIMITS.text);
        vsel.value = '';
        text.focus(); text.setSelectionRange(a + token.length, a + token.length); count();
      });
      const grid = OC.$('[data-grid]', s.el);
      if (grid) grid.addEventListener('click', () => OC.bodyGridSheet(d.table || B.emptyTable(), o.editable, (t) => { d.table = t; OC.$('[data-tsize]', s.el).textContent = tableSize(t); }));
      const cond = OC.$('[data-cond]', s.el);
      if (cond) cond.addEventListener('click', () => o.onConditions());
      const tpl = OC.$('[data-tplsave]', s.el);
      if (tpl) tpl.addEventListener('click', () => {
        if (!(text.value || '').trim()) { OC.toast('Escreva o texto antes de salvar como modelo.', 'warning-circle'); return; }
        OC.ask('Salvar como modelo de texto', 'Nome do modelo', 'Ex.: Exclusões padrão', async (name) => {
          const input = B.toTemplate(read(), name);
          if (!input) throw new Error('Informe um nome e um texto para o modelo.');
          await o.saveTemplate(input);
          OC.toast('Modelo salvo na biblioteca da empresa.');
        });
      });
      OC.$('[data-no]', s.el).addEventListener('click', s.close);
      const yes = OC.$('[data-yes]', s.el);
      if (yes) yes.addEventListener('click', () => {
        const next = read();
        const idx = o.get().findIndex((b) => b.id === next.id);
        s.close();
        if (idx >= 0 && JSON.stringify(o.get()[idx]) !== JSON.stringify(next)) o.set(B.update(o.get(), idx, next));
      });
    }

    return { paint };
  };
})(window.OC = window.OC || {});
