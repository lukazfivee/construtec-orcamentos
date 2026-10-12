// Conta e varredura da Exsat no celular, pelas mesmas rotas do site de computador (/api/exsat/*, ExsatAccountCard.tsx e
// useExsatServer.ts). O servidor guarda a conta criptografada e le o catalogo em segundo plano. Tudo exige p10; cadastrar,
// trocar e remover a conta, so administrador (status.canManage). A senha so sobe no "Salvar e conectar" e nunca desce.
(function (OC) {
  const POLL_MS = 2500;
  const fmtN = (n) => Number(n || 0).toLocaleString('pt-BR');
  const plural = (n, one, many) => `${fmtN(n)} ${n === 1 ? one : many}`;
  const when = (iso) => (iso ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) : 'Nunca');
  OC.exsatJobPercent = (job) => (job.pagesTotal > 0 ? Math.min(100, Math.round(((job.pagesRead + job.pagesFailed) / job.pagesTotal) * 100)) : 0);

  // Cadastrar ou trocar a conta. Uma tentativa por toque; o campo de senha e limpo antes do envio.
  function accountSheet(configured, onSaved) {
    const { icon } = OC;
    const s = OC.sheet(`${OC.sheetHead(configured ? 'Trocar conta da Exsat' : 'Conta da Exsat', 'key')}
      <p class="sheet-text" style="margin-top:2px">Conta de revendedor da Exsat. O servidor entra nela e lê os seus preços; preço público sem login nunca é importado.</p>
      <form data-f autocomplete="off"><label class="field" style="margin-top:12px"><span>E-mail da conta Exsat</span><input id="xa-user" type="email" name="exsat-email" autocomplete="off" autocapitalize="off" placeholder="nome@empresa.com.br" required></label>
      <label class="field" style="margin-top:12px"><span>Senha</span><input id="xa-pass" type="password" name="exsat-senha" autocomplete="new-password" placeholder="${configured ? 'Digite a nova senha' : 'Senha da conta'}" required></label>
      <p class="hint" style="margin-top:8px">A senha viaja protegida (HTTPS) e fica guardada criptografada no servidor; nunca é mostrada de volta.</p>
      <div class="sheet-actions"><button class="btn2" type="button" data-no>Cancelar</button><button class="btn" type="submit" data-yes>${icon('key', 18)}Salvar e conectar</button></div></form>`);
    OC.$('[data-no]', s.el).addEventListener('click', s.close);
    OC.$('[data-f]', s.el).addEventListener('submit', async (event) => {
      event.preventDefault();
      const user = OC.$('#xa-user', s.el), pass = OC.$('#xa-pass', s.el), b = OC.$('[data-yes]', s.el);
      const username = user.value.trim(), password = pass.value;
      pass.value = '';
      if (!username || !password) { OC.toast('Informe o e-mail e a senha da conta.', 'warning-circle'); return; }
      b.disabled = true;
      try {
        const res = await OC.api('/exsat/credential', { method: 'PUT', body: { username, password } });
        s.close();
        OC.toast(res.status && res.status.connected ? 'Conta da Exsat conectada' : 'Conta da Exsat salva');
        onSaved(res.status);
      } catch (error) { OC.toast(error.message, 'warning-circle'); b.disabled = false; }
    });
    setTimeout(() => OC.$('#xa-user', s.el).focus(), 50);
  }

  // Le todos os itens com preco da varredura (lotes de 500) e manda para a conferencia, que compara com o catalogo.
  async function results(job, button) {
    const all = [];
    button.disabled = true;
    try {
      for (let offset = 0; offset < 100000; offset += 500) {
        button.textContent = `Lendo ${fmtN(all.length)} de ${fmtN(job.itemsWithPrice)}`;
        const page = await OC.api(`/exsat/sync/${encodeURIComponent(job.id)}/items?offset=${offset}&limit=500`);
        all.push(...(page.items || []));
        if (all.length >= page.total || !(page.items || []).length) break;
      }
    } catch (error) { OC.toast(error.message, 'warning-circle'); button.disabled = false; button.textContent = 'Conferir alterações'; return; }
    if (!all.length) { OC.toast('A varredura não trouxe itens com preço.', 'warning-circle'); button.disabled = false; button.textContent = 'Conferir alterações'; return; }
    OC.reviewImport(all, { title: 'Varredura da Exsat', note: job.itemsWithoutPrice ? `${plural(job.itemsWithoutPrice, 'item sem preço ignorado', 'itens sem preço ignorados')}.` : '' });
  }

  // Desenha o cartao em box e acompanha a varredura enquanto ela roda e a tela esta aberta.
  OC.exsatAccount = function (box) {
    const { esc, icon } = OC;
    let status = null, timer = 0, busy = false;
    const alive = () => box.isConnected;
    const poll = () => { clearTimeout(timer); if (alive() && status && status.job && status.job.status === 'running') timer = setTimeout(refresh, POLL_MS); };
    async function refresh() {
      try { status = (await OC.api('/exsat/status')).status; } catch (error) {
        if (!alive()) return;
        box.innerHTML = `<div class="card ex-card"><div class="ex-head"><span class="ex-ic">${icon('key', 22)}</span><span class="grow"><b>Conta Exsat</b><small>${esc(error.status === 403 ? 'Seu papel não permite usar a varredura da Exsat, que carrega custo.' : error.message)}</small></span></div>
          ${error.status === 403 ? '' : '<div class="ex-btns"><button class="btn2" type="button" data-x="retry">Tentar de novo</button></div>'}</div>`;
        const r = OC.$('[data-x="retry"]', box);
        if (r) r.addEventListener('click', refresh);
        return;
      }
      if (alive()) paint();
      poll();
    }
    const run = async (fn, ok) => {
      if (busy) return;
      busy = true; paint();
      try { await fn(); if (ok) OC.toast(ok); } catch (error) { OC.toast(error.message, 'warning-circle'); }
      busy = false;
      await refresh();
    };
    function jobHtml(job) {
      const wait = status.retryAfterSeconds || 0, pct = OC.exsatJobPercent(job);
      if (job.status === 'running') return `<div class="xs-job" role="status"><div class="bar"><span style="width:${pct}%"></span></div>
        <small>${pct}% · ${fmtN(job.pagesRead + job.pagesFailed)} de ${fmtN(job.pagesTotal)} páginas · ${plural(job.itemsWithPrice, 'item com preço', 'itens com preço')}</small>
        <small>Mantenha esta tela aberta. A leitura é feita devagar, uma página por vez, para não sobrecarregar a Exsat.</small>
        <div class="ex-btns"><button class="btn2" type="button" data-x="cancel"${busy ? ' disabled' : ''}>Cancelar varredura</button></div></div>`;
      if (job.status === 'paused') return `<div class="xs-note warn" role="alert">${esc(job.message || 'A varredura foi pausada.')} Foram lidas ${fmtN(job.pagesRead)} de ${fmtN(job.pagesTotal)} páginas.${wait > 0 ? ` Nova tentativa em ${Math.ceil(wait / 60)} min.` : ''}
        <div class="ex-btns"><button class="btn2" type="button" data-x="resume"${busy || wait > 0 ? ' disabled' : ''}>Retomar</button></div></div>`;
      if (job.status === 'failed') return `<div class="xs-note bad" role="alert">${esc(job.message || 'A varredura não terminou.')}</div>`;
      if (job.status === 'cancelled') return '<div class="xs-note">Varredura cancelada. Nada foi importado.</div>';
      return `<div class="kv"><span>Última varredura</span><b>${esc(when(job.finishedAt || job.updatedAt))}</b></div>
        <div class="kv"><span>Páginas lidas</span><b>${fmtN(job.pagesRead)}${job.pagesFailed ? ` · ${fmtN(job.pagesFailed)} com falha` : ''}</b></div>
        <div class="kv"><span>Itens com preço</span><b>${fmtN(job.itemsWithPrice)}</b></div><div class="kv"><span>Sem preço (ignorados)</span><b>${fmtN(job.itemsWithoutPrice)}</b></div>
        ${OC.canEditCatalog() ? `<div class="ex-btns"><button class="btn2" type="button" data-x="results">Conferir alterações</button></div><small class="hint">Compara os preços lidos com o catálogo e mostra só o que é novo ou mudou.</small>` : ''}`;
    }
    function paint() {
      const s = status, job = s.job, running = job && job.status === 'running', wait = s.retryAfterSeconds || 0;
      box.innerHTML = `<div class="card ex-card"><div class="ex-head"><span class="ex-ic">${icon(s.connected ? 'check-circle' : 'wifi-slash', 22)}</span><span class="grow"><b>Conta Exsat</b>
          <small>${s.configured ? `${esc(s.usernameHint || 'Conta')} · cadastrada em ${esc(when(s.configuredAt))}` : 'Nenhuma conta cadastrada'}</small></span>
          <span class="tag ${s.connected ? 'ok' : 'warn'}">${s.connected ? 'Conectada' : 'Não conectada'}</span></div>
        <p class="hint">${s.configured ? (s.connected ? 'O servidor está conectado e lê os seus preços de revendedor.' : 'O servidor entra na Exsat quando você atualiza o catálogo.') : 'Informe a conta de revendedor da Exsat. Só entram itens com preço real, lido com login.'}</p>
        ${!s.keyConfigured ? '<div class="xs-note warn" role="alert">O servidor ainda não tem a chave de criptografia da conta (EXSAT_CREDENTIAL_KEY), então nada é guardado. Peça ao responsável pelo servidor para cadastrá-la.</div>' : ''}
        ${s.lastFailure && !s.connected ? `<div class="xs-note bad" role="alert">${esc(s.lastFailure.message)}${wait > 0 ? ` Nova tentativa liberada em ${Math.ceil(wait / 60)} min.` : ''}</div>` : ''}
        ${s.configured && s.keyConfigured ? `${job ? jobHtml(job) : ''}<div class="ex-btns"><button class="btn" type="button" data-x="start"${busy || running || wait > 0 ? ' disabled' : ''}>${running ? 'Varredura em andamento' : 'Atualizar catálogo'}</button></div>
          <small class="hint">Lê todos os departamentos da Exsat com a sua conta, em segundo plano.</small>` : ''}
        ${s.canManage && s.keyConfigured ? `<div class="ex-btns">${s.configured ? `<button class="btn2" type="button" data-x="acc"${busy ? ' disabled' : ''}>Trocar conta ou senha</button><button class="btn2 danger-btn" type="button" data-x="remove"${busy || running ? ' disabled' : ''}>Remover conta</button>` : `<button class="btn" type="button" data-x="acc">${icon('key', 18)}Cadastrar conta</button>`}</div>` : ''}
        ${!s.canManage && !s.configured ? '<small class="hint">Só administradores cadastram a conta da Exsat.</small>' : ''}</div>`;
      const on = (k, fn) => { const b = OC.$(`[data-x="${k}"]`, box); if (b) b.addEventListener('click', () => fn(b)); };
      on('acc', () => accountSheet(s.configured, (next) => { if (next) status = next; paint(); poll(); }));
      on('remove', () => OC.confirm('Remover conta da Exsat', 'O servidor apaga a conta guardada e não lê mais os preços até alguém cadastrar de novo. O catálogo continua como está.', 'Remover', async () => {
        status = (await OC.api('/exsat/credential', { method: 'DELETE' })).status;
        OC.toast('Conta da Exsat removida', 'trash');
        paint();
      }));
      on('start', () => run(() => OC.api('/exsat/sync', { method: 'POST', body: {} }), 'Varredura iniciada'));
      on('resume', () => run(() => OC.api(`/exsat/sync/${encodeURIComponent(job.id)}/resume`, { method: 'POST', body: {} }), 'Varredura retomada'));
      on('cancel', () => run(() => OC.api(`/exsat/sync/${encodeURIComponent(job.id)}/cancel`, { method: 'POST', body: {} }), 'Varredura cancelada'));
      on('results', (b) => results(job, b));
    }
    box.innerHTML = '<div class="skeleton" style="height:120px"></div>';
    refresh();
  };
})(window.OC = window.OC || {});
