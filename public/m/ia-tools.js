// Ferramentas do assistente (function calling do Gemini). Rodam no celular com a sessao de quem
// pergunta, pelas mesmas rotas das telas: a IA so enxerga o que a pessoa ja pode ver. Custo, BDI e
// margem so saem com a permissao p10 (o servidor ja recusa; aqui nem chega ao modelo).
// Cada resposta e resumida antes de ir para o modelo.
(function (OC) {
  const IA = OC.ia = OC.ia || {};
  const n = (v) => (Number.isFinite(Number(v)) ? OC.cents(Number(v)) : null);
  const cost = (v) => (OC.can('p10') ? n(v) : undefined); // undefined some do JSON
  const plain = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const STATUS = { draft: 'em edição', review: 'em revisão', sent: 'enviada', approved: 'aprovada', rejected: 'recusada' };
  const ID = /^[A-Za-z0-9-]{1,64}$/;
  const need = (id, what) => (ID.test(String(id || '')) ? '' : `Informe ${what} (use listar_${what === 'proposta_id' ? 'propostas' : 'kits'}).`);

  // Destinos que a IA pode abrir. Cada um devolve a acao feita depois da resposta.
  const TELAS = {
    inicio: () => () => OC.go('home'),
    propostas: () => () => OC.go('props'),
    proposta: (a) => need(a.proposta_id, 'proposta_id') || (() => OC.go('prop', { id: String(a.proposta_id) })),
    nova_proposta: () => (OC.canEdit() ? () => OC.go('nova') : 'Seu perfil só consulta; não cria propostas.'),
    kits: () => () => OC.go('kits'),
    kit: (a) => need(a.kit_id, 'kit_id') || (() => OC.go('kit', { id: String(a.kit_id) })),
    clientes: () => () => OC.go('cli'),
    catalogo: () => () => OC.go('cat'),
    painel: () => () => OC.go('painel'),
    notificacoes: () => () => OC.go('avisos'),
    configuracoes: () => () => OC.go('cfg'),
    menu: () => () => OC.go('menu'),
    descartadas: () => (OC.isAdmin && OC.isAdmin() ? () => OC.go('desc') : 'Só administradores veem as propostas descartadas.'),
    centro_custos: () => () => { location.href = OC.suite.centroLink(); },
    obra: (a) => (a.obra_id > 0 ? () => { location.href = OC.suite.centroLink(a.obra_id); } : 'Informe obra_id (vem de ver_proposta, centro_custo_id).'),
  };

  const NOMES = { inicio: 'Início', propostas: 'Propostas', proposta: 'a proposta', nova_proposta: 'Nova proposta', kits: 'Kits', kit: 'o kit', clientes: 'Clientes e obras', catalogo: 'Catálogo',
    painel: 'Painel comercial', notificacoes: 'Notificações', configuracoes: 'Configurações', menu: 'Menu', descartadas: 'Propostas descartadas', centro_custos: 'Centro de Custos', obra: 'a obra no Centro de Custos' };

  function resumo(p) {
    return { id: p.id, numero: p.number, revisao: p.revision, cliente: p.clientName, obra: p.workName, status: STATUS[p.status] || p.status, valor_venda: n(p.totalSale),
      itens: p.itemCount, atualizada_em: p.updatedAt, validade: p.validUntil || null, tem_revisao_aprovada: Boolean(p.hasApprovedRevision) };
  }

  // Rascunho de proposta da conversa (so memoria; ia-draft.js). `confirm` liga quando a IA pede o cartao de confirmacao.
  const D = IA.draft;
  const ST = IA.state = { draft: D.empty(), confirm: false, known: null };
  const NO_EDIT = { erro: 'Seu perfil só consulta; não cria propostas.' };
  const NO_COST = 'Seu perfil não vê nem define custo, BDI e imposto; esses valores se informam no editor depois de criar a proposta.';
  const nameOf = (c) => c.tradeName || c.legalName;

  // Cliente pelo nome digitado: um so resultado vira o escolhido; varios pedem desempate; nenhum so cria se a pessoa quis.
  async function pickClient(name, create) {
    const wanted = plain(name).trim();
    if (wanted.length < 2) return { erro: 'Informe o nome do cliente.' };
    // A busca do servidor tambem casa nome de obra: so vale quem tem o nome (ou documento) no proprio cadastro do cliente.
    const found = ((await OC.api(`/clients?q=${encodeURIComponent(name.slice(0, 60))}`)).clients || []).filter((c) => plain(`${c.legalName} ${c.tradeName || ''} ${c.document || ''}`).includes(wanted));
    const exact = found.filter((c) => plain(c.legalName).trim() === wanted || plain(c.tradeName || '').trim() === wanted);
    const pool = exact.length ? exact : found;
    if (pool.length === 1) { ST.draft = D.withClient(ST.draft, { id: pool[0].id, name: nameOf(pool[0]) }); ST.known = pool[0]; return null; }
    if (pool.length > 1) return { cliente_ambiguo: pool.slice(0, 8).map(nameOf), aviso: 'Pergunte qual destes é o cliente.' };
    if (create) { ST.draft = D.withClient(ST.draft, { newName: name.trim().slice(0, 160) }); ST.known = null; return null; }
    return { cliente_nao_encontrado: name, aviso: 'Não há cliente com esse nome. Pergunte se a pessoa quer cadastrar um cliente novo; se sim, chame de novo com cliente_novo verdadeiro.' };
  }

  function pickWork(name, address) {
    const wanted = plain(name).trim();
    const hit = ((ST.known && ST.known.works) || []).find((w) => w.active !== false && plain(w.name).trim() === wanted);
    ST.draft = hit ? D.withWork(ST.draft, { id: hit.id, name: hit.name }) : D.withWork(ST.draft, { newName: name.trim().slice(0, 160), address: address.trim().slice(0, 240) });
  }

  async function catalogHit(code) {
    const wanted = plain(code).trim();
    const list = ((await OC.api(`/catalog?q=${encodeURIComponent(code.slice(0, 60))}&limit=20`)).products || []).filter((x) => x.active !== false);
    const hit = list.find((x) => plain(x.code).trim() === wanted);
    return hit && { code: hit.code, description: hit.description, unit: hit.unit };
  }

  // A IA nao cria nada: ela so liga `confirm`; quem cria e o botao do cartao (ia-chat.js).
  // Edicao de proposta existente (plano em memoria + cartao de confirmacao), em ia-edit.js.
  const EDIT = IA.edit.tools({ catalogHit, seesCost: () => OC.can('p10'), canEdit: () => OC.canEdit() });
  IA.takeEditConfirm = EDIT.takeConfirm; IA.getPlan = EDIT.getPlan; IA.setPlan = EDIT.setPlan;
  const NO_LABOR = 'Seu perfil não vê nem define custo, e a mão de obra é custo; ela se cadastra no editor depois de criar a proposta.';

  IA.takeConfirm = () => { const out = ST.confirm ? ST.draft : null; ST.confirm = false; return out; };
  IA.clearConfirm = () => { ST.confirm = false; EDIT.clearConfirm(); };
  IA.setDraft = (next, done) => { ST.draft = done ? D.empty() : next; if (done) ST.known = null; };
  IA.resetDraft = () => { ST.draft = D.empty(); ST.known = null; ST.confirm = false; EDIT.reset(); };

  const RUN = {
    async abrir_tela(a) {
      const make = TELAS[a.tela];
      if (!make) return { erro: 'Tela desconhecida.' };
      const action = make(a);
      if (typeof action === 'string') return { erro: action };
      IA.pendingNav = action;
      IA.pendingLabel = NOMES[a.tela] || 'a tela';
      return { ok: true, aviso: 'A tela abre quando você terminar de responder.' };
    },
    async listar_propostas(a) {
      const all = ((await OC.api('/proposals')).proposals || []).filter((p) => p.isLatest !== false);
      const term = plain(a.busca).trim();
      const wanted = Object.keys(STATUS).find((k) => k === a.status || plain(STATUS[k]) === plain(a.status)); // sem acento dos dois lados: "em edição" e "em revisão"
      const list = all.filter((p) => !wanted || p.status === wanted).filter((p) => !term || plain(`${p.number} ${p.clientName} ${p.workName}`).includes(term))
        .sort((x, y) => String(y.updatedAt).localeCompare(String(x.updatedAt)));
      return { total_encontradas: list.length, soma_valor_venda: n(list.reduce((s, p) => s + (Number(p.totalSale) || 0), 0)), propostas: list.slice(0, 30).map(resumo) };
    },
    async ver_proposta(a) {
      const bad = need(a.proposta_id, 'proposta_id');
      if (bad) return { erro: bad };
      const p = (await OC.api(`/proposals/${encodeURIComponent(a.proposta_id)}`)).proposal || {};
      const t = p.totals || {};
      const items = (p.items || []).slice().sort((x, y) => (Number(y.totalSale) || 0) - (Number(x.totalSale) || 0));
      return {
        ...resumo({ ...p, totalSale: t.finalValue ?? t.sale, itemCount: items.length }), escopo: String(p.scope || '').slice(0, 800), responsavel: p.responsibleName || null,
        e_a_revisao_atual: p.isLatest !== false, centro_custo_id: p.costCenterId || null, impostos_pct: p.taxPercentage == null ? undefined : n(p.taxPercentage),
        bdi_multiplicador: cost(p.bdiMultiplier),
        totais: { valor_final: n(t.finalValue ?? t.sale), custo_base: cost(t.baseCost ?? t.cost), materiais: cost(t.materials ?? t.cost), mao_de_obra: cost(t.labor), impostos: cost(t.taxAmount),
          resultado_bruto: cost(t.grossResult), margem_pct: cost(t.marginPercent) },
        itens_principais: items.slice(0, 15).map((i) => ({ descricao: i.description, categoria: i.category, quantidade: n(i.quantity), unidade: i.unit, custo_total: cost(i.totalCost), venda_total: n(i.totalSale) })),
        mao_de_obra: (p.laborItems || []).slice(0, 10).map((l) => ({ descricao: l.description, profissionais: l.professionalCount, horas_equipe: n(l.plannedTeamHours), custo_total: cost(l.totalCost) })),
      };
    },
    async historico_revisoes(a) {
      const bad = need(a.proposta_id, 'proposta_id');
      if (bad) return { erro: bad };
      const list = (await OC.api(`/proposals/${encodeURIComponent(a.proposta_id)}/history`)).revisions || [];
      return { revisoes: list.slice(0, 20).map((r) => ({ id: r.id, revisao: r.revision, status: STATUS[r.status] || r.status, valor_venda: n(r.totalSale), itens: r.itemCount, responsavel: r.responsibleName, atualizada_em: r.updatedAt, atual: Boolean(r.isLatest) })) };
    },
    async acompanhamento_obra(a) {
      if (!OC.can('p10')) return { erro: 'O acompanhamento da obra traz custo e só aparece para quem tem a permissão de custo.' }; // igual à tela
      const bad = need(a.proposta_id, 'proposta_id');
      if (bad) return { erro: bad };
      const d = await OC.api(`/proposals/${encodeURIComponent(a.proposta_id)}/center-tracking`);
      const s = d.summary;
      if (!d.integrated || !s) return { sem_obra: true, aviso: 'Esta proposta ainda não gerou obra no Centro de Custos.' };
      const c = (v) => (v == null ? undefined : n(Number(v) / 100)); // o Centro informa em centavos
      return { obra: s.costCenterName || null, codigo: s.costCenterCode || null, situacao_obra: s.costCenterStatus, obra_id: s.costCenterId, tem_orcado: s.hasBudget,
        valor_contrato: c(s.baseline && s.baseline.contractValueCents), custo_orcado: c(s.baseline && s.baseline.baseCostCents), realizado: c(s.realizedCents), saldo: c(s.balanceCents),
        pct_realizado: s.realizedPercent == null ? undefined : n(s.realizedPercent), acima_do_orcado: Boolean(s.overBudget), lancado_sem_item: c(s.unlinkedExpenseCents),
        atualizado_em: d.fetchedAt || s.updatedAt, desatualizado: Boolean(d.stale) };
    },
    async resumo_comercial() {
      const d = (await OC.api('/dashboard')).summary || {};
      const i = d.intelligence || {};
      return { propostas_abertas: d.activeProposalsCount, propostas_aprovadas: d.approvedProposalsCount, total_em_negociacao: n(d.totalInNegotiation), total_aprovado: n(d.totalApproved),
        clientes: d.totalClientsCount, itens_no_catalogo: d.totalProductsCount, kits: d.totalKitsCount, taxa_conversao_pct: i.conversionRate == null ? undefined : n(i.conversionRate),
        ticket_medio_aprovado: i.averageTicketApproved == null ? undefined : n(i.averageTicketApproved), ticket_medio_negociacao: i.averageTicketNegotiation == null ? undefined : n(i.averageTicketNegotiation),
        funil: (i.pipeline || []).map((s) => ({ etapa: s.label, propostas: s.count, valor: n(s.totalValue) })),
        principais_clientes: (i.topClients || []).slice(0, 5).map((c) => ({ cliente: c.clientName, propostas: c.proposalsCount, aprovado: n(c.approvedValue), em_negociacao: n(c.inNegotiationValue) })) };
    },
    async listar_clientes(a) {
      const list = (await OC.api(`/clients?q=${encodeURIComponent(String(a.busca || '').slice(0, 60))}`)).clients || [];
      return { total: list.length, clientes: list.slice(0, 25).map((c) => ({ id: c.id, nome: c.legalName, fantasia: c.tradeName || null, documento: c.document || null,
        obras: (c.works || []).filter((w) => w.active !== false).map((w) => w.name).slice(0, 10), contato: c.contact && c.contact.name ? { nome: c.contact.name, cargo: c.contact.role || null, email: c.contact.email || null, telefone: c.contact.phone || null } : null })) };
    },
    async listar_kits(a) {
      const term = plain(a.busca).trim();
      const list = ((await OC.api('/kits')).kits || []).filter((k) => k.active !== false && (!term || plain(`${k.name} ${k.category} ${k.description || ''}`).includes(term)));
      return { total: list.length, kits: list.slice(0, 25).map((k) => ({ id: k.id, nome: k.name, categoria: k.category, itens: k.itemCount, referencia: k.description || null, custo_estimado: cost(k.totalEstimatedCost) })) };
    },
    async rascunho_atualizar(a) {
      if (!OC.canEdit()) return NO_EDIT;
      if ((a.bdi !== undefined || a.imposto_pct !== undefined) && !OC.can('p10')) return { erro: NO_COST };
      const avisos = {};
      // Escopo, prazo etc. entram primeiro: se o cliente nao for achado, o resto dito junto nao se perde.
      const result = D.setFields(ST.draft, { escopo: a.escopo, prazo_execucao: a.prazo_execucao, pagamento: a.pagamento, garantia: a.garantia, validade_dias: a.validade_dias, modelo: a.modelo, bdi: a.bdi, imposto_pct: a.imposto_pct });
      ST.draft = result.draft;
      ST.confirm = false;
      if (String(a.cliente || '').trim()) {
        const problem = await pickClient(String(a.cliente), a.cliente_novo === true);
        if (problem) return problem;
      }
      if (String(a.obra || '').trim()) {
        if (!ST.draft.clientName) return { erro: 'Defina o cliente antes da obra.' };
        pickWork(String(a.obra), String(a.obra_endereco || ''));
        if (ST.draft.newWork) avisos.obra_nova = 'Esta obra ainda não existe para o cliente e será cadastrada junto com a proposta; confirme com a pessoa.';
      }
      return { ok: true, ...avisos, ...(result.erros.length ? { erros: result.erros } : {}), rascunho: D.summary(ST.draft) };
    },
    async rascunho_itens(a) {
      if (!OC.canEdit()) return NO_EDIT;
      if (Array.isArray(a.adicionar) && a.adicionar.some((raw) => raw && typeof raw === 'object' && raw.custo_unitario != null) && !OC.can('p10')) return { erro: NO_COST };
      ST.confirm = false;
      const erros = [];
      const wanted = [];
      for (const raw of Array.isArray(a.adicionar) ? a.adicionar.slice(0, 30) : []) {
        const input = raw && typeof raw === 'object' ? raw : {};
        const code = String(input.codigo || '').trim();
        if (!code) { wanted.push({ input }); continue; }
        const hit = await catalogHit(code);
        if (hit) wanted.push({ input, hit }); else erros.push(`Código "${code}" não existe no catálogo. Use buscar_catalogo ou envie só a descrição para entrar como item avulso sem preço.`);
      }
      const added = D.addItems(ST.draft, wanted);
      const removed = D.removeItems(added.draft, Array.isArray(a.remover) ? a.remover.slice(0, 30) : []);
      ST.draft = removed.draft;
      return { ok: true, removidos: removed.removidos, ...(erros.length || added.erros.length ? { erros: [...erros, ...added.erros] } : {}), rascunho: D.summary(ST.draft) };
    },
    async rascunho_mao_de_obra(a) {
      if (!OC.canEdit()) return NO_EDIT;
      if (!OC.can('p10')) return { erro: NO_LABOR };
      ST.confirm = false;
      const list = (value) => (Array.isArray(value) ? value.slice(0, 20) : []);
      const added = D.addLabor(ST.draft, list(a.adicionar));
      const removed = D.removeLabor(added.draft, list(a.remover));
      ST.draft = removed.draft;
      return { ok: true, removidos: removed.removidos, ...(added.erros.length ? { erros: added.erros } : {}), rascunho: D.summary(ST.draft) };
    },
    async rascunho_ver() {
      return { rascunho: D.summary(ST.draft) };
    },
    async rascunho_descartar() {
      ST.draft = D.empty(); ST.known = null; ST.confirm = false;
      return { ok: true };
    },
    async finalizar_rascunho() {
      if (!OC.canEdit()) return NO_EDIT;
      const falta = D.missing(ST.draft);
      if (falta.length) return { erro: `Ainda falta: ${falta.join(', ')}. Pergunte à pessoa.` };
      ST.confirm = true;
      return { ok: true, aviso: 'A proposta AINDA NÃO foi criada. Um cartão de confirmação aparece quando você terminar de responder. Peça que a pessoa confira e toque em Criar proposta.' };
    },
    async buscar_catalogo(a) {
      const q = String(a.busca || '').trim().slice(0, 60);
      if (q.length < 2) return { erro: 'Informe ao menos 2 letras para buscar no catálogo.' };
      const list = ((await OC.api(`/catalog?q=${encodeURIComponent(q)}&limit=20`)).products || []).filter((x) => x.active !== false);
      return { total: list.length, itens: list.map((x) => ({ codigo: x.code, descricao: x.description, categoria: x.category, unidade: x.unit, fabricante: x.manufacturer || null, custo_unitario: cost(x.currentCost) })) };
    },
  };

  Object.assign(RUN, EDIT.run);

  // Executa uma chamada do modelo; erros viram texto para a IA explicar.
  IA.run = async function (call) {
    const fn = RUN[call.name];
    if (!fn) return { erro: 'Ferramenta desconhecida.' };
    try {
      const out = await fn(call.args || {});
      const text = JSON.stringify(out);
      return text.length > 14000 ? { aviso: 'Resultado cortado por tamanho.', parcial: text.slice(0, 14000) } : out;
    } catch (error) {
      return { erro: error.status === 0 ? 'Sem internet.' : (error.message || 'Falhou.') };
    }
  };

  // Declaracoes no formato do Firebase AI Logic (S = Schema do SDK).
  const pid = (S) => S.object({ properties: { proposta_id: S.string({ description: 'id da proposta (use listar_propostas)' }) } });
  IA.declarations = (S) => [{ functionDeclarations: [
    { name: 'abrir_tela', description: 'Abre uma tela do app para a pessoa. Use quando ela pedir para ir, abrir ou ver uma parte do app.',
      parameters: S.object({ properties: {
        tela: S.enumString({ enum: Object.keys(TELAS), description: 'proposta pede proposta_id; kit pede kit_id; obra pede obra_id e abre o Centro de Custos; centro_custos abre o outro app.' }),
        proposta_id: S.string({ description: 'id da proposta' }), kit_id: S.string({ description: 'id do kit' }), obra_id: S.integer({ description: 'id da obra no Centro de Custos' }),
      }, optionalProperties: ['proposta_id', 'kit_id', 'obra_id'] }) },
    { name: 'listar_propostas', description: 'Propostas (revisão atual) com número, cliente, obra, status, valor de venda e validade. Use para achar o id pelo número, cliente ou obra.',
      parameters: S.object({ properties: {
        busca: S.string({ description: 'número, cliente ou obra' }), status: S.enumString({ enum: ['em edição', 'em revisão', 'enviada', 'aprovada', 'recusada'] }),
      }, optionalProperties: ['busca', 'status'] }) },
    { name: 'ver_proposta', description: 'Detalhe de uma proposta: valor final, escopo, itens principais, mão de obra e, se a pessoa pode ver custo, custo, BDI e margem.', parameters: pid(S) },
    { name: 'historico_revisoes', description: 'Revisões de uma proposta (REV 00, 01...) com status, valor, responsável e data.', parameters: pid(S) },
    { name: 'acompanhamento_obra', description: 'Como está a obra gerada pela proposta no Centro de Custos: orçado, realizado, saldo e se passou do orçado.', parameters: pid(S) },
    { name: 'resumo_comercial', description: 'Resumo comercial: propostas abertas e aprovadas, total em negociação e aprovado, taxa de conversão, ticket médio, funil e principais clientes.', parameters: S.object({ properties: {} }) },
    { name: 'listar_clientes', description: 'Clientes e suas obras (e contato). Sem busca, lista os primeiros.',
      parameters: S.object({ properties: { busca: S.string({ description: 'parte do nome, nome fantasia ou documento' }) }, optionalProperties: ['busca'] }) },
    { name: 'listar_kits', description: 'Kits de itens que entram de uma vez na proposta.',
      parameters: S.object({ properties: { busca: S.string({ description: 'parte do nome ou da categoria' }) }, optionalProperties: ['busca'] }) },
    { name: 'rascunho_atualizar', description: 'Monta o rascunho de uma nova proposta (nada é gravado ainda). Passe só o que a pessoa disse. cliente e obra são nomes: o cliente é procurado nos cadastros. Nunca invente prazo, pagamento ou garantia.',
      parameters: S.object({ properties: {
        cliente: S.string({ description: 'nome do cliente (procurado nos cadastros)' }), cliente_novo: S.boolean({ description: 'true só depois de a pessoa confirmar que é um cliente novo' }),
        obra: S.string({ description: 'nome da obra' }), obra_endereco: S.string({ description: 'endereço da obra, se informado' }),
        escopo: S.string({ description: 'escopo em 1 ou 2 frases, com as palavras da pessoa (3 a 1200 letras)' }), prazo_execucao: S.string({ description: 'prazo de execução, ex.: 30 dias' }),
        pagamento: S.string({ description: 'condição de pagamento, ex.: 50% na entrada e 50% na entrega' }), garantia: S.string({ description: 'garantia, ex.: 12 meses' }),
        validade_dias: S.integer({ description: 'validade da proposta em dias (1 a 365)' }), modelo: S.enumString({ enum: ['servico', 'fornecimento'], description: 'servico = mão de obra; fornecimento = material' }),
        bdi: S.number({ description: 'BDI como multiplicador: 25% vira 1,25. Só se a pessoa pediu e pode ver custo' }), imposto_pct: S.number({ description: 'imposto em %, ex.: 8. Só se a pessoa pediu e pode ver custo' }),
      }, optionalProperties: ['cliente', 'cliente_novo', 'obra', 'obra_endereco', 'escopo', 'prazo_execucao', 'pagamento', 'garantia', 'validade_dias', 'modelo', 'bdi', 'imposto_pct'] }) },
    { name: 'rascunho_itens', description: 'Adiciona ou remove itens do rascunho. Com codigo, o item vem do catálogo (confira antes com buscar_catalogo). Sem codigo entra como item avulso SEM preço. Item que já está no rascunho tem a quantidade substituída pela nova. Só anote custo_unitario se a pessoa disse o valor; nunca invente.',
      parameters: S.object({ properties: {
        adicionar: S.array({ description: 'itens a adicionar', items: S.object({ properties: {
          codigo: S.string({ description: 'código exato do catálogo' }), descricao: S.string({ description: 'descrição (obrigatória sem codigo)' }),
          unidade: S.string({ description: 'un, m, m², etc.' }), quantidade: S.number({ description: 'quantidade maior que zero' }),
          custo_unitario: S.number({ description: 'custo unitário em reais que a pessoa informou, só para item avulso (sem codigo); o preço de venda sai do BDI e do imposto' }),
        }, optionalProperties: ['codigo', 'descricao', 'unidade', 'custo_unitario'] }) }),
        remover: S.array({ description: 'número do item (1, 2...) ou trecho da descrição', items: S.string() }),
      }, optionalProperties: ['adicionar', 'remover'] }) },
    { name: 'rascunho_mao_de_obra', description: 'Adiciona ou remove mão de obra do rascunho (só para quem vê custo). Nova exige descricao, profissionais, salario_mensal e horas_por_profissional (pergunte o que faltar); alimentação, transporte e outros custos são opcionais. Nunca invente valores.',
      parameters: S.object({ properties: {
        adicionar: S.array({ description: 'mão de obra nova', items: S.object({ properties: {
          descricao: S.string({ description: 'função, ex.: Eletricista' }), profissionais: S.number({ description: 'quantidade de profissionais' }),
          salario_mensal: S.number({ description: 'salário mensal de cada profissional, em reais' }), alimentacao_mensal: S.number({ description: 'alimentação mensal' }),
          transporte_mensal: S.number({ description: 'transporte mensal' }), outros_custos_mensais: S.number({ description: 'outros custos mensais' }),
          horas_por_profissional: S.number({ description: 'horas previstas por profissional na obra' }),
        }, optionalProperties: ['alimentacao_mensal', 'transporte_mensal', 'outros_custos_mensais'] }) }),
        remover: S.array({ description: 'número da mão de obra (1, 2...) ou trecho da descrição', items: S.string() }),
      }, optionalProperties: ['adicionar', 'remover'] }) },
    { name: 'rascunho_ver', description: 'Mostra o rascunho atual da proposta e o que ainda falta.', parameters: S.object({ properties: {} }) },
    { name: 'rascunho_descartar', description: 'Apaga o rascunho de proposta (quando a pessoa desistir ou quiser recomeçar).', parameters: S.object({ properties: {} }) },
    { name: 'finalizar_rascunho', description: 'Pede a confirmação da pessoa para criar a proposta. Só depois de cliente, obra e escopo definidos. Não cria nada: aparece um botão para ela.', parameters: S.object({ properties: {} }) },
    { name: 'buscar_catalogo', description: 'Procura itens no catálogo por código, descrição ou fabricante. Mostra até 20.',
      parameters: S.object({ properties: { busca: S.string({ description: 'ao menos 2 letras' }) } }) },
    ...EDIT.declarations(S),
  ] }];
})(window.OC = window.OC || {});
