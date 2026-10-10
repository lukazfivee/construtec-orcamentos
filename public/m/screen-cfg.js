// Configuracoes gerais no celular: impostos padrao e opcoes do PDF (CompanyDefaultsPanel.tsx) dentro da tela de
// Configuracoes (screen-misc.js chama OC.cfgExtra), e dados da empresa com o responsavel tecnico (SettingsSections.tsx).
// Tudo em PATCH /api/settings; so administrador grava (o servidor confere). Corpo padrao e modelos de texto: outra tela.
(function (OC) {
  const PDF = [['pdfShowLogo', 'Logo da Construtec na capa', 'Versão branca sobre o azul-marinho'],
    ['pdfShowSignature', 'Assinatura de quem envia', 'Nome e cargo no fim das condições'],
    ['pdfWatermark', "Marca d'água com a logo", 'Logo clara ao fundo de todas as páginas; cada PDF pode desligar']];

  OC.cfgExtra = {
    // s: configuracoes do servidor. Os controles escrevem em v, que a tela de Configuracoes salva inteiro.
    html(s, admin) {
      const { esc, icon } = OC;
      const off = admin ? '' : ' disabled';
      return `<div class="card cfg"><span class="label">Impostos</span>
          <div class="cfg-row"><b>Impostos padrão</b><small>% sobre o valor com BDI, em toda proposta nova</small>
            <div class="qty"><button class="qbtn" type="button" data-tax="-0.5"${off} aria-label="Diminuir impostos">${icon('minus', 18)}</button><span class="qval" id="cx-tax"></span><button class="qbtn" type="button" data-tax="0.5"${off} aria-label="Aumentar impostos">${icon('plus', 18)}</button></div></div></div>
        <div class="card cfg-pdf"><span class="label">PDF da proposta</span><p class="hint">O que sai em todo PDF enviado ao cliente.</p>
          <div class="opt-list">${PDF.map(([k, t, sub]) => `<button class="opt" type="button" data-sw="${k}"${off}><span><b>${esc(t)}</b><small>${esc(sub)}</small></span><i class="switch"></i></button>`).join('')}</div>
          <label class="field" style="margin-top:12px"><span>Local da carta de abertura</span><input id="cx-place" type="text" maxlength="80" value="${esc(s.letterPlace || '')}" placeholder="Salvador / BA"${admin ? '' : ' readonly'}></label>
          <p class="hint lock" style="margin-top:8px">${icon('lock-simple', 16)}Custo, BDI e margem nunca entram no PDF, qualquer que seja o padrão.</p></div>
        <button class="card cfg-link" type="button" id="cx-emp">${icon('buildings', 20)}<span class="grow"><b>${esc(s.tradeName || s.companyName || 'Dados da empresa')}</b><small>${esc(s.document || 'CNPJ não informado')} · responsável ${esc(s.defaultResponsible || 'não informado')}</small></span>${icon('caret-right', 18)}</button>`;
    },
    bind(el, s, admin, v) {
      v.defaultTaxPercentage = Number(s.defaultTaxPercentage) || 0;
      PDF.forEach(([k]) => { v[k] = s[k] !== false; });
      v.letterPlace = s.letterPlace || 'Salvador / BA';
      const paint = () => {
        OC.$('#cx-tax', el).textContent = `${v.defaultTaxPercentage.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
        OC.$$('[data-sw]', el).forEach((b) => b.setAttribute('aria-pressed', String(!!v[b.dataset.sw])));
      };
      OC.$$('[data-tax]', el).forEach((b) => b.addEventListener('click', () => { v.defaultTaxPercentage = Math.min(100, Math.max(0, Math.round((v.defaultTaxPercentage + Number(b.dataset.tax)) * 100) / 100)); paint(); }));
      OC.$$('[data-sw]', el).forEach((b) => b.addEventListener('click', () => { v[b.dataset.sw] = !v[b.dataset.sw]; paint(); }));
      // Local vazio nao vai (o servidor exige texto): fica o que estava.
      OC.$('#cx-place', el).addEventListener('input', (event) => { v.letterPlace = event.target.value.trim() || s.letterPlace || 'Salvador / BA'; });
      OC.$('#cx-emp', el).addEventListener('click', () => OC.open('cfgEmp'));
      paint();
    },
  };

  const FIELDS = [['companyName', 'Razão social', 'Construtec Engenharia e Soluções Ltda.', 200, 'text'], ['tradeName', 'Nome fantasia', 'Construtec Engenharia', 200, 'text'],
    ['document', 'CNPJ ou inscrição', '00.000.000/0001-00', 50, 'text'], ['email', 'E-mail comercial', 'comercial@empresa.com.br', 120, 'email'],
    ['phone', 'Telefone', '(71) 99999-9999', 50, 'tel'], ['address', 'Endereço e cidade', 'Salvador - BA', 300, 'text']];

  // Dados da empresa (cabecalho e rodape do PDF e do Word) e responsavel tecnico padrao das propostas novas.
  OC.screens.cfgEmp = async function (params) {
    const { esc, icon } = OC;
    const s = (await OC.api('/settings')).settings || {};
    const admin = (OC.session.user() || {}).role === 'admin';
    const ro = admin ? '' : ' readonly';
    const field = ([k, label, ph, max, type]) => `<label class="field"><span>${label}</span><input id="ce-${k}" type="${type}" maxlength="${max}" value="${esc(s[k] || '')}" placeholder="${esc(ph)}" autocomplete="off"${ro}></label>`;
    const el = OC.render(`${OC.header('Dados da empresa', { back: true })}
      <p class="sub" style="margin:-6px 0 0">Saem no cabeçalho e no rodapé do PDF e do Word</p>
      ${FIELDS.map(field).join('')}
      <span class="group">Propostas novas</span>
      ${field(['defaultResponsible', 'Responsável técnico padrão', 'Nome de quem assina', 120, 'text'])}
      <p class="hint">${admin ? 'Propostas já criadas mantêm os dados delas.' : 'Só administradores alteram estes dados.'}</p>
      ${admin ? `<div class="actions"><button class="btn" type="button" id="ce-save">${icon('check', 18)}Salvar dados</button></div>` : ''}`, true, params);
    const save = OC.$('#ce-save', el);
    if (save) save.addEventListener('click', async () => {
      const body = {};
      [...FIELDS.map((x) => x[0]), 'defaultResponsible'].forEach((k) => { body[k] = OC.$(`#ce-${k}`, el).value.trim(); });
      if (!body.companyName) { OC.toast('Informe a razão social.', 'warning-circle'); return; }
      if (!body.defaultResponsible) { OC.toast('Informe o responsável técnico.', 'warning-circle'); return; }
      save.disabled = true;
      try { await OC.api('/settings', { method: 'PATCH', body }); OC.toast('Dados da empresa salvos'); } catch (error) { OC.toast(error.message, 'warning-circle'); }
      save.disabled = false;
    });
  };
})(window.OC = window.OC || {});
