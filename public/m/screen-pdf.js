// PDF da proposta no celular (prototipo: Rodada 21, telas 21a-21j e 21p-21r).
// A pre-visualizacao e desenhada aqui so com precos de venda; o arquivo vem do servidor
// (GET /proposals/:id/document), que tambem nunca leva custo, BDI ou margem.
(function (OC) {
  const { esc, icon } = OC;
  const ROWS_PER_PAGE = 14;
  const THUMB_SCALE = 74 / 396;
  // Escolhas por proposta: sobrevivem ao erro de rede e ao "Tentar de novo".
  const saved = {};
  const choicesFor = (id) => (saved[id] = saved[id] || { modelo: 'completo', capa: true, condicoes: true, validade: true });
  const query = (c) => `modelo=${c.modelo}&capa=${c.capa ? 1 : 0}&condicoes=${c.condicoes ? 1 : 0}&validade=${c.validade ? 1 : 0}`;

  // Paginas da pre-visualizacao: capa, itens (agrupados por sistema) e condicoes.
  function pages(p, c) {
    const total = (p.totals && p.totals.finalValue) || 0;
    const head = (title) => `<div class="pg-head"><b>CONSTRUTEC</b><span>${esc(p.number)} · ${esc(OC.rev(p.revision))}</span></div><div class="pg-title">${esc(title)}</div>`;
    const foot = (n) => `<div class="pg-foot"><span>Construtec Engenharia · Sistemas especiais</span><span>Página ${n}</span></div>`;
    const out = [];
    const labor = OC.laborSale(p);
    const systems = [...new Set(p.items.map((it) => it.category || 'Itens'))];
    if (labor > 0) systems.push('Mão de obra e serviços técnicos');
    if (c.capa) {
      out.push({ label: 'Capa', html: `<div class="pg-cover"><small>Proposta comercial</small><b class="pg-h1">${esc(p.workName || p.clientName)}</b><span>${esc(p.clientName)}</span>
        <dl><dt>Proposta</dt><dd>${esc(p.number)} · ${esc(OC.rev(p.revision))}</dd>
        ${c.validade && p.validUntil ? `<dt>Válida até</dt><dd>${esc(OC.dateFull(p.validUntil))}</dd>` : ''}
        <dt>Responsável</dt><dd>${esc(p.responsibleName || '')}</dd><dt>Sistemas</dt><dd>${esc(systems.join(', '))}</dd></dl>
        <div class="pg-total"><small>Valor total</small><b>${esc(OC.money(total))}</b></div></div>` });
    }
    const rows = [];
    const laborLine = { description: 'Mão de obra', quantity: 1, unit: 'vb', unitSale: labor, totalSale: labor };
    if (c.modelo === 'completo') {
      // Planilha item a item, na ordem da proposta, sem separar por sistema.
      [...p.items, ...(labor > 0 ? [laborLine] : [])].forEach((it) => rows.push({ it }));
    } else {
      systems.forEach((s) => {
        const list = labor > 0 && s === systems[systems.length - 1] ? [laborLine] : p.items.filter((it) => (it.category || 'Itens') === s);
        rows.push({ cat: s, sum: list.reduce((a, it) => a + (it.totalSale || 0), 0) });
      });
    }
    for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) {
      const chunk = rows.slice(i, i + ROWS_PER_PAGE);
      const last = i + ROWS_PER_PAGE >= rows.length;
      out.push({ label: 'Itens', html: `${head(c.modelo === 'completo' ? 'Itens da proposta' : 'Resumo por sistema')}
        <table class="pg-tab"><tbody>${chunk.map((r) => (r.cat
          ? `<tr class="pg-cat"><td colspan="${c.modelo === 'completo' ? 3 : 1}">${esc(r.cat)}</td><td>${esc(OC.money(r.sum))}</td></tr>`
          : `<tr><td>${esc(r.it.description)}</td><td>${esc(OC.num(r.it.quantity))} ${esc(r.it.unit)}</td><td>${esc(OC.money(r.it.unitSale))}</td><td>${esc(OC.money(r.it.totalSale))}</td></tr>`)).join('')}</tbody></table>
        ${last ? `<div class="pg-total"><small>Valor total da proposta</small><b>${esc(OC.money(total))}</b></div>
          ${c.validade && p.validUntil ? `<p class="pg-note">Proposta válida até ${esc(OC.dateFull(p.validUntil))}.</p>` : ''}` : ''}` });
    }
    // Condicoes reais da proposta, com os mesmos textos de reserva do documento do servidor (observacoes so no modelo completo).
    if (c.condicoes) {
      out.push({ label: 'Condições', html: `${head('Condições comerciais')}
        <dl class="pg-terms">${OC.conditionTerms(p.scope, c.modelo === 'completo').map(([dt, dd]) => `<dt>${esc(dt)}</dt><dd>${esc(dd)}</dd>`).join('')}</dl>
        ${c.validade && p.validUntil ? `<p class="pg-note">Validade: esta proposta vale até ${esc(OC.dateFull(p.validUntil))}. Depois disso, os preços dos equipamentos podem mudar.</p>` : ''}
        <p class="pg-sign">${esc(p.responsibleName || '')}<br>Construtec Engenharia</p>` });
    }
    return out.map((pg, i) => ({ ...pg, html: `<div class="pg">${pg.html}${foot(i + 1)}</div>` }));
  }

  // Nome do arquivo: Proposta_Construtec_CLIENTE_Obra (mesma regra do computador; REV so da segunda revisao em diante).
  function fileBase(p) {
    const seg = (v) => String(v || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+[-–—]+\s+/g, ' ').trim().replace(/\s+/g, '_').slice(0, 70).replace(/^[._]+|[._]+$/g, '');
    const client = seg(p.clientName), name = seg(p.workName), work = name.toLowerCase() === client.toLowerCase() ? '' : name;
    const rev = p.revision > 0 ? 'REV_' + String(p.revision).padStart(2, '0') : '';
    return ['Proposta', 'Construtec', client, work, client || work ? '' : seg(p.number), rev].filter(Boolean).join('_');
  }
  // Arquivo do cliente: HTML do PDF montado no servidor (com a sessao).
  async function fetchDocument(p, c) {
    let response;
    try {
      response = await fetch(`/api/proposals/${encodeURIComponent(p.id)}/document?${query(c)}`, { headers: { 'X-Construtec-Session': OC.session.token() }, cache: 'no-store' });
    } catch { throw new OC.ApiError(0, 'Sem internet. Confira a conexão e tente de novo.'); }
    if (!response.ok) throw new OC.ApiError(response.status, 'Não foi possível montar o PDF agora.');
    const title = fileBase(p);
    return { html: await response.text(), title, name: `${title}.html` };
  }
  // Abre a impressao do aparelho: "Salvar como PDF" gera o arquivo.
  // O nome sugerido pelo aparelho vem do titulo da pagina: o do app e o do documento ficam com o nome do arquivo durante a impressao.
  function printDocument(doc) {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0';
    document.body.appendChild(frame);
    frame.srcdoc = doc.html;
    frame.onload = () => {
      const appTitle = document.title;
      document.title = doc.title;
      const restore = () => { document.title = appTitle; };
      try { frame.contentWindow.addEventListener('afterprint', restore); frame.contentWindow.focus(); frame.contentWindow.print(); } finally { setTimeout(() => { restore(); frame.remove(); }, 60000); }
    };
  }
  function download(doc) {
    const url = URL.createObjectURL(new Blob([doc.html], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url; a.download = doc.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  // Compartilha o arquivo pelo menu do aparelho; sem suporte, baixa.
  async function shareFile(doc, text) {
    const file = new File([doc.html], doc.name, { type: 'text/html' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: doc.name, text }); return true; } catch (error) { if (error && error.name === 'AbortError') return false; }
    }
    download(doc);
    OC.toast('Arquivo baixado. Anexe na conversa com o cliente.');
    return true;
  }
  // Word (.docx) montado no servidor com o gerador do computador: compartilha pelo aparelho ou baixa.
  async function shareWord(p, c) {
    let response;
    try {
      response = await fetch(`/api/proposals/${encodeURIComponent(p.id)}/document.docx?${query(c)}`, { headers: { 'X-Construtec-Session': OC.session.token() }, cache: 'no-store' });
    } catch { throw new OC.ApiError(0, 'Sem internet. Confira a conexão e tente de novo.'); }
    if (!response.ok) throw new OC.ApiError(response.status, 'Não foi possível montar o Word agora.');
    const name = `${fileBase(p)}.docx`;
    const file = new File([await response.blob()], name, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return; } catch (error) { if (error && error.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    OC.toast('Word baixado.');
  }
  const message = (p) => `Olá! Segue a proposta ${p.number} (${OC.rev(p.revision)}) da Construtec para ${p.workName || p.clientName}, no valor de ${OC.money((p.totals && p.totals.finalValue) || 0)}${p.validUntil ? `, válida até ${OC.dateFull(p.validUntil)}` : ''}.`;

  function zoomView(list, start) {
    let i = start, z = 100;
    const s = OC.sheet(`${OC.sheetHead('Página ampliada', 'eye')}
      <div class="seg zoom-seg">${[100, 150, 200].map((v) => `<button type="button" data-z="${v}">${v}%</button>`).join('')}</div>
      <div class="zoom-box"><div class="zoom-page"></div></div>
      <div class="sheet-actions"><button class="btn2" type="button" data-prev>${icon('caret-left', 18)}Anterior</button><button class="btn2" type="button" data-next>Próxima${icon('caret-right', 18)}</button></div>`);
    s.el.firstElementChild.classList.add('sheet-tall');
    const paint = () => {
      const box = OC.$('.zoom-box', s.el), wrap = OC.$('.zoom-page', s.el);
      wrap.innerHTML = list[i].html;
      const page = wrap.firstElementChild;
      // 100% = a pagina inteira na largura da folha; 150% e 200% ampliam a partir dai.
      const scale = Math.max(0.3, (box.clientWidth - 16) / 396) * (z / 100);
      page.style.transform = `scale(${scale})`;
      wrap.style.width = `${Math.round(396 * scale)}px`;
      wrap.style.height = `${Math.round(page.offsetHeight * scale)}px`;
      OC.$('.sheet-head b', s.el).lastChild.textContent = `Página ${i + 1} de ${list.length} · ${list[i].label}`;
      OC.$$('[data-z]', s.el).forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.z) === z)));
      OC.$('[data-prev]', s.el).disabled = i === 0;
      OC.$('[data-next]', s.el).disabled = i === list.length - 1;
    };
    OC.$$('[data-z]', s.el).forEach((b) => b.addEventListener('click', () => { z = Number(b.dataset.z); paint(); }));
    OC.$('[data-prev]', s.el).addEventListener('click', () => { i -= 1; paint(); });
    OC.$('[data-next]', s.el).addEventListener('click', () => { i += 1; paint(); });
    paint();
  }

  function shareSheet(p, c) {
    const s = OC.sheet(`${OC.sheetHead('Compartilhar', 'arrow-square-out')}
      <div class="share-list">
        <button class="opt" type="button" data-sh="whats">${icon('paper-plane-tilt', 20)}<span class="grow"><b>WhatsApp</b><small>Mensagem pronta com o arquivo</small></span></button>
        <button class="opt" type="button" data-sh="mail">${icon('envelope-simple', 20)}<span class="grow"><b>E-mail</b><small>Abre o e-mail com a mensagem</small></span></button>
        <button class="opt" type="button" data-sh="file">${icon('arrow-square-out', 20)}<span class="grow"><b>Outros apps</b><small>Menu de compartilhar do aparelho</small></span></button>
        <button class="opt" type="button" data-sh="print">${icon('file-text', 20)}<span class="grow"><b>Salvar como PDF</b><small>Pela impressão do aparelho</small></span></button>
        <button class="opt" type="button" data-sh="word">${icon('download-simple', 20)}<span class="grow"><b>Word (.docx)</b><small>O mesmo documento, para editar no Word</small></span></button>
      </div>
      <p class="sheet-text">Compartilhar não muda a situação da proposta.</p>`);
    OC.$$('[data-sh]', s.el).forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        const kind = b.dataset.sh;
        if (kind === 'whats') {
          const doc = await fetchDocument(p, c);
          if (!(navigator.canShare && navigator.canShare({ files: [new File([doc.html], doc.name, { type: 'text/html' })] }))) {
            window.open(`https://wa.me/?text=${encodeURIComponent(message(p))}`, '_blank', 'noopener');
            download(doc);
          } else await shareFile(doc, message(p));
        } else if (kind === 'mail') {
          location.href = `mailto:?subject=${encodeURIComponent(`Proposta ${p.number} · Construtec`)}&body=${encodeURIComponent(`${message(p)}\n\nO arquivo da proposta segue em anexo.`)}`;
        } else if (kind === 'file') {
          await shareFile(await fetchDocument(p, c), message(p));
        } else if (kind === 'word') {
          await shareWord(p, c);
        } else {
          printDocument(await fetchDocument(p, c));
        }
        s.close();
      } catch (error) { OC.toast(error.message, 'warning-circle'); b.disabled = false; }
    }));
  }

  function sendSheet(p, c, done) {
    const s = OC.sheet(`${OC.sheetHead('Enviar ao cliente', 'paper-plane-tilt')}
      <div class="kv"><span>Cliente</span><b>${esc(p.clientName)}</b></div>
      <label class="field" style="margin-top:12px"><span>Mensagem</span><textarea rows="4" data-msg>${esc(message(p))}</textarea></label>
      <div class="card attach">${icon('file-text', 20)}<span class="grow"><b>${esc(p.number)}-${esc(OC.rev(p.revision).replace(' ', '-'))}</b><small>Proposta ${c.modelo === 'completo' ? 'completa' : 'resumida'} · só preços de venda</small></span></div>
      <p class="sheet-text">A proposta passa a Enviada depois que você compartilhar o arquivo.</p>
      <div class="sheet-actions"><button class="btn2" type="button" data-no>Cancelar</button><button class="btn" type="button" data-yes>${icon('paper-plane-tilt', 18)}Enviar</button></div>`);
    OC.$('[data-no]', s.el).addEventListener('click', s.close);
    OC.$('[data-yes]', s.el).addEventListener('click', async (event) => {
      const b = event.currentTarget; b.disabled = true;
      try {
        const doc = await fetchDocument(p, c);
        if (!(await shareFile(doc, OC.$('[data-msg]', s.el).value))) { b.disabled = false; return; }
        await OC.api(`/proposals/${p.id}/status`, { method: 'PATCH', body: { status: 'sent' } });
        s.close();
        OC.toast('Proposta marcada como enviada');
        done();
      } catch (error) { OC.toast(error.message, 'warning-circle'); b.disabled = false; }
    });
  }

  const thumbSkeleton = () => '<span class="pg-skel"><i></i><i></i></span>'.repeat(3);
  const skeleton = () => `<div class="pdf-thumbs">${thumbSkeleton()}</div>
    <div class="skeleton" style="height:120px"></div><div class="skeleton" style="height:160px"></div>
    <div class="actions"><button class="btn2" type="button" disabled>Compartilhar</button><button class="btn" type="button" disabled>Baixar PDF</button></div>`;

  OC.screens.pdf = async function (params) {
    const c = choicesFor(params.id);
    const el = OC.render(`${OC.header('PDF da proposta', { back: true })}<div class="prop-tags"><span class="prop-work" id="pdf-sub">Gerando a pré-visualização do PDF…</span></div><div id="pdf-body" class="p-body">${skeleton()}</div>`, true, params);
    const body = OC.$('#pdf-body', el);
    const nav = OC.nav;
    let p;
    try {
      p = (await OC.api(`/proposals/${encodeURIComponent(params.id)}`)).proposal;
    } catch (error) {
      if (nav !== OC.nav) return;
      if (error.status === 401) return;
      OC.$('#pdf-sub', el).textContent = '';
      body.innerHTML = `<div class="empty">${icon(error.status === 0 ? 'wifi-slash' : 'warning-circle', 28)}<b class="empty-t">Não deu para gerar o PDF</b>
        <span>${error.status === 0 ? 'O PDF é montado no servidor e o celular está sem internet. Suas escolhas de modelo e capa ficam guardadas.' : esc(error.message)}</span>
        <button class="btn" type="button" data-retry style="padding:0 18px">Tentar de novo</button><button class="btn2" type="button" data-back style="padding:0 18px">Voltar à proposta</button></div>`;
      OC.$('[data-retry]', body).addEventListener('click', () => OC.go('pdf', params, { back: true }));
      return;
    }
    if (nav !== OC.nav) return;
    history.replaceState(null, '', `#pdf=${encodeURIComponent(p.id)}`);
    OC.$('#pdf-sub', el).textContent = `${p.number} · ${OC.rev(p.revision)} · ${p.workName || p.clientName}`;
    if (!p.items.length && !OC.laborSale(p)) {
      const can = OC.propEditable(p);
      body.innerHTML = `<div class="empty">${icon('file-text', 28)}<b class="empty-t">Sem itens para o PDF</b>
        <span>${can ? 'Adicione os itens da proposta e o PDF fica pronto para o cliente.' : 'Esta revisão não tem itens.'}</span>
        ${can ? `<button class="btn" type="button" data-add style="padding:0 18px">${icon('plus', 18)}Adicionar itens</button>` : ''}
        <button class="btn2" type="button" data-back style="padding:0 18px">Voltar à proposta</button></div>`;
      const add = OC.$('[data-add]', body);
      if (add) add.addEventListener('click', () => OC.leave('prop', { id: p.id, tab: 'itens' }));
      return;
    }

    const cost = OC.can('p10');
    const canSend = OC.can('p11') && OC.canEdit() && p.isLatest;
    const sendable = p.status === 'review';
    const t = p.totals || {};
    const opt = (key, val, title, sub) => `<button class="opt" type="button" data-opt="${key}" data-val="${val}"><span class="grow"><b>${title}</b><small>${sub}</small></span><span class="radio"></span></button>`;
    const sw = (key, title, sub, off) => `<button class="opt" type="button" data-sw="${key}"${off ? ' disabled' : ''}><span class="grow"><b>${title}</b><small>${sub}</small></span><span class="switch"></span></button>`;
    let sendBlock;
    if (!canSend) sendBlock = `<p class="hint lock">${icon('lock-simple', 15)}<span>${OC.can('p11') ? (p.isLatest ? 'Seu acesso é só de consulta: baixe ou compartilhe o PDF.' : 'Só a revisão atual pode ser enviada.') : 'Seu papel não permite enviar a proposta ao cliente. Baixe ou compartilhe o PDF; quem envia marca como Enviada.'}</span></p>`;
    else if (!sendable) sendBlock = `<p class="hint">${p.status === 'draft' ? 'Envie para revisão interna antes de mandar ao cliente.' : 'Compartilhar não muda a situação da proposta.'}</p>`;
    else sendBlock = '';

    body.innerHTML = `<div class="sec-row"><span class="label">Pré-visualização</span><span class="hint right" id="pdf-pages"></span></div>
      <div class="pdf-thumbs" id="pdf-thumbs"></div>
      <p class="hint busy-row" id="pdf-busy" role="status" hidden>${icon('circle-notch', 16)}Atualizando a pré-visualização…</p>
      <span class="label">Modelo</span>
      <div class="opt-list">${opt('modelo', 'completo', 'Completo', 'Cada item com quantidade e preço')}${opt('modelo', 'resumido', 'Resumido', 'Só o total de cada sistema')}</div>
      <span class="label">Incluir no PDF</span>
      <div class="opt-list">${sw('capa', 'Capa', 'Obra, cliente e valor total')}${sw('condicoes', 'Condições comerciais', 'Pagamento, prazo e garantia')}${sw('validade', 'Validade', p.validUntil ? `Até ${OC.dateFull(p.validUntil)}` : 'Sem validade definida', !p.validUntil)}</div>
      ${cost ? `<div class="card team"><div class="sec-row"><b>${icon('eye', 18)}Só para a equipe</b><span class="tag">Não vai no PDF</span></div>
        <div class="kv"><span>Custo base</span><b>${esc(OC.money0(t.baseCost))}</b></div>
        <div class="kv"><span>BDI</span><b>${esc(OC.dec2(p.bdiMultiplier))} ×</b></div>
        <div class="kv"><span>Margem</span><b>${esc(OC.pct(t.marginPercent))}</b></div></div>` : ''}
      <p class="hint">O cliente vê só preços de venda. Custo, BDI e margem nunca entram no PDF.</p>
      ${sendBlock}
      <div class="actions col"><div class="pair"><button class="btn2" type="button" data-share>${icon('arrow-square-out', 18)}Compartilhar</button>
        <button class="btn2" type="button" data-print>${icon('download-simple', 18)}Baixar</button></div>
        ${canSend && (sendable || p.status === 'sent') ? `<button class="btn2" type="button" data-link>${icon('arrow-square-out', 18)}Link para o cliente aprovar</button>` : ''}
        ${canSend && sendable ? `<button class="btn" type="button" data-send>${icon('paper-plane-tilt', 18)}Enviar ao cliente</button>` : ''}</div>`;

    let list = [];
    let timer = 0;
    const effective = () => ({ ...c, validade: c.validade && !!p.validUntil });
    function preview() {
      OC.$$('[data-opt]', body).forEach((b) => b.setAttribute('aria-pressed', String(c[b.dataset.opt] === b.dataset.val)));
      OC.$$('[data-sw]', body).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sw === 'validade' ? effective().validade : !!c[b.dataset.sw])));
      const thumbs = OC.$('#pdf-thumbs', body), busy = OC.$('#pdf-busy', body);
      thumbs.classList.add('busy');
      busy.hidden = false;
      if (!list.length) thumbs.innerHTML = thumbSkeleton();
      OC.$('#pdf-pages', body).textContent = '';
      clearTimeout(timer);
      timer = setTimeout(() => {
        list = pages(p, effective());
        thumbs.innerHTML = list.map((pg, i) => `<button class="pg-thumb" type="button" data-pg="${i}" aria-label="Ampliar página ${i + 1}, ${esc(pg.label)}"><span class="pg-box">${pg.html}</span><small>${esc(pg.label)}</small></button>`).join('');
        OC.$$('.pg-box', thumbs).forEach((box) => { box.style.height = `${Math.round(box.firstElementChild.offsetHeight * THUMB_SCALE)}px`; });
        thumbs.classList.remove('busy');
        busy.hidden = true;
        OC.$('#pdf-pages', body).textContent = `${list.length} ${list.length === 1 ? 'página' : 'páginas'} · toque para ampliar`;
        OC.$$('[data-pg]', thumbs).forEach((b) => b.addEventListener('click', () => zoomView(list, Number(b.dataset.pg))));
      }, 250);
    }
    OC.$$('[data-opt]', body).forEach((b) => b.addEventListener('click', () => { c[b.dataset.opt] = b.dataset.val; preview(); }));
    OC.$$('[data-sw]', body).forEach((b) => b.addEventListener('click', () => { c[b.dataset.sw] = !c[b.dataset.sw]; preview(); }));
    OC.$('[data-share]', body).addEventListener('click', () => shareSheet(p, c));
    const printButton = OC.$('[data-print]', body);
    if (printButton) printButton.addEventListener('click', async () => {
      printButton.disabled = true;
      try { printDocument(await fetchDocument(p, c)); } catch (error) { OC.toast(error.message, 'warning-circle'); } finally { printButton.disabled = false; }
    });
    const linkButton = OC.$('[data-link]', body);
    if (linkButton) linkButton.addEventListener('click', () => OC.open('link', { id: p.id }));
    const sendButton = OC.$('[data-send]', body);
    if (sendButton) sendButton.addEventListener('click', () => sendSheet(p, c, () => OC.leave('prop', { id: p.id, tab: 'resumo' })));
    preview();
  };
})(window.OC = window.OC || {});
