// Seletor "Suite": folha inferior com os apps da esteira (mesmo desenho do /m/ do Centro).
// Dentro do app Android, o Centro de Custos troca de WebView por suite://app/centro-custos
// (com ?obra= para ir direto a obra da proposta); fora do app, abre o site em outra aba.
(function (OC) {
  const { esc, icon } = OC;
  const CENTRO_URL = 'https://centro-custos-api.construtec-reports.workers.dev/m/';
  const CHAMADOPRO_URL = 'https://chamadopro-app.lucas-coelho5923.workers.dev/';
  const inApp = () => /SuiteConstrutec\//.test(navigator.userAgent);
  const centroLink = (obra) => {
    const id = Number(obra) > 0 ? String(Number(obra)) : '';
    if (inApp()) return `suite://app/centro-custos${id ? `?obra=${id}` : ''}`;
    return `${CENTRO_URL}${id ? `#obra=${id}` : ''}`;
  };

  // Contexto da tela aberta: a proposta informa a obra gerada; OC.go limpa.
  OC.suite = { context: null, centroLink };

  function onKey(event) { if (event.key === 'Escape') close(); }
  function close() {
    const el = document.getElementById('suite-sheet');
    if (el) el.remove();
    document.removeEventListener('keydown', onKey);
  }

  OC.suite.open = function () {
    close();
    const obra = OC.suite.context && OC.suite.context.obra;
    const other = inApp() ? '' : ' target="_blank" rel="noopener"';
    const el = document.createElement('div');
    el.id = 'suite-sheet';
    el.className = 'sheet-backdrop';
    el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="suite-title">
      <div class="sheet-handle"></div>
      <div class="sheet-head"><b id="suite-title">${icon('squares-four', 18)}Esteira Operacional Construtec</b>
        <button type="button" class="sheet-x" aria-label="Fechar">${icon('x', 20)}</button></div>
      ${obra && obra.id ? `<p class="sheet-sec">Ir direto para</p>
        <a class="suite-item ctx" href="${esc(centroLink(obra.id))}"${other}>${icon('arrow-right', 20)}<span><b>Obra desta proposta</b><small>${esc(obra.nome || '')} no Centro de Custos</small></span>${icon('caret-right', 18)}</a>` : ''}
      <p class="sheet-sec">Sistemas</p>
      <div class="suite-item current" aria-current="page">${icon('receipt', 22)}<span><small>Etapa 01</small><b>Orçamentos</b></span><em>Atual</em></div>
      <a class="suite-item" href="${esc(centroLink())}"${other}>${icon('buildings', 22)}<span><small>Etapa 02</small><b>Centro de Custos</b></span>${icon('caret-right', 18)}</a>
      <a class="suite-item" href="${CHAMADOPRO_URL}" target="_blank" rel="noopener">${icon('check-circle', 22)}<span><small>Etapa 03</small><b>ChamadoPro</b><small>Abre no navegador</small></span>${icon('arrow-right', 18)}</a>
    </div>`;
    el.addEventListener('click', (event) => {
      if (event.target === el || event.target.closest('.sheet-x')) close();
      else if (event.target.closest('a')) setTimeout(close, 0); // deixa o link navegar antes de fechar
    });
    document.body.appendChild(el);
    document.addEventListener('keydown', onKey);
    OC.$('.sheet-x', el).focus();
  };

  document.addEventListener('click', (event) => { if (event.target.closest('[data-suite]')) OC.suite.open(); });
})(window.OC = window.OC || {});
