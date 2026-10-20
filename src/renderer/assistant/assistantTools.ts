// Ferramentas do assistente (function calling do Gemini). Rodam no computador com a sessao de quem
// pergunta, pelas mesmas rotas das telas: a IA so enxerga o que a pessoa ja pode ver. Custo, BDI e
// margem so saem com a permissao p10 (o servidor ja recusa; aqui nem chega ao modelo).
// Tudo que toca o app entra por `deps` (API, permissoes, navegacao), para testar sem rede nem tela.
import type { CatalogProduct, CenterTracking, ClientRecord, DashboardMetrics, KitSummary, ProposalDetail, ProposalRevisionSummary, ProposalSummary } from '../../shared/contracts';
import type { NavSection } from '../navSections';
import { addItems, emptyDraft, missing, removeItems, setFields, summary, withClient, withWork } from './proposalDraft';
import type { CatalogHit, ItemInput, ProposalDraft } from './proposalDraft';

export interface AssistantApi {
  proposals(): Promise<{ proposals: ProposalSummary[] }>;
  proposal(id: string): Promise<{ proposal: ProposalDetail }>;
  history(id: string): Promise<{ revisions: ProposalRevisionSummary[] }>;
  tracking(id: string): Promise<CenterTracking>;
  dashboard(): Promise<{ summary: DashboardMetrics }>;
  clients(query: string): Promise<{ clients: ClientRecord[] }>;
  kits(): Promise<{ kits: KitSummary[] }>;
  catalog(query: string): Promise<{ products: CatalogProduct[] }>;
}

// O que o App faz quando a IA abre uma tela.
export interface AssistantNav {
  openProposal(id: string): void;
  navigate(section: NavSection): void;
  newProposal(): void;
  openCentroCustos(obraId?: number): void;
}

export interface ToolDeps {
  api: AssistantApi;
  seesCost(): boolean;
  canEdit(): boolean;
  nav(): AssistantNav;
}

export type ToolCall = { name: string; args?: Record<string, unknown> };
export type PendingNav = { label: string; run: () => void };

// Schema do SDK do Firebase AI (so o que as declaracoes usam).
type Spec = { description?: string };
export interface SchemaBuilder {
  object(spec: { properties: Record<string, unknown>; optionalProperties?: string[] }): unknown;
  string(spec?: Spec): unknown;
  enumString(spec: Spec & { enum: string[] }): unknown;
  integer(spec?: Spec): unknown;
  number(spec?: Spec): unknown;
  boolean(spec?: Spec): unknown;
  array(spec: Spec & { items: unknown }): unknown;
}

type Args = Record<string, unknown>;
const STATUS: Record<string, string> = { draft: 'em edição', review: 'em revisão', sent: 'enviada', approved: 'aprovada', rejected: 'recusada' };
const ID = /^[A-Za-z0-9-]{1,64}$/;
const MAX_JSON = 14000;
const SECTIONS: Record<string, NavSection> = { inicio: 'Início', propostas: 'Propostas', catalogo: 'Catálogo', clientes: 'Clientes', kits: 'Kits', configuracoes: 'Configurações' };
const TELAS = [...Object.keys(SECTIONS), 'proposta', 'nova_proposta', 'centro_custos', 'obra'];

export const str = (v: unknown): string => (typeof v === 'string' ? v : '');
export const plain = (v: unknown): string => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const n = (v: unknown): number | null => (v != null && v !== '' && Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : null);
const needId = (id: unknown): string => (ID.test(str(id)) ? '' : 'Informe proposta_id (use listar_propostas).');
const sale = (p: ProposalSummary) => Number(p.totalSale) || 0;

export function createAssistantTools(deps: ToolDeps) {
  let pending: PendingNav | null = null;
  // Rascunho de proposta da conversa (so memoria). `confirm` liga quando a IA pede o cartao de confirmacao.
  let draft: ProposalDraft = emptyDraft();
  let confirm = false;
  let known: ClientRecord | null = null; // cadastro do cliente escolhido (para casar a obra pelo nome)
  const cost = (v: unknown) => (deps.seesCost() ? n(v) : undefined); // undefined some do JSON

  function resumo(p: ProposalSummary) {
    return { id: p.id, numero: p.number, revisao: p.revision, cliente: p.clientName, obra: p.workName, status: STATUS[p.status] || p.status, valor_venda: n(p.totalSale),
      itens: p.itemCount, atualizada_em: p.updatedAt, validade: p.validUntil || null, tem_revisao_aprovada: Boolean(p.hasApprovedRevision) };
  }

  // Destinos que a IA pode abrir; a acao so roda depois da resposta (pending).
  function destino(a: Args): PendingNav | string {
    const tela = str(a.tela);
    const section = SECTIONS[tela];
    if (section) return { label: section, run: () => deps.nav().navigate(section) };
    if (tela === 'proposta') {
      const bad = needId(a.proposta_id);
      const id = str(a.proposta_id);
      return bad || { label: 'a proposta', run: () => deps.nav().openProposal(id) };
    }
    if (tela === 'nova_proposta') return deps.canEdit() ? { label: 'Nova proposta', run: () => deps.nav().newProposal() } : 'Seu perfil só consulta; não cria propostas.';
    if (tela === 'centro_custos') return { label: 'Centro de Custos', run: () => deps.nav().openCentroCustos() };
    if (tela === 'obra') {
      const id = typeof a.obra_id === 'number' ? a.obra_id : /^\d{1,9}$/.test(str(a.obra_id)) ? Number(a.obra_id) : 0;
      return Number.isInteger(id) && id > 0 ? { label: 'a obra no Centro de Custos', run: () => deps.nav().openCentroCustos(id) } : 'Informe obra_id (vem de ver_proposta, centro_custo_id).';
    }
    return 'Tela desconhecida.';
  }


  const NO_EDIT = { erro: 'Seu perfil só consulta; não cria propostas.' };
  const nameOf = (c: ClientRecord) => c.tradeName || c.legalName;

  // Cliente pelo nome digitado: um so resultado vira o escolhido; varios pedem desempate; nenhum so cria se a pessoa quis.
  async function pickClient(name: string, create: boolean): Promise<Record<string, unknown> | null> {
    const wanted = plain(name).trim();
    if (wanted.length < 2) return { erro: 'Informe o nome do cliente.' };
    // A busca do servidor tambem casa nome de obra: so vale quem tem o nome (ou documento) no proprio cadastro do cliente.
    const found = (await deps.api.clients(name.slice(0, 60))).clients.filter((c) => plain(`${c.legalName} ${c.tradeName || ''} ${c.document || ''}`).includes(wanted));
    const exact = found.filter((c) => plain(c.legalName).trim() === wanted || plain(c.tradeName || '').trim() === wanted);
    const pool = exact.length ? exact : found;
    if (pool.length === 1) { draft = withClient(draft, { id: pool[0].id, name: nameOf(pool[0]) }); known = pool[0]; return null; }
    if (pool.length > 1) return { cliente_ambiguo: pool.slice(0, 8).map(nameOf), aviso: 'Pergunte qual destes é o cliente.' };
    if (create) { draft = withClient(draft, { newName: name.trim().slice(0, 160) }); known = null; return null; }
    return { cliente_nao_encontrado: name, aviso: 'Não há cliente com esse nome. Pergunte se a pessoa quer cadastrar um cliente novo; se sim, chame de novo com cliente_novo verdadeiro.' };
  }

  function pickWork(name: string, address: string): void {
    const wanted = plain(name).trim();
    const hit = known?.works?.find((w) => w.active !== false && plain(w.name).trim() === wanted);
    draft = hit ? withWork(draft, { id: hit.id, name: hit.name }) : withWork(draft, { newName: name.trim().slice(0, 160), address: address.trim().slice(0, 240) });
  }

  async function catalogHit(code: string): Promise<CatalogHit | undefined> {
    const wanted = plain(code).trim();
    const list = (await deps.api.catalog(code.slice(0, 60))).products.filter((x) => x.active !== false);
    const hit = list.find((x) => plain(x.code).trim() === wanted);
    return hit && { code: hit.code, description: hit.description, unit: hit.unit };
  }

  const RUN: Record<string, (a: Args) => Promise<unknown>> = {
    async abrir_tela(a) {
      const found = destino(a);
      if (typeof found === 'string') return { erro: found };
      pending = found;
      return { ok: true, aviso: 'A tela abre quando você terminar de responder.' };
    },
    async listar_propostas(a) {
      const all = (await deps.api.proposals()).proposals.filter((p) => p.isLatest !== false);
      const term = plain(a.busca).trim();
      const wanted = Object.keys(STATUS).find((k) => k === str(a.status) || plain(STATUS[k]) === plain(a.status));
      const list = all.filter((p) => !wanted || p.status === wanted).filter((p) => !term || plain(`${p.number} ${p.clientName} ${p.workName}`).includes(term))
        .sort((x, y) => String(y.updatedAt).localeCompare(String(x.updatedAt)));
      return { total_encontradas: list.length, soma_valor_venda: n(list.reduce((s, p) => s + sale(p), 0)), propostas: list.slice(0, 30).map(resumo) };
    },
    async ver_proposta(a) {
      const bad = needId(a.proposta_id);
      if (bad) return { erro: bad };
      const p = (await deps.api.proposal(str(a.proposta_id))).proposal;
      const t = p.totals ?? ({} as Partial<ProposalDetail['totals']>);
      const items = (p.items ?? []).slice().sort((x, y) => (Number(y.totalSale) || 0) - (Number(x.totalSale) || 0));
      return {
        ...resumo({ ...p, totalSale: t.finalValue ?? t.sale ?? 0, itemCount: items.length }), escopo: String(p.scope || '').slice(0, 800), responsavel: p.responsibleName || null,
        e_a_revisao_atual: p.isLatest !== false, centro_custo_id: p.costCenterId || null, impostos_pct: p.taxPercentage == null ? undefined : n(p.taxPercentage),
        bdi_multiplicador: cost(p.bdiMultiplier),
        totais: { valor_final: n(t.finalValue ?? t.sale), custo_base: cost(t.baseCost ?? t.cost), materiais: cost(t.materials ?? t.cost), mao_de_obra: cost(t.labor), impostos: cost(t.taxAmount),
          resultado_bruto: cost(t.grossResult), margem_pct: cost(t.marginPercent) },
        itens_principais: items.slice(0, 15).map((i) => ({ descricao: i.description, categoria: i.category, quantidade: n(i.quantity), unidade: i.unit, custo_total: cost(i.totalCost), venda_total: n(i.totalSale) })),
        mao_de_obra: (p.laborItems || []).slice(0, 10).map((l) => ({ descricao: l.description, profissionais: l.professionalCount, horas_equipe: n(l.plannedTeamHours), custo_total: cost(l.totalCost) })),
      };
    },
    async historico_revisoes(a) {
      const bad = needId(a.proposta_id);
      if (bad) return { erro: bad };
      const list = (await deps.api.history(str(a.proposta_id))).revisions;
      return { revisoes: list.slice(0, 20).map((r) => ({ id: r.id, revisao: r.revision, status: STATUS[r.status] || r.status, valor_venda: n(r.totalSale), itens: r.itemCount, responsavel: r.responsibleName, atualizada_em: r.updatedAt, atual: Boolean(r.isLatest) })) };
    },
    async acompanhamento_obra(a) {
      const bad = needId(a.proposta_id);
      if (bad) return { erro: bad };
      // Orcado, realizado e saldo sao custo: a tela de acompanhamento tambem so aparece com p10.
      if (!deps.seesCost()) return { erro: 'Seu perfil não vê custos, e o acompanhamento da obra mostra custo orçado e realizado.' };
      const d = await deps.api.tracking(str(a.proposta_id));
      const s = d.summary;
      if (!d.integrated || !s) return { sem_obra: true, aviso: 'Esta proposta ainda não gerou obra no Centro de Custos.' };
      const c = (v?: number) => (v == null ? undefined : n(v / 100)); // o Centro informa em centavos
      return { obra: s.costCenterName || null, codigo: s.costCenterCode || null, situacao_obra: s.costCenterStatus, obra_id: s.costCenterId, tem_orcado: s.hasBudget,
        valor_contrato: c(s.baseline?.contractValueCents), custo_orcado: c(s.baseline?.baseCostCents), realizado: c(s.realizedCents), saldo: c(s.balanceCents),
        pct_realizado: s.realizedPercent == null ? undefined : n(s.realizedPercent), acima_do_orcado: Boolean(s.overBudget), lancado_sem_item: c(s.unlinkedExpenseCents),
        atualizado_em: d.fetchedAt || s.updatedAt, desatualizado: Boolean(d.stale) };
    },
    async resumo_comercial() {
      const d = (await deps.api.dashboard()).summary;
      const i = d.intelligence;
      return { propostas_abertas: d.activeProposalsCount, propostas_aprovadas: d.approvedProposalsCount, total_em_negociacao: n(d.totalInNegotiation), total_aprovado: n(d.totalApproved),
        clientes: d.totalClientsCount, itens_no_catalogo: d.totalProductsCount, kits: d.totalKitsCount, taxa_conversao_pct: i?.conversionRate == null ? undefined : n(i.conversionRate),
        ticket_medio_aprovado: i?.averageTicketApproved == null ? undefined : n(i.averageTicketApproved), ticket_medio_negociacao: i?.averageTicketNegotiation == null ? undefined : n(i.averageTicketNegotiation),
        funil: (i?.pipeline || []).map((s) => ({ etapa: s.label, propostas: s.count, valor: n(s.totalValue) })),
        principais_clientes: (i?.topClients || []).slice(0, 5).map((c) => ({ cliente: c.clientName, propostas: c.proposalsCount, aprovado: n(c.approvedValue), em_negociacao: n(c.inNegotiationValue) })) };
    },
    async listar_clientes(a) {
      const list = (await deps.api.clients(str(a.busca).slice(0, 60))).clients;
      return { total: list.length, clientes: list.slice(0, 25).map((c) => ({ id: c.id, nome: c.legalName, fantasia: c.tradeName || null, documento: c.document || null,
        obras: (c.works || []).filter((w) => w.active !== false).map((w) => w.name).slice(0, 10),
        contato: c.contact?.name ? { nome: c.contact.name, cargo: c.contact.role || null, email: c.contact.email || null, telefone: c.contact.phone || null } : null })) };
    },
    async listar_kits(a) {
      const term = plain(a.busca).trim();
      const list = (await deps.api.kits()).kits.filter((k) => k.active !== false && (!term || plain(`${k.name} ${k.category} ${k.description || ''}`).includes(term)));
      return { total: list.length, kits: list.slice(0, 25).map((k) => ({ id: k.id, nome: k.name, categoria: k.category, itens: k.itemCount, referencia: k.description || null, custo_estimado: cost(k.totalEstimatedCost) })) };
    },
    async rascunho_atualizar(a) {
      if (!deps.canEdit()) return NO_EDIT;
      const avisos: Record<string, unknown> = {};
      // Escopo, prazo etc. entram primeiro: se o cliente nao for achado, o resto dito junto nao se perde.
      const result = setFields(draft, { escopo: a.escopo, prazo_execucao: a.prazo_execucao, pagamento: a.pagamento, garantia: a.garantia, validade_dias: a.validade_dias, modelo: a.modelo });
      draft = result.draft;
      confirm = false;
      if (str(a.cliente).trim()) {
        const problem = await pickClient(str(a.cliente), a.cliente_novo === true);
        if (problem) return problem;
      }
      if (str(a.obra).trim()) {
        if (!draft.clientName) return { erro: 'Defina o cliente antes da obra.' };
        pickWork(str(a.obra), str(a.obra_endereco));
        if (draft.newWork) avisos.obra_nova = 'Esta obra ainda não existe para o cliente e será cadastrada junto com a proposta; confirme com a pessoa.';
      }
      return { ok: true, ...avisos, ...(result.erros.length ? { erros: result.erros } : {}), rascunho: summary(draft) };
    },
    async rascunho_itens(a) {
      if (!deps.canEdit()) return NO_EDIT;
      confirm = false;
      const erros: string[] = [];
      const wanted: Array<{ input: ItemInput; hit?: CatalogHit }> = [];
      for (const raw of Array.isArray(a.adicionar) ? a.adicionar.slice(0, 30) : []) {
        const input = (raw && typeof raw === 'object' ? raw : {}) as ItemInput;
        const code = str(input.codigo).trim();
        if (!code) { wanted.push({ input }); continue; }
        const hit = await catalogHit(code);
        if (hit) wanted.push({ input, hit }); else erros.push(`Código "${code}" não existe no catálogo. Use buscar_catalogo ou envie só a descrição para entrar como item avulso sem preço.`);
      }
      const added = addItems(draft, wanted);
      const removed = removeItems(added.draft, Array.isArray(a.remover) ? a.remover.slice(0, 30) : []);
      draft = removed.draft;
      return { ok: true, removidos: removed.removidos, ...(erros.length || added.erros.length ? { erros: [...erros, ...added.erros] } : {}), rascunho: summary(draft) };
    },
    async rascunho_ver() {
      return { rascunho: summary(draft) };
    },
    async rascunho_descartar() {
      draft = emptyDraft(); known = null; confirm = false;
      return { ok: true };
    },
    async finalizar_rascunho() {
      if (!deps.canEdit()) return NO_EDIT;
      const falta = missing(draft);
      if (falta.length) return { erro: `Ainda falta: ${falta.join(', ')}. Pergunte à pessoa.` };
      confirm = true;
      return { ok: true, aviso: 'A proposta AINDA NÃO foi criada. Um cartão de confirmação aparece quando você terminar de responder. Peça que a pessoa confira e toque em Criar proposta.' };
    },
    async buscar_catalogo(a) {
      const q = str(a.busca).trim().slice(0, 60);
      if (q.length < 2) return { erro: 'Informe ao menos 2 letras para buscar no catálogo.' };
      const list = (await deps.api.catalog(q)).products.filter((x) => x.active !== false);
      return { total: list.length, itens: list.map((x) => ({ codigo: x.code, descricao: x.description, categoria: x.category, unidade: x.unit, fabricante: x.manufacturer || null, custo_unitario: cost(x.currentCost) })) };
    },
  };

  // Executa uma chamada do modelo; erros viram texto para a IA explicar.
  async function run(call: ToolCall): Promise<unknown> {
    const fn = RUN[call.name];
    if (!fn) return { erro: 'Ferramenta desconhecida.' };
    try {
      const out = await fn(call.args || {});
      const text = JSON.stringify(out);
      return text.length > MAX_JSON ? { aviso: 'Resultado cortado por tamanho.', parcial: text.slice(0, MAX_JSON) } : out;
    } catch (error) {
      if (error instanceof TypeError && /fetch|network|load failed/i.test(error.message)) return { erro: 'Sem conexão com o servidor.' };
      return { erro: error instanceof Error && error.message ? error.message : 'Falhou.' };
    }
  }

  // Declaracoes no formato do Firebase AI Logic (S = Schema do SDK).
  function declarations(S: SchemaBuilder) {
    const pid = S.object({ properties: { proposta_id: S.string({ description: 'id da proposta (use listar_propostas)' }) } });
    const busca = (description: string) => S.object({ properties: { busca: S.string({ description }) }, optionalProperties: ['busca'] });
    return [{ functionDeclarations: [
      { name: 'abrir_tela', description: 'Abre uma tela do app para a pessoa. Use quando ela pedir para ir, abrir ou ver uma parte do app.',
        parameters: S.object({ properties: {
          tela: S.enumString({ enum: TELAS, description: 'proposta pede proposta_id e abre o editor da proposta; obra pede obra_id e abre o Centro de Custos; centro_custos abre o Centro de Custos.' }),
          proposta_id: S.string({ description: 'id da proposta' }), obra_id: S.integer({ description: 'id da obra no Centro de Custos' }),
        }, optionalProperties: ['proposta_id', 'obra_id'] }) },
      { name: 'listar_propostas', description: 'Propostas (revisão atual) com número, cliente, obra, status, valor de venda e validade. Use para achar o id pelo número, cliente ou obra.',
        parameters: S.object({ properties: {
          busca: S.string({ description: 'número, cliente ou obra' }), status: S.enumString({ enum: Object.values(STATUS) }),
        }, optionalProperties: ['busca', 'status'] }) },
      { name: 'ver_proposta', description: 'Detalhe de uma proposta: valor final, escopo, itens principais, mão de obra e, se a pessoa pode ver custo, custo, BDI e margem.', parameters: pid },
      { name: 'historico_revisoes', description: 'Revisões de uma proposta (REV 00, 01...) com status, valor, responsável e data.', parameters: pid },
      { name: 'acompanhamento_obra', description: 'Como está a obra gerada pela proposta no Centro de Custos: orçado, realizado, saldo e se passou do orçado. Só para quem vê custo.', parameters: pid },
      { name: 'resumo_comercial', description: 'Resumo comercial: propostas abertas e aprovadas, total em negociação e aprovado, taxa de conversão, ticket médio, funil e principais clientes.', parameters: S.object({ properties: {} }) },
      { name: 'listar_clientes', description: 'Clientes e suas obras (e contato). Sem busca, lista os primeiros.', parameters: busca('parte do nome, nome fantasia ou documento') },
      { name: 'listar_kits', description: 'Kits de itens que entram de uma vez na proposta.', parameters: busca('parte do nome ou da categoria') },
      { name: 'rascunho_atualizar', description: 'Monta o rascunho de uma nova proposta (nada é gravado ainda). Passe só o que a pessoa disse. cliente e obra são nomes: o cliente é procurado nos cadastros. Nunca invente prazo, pagamento ou garantia.',
        parameters: S.object({ properties: {
          cliente: S.string({ description: 'nome do cliente (procurado nos cadastros)' }), cliente_novo: S.boolean({ description: 'true só depois de a pessoa confirmar que é um cliente novo' }),
          obra: S.string({ description: 'nome da obra' }), obra_endereco: S.string({ description: 'endereço da obra, se informado' }),
          escopo: S.string({ description: 'escopo em 1 ou 2 frases, com as palavras da pessoa (3 a 1200 letras)' }), prazo_execucao: S.string({ description: 'prazo de execução, ex.: 30 dias' }),
          pagamento: S.string({ description: 'condição de pagamento, ex.: 50% na entrada e 50% na entrega' }), garantia: S.string({ description: 'garantia, ex.: 12 meses' }),
          validade_dias: S.integer({ description: 'validade da proposta em dias (1 a 365)' }), modelo: S.enumString({ enum: ['servico', 'fornecimento'], description: 'servico = mão de obra; fornecimento = material' }),
        }, optionalProperties: ['cliente', 'cliente_novo', 'obra', 'obra_endereco', 'escopo', 'prazo_execucao', 'pagamento', 'garantia', 'validade_dias', 'modelo'] }) },
      { name: 'rascunho_itens', description: 'Adiciona ou remove itens do rascunho. Com codigo, o item vem do catálogo (confira antes com buscar_catalogo). Sem codigo entra como item avulso SEM preço. Item que já está no rascunho tem a quantidade substituída pela nova. Nunca informe preço.',
        parameters: S.object({ properties: {
          adicionar: S.array({ description: 'itens a adicionar', items: S.object({ properties: {
            codigo: S.string({ description: 'código exato do catálogo' }), descricao: S.string({ description: 'descrição (obrigatória sem codigo)' }),
            unidade: S.string({ description: 'un, m, m², etc.' }), quantidade: S.number({ description: 'quantidade maior que zero' }),
          }, optionalProperties: ['codigo', 'descricao', 'unidade'] }) }),
          remover: S.array({ description: 'número do item (1, 2...) ou trecho da descrição', items: S.string() }),
        }, optionalProperties: ['adicionar', 'remover'] }) },
      { name: 'rascunho_ver', description: 'Mostra o rascunho atual da proposta e o que ainda falta.', parameters: S.object({ properties: {} }) },
      { name: 'rascunho_descartar', description: 'Apaga o rascunho de proposta (quando a pessoa desistir ou quiser recomeçar).', parameters: S.object({ properties: {} }) },
      { name: 'finalizar_rascunho', description: 'Pede a confirmação da pessoa para criar a proposta. Só depois de cliente, obra e escopo definidos. Não cria nada: aparece um botão para ela.', parameters: S.object({ properties: {} }) },
      { name: 'buscar_catalogo', description: 'Procura itens no catálogo por código, descrição ou fabricante. Mostra até 10.',
        parameters: S.object({ properties: { busca: S.string({ description: 'ao menos 2 letras' }) } }) },
    ] }];
  }

  return {
    run,
    declarations,
    /** Entrega (e esquece) a tela que a IA pediu para abrir. */
    takePending(): PendingNav | null { const found = pending; pending = null; return found; },
    clearPending() { pending = null; confirm = false; },
    /** Rascunho para o cartao de confirmacao (so quando a IA chamou finalizar_rascunho e nada mudou depois). */
    takeConfirm(): ProposalDraft | null { const out = confirm ? draft : null; confirm = false; return out; },
    getDraft(): ProposalDraft { return draft; },
    /** Depois do commit: guarda os ids criados (nova tentativa nao duplica) ou, com `done`, zera para a proxima proposta. */
    setDraft(next: ProposalDraft, done = false) { draft = done ? emptyDraft() : next; if (done) known = null; },
    toolNames: Object.keys(RUN),
  };
}

export type AssistantTools = ReturnType<typeof createAssistantTools>;
