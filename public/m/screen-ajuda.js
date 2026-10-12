// Tema (Automatico, Claro, Escuro, como AppearancePanel.tsx) e Ajuda do Orcamentos no celular (essencial do HelpModal.tsx).
(function (OC) {
  const KEY = 'orc_m_tema';
  const THEMES = [['auto', 'Automático (do aparelho)', 'Segue o tema claro ou escuro do celular', 'desktop'], ['claro', 'Claro', 'Fundo claro', 'sun'], ['escuro', 'Escuro', 'Fundo azul-marinho', 'moon']];
  // Sem escolha salva o core.js ja segue o aparelho (ou o ?tema= do app); "Automatico" e so apagar a escolha.
  OC.theme.mode = () => { try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; } };
  OC.theme.set = (mode) => {
    try { if (mode === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, mode); } catch { /* sem armazenamento: vale ate fechar */ }
    OC.theme.apply(mode === 'auto' ? OC.theme.get() : mode);
  };
  OC.theme.label = () => (THEMES.find(([k]) => k === OC.theme.mode()) || THEMES[0])[1];
  try {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (OC.theme.mode() === 'auto') OC.theme.apply(OC.theme.get()); });
  } catch { /* navegador antigo: aplica ao abrir */ }

  OC.themeSheet = function (onDone) {
    const { esc, icon } = OC;
    const s = OC.sheet(`${OC.sheetHead('Tema', 'sun')}<div class="opts" style="margin-top:12px">${THEMES.map(([k, l, sub, ic]) => `<button class="opt" type="button" data-th="${k}" aria-pressed="${OC.theme.mode() === k}">${icon(ic, 20)}<span><b>${esc(l)}</b><small>${esc(sub)}</small></span><i class="radio"></i></button>`).join('')}</div>
      <p class="sheet-text">Vale neste aparelho. O PDF da proposta continua claro.</p>`);
    OC.$$('[data-th]', s.el).forEach((b) => b.addEventListener('click', () => { OC.theme.set(b.dataset.th); s.close(); if (onDone) onDone(); }));
  };

  OC.screens.ajuda = async function (params) {
    const { esc, icon } = OC;
    const flow = [['draft', 'Itens e valores liberados para editar.'], ['review', 'Conferência interna antes de enviar.'], ['sent', 'O cliente recebeu. Enviar exige permissão para enviar e aprovar.'],
      ['approved', 'Fica travada e vira a base da obra no Centro de Custos. Não volta atrás: só com nova revisão.'], ['rejected', 'Pode voltar para edição ou virar nova revisão.']];
    const card = (ic, title, html) => `<div class="card help-card"><div class="sec-row"><b>${icon(ic, 18)}${esc(title)}</b></div>${html}</div>`;
    OC.render(`${OC.header('Ajuda', { back: true })}
      <p class="sub" style="margin:-6px 0 0">O essencial do Construtec Orçamentos</p>
      ${card('file-text', 'Situação da proposta', flow.map(([st, t]) => `<div class="help-flow">${OC.pill(st)}<small>${esc(t)}</small></div>`).join(''))}
      ${card('clock-counter-clockwise', 'Revisões', '<p>Cada revisão guarda os itens e os preços do momento em que foi criada. Mudar o catálogo depois não altera propostas já emitidas; o aviso de preço novo aparece nas propostas em edição.</p>')}
      ${OC.can('p10') ? card('percent', 'Como o preço é calculado', `<p>Preço de venda = custo × BDI (multiplicador, ex.: 1,25) × (1 + impostos %). A mão de obra entra pelo custo por hora:</p>
        <p class="help-code">Custo por hora = (salário + alimentação + transporte + outros) ÷ horas por mês (padrão 220)</p><p>Os valores são arredondados em centavos, no padrão R$ 1.250,00.</p>`) : ''}
      ${card('lock-simple', 'Sigilo comercial', '<p>Custo, salários, BDI e margem nunca saem no PDF nem no Word do cliente. O cliente recebe só os valores de venda e o escopo.</p><p>Quem não tem permissão para ver custo vê só o valor final, aqui e no computador.</p>')}
      ${card('desktop', 'Celular e computador', '<p>Propostas, catálogo, kits, clientes e configurações são os mesmos nos dois. Foto ou PDF de orçamento para importar itens, backup e restauração ficam na versão completa (Menu, Versão completa).</p>')}
      ${card('info', 'Sobre', '<div class="kv"><span>Aplicativo</span><b>Construtec Orçamentos</b></div><div class="kv"><span>Dados</span><b>Servidor da Construtec</b></div>')}`, true, params);
  };
})(window.OC = window.OC || {});
