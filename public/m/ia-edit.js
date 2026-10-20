// Edicao de proposta existente pela IA no celular (espelho de src/renderer/assistant/proposalEdit.ts e
// assistantEditTools.ts; um teste compara os dois). A IA abre uma proposta editavel (ultima revisao, em edicao ou em
// revisao), anota as mudancas num plano em memoria e mostra um cartao com a lista; so o botao "Aplicar alteracoes"
// grava, pelas mesmas rotas do editor. Numeros de item e de mao de obra seguem a lista mostrada ao abrir e nao mudam.
(function (OC) {
  const IA = OC.ia = OC.ia || {};
  const D = IA.draft;
  const E = IA.edit = {};
  const DEFAULT_STANDARD_HOURS = 176;
  const LABOR_ADD_MAX = 20;
  const STATUS = { draft: 'em edição', review: 'em revisão', sent: 'enviada', approved: 'aprovada', rejected: 'recusada' };
  const ID = /^[A-Za-z0-9-]{1,64}$/;

  E.isEditable = (p) => p.isLatest !== false && (p.status === 'draft' || p.status === 'review');

  E.toEditBase = function (p) {
    const standard = Number(p.standardMonthlyHours) > 0 ? Number(p.standardMonthlyHours) : DEFAULT_STANDARD_HOURS;
    return {
      id: p.id, number: p.number, revision: p.revision, status: p.status, clientName: p.clientName, workName: p.workName, scope: p.scope || '',
      validUntil: p.validUntil || null, bdiMultiplier: p.bdiMultiplier === undefined ? null : p.bdiMultiplier, taxPercentage: p.taxPercentage === undefined ? null : p.taxPercentage, standardMonthlyHours: standard,
      items: (p.items || []).map((i) => ({ id: i.id, code: i.code, description: i.description, unit: i.unit, quantity: Number(i.quantity), unitCost: Number(i.unitCost) || 0, unitSale: Number(i.unitSale) || 0, inCatalog: i.inCatalog !== false })),
      labor: (p.laborItems || []).map((l) => ({
        id: l.id, description: l.description, professionalCount: Number(l.professionalCount), monthlySalary: Number(l.monthlySalary), monthlyFood: Number(l.monthlyFood),
        monthlyTransport: Number(l.monthlyTransport), monthlyOtherCosts: Number(l.monthlyOtherCosts), plannedHours: Number(l.plannedHoursPerProfessional ?? l.plannedHours),
        standardMonthlyHours: Number(l.standardMonthlyHours) > 0 ? Number(l.standardMonthlyHours) : standard,
      })),
    };
  };

  E.startPlan = (base) => ({ base, itemUpdates: [], itemRemovals: [], itemAdds: [], laborUpdates: [], laborRemovals: [], laborAdds: [] });

  E.planIsEmpty = (plan) => !plan.scopeParts && plan.validUntil === undefined && plan.bdi === undefined && plan.tax === undefined
    && !plan.itemUpdates.length && !plan.itemRemovals.length && !plan.itemAdds.length && !plan.laborUpdates.length && !plan.laborRemovals.length && !plan.laborAdds.length;

  const itemText = (item) => `${item.code || ''} ${item.description}`;

  // Escopo, condicoes, validade (em dias a partir de hoje), BDI e imposto.
  E.planFields = function (plan, input, now) {
    const scratch = D.setFields({ items: [] }, input);
    const d = scratch.draft;
    const next = { ...plan };
    let parts = plan.scopeParts || D.parseScope(plan.base.scope);
    let touched = false;
    if (input.escopo !== undefined && d.scope !== undefined) { parts = { ...parts, scope: d.scope }; touched = true; }
    if (input.prazo_execucao !== undefined) { parts = { ...parts, executionTerm: d.executionTerm || '' }; touched = true; }
    if (input.pagamento !== undefined) { parts = { ...parts, paymentTerms: d.paymentTerms || '' }; touched = true; }
    if (input.garantia !== undefined) { parts = { ...parts, warranty: d.warranty || '' }; touched = true; }
    if (touched) next.scopeParts = parts;
    if (input.validade_dias !== undefined && d.validityDays) next.validUntil = D.validUntil(d, now);
    if (input.bdi !== undefined && d.bdiMultiplier !== undefined) next.bdi = d.bdiMultiplier;
    if (input.imposto_pct !== undefined && d.taxPercentage !== undefined) next.tax = d.taxPercentage;
    return { plan: next, erros: scratch.erros };
  };

  E.planItems = function (plan, input) {
    const erros = [];
    let updates = plan.itemUpdates.map((u) => ({ id: u.id, patch: { ...u.patch } }));
    let removals = [...plan.itemRemovals];
    for (const change of input.alterar || []) {
      const found = D.findOne(plan.base.items, change.item, itemText, 'item');
      if (found.index === undefined) { erros.push(found.erro); continue; }
      const target = plan.base.items[found.index];
      if (removals.includes(target.id)) { erros.push(`O item ${found.index + 1} já está marcado para remoção.`); continue; }
      const patch = {};
      const at = found.index + 1;
      if (change.quantidade !== undefined) {
        const q = Number(change.quantidade);
        if (Number.isFinite(q) && q > 0 && q <= 1000000) patch.quantity = Math.round(q * 1000) / 1000; else { erros.push(`Quantidade inválida no item ${at}.`); continue; }
      }
      if (change.unidade !== undefined) {
        const u = typeof change.unidade === 'string' ? change.unidade.trim().slice(0, 24) : '';
        if (u) patch.unit = u; else { erros.push(`Unidade inválida no item ${at}.`); continue; }
      }
      if (change.descricao !== undefined) {
        const t = typeof change.descricao === 'string' ? change.descricao.trim().replace(/\s+/g, ' ').slice(0, 240) : '';
        if (t.length >= 2) patch.description = t; else { erros.push(`Descrição inválida no item ${at}.`); continue; }
      }
      if (change.custo_unitario !== undefined) {
        const c = Number(change.custo_unitario);
        if (Number.isFinite(c) && c >= 0 && c <= 100000000) patch.unitCost = Math.round(c * 100) / 100; else { erros.push(`Custo inválido no item ${at}.`); continue; }
      }
      if (!Object.keys(patch).length) { erros.push(`Nada para alterar no item ${at}.`); continue; }
      const existing = updates.find((u) => u.id === target.id);
      if (existing) existing.patch = { ...existing.patch, ...patch }; else updates.push({ id: target.id, patch });
    }
    const drop = D.refIndexes(plan.base.items, input.remover || [], itemText);
    for (const index of drop) {
      const id = plan.base.items[index].id;
      if (!removals.includes(id)) removals.push(id);
      updates = updates.filter((u) => u.id !== id);
    }
    removals = [...new Set(removals)];
    const added = input.adicionar && input.adicionar.length ? D.addItems({ items: plan.itemAdds }, input.adicionar) : { draft: { items: plan.itemAdds }, erros: [] };
    return { plan: { ...plan, itemUpdates: updates, itemRemovals: removals, itemAdds: added.draft.items }, erros: [...erros, ...added.erros] };
  };

  E.planLabor = function (plan, input) {
    const erros = [];
    const updates = plan.laborUpdates.map((u) => ({ id: u.id, labor: { ...u.labor } }));
    let removals = [...plan.laborRemovals];
    let adds = [...plan.laborAdds];
    const text = (l) => l.description;
    for (const change of input.alterar || []) {
      const found = D.findOne(plan.base.labor, change.item, text, 'mão de obra');
      if (found.index === undefined) { erros.push(found.erro); continue; }
      const target = plan.base.labor[found.index];
      if (removals.includes(target.id)) { erros.push(`A mão de obra ${found.index + 1} já está marcada para remoção.`); continue; }
      const existing = updates.find((u) => u.id === target.id);
      const result = D.normalizeLabor(change, existing ? existing.labor : target);
      if (!result.labor) { erros.push(result.erro); continue; }
      if (existing) existing.labor = result.labor; else updates.push({ id: target.id, labor: result.labor });
    }
    for (const index of D.refIndexes(plan.base.labor, input.remover || [], text)) {
      const id = plan.base.labor[index].id;
      if (!removals.includes(id)) removals.push(id);
    }
    removals = [...new Set(removals)];
    for (const raw of input.adicionar || []) {
      const result = D.normalizeLabor(raw);
      if (!result.labor) { erros.push(result.erro); continue; }
      const key = result.labor.description.toLowerCase();
      const same = adds.findIndex((l) => l.description.toLowerCase() === key);
      if (same >= 0) { adds[same] = result.labor; continue; }
      // O limite avisa em vez de descartar em silencio: o cartao final nao pode omitir trabalho pedido.
      if (adds.length >= LABOR_ADD_MAX) { erros.push(`Limite de ${LABOR_ADD_MAX} inclusões de mão de obra por alteração; "${result.labor.description}" não entrou.`); continue; }
      adds.push(result.labor);
    }
    return { plan: { ...plan, laborUpdates: updates.filter((u) => !removals.includes(u.id)), laborRemovals: removals, laborAdds: adds }, erros };
  };

  const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const num = (n) => String(n).replace('.', ',');
  const dateBr = (iso) => iso.split('-').reverse().join('/');

  // Lista legivel das mudancas (vai para o cartao e para o modelo).
  E.describePlan = function (plan) {
    const lines = [];
    if (plan.scopeParts) {
      const before = D.parseScope(plan.base.scope);
      const now = plan.scopeParts;
      if (now.scope !== before.scope) lines.push(`Escopo: ${now.scope}`);
      if (now.executionTerm !== before.executionTerm) lines.push(`Prazo de execução: ${now.executionTerm || '(removido)'}`);
      if (now.paymentTerms !== before.paymentTerms) lines.push(`Pagamento: ${now.paymentTerms || '(removido)'}`);
      if (now.warranty !== before.warranty) lines.push(`Garantia: ${now.warranty || '(removida)'}`);
    }
    if (plan.validUntil !== undefined) lines.push(`Validade: até ${dateBr(plan.validUntil)}`);
    if (plan.bdi !== undefined) lines.push(`BDI: ${num(plan.bdi)}`);
    if (plan.tax !== undefined) lines.push(`Imposto: ${num(plan.tax)}%`);
    const itemRef = (id) => { const index = plan.base.items.findIndex((i) => i.id === id); return `item ${index + 1} (${plan.base.items[index] ? plan.base.items[index].description : '?'})`; };
    for (const { id, patch } of plan.itemUpdates) {
      const was = plan.base.items.find((i) => i.id === id);
      const changes = [];
      if (patch.quantity !== undefined) changes.push(`quantidade ${num(was ? was.quantity : 0)} → ${num(patch.quantity)}`);
      if (patch.unit !== undefined) changes.push(`unidade ${was ? was.unit : ''} → ${patch.unit}`);
      if (patch.description !== undefined) changes.push(`descrição → ${patch.description}`);
      if (patch.unitCost !== undefined) changes.push(`custo ${brl(was ? was.unitCost : 0)} → ${brl(patch.unitCost)}`);
      lines.push(`Alterar ${itemRef(id)}: ${changes.join('; ')}`);
    }
    for (const id of plan.itemRemovals) lines.push(`Remover ${itemRef(id)}`);
    for (const item of plan.itemAdds) lines.push(`Adicionar ${num(item.quantity)} ${item.unit} · ${item.description}${item.code ? ' (catálogo)' : item.unitCost !== undefined ? ` (custo ${brl(item.unitCost)})` : ' (sem preço)'}`);
    const laborRef = (id) => { const index = plan.base.labor.findIndex((l) => l.id === id); return `mão de obra ${index + 1} (${plan.base.labor[index] ? plan.base.labor[index].description : '?'})`; };
    for (const { id, labor } of plan.laborUpdates) lines.push(`Alterar ${laborRef(id)}: ${labor.description}, ${num(labor.professionalCount)} prof., salário ${brl(labor.monthlySalary)}, ${num(labor.plannedHours)} h cada`);
    for (const id of plan.laborRemovals) lines.push(`Remover ${laborRef(id)}`);
    for (const labor of plan.laborAdds) lines.push(`Adicionar mão de obra: ${labor.description}, ${num(labor.professionalCount)} prof., salário ${brl(labor.monthlySalary)}, ${num(labor.plannedHours)} h cada`);
    return lines;
  };

  // Visao para o modelo ao abrir: numeros das listas; custos so quando a pessoa pode ve-los.
  E.describeBase = function (base, seesCost) {
    const parts = D.parseScope(base.scope);
    return {
      proposta: { numero: base.number, revisao: base.revision, situacao: base.status, cliente: base.clientName, obra: base.workName, validade: base.validUntil },
      escopo: parts.scope, prazo_execucao: parts.executionTerm, pagamento: parts.paymentTerms, garantia: parts.warranty, observacoes: seesCost ? parts.notes : undefined,
      bdi: seesCost ? base.bdiMultiplier : undefined,
      imposto_pct: seesCost ? base.taxPercentage : undefined,
      itens: base.items.map((i, index) => ({ numero: index + 1, codigo: i.inCatalog ? i.code : null, descricao: i.description, unidade: i.unit, quantidade: i.quantity, custo_unitario: seesCost ? i.unitCost : undefined })),
      mao_de_obra: base.labor.map((l, index) => ({ numero: index + 1, descricao: l.description, profissionais: l.professionalCount, horas_por_profissional: l.plannedHours, salario_mensal: seesCost ? l.monthlySalary : undefined })),
    };
  };

  const message = (error, fallback) => (error && error.message ? error.message : fallback);

  // Grava o plano na ordem certa (BDI antes dos itens novos) e para no primeiro erro, devolvendo o que falta.
  E.applyPlan = async function (input) {
    let plan = input;
    const id = plan.base.id;
    const aplicado = [];
    const steps = [];
    const api = (path, method, body) => OC.api(`/proposals/${id}${path}`, { method, body });
    if (plan.scopeParts || plan.validUntil !== undefined) {
      const { scopeParts, validUntil } = plan;
      steps.push({ label: 'Escopo, condições e validade', run: () => api('/details', 'PATCH', { ...(scopeParts ? { scope: D.packScope(scopeParts) } : {}), ...(validUntil !== undefined ? { validUntil } : {}) }),
        strip: (p) => ({ ...p, scopeParts: undefined, validUntil: undefined }) });
    }
    if (plan.bdi !== undefined) { const v = plan.bdi; steps.push({ label: 'BDI', run: () => api('/bdi', 'PATCH', { bdiMultiplier: v }), strip: (p) => ({ ...p, bdi: undefined }) }); }
    if (plan.tax !== undefined) { const v = plan.tax; steps.push({ label: 'Imposto', run: () => api('/tax', 'PATCH', { taxPercentage: v }), strip: (p) => ({ ...p, tax: undefined }) }); }
    for (const update of plan.itemUpdates) {
      steps.push({ label: 'Alterar item', run: () => api(`/items/${update.id}`, 'PATCH', update.patch), strip: (p) => ({ ...p, itemUpdates: p.itemUpdates.filter((u) => u.id !== update.id) }) });
    }
    if (plan.itemRemovals.length) {
      const ids = plan.itemRemovals;
      steps.push({ label: 'Remover itens', run: () => api('/items/remove', 'POST', { itemIds: ids }), strip: (p) => ({ ...p, itemRemovals: [] }) });
    }
    if (plan.itemAdds.length) {
      const adds = plan.itemAdds;
      steps.push({ label: 'Adicionar itens', strip: (p) => ({ ...p, itemAdds: [] }), run: () => api('/items/import-batch', 'POST', { items: adds.map((item) => (item.code
        ? { code: item.code, description: item.description, quantity: item.quantity }
        : item.unitCost !== undefined
          ? { description: item.description, unit: item.unit, quantity: item.quantity, unitCost: item.unitCost }
          : { description: item.description, unit: item.unit, quantity: item.quantity, unitCost: 0, unitSale: 0 })) }) });
    }
    const laborInput = (l, hours) => ({ description: l.description, professionalCount: l.professionalCount, monthlySalary: l.monthlySalary, monthlyFood: l.monthlyFood,
      monthlyTransport: l.monthlyTransport, monthlyOtherCosts: l.monthlyOtherCosts, standardMonthlyHours: hours, plannedHours: l.plannedHours });
    for (const update of plan.laborUpdates) {
      const found = plan.base.labor.find((l) => l.id === update.id);
      const hours = found ? found.standardMonthlyHours : plan.base.standardMonthlyHours;
      steps.push({ label: 'Alterar mão de obra', run: () => api(`/labor/${update.id}`, 'PATCH', laborInput(update.labor, hours)), strip: (p) => ({ ...p, laborUpdates: p.laborUpdates.filter((u) => u.id !== update.id) }) });
    }
    for (const laborId of plan.laborRemovals) {
      steps.push({ label: 'Remover mão de obra', run: () => api(`/labor/${laborId}/remove`, 'POST'), strip: (p) => ({ ...p, laborRemovals: p.laborRemovals.filter((x) => x !== laborId) }) });
    }
    for (const labor of plan.laborAdds) {
      steps.push({ label: 'Adicionar mão de obra', run: () => api('/labor', 'POST', laborInput(labor, plan.base.standardMonthlyHours)), strip: (p) => ({ ...p, laborAdds: p.laborAdds.filter((l) => l !== labor) }) });
    }
    for (const step of steps) {
      try {
        await step.run();
        plan = step.strip(plan);
        aplicado.push(step.label);
      } catch (error) {
        return { plan, aplicado, erro: `${step.label}: ${message(error, 'não consegui gravar')}.${aplicado.length ? ` Já aplicado: ${aplicado.join(', ')}.` : ''}` };
      }
    }
    return { plan, aplicado };
  };

  // ---- Ferramentas do assistente (nada e gravado aqui; finalizar_edicao so liga o cartao de conferencia).
  const NO_EDIT = { erro: 'Seu perfil só consulta; não edita propostas.' };
  const NO_COST = 'Seu perfil não vê nem define custo, BDI e imposto; esses valores se alteram no editor.';
  const NO_LABOR = 'Seu perfil não vê nem define custo, e a mão de obra é custo; ela se cadastra no editor.';
  const NO_PLAN = { erro: 'Abra uma proposta primeiro com editar_abrir (use listar_propostas para achar o id).' };

  E.tools = function (deps) {
    let plan = null;
    let confirm = false;
    const hasCost = (list, key) => Array.isArray(list) && list.some((raw) => raw && typeof raw === 'object' && raw[key] != null);
    const list = (value) => (Array.isArray(value) ? value.slice(0, 20) : []);
    const run = {
      async editar_abrir(a) {
        if (!deps.canEdit()) return NO_EDIT;
        const id = typeof a.proposta_id === 'string' ? a.proposta_id : '';
        if (!ID.test(id)) return { erro: 'Informe proposta_id (use listar_propostas).' };
        const p = (await OC.api(`/proposals/${encodeURIComponent(id)}`)).proposal || {};
        if (!E.isEditable(p)) {
          return { erro: `A proposta ${p.number} (REV ${String(p.revision).padStart(2, '0')}) está ${STATUS[p.status] || p.status}${p.isLatest === false ? ' e não é a revisão atual' : ''}: só a revisão atual em edição ou em revisão pode ser alterada por aqui. Peça para reabrir ou criar uma revisão no editor.` };
        }
        plan = E.startPlan(E.toEditBase(p));
        confirm = false;
        return { ok: true, ...E.describeBase(plan.base, deps.seesCost()) };
      },
      async editar_campos(a) {
        if (!deps.canEdit()) return NO_EDIT;
        if (!plan) return NO_PLAN;
        if ((a.bdi !== undefined || a.imposto_pct !== undefined) && !deps.seesCost()) return { erro: NO_COST };
        const result = E.planFields(plan, { escopo: a.escopo, prazo_execucao: a.prazo_execucao, pagamento: a.pagamento, garantia: a.garantia, validade_dias: a.validade_dias, bdi: a.bdi, imposto_pct: a.imposto_pct });
        plan = result.plan; confirm = false;
        return { ok: true, ...(result.erros.length ? { erros: result.erros } : {}), mudancas: E.describePlan(plan) };
      },
      async editar_itens(a) {
        if (!deps.canEdit()) return NO_EDIT;
        if (!plan) return NO_PLAN;
        if ((hasCost(a.alterar, 'custo_unitario') || hasCost(a.adicionar, 'custo_unitario')) && !deps.seesCost()) return { erro: NO_COST };
        const erros = [];
        const wanted = [];
        for (const raw of Array.isArray(a.adicionar) ? a.adicionar.slice(0, 30) : []) {
          const input = raw && typeof raw === 'object' ? raw : {};
          const code = typeof input.codigo === 'string' ? input.codigo.trim() : '';
          if (!code) { wanted.push({ input }); continue; }
          const hit = await deps.catalogHit(code);
          if (hit) wanted.push({ input, hit }); else erros.push(`Código "${code}" não existe no catálogo. Use buscar_catalogo ou envie só a descrição para entrar como item avulso sem preço.`);
        }
        const result = E.planItems(plan, { alterar: Array.isArray(a.alterar) ? a.alterar.slice(0, 30) : [], remover: Array.isArray(a.remover) ? a.remover.slice(0, 30) : [], adicionar: wanted });
        plan = result.plan; confirm = false;
        const all = [...erros, ...result.erros];
        return { ok: true, ...(all.length ? { erros: all } : {}), mudancas: E.describePlan(plan) };
      },
      async editar_mao_de_obra(a) {
        if (!deps.canEdit()) return NO_EDIT;
        if (!plan) return NO_PLAN;
        if (!deps.seesCost()) return { erro: NO_LABOR };
        const result = E.planLabor(plan, { adicionar: list(a.adicionar), alterar: list(a.alterar), remover: list(a.remover) });
        plan = result.plan; confirm = false;
        return { ok: true, ...(result.erros.length ? { erros: result.erros } : {}), mudancas: E.describePlan(plan) };
      },
      async editar_ver() {
        if (!plan) return NO_PLAN;
        return { proposta: `${plan.base.number} REV ${String(plan.base.revision).padStart(2, '0')}`, mudancas: E.describePlan(plan) };
      },
      async editar_descartar() {
        plan = null; confirm = false;
        return { ok: true };
      },
      async finalizar_edicao() {
        if (!deps.canEdit()) return NO_EDIT;
        if (!plan) return NO_PLAN;
        if (E.planIsEmpty(plan)) return { erro: 'Ainda não há nenhuma mudança anotada. Pergunte à pessoa o que alterar.' };
        confirm = true;
        return { ok: true, aviso: 'Nada foi alterado ainda. Um cartão com a lista de mudanças aparece quando você terminar de responder. Peça que a pessoa confira e toque em Aplicar alterações.' };
      },
    };

    const declarations = (S) => {
      const itemFields = {
        item: S.string({ description: 'número do item (como na lista de editar_abrir) ou trecho da descrição' }), quantidade: S.number({ description: 'nova quantidade' }),
        unidade: S.string({ description: 'nova unidade' }), descricao: S.string({ description: 'nova descrição' }),
        custo_unitario: S.number({ description: 'novo custo unitário em reais; só se a pessoa disse o valor' }),
      };
      const laborFields = {
        descricao: S.string({ description: 'função, ex.: Eletricista' }), profissionais: S.number({ description: 'quantidade de profissionais' }),
        salario_mensal: S.number({ description: 'salário mensal de cada profissional, em reais' }), alimentacao_mensal: S.number({ description: 'alimentação mensal' }),
        transporte_mensal: S.number({ description: 'transporte mensal' }), outros_custos_mensais: S.number({ description: 'outros custos mensais' }),
        horas_por_profissional: S.number({ description: 'horas previstas por profissional na obra' }),
      };
      return [
        { name: 'editar_abrir', description: 'Abre uma proposta existente para alterar (nada é gravado). Só a revisão atual em edição ou em revisão. Devolve os itens e a mão de obra numerados. Use listar_propostas antes para achar o id.',
          parameters: S.object({ properties: { proposta_id: S.string({ description: 'id da proposta' }) } }) },
        { name: 'editar_campos', description: 'Anota mudança de escopo, prazo, pagamento, garantia, validade (em dias a partir de hoje), BDI (multiplicador: 25% vira 1,25) ou imposto (%). Só o que a pessoa pediu. BDI e imposto só para quem vê custo.',
          parameters: S.object({ properties: {
            escopo: S.string({ description: 'novo escopo (3 a 1200 letras)' }), prazo_execucao: S.string({ description: 'prazo de execução; texto vazio remove' }),
            pagamento: S.string({ description: 'condição de pagamento; texto vazio remove' }), garantia: S.string({ description: 'garantia; texto vazio remove' }),
            validade_dias: S.integer({ description: 'nova validade em dias a partir de hoje (1 a 365)' }), bdi: S.number({ description: 'BDI como multiplicador' }), imposto_pct: S.number({ description: 'imposto em %' }),
          }, optionalProperties: ['escopo', 'prazo_execucao', 'pagamento', 'garantia', 'validade_dias', 'bdi', 'imposto_pct'] }) },
        { name: 'editar_itens', description: 'Anota alteração, remoção ou inclusão de itens da proposta aberta. alterar e remover usam o número da lista de editar_abrir. adicionar: com codigo vem do catálogo; sem codigo é item avulso (só anote custo_unitario se a pessoa disse o valor).',
          parameters: S.object({ properties: {
            alterar: S.array({ description: 'itens a alterar', items: S.object({ properties: itemFields, optionalProperties: ['quantidade', 'unidade', 'descricao', 'custo_unitario'] }) }),
            remover: S.array({ description: 'número do item ou trecho da descrição', items: S.string() }),
            adicionar: S.array({ description: 'itens novos', items: S.object({ properties: {
              codigo: S.string({ description: 'código exato do catálogo' }), descricao: S.string({ description: 'descrição (sem codigo)' }), unidade: S.string({ description: 'un, m, m²...' }),
              quantidade: S.number({ description: 'quantidade maior que zero' }), custo_unitario: S.number({ description: 'custo unitário que a pessoa informou, só item avulso' }),
            }, optionalProperties: ['codigo', 'descricao', 'unidade', 'custo_unitario'] }) }),
          }, optionalProperties: ['alterar', 'remover', 'adicionar'] }) },
        { name: 'editar_mao_de_obra', description: 'Anota inclusão, alteração ou remoção de mão de obra da proposta aberta (só para quem vê custo). Nova exige descricao, profissionais, salario_mensal e horas_por_profissional; alimentação, transporte e outros custos são opcionais (0). alterar e remover usam o número da lista.',
          parameters: S.object({ properties: {
            adicionar: S.array({ description: 'mão de obra nova', items: S.object({ properties: laborFields, optionalProperties: ['alimentacao_mensal', 'transporte_mensal', 'outros_custos_mensais'] }) }),
            alterar: S.array({ description: 'mão de obra a alterar', items: S.object({ properties: { item: S.string({ description: 'número da mão de obra ou trecho da descrição' }), ...laborFields }, optionalProperties: ['descricao', 'profissionais', 'salario_mensal', 'alimentacao_mensal', 'transporte_mensal', 'outros_custos_mensais', 'horas_por_profissional'] }) }),
            remover: S.array({ description: 'número ou trecho da descrição', items: S.string() }),
          }, optionalProperties: ['adicionar', 'alterar', 'remover'] }) },
        { name: 'editar_ver', description: 'Mostra a lista de mudanças anotadas até agora na proposta aberta.', parameters: S.object({ properties: {} }) },
        { name: 'editar_descartar', description: 'Descarta as mudanças anotadas e fecha a edição (quando a pessoa desistir).', parameters: S.object({ properties: {} }) },
        { name: 'finalizar_edicao', description: 'Pede a confirmação da pessoa para aplicar as mudanças. Não altera nada: aparece um botão para ela.', parameters: S.object({ properties: {} }) },
      ];
    };

    return {
      run,
      declarations,
      clearConfirm() { confirm = false; },
      takeConfirm() { const out = confirm ? plan : null; confirm = false; return out; },
      getPlan() { return plan; },
      // Depois de aplicar: guarda o que sobrou (nova tentativa nao repete) ou, com `done`, fecha a edicao.
      setPlan(next, done) { plan = done ? null : next; },
      reset() { plan = null; confirm = false; },
    };
  };
})(window.OC = window.OC || {});
