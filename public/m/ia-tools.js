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
    async buscar_catalogo(a) {
      const q = String(a.busca || '').trim().slice(0, 60);
      if (q.length < 2) return { erro: 'Informe ao menos 2 letras para buscar no catálogo.' };
      const list = ((await OC.api(`/catalog?q=${encodeURIComponent(q)}&limit=20`)).products || []).filter((x) => x.active !== false);
      return { total: list.length, itens: list.map((x) => ({ codigo: x.code, descricao: x.description, categoria: x.category, unidade: x.unit, fabricante: x.manufacturer || null, custo_unitario: cost(x.currentCost) })) };
    },
  };

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
    { name: 'buscar_catalogo', description: 'Procura itens no catálogo por código, descrição ou fabricante. Mostra até 20.',
      parameters: S.object({ properties: { busca: S.string({ description: 'ao menos 2 letras' }) } }) },
  ] }];
})(window.OC = window.OC || {});
