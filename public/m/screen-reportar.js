// Reportar problema, melhoria ou sugestao pelo celular. POST /api/reports repassa ao suporte com o nome e o e-mail da sessao.
(function (OC) {
  const { icon } = OC;
  const TIPOS = [['bug', 'Problema'], ['melhoria', 'Melhoria'], ['sugestao', 'Sugestão']];
  const PRIORIDADES = [['baixa', 'Baixa'], ['media', 'Média'], ['alta', 'Alta'], ['critica', 'Crítica']];
  const novoId = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : null);

  OC.screens.reportar = async function (params) {
    const el = OC.render(`${OC.header('Reportar problema', { back: true })}
      <p class="sub" style="margin:-6px 0 0">Vai para o suporte, com seu nome e e-mail para responder. Não escreva senhas.</p>
      <div><span class="label">Tipo</span><div class="seg" role="group" aria-label="Tipo">${TIPOS.map(([k, l]) => `<button type="button" data-tipo="${k}" aria-pressed="${k === 'bug'}">${l}</button>`).join('')}</div></div>
      <div><span class="label">Prioridade</span><div class="seg" role="group" aria-label="Prioridade">${PRIORIDADES.map(([k, l]) => `<button type="button" data-prio="${k}" aria-pressed="${k === 'media'}">${l}</button>`).join('')}</div></div>
      <label class="field"><span>Título</span><input id="rp-titulo" maxlength="170" autocomplete="off" placeholder="Resumo em uma frase"></label>
      <label class="field"><span>Descrição</span><textarea id="rp-desc" rows="6" maxlength="10000" placeholder="O que você fez, o que esperava e o que aconteceu"></textarea></label>
      <p class="alert" role="alert" id="rp-erro"></p>
      <div class="actions"><button class="btn" type="button" id="rp-enviar">${icon('paper-plane-right', 18)}Enviar ao suporte</button></div>`, true, params);
    document.body.classList.add('no-tabs');
    const erro = (texto) => { OC.$('#rp-erro', el).textContent = texto || ''; };
    const escolher = (attr) => OC.$$(`[${attr}]`, el).forEach((b) => b.addEventListener('click', () => OC.$$(`[${attr}]`, el).forEach((x) => x.setAttribute('aria-pressed', String(x === b)))));
    escolher('data-tipo');
    escolher('data-prio');
    const clientReportId = novoId(); // o mesmo envio repetido nao duplica o report
    const enviar = OC.$('#rp-enviar', el);
    enviar.addEventListener('click', async () => {
      const title = OC.$('#rp-titulo', el).value.trim();
      const description = OC.$('#rp-desc', el).value.trim();
      if (title.length < 3) { erro('Dê um título de pelo menos 3 letras.'); return; }
      if (description.length < 5) { erro('Conte o que aconteceu, com pelo menos 5 letras.'); return; }
      erro('');
      enviar.disabled = true;
      enviar.textContent = 'Enviando…';
      try {
        const body = {
          type: OC.$('[data-tipo][aria-pressed="true"]', el).dataset.tipo,
          severity: OC.$('[data-prio][aria-pressed="true"]', el).dataset.prio,
          title, description, platform: 'celular',
        };
        if (clientReportId) body.clientReportId = clientReportId;
        const feito = await OC.api('/reports', { method: 'POST', body });
        OC.toast(feito.reportId ? `Report ${feito.reportId} enviado ao suporte` : 'Report enviado ao suporte');
        OC.back();
      } catch (error) {
        enviar.disabled = false;
        enviar.innerHTML = `${icon('paper-plane-right', 18)}Enviar ao suporte`;
        erro(error.message);
      }
    });
  };
})(window.OC = window.OC || {});
