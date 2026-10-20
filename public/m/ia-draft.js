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
      const same = items.findIndex((item) => (code ? item.code === code : !item.code && plain(item.description) === plain(description)));
      // Item que ja esta no rascunho: a quantidade dita agora vale ("na verdade sao 6"), nao soma com a anterior.
      if (same >= 0) { items[same] = { ...items[same], quantity: qty }; continue; }
      if (items.length >= MAX_ITEMS) { erros.push(`Limite de ${MAX_ITEMS} itens por rascunho.`); break; }
      items.push({ code, description, unit, quantity: qty });
    }
    return { draft: { ...draft, items }, erros };
  };

  D.removeItems = function (draft, refs) {
    const drop = new Set();
    for (const ref of refs) {
      // O modelo manda o numero como texto ("2") ou numero: os dois valem.
      const asNumber = typeof ref === 'string' && /^\s*\d{1,3}\s*$/.test(ref) ? Number(ref) : ref;
      if (typeof asNumber === 'number' && Number.isInteger(asNumber)) { if (asNumber >= 1 && asNumber <= draft.items.length) drop.add(asNumber - 1); continue; }
      const term = plain(typeof ref === 'string' ? ref : '');
      if (term.length < 2) continue;
      draft.items.forEach((item, index) => { if (plain(`${item.code || ''} ${item.description}`).includes(term)) drop.add(index); });
    }
    return { draft: { ...draft, items: draft.items.filter((_, index) => !drop.has(index)) }, removidos: drop.size };
  };

  D.missing = function (draft) {
    const out = [];
    if (!draft.clientName) out.push('cliente');
    if (!draft.workName) out.push('obra');
    if (!draft.scope) out.push('escopo');
    return out;
  };

  D.scopeForSave = function (draft) {
    const scope = draft.scope || '';
    if (!draft.executionTerm && !draft.paymentTerms && !draft.warranty) return scope;
    const parts = { scope, executionTerm: draft.executionTerm || '', paymentTerms: draft.paymentTerms || '', warranty: draft.warranty || '', notes: '' };
    // O campo guarda ate 1200 caracteres do JSON JA escapado (aspas e barras crescem): corta o maior texto ate caber.
    // O escopo nunca passa de SCOPE_MIN letras; as condicoes podem ir a zero.
    for (let json = JSON.stringify(parts); json.length > SCOPE_MAX; json = JSON.stringify(parts)) {
      const cut = Math.max(1, Math.ceil((json.length - SCOPE_MAX) / 2));
      const longest = ['scope', 'executionTerm', 'paymentTerms', 'warranty']
        .filter((key) => parts[key].length > (key === 'scope' ? SCOPE_MIN : 0))
        .sort((a, b) => parts[b].length - parts[a].length)[0];
      parts[longest] = parts[longest].slice(0, Math.max(longest === 'scope' ? SCOPE_MIN : 0, parts[longest].length - cut));
    }
    return JSON.stringify(parts);
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
      itens: draft.items.map((item, index) => ({ numero: index + 1, codigo: item.code || null, descricao: item.description, unidade: item.unit, quantidade: item.quantity, preco: item.code ? 'do catálogo' : 'sem preço (avulso)' })),
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
    if (!draft.items.length) return { draft, proposalId };
    try {
      await OC.api(`/proposals/${proposalId}/items/import-batch`, { method: 'POST', body: { items: draft.items.map((item) => (item.code
        ? { code: item.code, description: item.description, quantity: item.quantity }
        : { description: item.description, unit: item.unit, quantity: item.quantity, unitCost: 0, unitSale: 0 })) } });
    } catch (error) {
      return { draft, proposalId, aviso: `A proposta foi criada, mas os itens não entraram (${msg(error, 'erro ao importar')}). Adicione-os no editor.` };
    }
    return { draft, proposalId };
  };
})(window.OC = window.OC || {});
