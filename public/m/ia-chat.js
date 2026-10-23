// Assistente do celular (Orcamentos): folha de conversa com o Gemini (Firebase AI Logic) aberta por um
// botao flutuante, visivel em todas as telas depois do login. O SDK e o App Check carregam em segundo
// plano logo depois da abertura do site; a resposta aparece enquanto e escrita (streaming). A conversa
// fica na memoria da pagina; nada e guardado no celular. Ferramentas em ia-tools.js, instrucoes em ia-config.js.
// Mesma base do assistente do Centro de Custos (public/m/ia-chat.js no repositorio do Centro).
(function (OC) {
  const { esc, icon } = OC;
  const IA = OC.ia = OC.ia || {};
  const SUGESTOES = ['Quais propostas estão em andamento?', 'Quanto temos aprovado e em negociação?', 'Como está a obra da proposta aprovada mais recente?', 'Quais propostas vencem a validade esta semana?', 'Quero criar uma proposta'];
  const PASSOS = { listar_propostas: 'Procurando as propostas', ver_proposta: 'Abrindo a proposta', historico_revisoes: 'Lendo as revisões', acompanhamento_obra: 'Consultando a obra no Centro de Custos',
    resumo_comercial: 'Somando o comercial', listar_clientes: 'Procurando os clientes', listar_kits: 'Procurando os kits', buscar_catalogo: 'Procurando no catálogo', abrir_tela: 'Preparando a tela',
    rascunho_atualizar: 'Anotando na proposta', rascunho_itens: 'Anotando os itens', rascunho_ver: 'Relendo o rascunho', rascunho_descartar: 'Limpando o rascunho', finalizar_rascunho: 'Preparando a conferência', rascunho_mao_de_obra: 'Anotando a mão de obra',
    editar_abrir: 'Abrindo a proposta', editar_campos: 'Anotando as mudanças', editar_itens: 'Anotando os itens', editar_mao_de_obra: 'Anotando a mão de obra', editar_ver: 'Relendo as mudanças', editar_descartar: 'Descartando as mudanças', finalizar_edicao: 'Preparando a conferência' };
  const state = { chat: null, sdk: null, model: 0, busy: false, log: [], live: '', screen: '' };
  const offline = () => navigator.onLine === false;

  IA.ready = () => Boolean(OC.iaConfig && OC.iaConfig.firebase);

  // Botao flutuante: um so, fora das telas, por isso aparece em todas depois do login.
  // Sobe quando a tela tem barra de acoes fixa embaixo, para nao cobrir o botao principal.
  function mountFab() {
    if (!IA.ready() || document.getElementById('ia-fab')) return;
    const fab = document.createElement('button');
    fab.id = 'ia-fab'; fab.className = 'ia-fab'; fab.type = 'button'; fab.hidden = true;
    fab.setAttribute('data-ia', ''); fab.setAttribute('aria-label', 'Assistente');
    fab.innerHTML = icon('sparkle-fill', 24);
    document.body.appendChild(fab);
    const sync = () => {
      fab.hidden = !OC.session.token() || Boolean(document.querySelector('.login'));
      const bar = document.querySelector('#view .actions');
      if (bar) fab.style.setProperty('--fab-bottom', `${bar.offsetHeight + 12}px`); else fab.style.removeProperty('--fab-bottom');
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.getElementById('view'), { childList: true });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    sync();
  }

  function sdk() {
    if (!state.sdk) state.sdk = load().catch((error) => { state.sdk = null; throw error; });
    return state.sdk;
  }
  async function load() {
    const base = OC.iaConfig.sdk;
    const [app, ai] = await Promise.all([import(`${base}firebase-app.js`), import(`${base}firebase-ai.js`)]);
    const fb = app.getApps()[0] || app.initializeApp(OC.iaConfig.firebase);
    // App Check (reCAPTCHA v3): so os sites liberados conseguem usar a cota do Gemini do projeto.
    if (OC.iaConfig.recaptcha) {
      const check = await import(`${base}firebase-app-check.js`);
      if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true; // teste local
      check.initializeAppCheck(fb, { provider: new check.ReCaptchaV3Provider(OC.iaConfig.recaptcha), isTokenAutoRefreshEnabled: true });
    }
    return { ai, backend: ai.getAI(fb, { backend: new ai.GoogleAIBackend() }) };
  }
  // Pre-carrega o SDK e o token do App Check para a primeira pergunta nao esperar por eles.
  IA.warm = () => { if (IA.ready() && !offline()) sdk().catch(() => {}); };

  async function newChat(history) {
    const { ai, backend } = await sdk();
    const m = OC.iaConfig.modelos[state.model];
    const model = ai.getGenerativeModel(backend, {
      model: m.nome, systemInstruction: OC.iaPrompt(), tools: IA.declarations(ai.Schema),
      generationConfig: { temperature: 0.3, maxOutputTokens: 1200, thinkingConfig: { thinkingLevel: m.pensar } },
    });
    state.chat = model.startChat({ history: history || [] });
    state.screen = OC.current ? OC.current() : '';
  }

  const quota = (e) => /\b429\b|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(`${e && e.message} ${e && e.customErrorData && e.customErrorData.status}`);

  // Modelo sobrecarregado no Google (500/503 "high demand"): passageiro.
  const busy = (e) => /\b50[03]\b|high demand|overloaded|UNAVAILABLE/i.test(`${e && e.message} ${e && e.customErrorData && e.customErrorData.status}`);

  // Texto parcial vai para a bolha ao vivo; devolve a resposta completa (com as chamadas de ferramenta).
  async function stream(content) {
    state.live = '';
    const r = await state.chat.sendMessageStream(content);
    for await (const chunk of r.stream) {
      let t = '';
      try { t = chunk.text(); } catch { t = ''; }
      if (t) { state.live += t; live(); }
    }
    return { response: await r.response };
  }

  // Limite gratuito ou modelo sobrecarregado: segue no reserva com a mesma conversa;
  // no ultimo modelo, tenta mais uma vez depois de uma pausa curta.
  async function send(content) {
    if (!state.chat) await newChat();
    else if (OC.current && state.screen !== OC.current()) await newChat(await state.chat.getHistory()); // a instrucao conta a tela aberta agora
    try {
      return await stream(content);
    } catch (error) {
      if (state.live || (!quota(error) && !busy(error))) throw error;
      if (state.model + 1 < OC.iaConfig.modelos.length) {
        state.model += 1;
        await newChat(await state.chat.getHistory());
      } else if (busy(error)) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } else throw error;
      return stream(content);
    }
  }

  function friendly(error) {
    IA.lastError = error; // para diagnostico pelo console
    if (offline()) return 'O assistente precisa de internet.';
    if (/api-not-enabled|SERVICE_DISABLED/.test(String(error && error.message))) return 'O assistente ainda não foi ativado no Firebase (AI Logic). Avise o administrador.';
    if (/app-check|appcheck|recaptcha|403/i.test(String(error && error.message))) return 'O assistente ainda não foi liberado para este site no Firebase (App Check). Avise o administrador.';
    if (quota(error)) return 'O limite gratuito do assistente acabou por agora. Tente de novo em alguns minutos.';
    if (busy(error)) return 'O serviço de IA do Google está sobrecarregado agora. Tente de novo em instantes.';
    if (/import|Failed to fetch|NetworkError/i.test(String(error && error.message))) return 'Não foi possível carregar o assistente. Verifique a internet.';
    return 'O assistente não conseguiu responder agora. Tente de novo.';
  }

  function md(text) {
    const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    const out = [];
    let list = null;
    for (const raw of String(text || '').split('\n')) {
      const line = raw.trim();
      const item = line.match(/^(?:[-*]|\d+[.)])\s+(.*)$/);
      if (item) { list = list || []; list.push(`<li>${inline(item[1])}</li>`); continue; }
      if (list) { out.push(`<ul>${list.join('')}</ul>`); list = null; }
      if (line) out.push(`<p>${inline(line.replace(/^#+\s*/, ''))}</p>`);
    }
    if (list) out.push(`<ul>${list.join('')}</ul>`);
    return out.join('');
  }

  // Cartao de confirmacao da proposta montada pela IA: so o botao cria (a IA nao grava nada).
  function cardHtml(m, i) {
    const c = m.card;
    if (!c || c.state === 'dismissed') return '';
    if (c.plan) {
      const busy = c.state === 'busy';
      const lines = IA.edit.describePlan(c.plan).map((line) => `<li>${esc(line)}</li>`).join('');
      return `<div class="ia-card ${c.state}"><b>Alterações na proposta ${esc(c.plan.base.number)} · REV ${esc(String(c.plan.base.revision).padStart(2, '0'))}</b><ul>${lines}</ul>
        <small>Nada foi alterado ainda. Os valores seguem as regras do editor (BDI e imposto da proposta).</small>
        ${c.note ? `<p class="ia-card-note">${esc(c.note)}</p>` : ''}
        ${c.state === 'open' || busy ? `<div class="ia-card-actions"><button type="button" class="chip-act ia-go" data-card-create="${i}"${busy ? ' disabled' : ''}>${icon('check', 16)}${busy ? 'Aplicando' : 'Aplicar alterações'}</button>
          <button type="button" class="chip-act" data-card-keep="${i}"${busy ? ' disabled' : ''}>Continuar conversando</button></div>` : ''}
        ${c.state === 'done' ? `<p class="ia-card-note">${icon('check', 16)}Alterações aplicadas.</p>` : ''}</div>`;
    }
    const v = IA.draft.summary(c.draft);
    const labor = v.mao_de_obra.length ? `<ul>${v.mao_de_obra.map((l) => `<li>Mão de obra: ${esc(String(l.profissionais))} ${esc(l.descricao)} · ${esc(String(l.horas_por_profissional))} h cada</li>`).join('')}</ul>` : '';
    const row = (k, val) => (val ? `<dt>${k}</dt><dd>${val}</dd>` : '');
    const items = v.itens.length ? `<ul>${v.itens.map((it) => `<li>${esc(String(it.quantidade))} ${esc(it.unidade)} · ${esc(it.descricao)}${it.custo_unitario != null ? ` <em>(custo ${esc(Number(it.custo_unitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))})</em>` : ''}${it.preco === 'sem preço (avulso)' ? ' <em>(sem preço)</em>' : ''}</li>`).join('')}</ul>` : '';
    const open = c.state === 'open' || c.state === 'busy';
    return `<div class="ia-card ${c.state}"><b>Proposta para conferir</b><dl>
      ${row('Cliente', esc(v.cliente.nome) + (v.cliente.situacao === 'novo cadastro' ? ' <em>(novo cadastro)</em>' : ''))}
      ${row('Obra', esc(v.obra.nome) + (v.obra.situacao === 'nova obra' ? ' <em>(nova)</em>' : ''))}
      ${row('Escopo', esc(v.escopo))}${row('Prazo', esc(v.prazo_execucao))}${row('Pagamento', esc(v.pagamento))}${row('Garantia', esc(v.garantia))}${row('Validade', v.validade_dias ? `${v.validade_dias} dias` : '')}${row('BDI', v.bdi != null ? String(v.bdi).replace('.', ',') : '')}${row('Imposto', v.imposto_pct != null ? `${String(v.imposto_pct).replace('.', ',')}%` : '')}
      </dl>${labor}${items}<small>Itens do catálogo usam o custo do catálogo; BDI e imposto, os padrões da empresa (ou o que você informou). Itens sem preço você completa na proposta.</small>
      ${c.note ? `<p class="ia-card-note">${esc(c.note)}</p>` : ''}
      ${open ? `<div class="ia-card-actions"><button type="button" class="chip-act ia-go" data-card-create="${i}"${c.state === 'busy' ? ' disabled' : ''}>${icon('check', 16)}${c.state === 'busy' ? 'Criando' : 'Criar proposta'}</button>
        <button type="button" class="chip-act" data-card-keep="${i}"${c.state === 'busy' ? ' disabled' : ''}>Continuar conversando</button></div>` : ''}
      ${c.state === 'done' ? `<p class="ia-card-note">${icon('check', 16)}Proposta criada.</p>` : ''}</div>`;
  }

  async function createFromCard(i) {
    const m = state.log[i];
    if (!m || !m.card || m.card.state !== 'open' || state.busy) return;
    state.busy = true; m.card.state = 'busy'; m.card.note = '';
    paint();
    try {
      if (m.card.plan) {
        // Alterar proposta existente: grava na ordem do editor; se parar no meio, o cartao guarda so o que falta (nova tentativa nao repete).
        const applied = await IA.edit.applyPlan(m.card.plan);
        if (applied.erro) { IA.setPlan(applied.plan); m.card.state = 'open'; m.card.plan = applied.plan; m.card.note = applied.erro; return; }
        IA.setPlan(null, true);
        m.card.state = 'done'; m.card.note = '';
        try {
          OC.toast('Alterações aplicadas');
          close();
          OC.go('prop', { id: m.card.plan.base.id, tab: 'itens' }, { back: true });
        } catch { m.card.note = 'Não consegui abrir a proposta agora; as alterações foram aplicadas.'; }
        return;
      }
      const r = await IA.draft.commit(m.card.draft);
      if (!r.proposalId) {
        IA.setDraft(r.draft);
        m.card.state = 'open'; m.card.draft = r.draft; m.card.note = r.erro || 'Não consegui criar a proposta.';
      } else {
        IA.setDraft(r.draft, true);
        // Daqui em diante a proposta existe: o cartao nunca volta a "aberta" (outro toque criaria uma segunda proposta).
        m.card.state = 'done'; m.card.note = r.aviso || '';
        try {
          OC.toast('Proposta criada');
          close();
          OC.go('prop', { id: r.proposalId, tab: 'itens' }, { back: true });
        } catch { m.card.note = [m.card.note, 'Não consegui abrir a proposta agora; ela está na lista de Propostas.'].filter(Boolean).join(' '); }
      }
    } catch (error) {
      if (m.card.state === 'busy') { m.card.state = 'open'; m.card.note = friendly(error); }
    } finally {
      state.busy = false;
      paint();
    }
  }

  const body = () => OC.$('#ia-log');
  function paint() {
    const el = body();
    if (!el) return;
    el.innerHTML = state.log.length ? state.log.map((m, i) => `<div class="ia-msg ${m.who}">${m.who === 'ia' ? md(m.text) : esc(m.text)}${cardHtml(m, i)}${m.go ? `<button type="button" class="chip-act ia-go" data-go-ia="${i}">${icon('arrow-right', 16)}Ir para ${esc(m.label || 'a tela')}</button>` : ''}</div>`).join('')
      : `<div class="ia-hello">${icon('sparkle-fill', 28)}<b>Como posso ajudar?</b><span>Pergunte sobre propostas, clientes, kits, catálogo e a obra de cada proposta, ou peça para abrir uma tela.</span>
        <div class="ia-sug">${SUGESTOES.map((s) => `<button type="button" class="chip-act" data-sug="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>`;
    if (state.busy && state.live) el.insertAdjacentHTML('beforeend', `<div class="ia-msg ia" id="ia-live">${md(state.live)}</div>`);
    else if (state.busy) el.insertAdjacentHTML('beforeend', `<div class="ia-msg ia busy" role="status"><span class="ia-dots"><i></i><i></i><i></i></span><small id="ia-step">${esc(state.step || 'Pensando')}</small></div>`);
    OC.$$('[data-sug]', el).forEach((b) => b.addEventListener('click', () => ask(b.dataset.sug)));
    OC.$$('[data-card-create]', el).forEach((b) => b.addEventListener('click', () => createFromCard(Number(b.dataset.cardCreate))));
    OC.$$('[data-card-keep]', el).forEach((b) => b.addEventListener('click', () => { const m = state.log[Number(b.dataset.cardKeep)]; if (m && m.card && !state.busy) { m.card.state = 'dismissed'; paint(); } }));
    OC.$$('[data-go-ia]', el).forEach((b) => b.addEventListener('click', () => { const m = state.log[Number(b.dataset.goIa)]; close(); if (m && m.go) m.go(); }));
    el.scrollTop = el.scrollHeight;
  }

  function live() {
    const el = OC.$('#ia-live');
    if (!el) return paint();
    el.innerHTML = md(state.live);
    const log = body(); if (log) log.scrollTop = log.scrollHeight;
  }

  async function ask(text) {
    const q = String(text || '').trim();
    if (!q || state.busy) return;
    state.log.push({ who: 'eu', text: q });
    if (offline()) { state.log.push({ who: 'erro', text: 'O assistente precisa de internet.' }); return paint(); }
    state.busy = true; state.step = 'Pensando'; IA.pendingNav = null; IA.clearConfirm();
    paint();
    try {
      let result = await send(q);
      for (let round = 0; round < 6; round += 1) {
        const calls = result.response.functionCalls() || [];
        if (!calls.length) break;
        state.step = PASSOS[calls[0].name] || 'Consultando';
        if (state.live) { state.live = ''; paint(); } // texto antes da consulta ("vou verificar") sai
        const step = OC.$('#ia-step'); if (step) step.textContent = state.step;
        const parts = [];
        for (const call of calls) parts.push({ functionResponse: { name: call.name, response: await IA.run(call) } });
        result = await send(parts);
      }
      let answer = '';
      try { answer = result.response.text(); } catch { answer = ''; }
      const reply = { who: 'ia', text: answer || (IA.pendingNav ? 'Abrindo.' : 'Não tenho uma resposta para isso. Pode explicar de outro jeito?') };
      // Resposta longa fica para ler, com o botao da tela; curta ("abrindo...") ja vai.
      if (IA.pendingNav && reply.text.length > 160) { reply.go = IA.pendingNav; reply.label = IA.pendingLabel; IA.pendingNav = null; }
      const confirm = IA.takeConfirm();
      const editConfirm = IA.takeEditConfirm();
      if (editConfirm || confirm) {
        reply.card = editConfirm ? { plan: editConfirm, state: 'open' } : { draft: { ...confirm, items: confirm.items.map((item) => ({ ...item })) }, state: 'open' };
        IA.pendingNav = null; // com o cartao na tela a IA nao abre outra tela por cima
        state.log.forEach((m) => { if (m.card && m.card.state === 'open') m.card.state = 'dismissed'; }); // so o cartao mais novo vale
      }
      state.log.push(reply);
    } catch (error) {
      state.log.push({ who: 'erro', text: friendly(error) });
    } finally {
      state.busy = false; state.live = '';
      paint();
    }
    if (IA.pendingNav) {
      const go = IA.pendingNav;
      IA.pendingNav = null;
      setTimeout(() => { close(); go(); }, 900);
    }
  }

  IA.voz = IA.criarVoz({ state, sdk, paint, quota, busy, friendly });

  function onKey(event) { if (event.key === 'Escape') close(); }
  function close() {
    const el = document.getElementById('ia-sheet');
    IA.voz.cancelar();
    if (el) el.remove();
    document.removeEventListener('keydown', onKey);
  }

  IA.open = function (starter) {
    if (!IA.ready()) return;
    close();
    const el = document.createElement('div');
    el.id = 'ia-sheet';
    el.className = 'sheet-backdrop';
    el.innerHTML = `<div class="sheet ia-sheet" role="dialog" aria-modal="true" aria-labelledby="ia-title">
      <div class="sheet-handle"></div>
      <div class="sheet-head"><b id="ia-title">${icon('sparkle', 18)}Assistente</b><span class="grow"></span>
        <button type="button" class="chip-act" id="ia-new">Nova conversa</button><button type="button" class="sheet-x" aria-label="Fechar">${icon('x', 20)}</button></div>
      <div class="ia-log" id="ia-log" aria-live="polite"></div>
      <form class="ia-input" id="ia-form"><textarea id="ia-q" rows="1" maxlength="1500" placeholder="Pergunte, peça uma tela ou uma proposta" aria-label="Mensagem para o assistente"></textarea>
        ${IA.voz.suportada() ? `<button class="ia-mic" id="ia-mic" type="button" aria-label="Ditar mensagem" aria-pressed="false">${icon('microphone', 20)}</button>` : ''}
        <button class="ia-send" type="submit" aria-label="Enviar">${icon('paper-plane-right', 20)}</button></form>
      <small class="ia-voz" id="ia-voz" role="status" hidden></small>
      <small class="ia-note">A IA pode errar. Confira os valores nas telas.${OC.iaConfig.recaptcha ? ' Protegido pelo reCAPTCHA (<a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Privacidade</a>, <a href="https://policies.google.com/terms" target="_blank" rel="noopener">Termos</a>).' : ''}</small></div>`;
    el.addEventListener('click', (event) => { if (event.target === el || event.target.closest('.sheet-x')) close(); });
    document.body.appendChild(el);
    document.addEventListener('keydown', onKey);
    const input = OC.$('#ia-q', el);
    const grow = () => { input.style.height = 'auto'; input.style.height = `${Math.min(120, input.scrollHeight)}px`; };
    input.addEventListener('input', grow);
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); OC.$('#ia-form', el).requestSubmit(); } });
    const mic = OC.$('#ia-mic', el);
    if (mic) mic.addEventListener('click', IA.voz.toggle);
    OC.$('#ia-form', el).addEventListener('submit', (event) => { event.preventDefault(); if (IA.voz.ocupado()) return; const q = input.value; input.value = ''; grow(); ask(q); });
    OC.$('#ia-new', el).addEventListener('click', () => { if (state.busy) return; state.log = []; state.chat = null; state.model = 0; IA.resetDraft(); paint(); input.focus(); });
    paint();
    if (starter) ask(starter); else input.focus();
  };

  // A conversa pertence a conta: sair ou trocar de conta comeca do zero.
  IA.reset = () => { state.log = []; state.chat = null; state.model = 0; IA.resetDraft(); close(); };
  ['logout', 'onUnauthorized'].forEach((name) => {
    const original = OC[name];
    if (typeof original === 'function') OC[name] = function (...args) { IA.reset(); return original.apply(this, args); };
  });
  document.addEventListener('click', (event) => { if (event.target.closest('[data-ia]')) IA.open(); });
  window.addEventListener('load', () => setTimeout(() => { if (OC.session.token()) IA.warm(); }, 2500));
  mountFab();
})(window.OC = window.OC || {});
