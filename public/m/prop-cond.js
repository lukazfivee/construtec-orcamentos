// Escopo, condicoes comerciais e validade da proposta no celular. As condicoes ficam no campo scope em JSON, no mesmo
// formato do computador (ProposalCommercialConditionsPanel.tsx); o leitor e o mesmo de parseCommercialConditions
// (src/documents/proposalDocumentCommon.ts), que tambem aceita o texto antigo, sem JSON.
(function (OC) {
  // [campo, rotulo, tamanho maximo, exemplo] -- mesmos limites do computador.
  const FIELDS = [
    ['executionTerm', 'Prazo de execução', 160, 'Ex.: 15 dias úteis'],
    ['paymentTerms', 'Forma de pagamento', 240, 'Ex.: 40% entrada, 60% na entrega'],
    ['warranty', 'Garantia', 160, 'Ex.: 90 dias'],
    ['notes', 'Observações', 500, ''],
  ];
  const text = (value) => (typeof value === 'string' ? value.trim() : '');
  const empty = (scope) => ({ scope: scope.trim() || 'A definir', executionTerm: '', paymentTerms: '', warranty: '', notes: '' });
  const fromLines = (lines, names) => {
    const prefixes = names.map((name) => `${name}:`.toLowerCase());
    const found = lines.find((line) => prefixes.some((prefix) => line.toLowerCase().startsWith(prefix)));
    return found ? found.slice(found.indexOf(':') + 1).trim() : '';
  };

  OC.parseConditions = function (scope) {
    const raw = String(scope == null ? '' : scope);
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && typeof parsed.scope === 'string') {
        return { scope: parsed.scope.trim() || 'A definir', executionTerm: text(parsed.executionTerm), paymentTerms: text(parsed.paymentTerms), warranty: text(parsed.warranty), notes: text(parsed.notes) };
      }
    } catch {
      const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const lineScope = fromLines(lines, ['escopo', 'scope']);
      if (lineScope) {
        return {
          scope: lineScope,
          executionTerm: fromLines(lines, ['prazo', 'prazo de execução', 'execução']),
          paymentTerms: fromLines(lines, ['pagamento', 'forma de pagamento']),
          warranty: fromLines(lines, ['garantia']),
          notes: fromLines(lines, ['observações', 'observacao', 'observacoes', 'notas']),
        };
      }
    }
    return empty(raw);
  };

  // Mesmos textos de reserva do documento do cliente montado no servidor (proposalPresentation.ts).
  OC.conditionTerms = function (scope, withNotes) {
    const c = OC.parseConditions(scope);
    return [
      ['Forma de pagamento', c.paymentTerms || 'A combinar com o cliente'],
      ['Prazo de execução', c.executionTerm || 'A combinar após o aceite da proposta'],
      ['Garantia', c.warranty || 'Conforme normas técnicas aplicáveis'],
      ...(withNotes && c.notes ? [['Observações', c.notes]] : []),
    ];
  };

  // Validade estendida a partir de hoje ou da validade atual, a que for mais tarde (como no computador).
  OC.extendDate = function (current, days) {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    if (current) {
      const [y, m, d] = current.slice(0, 10).split('-').map(Number);
      const existing = new Date(y, m - 1, d);
      if (existing.getTime() > base.getTime()) base.setTime(existing.getTime());
    }
    base.setDate(base.getDate() + days);
    return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
  };

  // Cartao do Resumo: escopo e condicoes legiveis (nunca o JSON cru).
  OC.condCard = function (p, canEdit) {
    const { esc, icon } = OC;
    const c = OC.parseConditions(p.scope);
    const scope = c.scope.toLowerCase() === 'a definir' ? '' : c.scope;
    const rows = FIELDS.map(([key, label]) => (c[key] || key !== 'notes' ? `<small class="label">${label}</small><p${c[key] ? '' : ' class="muted"'}>${c[key] ? esc(c[key]) : 'Não informado'}</p>` : '')).join('');
    return `<div class="card scope"><div class="sec-row"><small class="label">Escopo</small>${canEdit ? `<button class="chip-act" type="button" data-cond>${icon('pencil-simple', 16)}Editar</button>` : ''}</div>
      <p${scope ? '' : ' class="muted"'}>${scope ? esc(scope) : 'A definir'}</p>${rows}</div>`;
  };

  const field = (id, label, value, max, placeholder, area) => `<label class="field" style="margin-top:12px"><span>${label}</span>${area
    ? `<textarea id="${id}" rows="3" maxlength="${max}" placeholder="${OC.esc(placeholder)}">${OC.esc(value)}</textarea>`
    : `<input id="${id}" type="text" maxlength="${max}" placeholder="${OC.esc(placeholder)}" value="${OC.esc(value)}" autocomplete="off">`}</label>`;

  // Editar escopo e condicoes: grava o JSON inteiro em PATCH /details, como o computador.
  OC.conditionsSheet = function (p, ctx) {
    ctx = OC.propCtx(p, ctx);
    const c = OC.parseConditions(p.scope);
    const s = OC.sheet(`${OC.sheetHead('Escopo e condições', 'pencil-simple')}
      ${field('cd-scope', 'Escopo', c.scope.toLowerCase() === 'a definir' ? '' : c.scope, 300, 'Ex.: Fornecimento e instalação do CFTV', true)}
      ${FIELDS.map(([key, label, max, ph]) => field(`cd-${key}`, label, c[key], max, ph, key === 'paymentTerms' || key === 'notes')).join('')}
      <p class="sheet-text">Saem no PDF do cliente. BDI, custos e margem continuam fora.</p>
      <div class="sheet-actions"><button class="btn2" type="button" data-no>Cancelar</button><button class="btn" type="button" data-yes>Salvar</button></div>`);
    s.el.firstElementChild.classList.add('sheet-tall');
    OC.$('[data-no]', s.el).addEventListener('click', s.close);
    OC.$('[data-yes]', s.el).addEventListener('click', async (event) => {
      const b = event.currentTarget;
      const next = { ...OC.parseConditions(p.scope), scope: OC.$('#cd-scope', s.el).value.trim() || 'A definir' };
      FIELDS.forEach(([key]) => { next[key] = OC.$(`#cd-${key}`, s.el).value.trim(); });
      const scope = JSON.stringify(next);
      if (scope === p.scope) { s.close(); return; }
      if (scope.length > 1200) { OC.toast('Textos longos demais. Encurte as observações ou o escopo.', 'warning-circle'); return; }
      b.disabled = true;
      try {
        const data = await OC.api(`/proposals/${p.id}/details`, { method: 'PATCH', body: { scope } });
        s.close();
        OC.toast('Condições atualizadas');
        ctx.update(data.proposal);
      } catch (error) { OC.toast(error.message, 'warning-circle'); b.disabled = false; }
    });
  };

  // Validade: prorrogar com atalhos (+7 a +45 dias) ou escolher a data. O servidor so altera em edicao ou revisao;
  // enviada ou recusada volta para revisao antes (quem tem p11), e depois e enviada de novo.
  OC.validitySheet = function (p, ctx) {
    ctx = OC.propCtx(p, ctx);
    const { esc, icon } = OC;
    const days = OC.daysUntil(p.validUntil);
    const now = p.validUntil ? `Até ${OC.dateFull(p.validUntil)}${days === null ? '' : ` · ${days < 0 ? 'vencida' : (days === 0 ? 'termina hoje' : `${days} ${days === 1 ? 'dia' : 'dias'}`)}`}` : 'Sem validade definida';
    const head = `${OC.sheetHead('Validade da proposta', 'calendar-blank')}<div class="kv" style="margin-top:6px"><span>Situação atual</span><b>${esc(now)}</b></div>`;
    if (!(OC.propEditable && OC.propEditable(p))) {
      const reopen = p.isLatest && OC.canEdit() && (p.status === 'sent' || p.status === 'rejected');
      const why = p.status === 'approved' ? 'Proposta aprovada: a validade não muda mais. Para renegociar, crie uma nova revisão.'
        : (!p.isLatest ? 'Esta é uma revisão antiga. Só a revisão atual pode mudar.' : (!OC.canEdit() ? 'Seu acesso é só para consulta.'
          : `A validade só muda com a proposta em edição ou em revisão. ${OC.can('p11') ? 'Volte para Em revisão, ajuste a validade e envie de novo ao cliente.' : 'Seu papel não permite reabrir propostas enviadas ou recusadas.'}`));
      const s = OC.sheet(`${head}<p class="sheet-text">${esc(why)}</p>
        <div class="sheet-actions${reopen && OC.can('p11') ? '' : ' col'}"><button class="btn2" type="button" data-no>Fechar</button>${reopen && OC.can('p11') ? `<button class="btn" type="button" data-yes>${icon('arrow-counter-clockwise', 18)}Voltar para revisão</button>` : ''}</div>`);
      OC.$('[data-no]', s.el).addEventListener('click', s.close);
      const yes = OC.$('[data-yes]', s.el);
      if (yes) yes.addEventListener('click', async () => {
        yes.disabled = true;
        try {
          const data = await OC.api(`/proposals/${p.id}/status`, { method: 'PATCH', body: { status: 'review' } });
          s.close();
          OC.toast('Proposta voltou para revisão');
          ctx.update(data.proposal);
          OC.validitySheet(data.proposal, ctx);
        } catch (error) { OC.toast(error.message, 'warning-circle'); yes.disabled = false; }
      });
      return;
    }
    let chosen = OC.extendDate(p.validUntil, 15);
    const s = OC.sheet(`${head}<p class="sheet-sec">Prorrogar</p>
      <div class="chips wrap">${[7, 15, 30, 45].map((d) => `<button class="chip-act" type="button" data-d="${d}">+${d} dias</button>`).join('')}</div>
      <label class="field" style="margin-top:12px"><span>Ou escolha a data</span><input id="vd-date" type="date" value="${chosen}"></label>
      <p class="sheet-text" id="vd-new"></p>
      <div class="sheet-actions"><button class="btn2" type="button" data-no>Cancelar</button><button class="btn" type="button" data-yes>${icon('check', 18)}Salvar validade</button></div>`);
    const input = OC.$('#vd-date', s.el);
    const paint = () => {
      OC.$('#vd-new', s.el).textContent = chosen ? `Nova validade: ${OC.dateFull(chosen)}` : 'Escolha uma data.';
      OC.$('[data-yes]', s.el).disabled = !chosen;
      OC.$$('[data-d]', s.el).forEach((b) => b.setAttribute('aria-pressed', String(OC.extendDate(p.validUntil, Number(b.dataset.d)) === chosen)));
    };
    OC.$$('[data-d]', s.el).forEach((b) => b.addEventListener('click', () => { chosen = OC.extendDate(p.validUntil, Number(b.dataset.d)); input.value = chosen; paint(); }));
    input.addEventListener('input', () => { chosen = input.value; paint(); });
    OC.$('[data-no]', s.el).addEventListener('click', s.close);
    OC.$('[data-yes]', s.el).addEventListener('click', async (event) => {
      const b = event.currentTarget;
      if (!chosen) return;
      if (chosen === (p.validUntil || '').slice(0, 10)) { s.close(); return; }
      b.disabled = true;
      try {
        const data = await OC.api(`/proposals/${p.id}/details`, { method: 'PATCH', body: { validUntil: chosen } });
        s.close();
        OC.toast(`Validade até ${OC.dateFull(chosen)}`);
        ctx.update(data.proposal);
      } catch (error) { OC.toast(error.message, 'warning-circle'); b.disabled = false; }
    });
    paint();
  };
})(window.OC = window.OC || {});
