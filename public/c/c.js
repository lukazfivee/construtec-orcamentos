// Pagina publica do cliente (Rodada 27C): ver a proposta, aprovar ou pedir ajuste, sem login.
// O token fica no fragmento (#) da URL, que o navegador nao envia ao servidor nem a outros sites.
// Todo texto vem do servidor e entra na pagina por textContent (nunca innerHTML).
(function () {
  const app = document.getElementById('app');
  const token = decodeURIComponent(location.hash.replace(/^#/, ''));
  const api = '/api/public/c/' + encodeURIComponent(token);
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const dateFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
  const fmtDate = (iso) => (iso ? dateFmt.format(new Date(String(iso).slice(0, 10) + 'T00:00:00Z')) : '');
  let data = null;
  let draft = { name: '', role: '', accept: false, message: '' };

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === false || v == null) return;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    kids.flat().forEach((kid) => { if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid))); });
    return el;
  }
  const show = (...nodes) => { app.replaceChildren(h('div', { class: 'brand' }, h('i'), 'CONSTRUTEC'), ...nodes); window.scrollTo(0, 0); };
  const contact = () => {
    const c = (data && data.company) || {};
    const parts = [c.phone, c.email].filter(Boolean);
    return h('p', { class: 'hint' }, parts.length ? 'Fale com a ' + (c.name || 'Construtec') + ': ' + parts.join(' · ') : 'Fale com a Construtec pelo contato que enviou este link.');
  };
  const rev = (n) => 'REV ' + String(n || 0).padStart(2, '0');

  function notice(icon, title, text, extra) {
    show(h('div', { class: 'card' }, h('div', { class: 'big-icon', 'aria-hidden': 'true' }, icon), h('h2', { text: title }), h('p', { class: 'muted', text: text }), extra, contact()));
  }

  function failure(message) {
    show(h('div', { class: 'card' }, h('div', { class: 'big-icon', 'aria-hidden': 'true' }, '!'), h('h2', { text: 'Não foi possível abrir a proposta' }),
      h('p', { class: 'muted', text: message }), h('button', { class: 'btn', type: 'button', onclick: load }, 'Tentar de novo'), contact()));
  }

  async function call(path, options) {
    const response = await fetch(api + path, options);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(body.error || 'Não foi possível concluir.'); error.code = body.code; error.status = response.status; throw error; }
    return body;
  }

  function closedScreen() {
    const p = data.proposal;
    const map = {
      expired: ['!', 'Este link venceu', 'O link da proposta ' + p.number + ' valia até ' + fmtDate(data.expiresAt) + '. Peça um link novo à Construtec.'],
      disabled: ['!', 'Este link foi desativado', 'A Construtec desativou o link da proposta ' + p.number + '. Peça um link novo.'],
      superseded: ['!', 'Existe uma revisão mais nova', 'O link é da ' + rev(p.revision) + ' da proposta ' + p.number + ', que já foi substituída. Peça à Construtec o link da revisão atual.'],
      adjust: ['✓', 'Pedido de ajuste enviado', 'A Construtec recebeu o seu pedido e vai enviar um link novo com a revisão.'],
    };
    if (data.state === 'approved' || data.state === 'confirmed') {
      const reply = data.reply || {};
      notice('✓', 'Proposta aprovada', 'A proposta ' + p.number + ' (' + rev(p.revision) + ') já foi aprovada por este link' + (reply.name ? ' por ' + reply.name : '') + '.',
        h('div', null, reply.code ? h('span', { class: 'code', text: reply.code }) : null, h('div', { class: 'row' }, h('button', { class: 'btn2', type: 'button', onclick: read }, 'Ver a proposta'))));
      return;
    }
    const m = map[data.state];
    notice(m[0], m[1], m[2]);
  }

  function cover() {
    const p = data.proposal;
    show(
      h('div', { class: 'card' },
        h('p', { class: 'kicker' }, 'Proposta comercial'),
        h('h1', { text: p.workName || p.clientName }),
        h('p', { class: 'muted', text: p.clientName }),
        h('dl', null, h('dt', null, 'Proposta'), h('dd', { text: p.number + ' · ' + rev(p.revision) }),
          p.validUntil ? [h('dt', null, 'Válida até'), h('dd', { text: fmtDate(p.validUntil) })] : null,
          p.responsibleName ? [h('dt', null, 'Responsável'), h('dd', { text: p.responsibleName })] : null),
        h('div', { class: 'total' }, h('span', { class: 'muted' }, 'Valor total'), h('b', { text: brl.format(p.total) }))),
      h('button', { class: 'btn2', type: 'button', onclick: read }, 'Ler a proposta (PDF)'),
      contact(),
      h('div', { class: 'bar' }, h('button', { class: 'btn2', type: 'button', onclick: adjustForm }, 'Pedir ajuste'), h('button', { class: 'btn', type: 'button', onclick: approveForm }, 'Aprovar proposta')),
    );
  }

  function read() {
    const frame = h('iframe', { title: 'Proposta', src: api + '/document', sandbox: 'allow-modals allow-same-origin' });
    show(
      h('button', { class: 'btn2', type: 'button', onclick: () => (data.state === 'active' ? cover() : closedScreen()) }, 'Voltar'),
      h('div', { class: 'reader' }, frame),
      h('div', { class: 'row' },
        h('button', { class: 'btn2', type: 'button', onclick: () => { try { frame.contentWindow.print(); } catch (e) { window.open(api + '/document', '_blank', 'noopener'); } } }, 'Baixar PDF ou imprimir')),
      h('p', { class: 'hint' }, 'Na janela de impressão, escolha "Salvar como PDF" para baixar o arquivo.'),
    );
  }

  function who(missing) {
    if (!data.requireIdentity) return null;
    const field = (key, label, autocomplete) => {
      const input = h('input', { type: 'text', id: 'f-' + key, value: draft[key], autocomplete, maxlength: key === 'name' ? 120 : 80, class: missing && draft[key].trim().length < 2 ? 'bad' : false, oninput: (e) => { draft[key] = e.target.value; refresh(); } });
      return h('label', { class: 'field' }, label, input);
    };
    return [field('name', 'Seu nome', 'name'), field('role', 'Seu cargo', 'organization-title')];
  }

  let refresh = () => {};
  function approveForm(missing) {
    const submit = h('button', { class: 'btn', type: 'button', onclick: send }, 'Aprovar proposta');
    const hint = h('p', { class: 'hint' });
    const errBox = h('div');
    refresh = () => {
      const lacks = [];
      if (data.requireIdentity && draft.name.trim().length < 2) lacks.push('o nome');
      if (data.requireIdentity && draft.role.trim().length < 2) lacks.push('o cargo');
      if (!draft.accept) lacks.push('o aceite');
      submit.disabled = lacks.length > 0;
      hint.textContent = lacks.length ? 'Falta preencher ' + lacks.join(', ') + '.' : 'Tudo pronto para aprovar.';
    };
    async function send() {
      submit.disabled = true; submit.textContent = 'Enviando a aprovação…'; errBox.replaceChildren();
      try {
        const result = await call('/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: draft.name, role: draft.role, accept: draft.accept }) });
        data.state = 'approved'; data.reply = { kind: 'approved', name: draft.name, code: result.code };
        notice('✓', 'Proposta aprovada', 'Recebemos a sua aprovação da proposta ' + data.proposal.number + '. Guarde o código do aceite.', h('span', { class: 'code', text: result.code }));
        document.getElementById('app').classList.add('ok');
      } catch (error) {
        if (error.code === 'LINK_NOT_ACTIVE') { await load(); return; }
        submit.textContent = 'Aprovar proposta';
        errBox.replaceChildren(h('div', { class: 'err', role: 'alert', text: error.status ? error.message : 'Sem conexão. O que você preencheu continua aqui; tente de novo.' }));
        refresh();
      }
    }
    show(
      h('button', { class: 'btn2', type: 'button', onclick: cover }, 'Voltar'),
      h('div', { class: 'card' }, h('h2', null, 'Aprovar proposta'),
        h('p', { class: 'muted', text: data.proposal.number + ' · ' + rev(data.proposal.revision) + ' · ' + brl.format(data.proposal.total) }),
        who(missing === true),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: draft.accept, onchange: (e) => { draft.accept = e.target.checked; refresh(); } }),
          h('span', null, 'Li a proposta e aceito o valor, o escopo e as condições comerciais.')),
        errBox, hint, submit),
    );
    refresh();
  }

  function adjustForm() {
    const submit = h('button', { class: 'btn', type: 'button', onclick: send }, 'Enviar pedido');
    const errBox = h('div');
    const area = h('textarea', { id: 'f-message', maxlength: 1000, placeholder: 'Conte o que precisa mudar na proposta.', oninput: (e) => { draft.message = e.target.value; refresh(); } });
    area.value = draft.message;
    refresh = () => {
      const needsWho = data.requireIdentity && (draft.name.trim().length < 2 || draft.role.trim().length < 2);
      submit.disabled = draft.message.trim().length < 3 || needsWho;
    };
    async function send() {
      submit.disabled = true; submit.textContent = 'Enviando o pedido…'; errBox.replaceChildren();
      try {
        await call('/adjust', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: draft.name, role: draft.role, message: draft.message }) });
        data.state = 'adjust';
        notice('✓', 'Pedido de ajuste enviado', 'A Construtec recebeu a sua mensagem e vai enviar um link novo com a revisão.', h('p', { class: 'note', text: draft.message }));
      } catch (error) {
        if (error.code === 'LINK_NOT_ACTIVE') { await load(); return; }
        submit.textContent = 'Enviar pedido';
        errBox.replaceChildren(h('div', { class: 'err', role: 'alert', text: error.status ? error.message : 'Sem conexão. A mensagem continua aqui; tente de novo.' }));
        refresh();
      }
    }
    show(
      h('button', { class: 'btn2', type: 'button', onclick: cover }, 'Voltar'),
      h('div', { class: 'card' }, h('h2', null, 'Pedir ajuste'), h('p', { class: 'hint' }, 'O link se encerra e a Construtec envia a revisão em um link novo.'),
        who(false), h('label', { class: 'field' }, 'Mensagem', area), errBox, submit),
    );
    refresh();
  }

  async function load() {
    show(h('div', { class: 'skeleton' }), h('div', { class: 'skeleton' }));
    if (!/^[0-9a-f]{32}[A-Za-z0-9_-]{43}$/.test(token)) { notice('!', 'Link inválido', 'Confira se o endereço está completo ou peça um link novo à Construtec.'); return; }
    try {
      data = await call('');
      if (data.state === 'active') cover(); else closedScreen();
    } catch (error) {
      if (error.status === 404) notice('!', 'Link inválido', 'Confira se o endereço está completo ou peça um link novo à Construtec.');
      else failure(error.status ? error.message : 'Sem conexão. Verifique a internet e tente de novo.');
    }
  }
  load();
})();
