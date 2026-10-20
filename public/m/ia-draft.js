// Rascunho de proposta montado pela IA no celular (espelho de src/renderer/assistant/proposalDraft.ts e
// assistantCommit.ts; um teste compara os dois). Fica so na memoria da pagina: nada e gravado ate a pessoa
// tocar em "Criar proposta". A IA nunca define preco, custo, BDI nem imposto: vem dos padroes da empresa.
(function (OC) {
  const IA = OC.ia = OC.ia || {};
  const MAX_ITEMS = 60;
  const SCOPE_MIN = 3;
  const SCOPE_MAX = 1200;
  const SHORT_MAX = 300;
  const text = (value, max) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '');
  const plain = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const round3 = (v) => Math.round(v * 1000) / 1000;

  const D = IA.draft = {};
  D.empty = () => ({ items: [] });

  D.setFields = function (draft, input) {
    const next = { ...draft };
    const erros = [];
    if (input.escopo !== undefined) {
      const value = text(input.escopo, SCOPE_MAX);
      if (value.length < SCOPE_MIN) erros.push(`O escopo precisa de ao menos ${SCOPE_MIN} letras.`); else next.scope = value;
    }
    if (input.prazo_execucao !== undefined) next.executionTerm = text(input.prazo_execucao, SHORT_MAX) || undefined;
    if (input.pagamento !== undefined) next.paymentTerms = text(input.pagamento, SHORT_MAX) || undefined;
    if (input.garantia !== undefined) next.warranty = text(input.garantia, SHORT_MAX) || undefined;
    if (input.validade_dias !== undefined) {
      const days = Number(input.validade_dias);
      if (Number.isInteger(days) && days >= 1 && days <= 365) next.validityDays = days; else erros.push('A validade vai de 1 a 365 dias.');
    }
    if (input.modelo !== undefined) {
      if (input.modelo === 'servico' || input.modelo === 'fornecimento') next.model = input.modelo; else erros.push('O modelo é "servico" ou "fornecimento".');
    }
    if (input.bdi !== undefined) {
      const bdi = Number(input.bdi);
      if (Number.isFinite(bdi) && bdi >= 1 && bdi <= 100) next.bdiMultiplier = Math.round(bdi * 10000) / 10000; else erros.push('O BDI é um multiplicador de 1 a 100 (25% vira 1,25).');
    }
    if (input.imposto_pct !== undefined) {
      const tax = Number(input.imposto_pct);
      if (Number.isFinite(tax) && tax >= 0 && tax <= 100) next.taxPercentage = Math.round(tax * 100) / 100; else erros.push('O imposto vai de 0 a 100 (em %).');
    }
    return { draft: next, erros };
  };

  D.withClient = function (draft, client) {
    // Repetir o mesmo cliente (a IA costuma reenviar) nao pode apagar a obra ja escolhida.
    if (client.id && draft.clientId === client.id) return { ...draft, clientName: client.name };
    const cleared = { ...draft, clientId: undefined, clientName: undefined, newClient: undefined, workId: undefined, workName: undefined, workAddress: undefined, newWork: undefined };
    return client.id ? { ...cleared, clientId: client.id, clientName: client.name } : { ...cleared, clientName: client.newName, newClient: true };
  };

  D.withWork = function (draft, work) {
    const base = { ...draft, workId: undefined, workName: undefined, workAddress: undefined, newWork: undefined };
    return work.id ? { ...base, workId: work.id, workName: work.name } : { ...base, workName: work.newName, workAddress: work.address || undefined, newWork: true };
  };

  D.addItems = function (draft, inputs) {
    const items = [...draft.items];
    const erros = [];
    for (const { input, hit } of inputs) {
      const quantity = Number(input.quantidade);
      const label = text(input.codigo, 80) || text(input.descricao, 80) || 'item';
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000) { erros.push(`Quantidade inválida em "${label}".`); continue; }
      const qty = round3(quantity);
      const description = hit ? hit.description : text(input.descricao, 240);
      if (description.length < 2) { erros.push(`Informe a descrição de "${label}".`); continue; }
      const unit = (hit ? hit.unit : text(input.unidade, 24)) || 'un';
      const code = hit ? hit.code : undefined;
      let unitCost;
      if (input.custo_unitario !== undefined && input.custo_unitario !== null) {
        const cost = Number(input.custo_unitario);
        if (hit) { erros.push(`"${label}" é do catálogo e usa o custo do catálogo; o custo informado foi ignorado.`); } else if (Number.isFinite(cost) && cost >= 0 && cost <= 100000000) unitCost = Math.round(cost * 100) / 100;
        else { erros.push(`Custo inválido em "${label}".`); continue; }
      }
      const same = items.findIndex((item) => (code ? item.code === code : !item.code && plain(item.description) === plain(description)));
      // Item que ja esta no rascunho: a quantidade dita agora vale ("na verdade sao 6"), nao soma com a anterior.
      if (same >= 0) { items[same] = { ...items[same], quantity: qty, ...(unitCost !== undefined ? { unitCost } : {}) }; continue; }
      if (items.length >= MAX_ITEMS) { erros.push(`Limite de ${MAX_ITEMS} itens por rascunho.`); break; }
      items.push({ code, description, unit, quantity: qty, ...(unitCost !== undefined ? { unitCost } : {}) });
    }
    return { draft: { ...draft, items }, erros };
  };

  // Posicoes (0, 1...) de uma lista citadas por numero (1, 2...) ou por trecho do texto. O modelo manda o numero como texto ("2") ou numero: os dois valem.
  D.refIndexes = function (list, refs, textOf) {
    const found = new Set();
    for (const ref of refs) {
      const asNumber = typeof ref === 'string' && /^\s*\d{1,3}\s*$/.test(ref) ? Number(ref) : ref;
      if (typeof asNumber === 'number' && Number.isInteger(asNumber)) { if (asNumber >= 1 && asNumber <= list.length) found.add(asNumber - 1); continue; }
      const term = plain(typeof ref === 'string' ? ref : '');
      if (term.length < 2) continue;
      list.forEach((item, index) => { if (plain(textOf(item)).includes(term)) found.add(index); });
    }
    return found;
  };

  // Um unico item da lista pelo numero ou trecho; devolve o erro (para a IA perguntar) se nao achar ou se houver varios.
  D.findOne = function (list, ref, textOf, label) {
    const hits = [...D.refIndexes(list, [ref], textOf)];
    if (hits.length === 1) return { index: hits[0] };
    if (hits.length === 0) return { erro: `Não achei ${label} "${String(ref)}". Use o número da lista.` };
    return { erro: `"${String(ref)}" combina com ${hits.length} resultados (${hits.map((i) => i + 1).join(', ')}). Pergunte qual, ou use o número.` };
  };

  D.removeItems = function (draft, refs) {
    const drop = D.refIndexes(draft.items, refs, (item) => `${item.code || ''} ${item.description}`);
    return { draft: { ...draft, items: draft.items.filter((_, index) => !drop.has(index)) }, removidos: drop.size };
  };

  const LABOR_MAX = 20;
  const money = (value, max = 100000000) => {
    if (value === undefined || value === null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 100) / 100 : Number.NaN;
  };

  // Valida uma mao de obra. Sem `base` (nova) exige descricao, profissionais, salario e horas; com `base` (alteracao) so troca o que veio.
  D.normalizeLabor = function (input, base) {
    const label = text(input.descricao, 160) || (base && base.description) || 'mão de obra';
    const description = input.descricao !== undefined ? text(input.descricao, 160) : (base ? base.description : '');
    if (description.length < 2) return { erro: 'Informe a descrição da mão de obra.' };
    const num = (key, current, positive, max, name) => {
      if (input[key] === undefined || input[key] === null || input[key] === '') return current === undefined ? { erro: name } : { value: current };
      const n = money(input[key], max);
      if (n === null || Number.isNaN(n) || (positive && n <= 0)) return { erro: `${name} inválido(a)` };
      return { value: n };
    };
    const count = num('profissionais', base && base.professionalCount, true, 1000, 'profissionais');
    const salary = num('salario_mensal', base && base.monthlySalary, false, 100000000, 'salário mensal');
    const hours = num('horas_por_profissional', base && base.plannedHours, false, 1000000, 'horas por profissional');
    const missingNames = [count, salary, hours].filter((x) => x.erro).map((x) => x.erro);
    if (missingNames.length) return { erro: `Mão de obra "${label}": informe ou corrija ${missingNames.join(', ')}.` };
    const optional = (key, current, name) => {
      if (input[key] === undefined || input[key] === null || input[key] === '') return { value: current === undefined ? 0 : current };
      const n = money(input[key]);
      return n === null || Number.isNaN(n) ? { erro: `${name} inválido(a)` } : { value: n };
    };
    const food = optional('alimentacao_mensal', base && base.monthlyFood, 'alimentação');
    const transport = optional('transporte_mensal', base && base.monthlyTransport, 'transporte');
    const other = optional('outros_custos_mensais', base && base.monthlyOtherCosts, 'outros custos');
    const bad = [food, transport, other].find((x) => x.erro);
    if (bad) return { erro: `Mão de obra "${label}": ${bad.erro}.` };
    return { labor: { description, professionalCount: count.value, monthlySalary: salary.value, monthlyFood: food.value, monthlyTransport: transport.value, monthlyOtherCosts: other.value, plannedHours: hours.value } };
  };

  D.addLabor = function (draft, inputs) {
    const list = [...(draft.labor || [])];
    const erros = [];
    for (const input of inputs) {
      const result = D.normalizeLabor(input);
      if (!result.labor) { erros.push(result.erro); continue; }
      const same = list.findIndex((item) => plain(item.description) === plain(result.labor.description));
      if (same >= 0) { list[same] = result.labor; continue; } // repetir a mesma mao de obra corrige os valores
      if (list.length >= LABOR_MAX) { erros.push(`Limite de ${LABOR_MAX} mãos de obra por rascunho.`); break; }
      list.push(result.labor);
    }
    return { draft: { ...draft, labor: list }, erros };
  };

  D.removeLabor = function (draft, refs) {
    const list = draft.labor || [];
    const drop = D.refIndexes(list, refs, (item) => item.description);
    return { draft: { ...draft, labor: list.filter((_, index) => !drop.has(index)) }, removidos: drop.size };
  };

  // Le o campo `scope` da proposta: JSON de condicoes ou texto puro (que vira so o escopo).
  D.parseScope = function (raw) {
    const str = (v) => (typeof v === 'string' ? v : '');
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && typeof parsed.scope === 'string') {
        return { scope: parsed.scope, executionTerm: str(parsed.executionTerm), paymentTerms: str(parsed.paymentTerms), warranty: str(parsed.warranty), notes: str(parsed.notes) };
      }
    } catch { /* texto puro */ }
    return { scope: raw, executionTerm: '', paymentTerms: '', warranty: '', notes: '' };
  };

  // Texto do campo `scope`: puro se so ha escopo; JSON de condicoes quando ha mais. O limite de 1200 vale para o JSON ja escapado.
  D.packScope = function (input) {
    const parts = { ...input };
    if (!parts.executionTerm && !parts.paymentTerms && !parts.warranty && !parts.notes) return parts.scope;
    // Corta o maior texto ate caber (aspas e barras crescem no JSON). O escopo nunca passa de SCOPE_MIN letras; o resto pode ir a zero.
    for (let json = JSON.stringify(parts); json.length > SCOPE_MAX; json = JSON.stringify(parts)) {
      const cut = Math.max(1, Math.ceil((json.length - SCOPE_MAX) / 2));
      const longest = ['scope', 'executionTerm', 'paymentTerms', 'warranty', 'notes']
        .filter((key) => parts[key].length > (key === 'scope' ? SCOPE_MIN : 0))
        .sort((x, y) => parts[y].length - parts[x].length)[0];
      parts[longest] = parts[longest].slice(0, Math.max(longest === 'scope' ? SCOPE_MIN : 0, parts[longest].length - cut));
    }
    return JSON.stringify(parts);
  };

  D.missing = function (draft) {
    const out = [];
    if (!draft.clientName) out.push('cliente');
    if (!draft.workName) out.push('obra');
    if (!draft.scope) out.push('escopo');
    return out;
  };

  D.scopeForSave = function (draft) {
    return D.packScope({ scope: draft.scope || '', executionTerm: draft.executionTerm || '', paymentTerms: draft.paymentTerms || '', warranty: draft.warranty || '', notes: '' });
  };

  D.validUntil = function (draft, now) {
    if (!draft.validityDays) return null;
    const brasilia = new Date((now || new Date()).getTime() - 3 * 3600000);
    brasilia.setUTCDate(brasilia.getUTCDate() + draft.validityDays);
    return brasilia.toISOString().slice(0, 10);
  };

  D.summary = function (draft) {
    return {
      cliente: draft.clientName ? { nome: draft.clientName, situacao: draft.newClient ? 'novo cadastro' : 'já cadastrado' } : null,
      obra: draft.workName ? { nome: draft.workName, endereco: draft.workAddress || null, situacao: draft.newWork ? 'nova obra' : 'já cadastrada' } : null,
      escopo: draft.scope || null,
      prazo_execucao: draft.executionTerm || null,
      pagamento: draft.paymentTerms || null,
      garantia: draft.warranty || null,
      validade_dias: draft.validityDays || null,
      modelo: draft.model || null,
      bdi: draft.bdiMultiplier ?? null,
      imposto_pct: draft.taxPercentage ?? null,
      itens: draft.items.map((item, index) => ({
        numero: index + 1, codigo: item.code || null, descricao: item.description, unidade: item.unit, quantidade: item.quantity,
        custo_unitario: item.unitCost ?? null, preco: item.code ? 'do catálogo' : item.unitCost !== undefined ? 'custo informado' : 'sem preço (avulso)',
      })),
      mao_de_obra: (draft.labor || []).map((l, index) => ({
        numero: index + 1, descricao: l.description, profissionais: l.professionalCount, salario_mensal: l.monthlySalary, alimentacao_mensal: l.monthlyFood,
        transporte_mensal: l.monthlyTransport, outros_custos_mensais: l.monthlyOtherCosts, horas_por_profissional: l.plannedHours,
      })),
      falta: D.missing(draft),
    };
  };

  // Cria de verdade, so quando a pessoa toca em "Criar proposta" (a IA nao chama isto). Mesmas rotas da tela Nova proposta.
  // Se algo falhar no meio, o rascunho devolvido guarda o que ja foi criado: a segunda tentativa nao duplica cadastro.
  D.commit = async function (input, now) {
    let draft = { ...input };
    const falta = D.missing(draft);
    if (falta.length) return { draft, erro: `Falta informar: ${falta.join(', ')}.` };
    const msg = (error, fallback) => (error && error.message ? error.message : fallback);
    try {
      if (!draft.clientId) {
        const { clientId } = await OC.api('/clients', { method: 'POST', body: { legalName: draft.clientName, tradeName: null, document: null } });
        draft = { ...draft, clientId, newClient: false };
      }
      if (!draft.workId) {
        const { workId } = await OC.api(`/clients/${draft.clientId}/works`, { method: 'POST', body: { name: draft.workName, address: draft.workAddress || null } });
        draft = { ...draft, workId, newWork: false };
      }
    } catch (error) {
      return { draft, erro: msg(error, 'Não consegui cadastrar o cliente ou a obra.') };
    }
    let proposalId;
    try {
      const body = { clientId: draft.clientId, workId: draft.workId, scope: D.scopeForSave(draft), validUntil: D.validUntil(draft, now) };
      if (draft.model) body.bodyModel = draft.model;
      proposalId = (await OC.api('/proposals', { method: 'POST', body })).proposal.id;
    } catch (error) {
      return { draft, erro: msg(error, 'Não consegui criar a proposta.') };
    }
    // BDI e imposto antes dos itens: o preco de venda de cada item nasce com o BDI da proposta.
    try {
      if (draft.bdiMultiplier !== undefined) await OC.api(`/proposals/${proposalId}/bdi`, { method: 'PATCH', body: { bdiMultiplier: draft.bdiMultiplier } });
      if (draft.taxPercentage !== undefined) await OC.api(`/proposals/${proposalId}/tax`, { method: 'PATCH', body: { taxPercentage: draft.taxPercentage } });
    } catch (error) {
      return { draft, proposalId, aviso: `A proposta foi criada, mas o BDI ou o imposto não foram aplicados e os itens não entraram (${msg(error, 'erro')}). Ajuste no editor.` };
    }
    if (draft.items.length) {
      try {
        await OC.api(`/proposals/${proposalId}/items/import-batch`, { method: 'POST', body: { items: draft.items.map((item) => (item.code
          ? { code: item.code, description: item.description, quantity: item.quantity }
          : item.unitCost !== undefined
            ? { description: item.description, unit: item.unit, quantity: item.quantity, unitCost: item.unitCost }
            : { description: item.description, unit: item.unit, quantity: item.quantity, unitCost: 0, unitSale: 0 })) } });
      } catch (error) {
        return { draft, proposalId, aviso: `A proposta foi criada, mas os itens não entraram (${msg(error, 'erro ao importar')}). Adicione-os no editor.` };
      }
    }
    // Mao de obra por ultimo, com as horas-padrao da proposta; se falhar, a proposta e os itens ja existem.
    if (draft.labor && draft.labor.length) {
      // Cada uma e gravada separada: se uma falhar, o aviso diz quais ja entraram e quais faltam (adicionar todas de novo duplicaria custo).
      const saved = [];
      let current = draft.labor[0].description;
      try {
        const hours = (await OC.api(`/proposals/${proposalId}/labor`)).standardMonthlyHours;
        for (const l of draft.labor) {
          current = l.description;
          await OC.api(`/proposals/${proposalId}/labor`, { method: 'POST', body: { description: l.description, professionalCount: l.professionalCount, monthlySalary: l.monthlySalary,
            monthlyFood: l.monthlyFood, monthlyTransport: l.monthlyTransport, monthlyOtherCosts: l.monthlyOtherCosts, standardMonthlyHours: hours, plannedHours: l.plannedHours } });
          saved.push(l.description);
        }
      } catch (error) {
        const pending = draft.labor.filter((l) => !saved.includes(l.description)).map((l) => l.description);
        return { draft, proposalId, aviso: `A proposta foi criada, mas a mão de obra não entrou por completo (${current}: ${msg(error, 'erro')}).${saved.length ? ` Já gravada: ${saved.join(', ')}.` : ''} Falta adicionar na aba Mão de obra: ${pending.join(', ')}.` };
      }
    }
    return { draft, proposalId };
  };
})(window.OC = window.OC || {});
