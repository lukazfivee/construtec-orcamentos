// Usuarios e e-mails autorizados no celular (so administrador), como UsersAdminPanel.tsx e as rotas /api/users.
// As contas sao do Centro de Custos: aqui se cria, ativa, desativa e exclui o login e se escolhe o perfil no Orcamentos.
(function (OC) {
  const ROLES = [['commercial', 'Comercial', 'Cria e edita propostas'], ['viewer', 'Consulta', 'Só vê, não altera'], ['admin', 'Administrador', 'Tudo, inclusive usuários e configurações']];
  const roleName = (r) => (ROLES.find(([k]) => k === r) || [r, r])[1];
  const actions = (yes) => `<div class="sheet-actions"><button class="btn2" type="button" data-no>Cancelar</button><button class="btn" type="button" data-yes>${yes}</button></div>`;
  const roleOpts = (current, disabled) => `<div class="opts">${ROLES.map(([k, l, sub]) => `<button class="opt" type="button" data-role="${k}" aria-pressed="${current === k}"${disabled ? ' disabled' : ''}><span><b>${l}</b><small>${sub}</small></span><i class="radio"></i></button>`).join('')}</div>`;
  const pickRole = (s, onPick) => OC.$$('[data-role]', s.el).forEach((b) => b.addEventListener('click', () => {
    OC.$$('[data-role]', s.el).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    onPick(b.dataset.role);
  }));
  // Executa a acao da folha; erro mantem a folha aberta.
  const submit = (s, fn) => OC.$('[data-yes]', s.el).addEventListener('click', async (event) => {
    const b = event.currentTarget;
    b.disabled = true;
    try { await fn(); s.close(); } catch (error) { OC.toast(error.message, 'warning-circle'); b.disabled = false; }
  });

  OC.screens.users = async function (params) {
    const { esc, icon } = OC;
    const me = OC.session.user() || {};
    if (me.role !== 'admin') { OC.go('menu'); return; }
    let users = [], emails = [], noCenter = false;
    try {
      [users, emails] = await Promise.all([OC.api('/users').then((d) => d.users || []), OC.api('/users/authorized-emails/list').then((d) => d.emails || [])]);
    } catch (error) {
      if (!/não configurada neste servidor/i.test(error.message || '')) throw error;
      noCenter = true;
    }
    const el = OC.render(`${OC.header('Usuários', { back: true })}
      <p class="sub" style="margin:-6px 0 0">Contas do Centro de Custos · o perfil abaixo vale só no Orçamentos</p>
      ${noCenter ? '<p class="hint">Este servidor não está ligado ao Centro de Custos, onde ficam as contas. A lista aparece quando a ligação estiver configurada.</p>' : ''}
      <div class="title-row"><span class="group" id="u-count"></span><button class="chip-act" type="button" id="u-new">${icon('plus', 16)}Nova conta</button></div>
      <div class="rows" id="u-rows"></div>
      <div class="title-row" style="margin-top:8px"><span class="group">E-mails externos autorizados</span><button class="chip-act" type="button" id="e-new">${icon('plus', 16)}Autorizar</button></div>
      <p class="hint">Contas fora do domínio @rcconstrutec.com.br só podem ser criadas para e-mails desta lista.</p>
      <div class="rows" id="e-rows"></div>
      <p class="hint">A senha é trocada pela própria pessoa no Centro de Custos.</p>`, true, params);
    function paint() {
      OC.$('#u-count', el).textContent = `${users.length} ${users.length === 1 ? 'conta' : 'contas'}`;
      OC.$('#u-rows', el).innerHTML = users.map((u) => `<button class="prow" type="button" data-u="${esc(u.id)}"><span class="avatar" style="--a:36px">${esc(OC.initials(u.name))}</span>
          <span class="grow"><b>${esc(u.name)}${u.id === me.id ? ' · você' : ''}</b><small>${esc(u.email)}</small></span>
          <span class="end"><span class="tag${u.role === 'admin' ? ' ok' : ''}">${esc(roleName(u.role))}</span>${u.active ? '' : '<span class="tag warn">Inativa</span>'}</span>${icon('caret-right', 18)}</button>`).join('')
        || `<div class="empty">${icon('users', 28)}Nenhuma conta.</div>`;
      OC.$('#e-rows', el).innerHTML = emails.map((m) => `<div class="prow static"><span class="grow"><b>${esc(m.email)}</b><small>${esc(m.note || 'Sem observação')}${m.authorizedByName ? ` · por ${esc(m.authorizedByName)}` : ''}</small></span>
          <button class="chip-act ghost" type="button" data-rev="${esc(m.email)}">Revogar</button></div>`).join('') || '<div class="empty">Nenhum e-mail externo autorizado.</div>';
      OC.$$('[data-u]', el).forEach((b) => b.addEventListener('click', () => editUser(users.find((u) => u.id === b.dataset.u))));
      OC.$$('[data-rev]', el).forEach((b) => b.addEventListener('click', () => OC.confirm('Revogar autorização', `Revogar a autorização de ${b.dataset.rev}? Uma conta já criada continua ativa; para tirar o acesso, exclua o login.`, 'Revogar', async () => {
        emails = (await OC.api('/users/authorized-emails/revoke', { method: 'POST', body: { email: b.dataset.rev } })).emails || [];
        OC.toast('Autorização revogada');
        paint();
      })));
    }

    function editUser(u) {
      let role = u.role, active = u.active;
      const s = OC.sheet(`${OC.sheetHead(u.name, 'user')}<p class="sheet-text" style="margin-top:2px">${esc(u.email)}${u.centroAdmin ? ' · administrador no Centro de Custos: o perfil muda lá' : ''}</p>
        <p class="sheet-sec">Perfil no Orçamentos</p>${roleOpts(role, u.centroAdmin)}
        <button class="opt" type="button" data-act style="margin-top:10px" aria-pressed="${active}"${u.id === me.id ? ' disabled' : ''}><span><b>Conta ativa</b><small>Inativa não entra no Orçamentos</small></span><i class="switch"></i></button>
        ${u.id !== me.id ? `<button class="btn2 danger-btn" type="button" data-del style="width:100%;margin-top:14px">${icon('trash', 18)}Excluir login</button>` : ''}
        ${actions('Salvar')}`);
      s.el.firstElementChild.classList.add('sheet-tall');
      pickRole(s, (r) => { role = r; });
      const act = OC.$('[data-act]', s.el);
      act.addEventListener('click', () => { active = !active; act.setAttribute('aria-pressed', String(active)); });
      OC.$('[data-no]', s.el).addEventListener('click', s.close);
      const del = OC.$('[data-del]', s.el);
      if (del) del.addEventListener('click', () => {
        s.close();
        OC.confirm('Excluir login', `Excluir o login de ${u.name}? A pessoa perde o acesso ao Orçamentos e ao Centro de Custos, e o e-mail fica livre para uma conta nova. O histórico não é apagado. Não dá para desfazer.`, 'Excluir login', async () => {
          users = (await OC.api(`/users/${encodeURIComponent(u.id)}`, { method: 'DELETE' })).users || [];
          OC.toast('Login excluído', 'trash');
          paint();
        });
      });
      submit(s, async () => {
        if (role === u.role && active === u.active) return;
        users = (await OC.api(`/users/${encodeURIComponent(u.id)}`, { method: 'PATCH', body: { role, active } })).users || [];
        OC.toast('Usuário atualizado');
        paint();
      });
    }

    OC.$('#u-new', el).addEventListener('click', () => {
      let role = 'commercial';
      const s = OC.sheet(`${OC.sheetHead('Nova conta', 'plus')}<p class="sheet-text" style="margin-top:2px">A mesma conta vale no Centro de Custos.</p>
        <label class="field" style="margin-top:12px"><span>Nome</span><input id="un-name" type="text" maxlength="120" autocomplete="off"></label>
        <label class="field" style="margin-top:12px"><span>E-mail</span><input id="un-mail" type="email" maxlength="254" autocomplete="off" autocapitalize="off"></label>
        <label class="field" style="margin-top:12px"><span>Senha inicial · pelo menos 10 caracteres</span><input id="un-pass" type="password" minlength="10" maxlength="128" autocomplete="new-password"></label>
        <p class="sheet-sec">Perfil no Orçamentos</p>${roleOpts(role, false)}${actions(`${icon('check', 18)}Criar conta`)}`);
      s.el.firstElementChild.classList.add('sheet-tall');
      pickRole(s, (r) => { role = r; });
      OC.$('[data-no]', s.el).addEventListener('click', s.close);
      submit(s, async () => {
        const name = OC.$('#un-name', s.el).value.trim(), email = OC.$('#un-mail', s.el).value.trim(), pass = OC.$('#un-pass', s.el);
        if (name.length < 2) throw new Error('Informe o nome (pelo menos 2 letras).');
        if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Informe um e-mail válido.');
        if (pass.value.length < 10) throw new Error('A senha inicial precisa de pelo menos 10 caracteres.');
        const password = pass.value;
        users = (await OC.api('/users', { method: 'POST', body: { name, email, password, role } })).users || [];
        pass.value = '';
        OC.toast('Conta criada. Vale também no Centro de Custos.');
        paint();
      });
      setTimeout(() => OC.$('#un-name', s.el).focus(), 50);
    });

    OC.$('#e-new', el).addEventListener('click', () => {
      const s = OC.sheet(`${OC.sheetHead('Autorizar e-mail externo', 'envelope-simple')}
        <label class="field" style="margin-top:12px"><span>E-mail</span><input id="ae-mail" type="email" maxlength="254" autocomplete="off" autocapitalize="off"></label>
        <label class="field" style="margin-top:12px"><span>Observação · opcional</span><input id="ae-note" type="text" maxlength="200" placeholder="Ex.: vendedor terceirizado" autocomplete="off"></label>${actions('Autorizar')}`);
      OC.$('[data-no]', s.el).addEventListener('click', s.close);
      submit(s, async () => {
        const email = OC.$('#ae-mail', s.el).value.trim(), note = OC.$('#ae-note', s.el).value.trim();
        if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Informe um e-mail válido.');
        emails = (await OC.api('/users/authorized-emails', { method: 'POST', body: { email, note } })).emails || [];
        OC.toast('E-mail externo autorizado');
        paint();
      });
      setTimeout(() => OC.$('#ae-mail', s.el).focus(), 50);
    });
    paint();
  };
})(window.OC = window.OC || {});
