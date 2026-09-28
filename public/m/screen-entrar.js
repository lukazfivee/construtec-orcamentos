// Entrar direto no Orcamentos pelo celular (iPhone e navegador). A conta e a do Centro de Custos.
(function (OC) {
  const { esc, icon } = OC;
  const CENTRO_M = 'https://centro-custos-api.construtec-reports.workers.dev/m/';
  const LAST_EMAIL = 'construtec.auth.remembered_email';

  // onDone: chamado depois de salvar a sessao (o app.js segue a abertura normal).
  OC.loginScreen = function (message, onDone) {
    document.body.classList.add('no-tabs');
    const el = OC.render(`<div class="login">
      <img class="login-logo" src="simbolo.png" alt="">
      <h1 class="title">Orçamentos</h1>
      <p class="sub">${esc(message || 'Entre com a mesma conta do Centro de Custos.')}</p>
      <form class="login-form" id="login-form" novalidate>
        <label class="field"><span>E-mail</span>
          <input id="login-email" type="email" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="email" required></label>
        <label class="field"><span>Senha</span>
          <span class="login-pass"><input id="login-senha" type="password" autocomplete="current-password" required>
          <button class="login-show" type="button" id="login-show" aria-pressed="false" aria-label="Mostrar senha">Mostrar</button></span></label>
        <p class="login-err" id="login-err" role="alert"></p>
        <button class="btn" type="submit" id="login-go">${icon('key', 20)}Entrar</button>
        <a class="btn2" href="${CENTRO_M}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">Esqueci minha senha</a>
      </form>
      <p class="login-note">Sem conta? Peça a um administrador do Centro de Custos.</p>
    </div>`);
    const email = OC.$('#login-email', el), senha = OC.$('#login-senha', el), err = OC.$('#login-err', el);
    try { const last = localStorage.getItem(LAST_EMAIL); if (last) email.value = last; } catch { /* nada */ }

    OC.$('#login-show', el).addEventListener('click', (event) => {
      const visible = senha.type === 'password';
      senha.type = visible ? 'text' : 'password';
      event.currentTarget.textContent = visible ? 'Ocultar' : 'Mostrar';
      event.currentTarget.setAttribute('aria-pressed', String(visible));
      event.currentTarget.setAttribute('aria-label', visible ? 'Ocultar senha' : 'Mostrar senha');
    });

    OC.$('#login-form', el).addEventListener('submit', async (event) => {
      event.preventDefault();
      err.textContent = '';
      const value = email.value.trim().toLowerCase();
      if (!value || !senha.value) { err.textContent = 'Preencha o e-mail e a senha.'; return; }
      const go = OC.$('#login-go', el);
      go.disabled = true;
      try {
        const data = await OC.api('/auth/login', { method: 'POST', body: { email: value, password: senha.value, rememberMe: true } });
        if (!data.token || !data.user) throw new Error('Não foi possível entrar agora.');
        try { localStorage.setItem(LAST_EMAIL, value); } catch { /* nada */ }
        OC.session.save(data);
        senha.value = '';
        onDone();
      } catch (error) {
        err.textContent = error.status === 400 ? 'Confira o e-mail digitado.' : error.message;
        go.disabled = false;
      }
    });
  };
})(window.OC = window.OC || {});
