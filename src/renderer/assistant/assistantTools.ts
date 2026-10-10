// Ferramentas do assistente (function calling do Gemini). Rodam no computador com a sessao de quem
// pergunta, pelas mesmas rotas das telas: a IA so enxerga o que a pessoa ja pode ver. Custo, BDI e
// margem so saem com a permissao p10 (o servidor ja recusa; aqui nem chega ao modelo).
// Tudo que toca o app entra por `deps` (API, permissoes, navegacao), para testar sem rede nem tela.
import type { CatalogProduct, CenterTracking, ClientRecord, DashboardMetrics, KitSummary, ProposalDetail, ProposalRevisionSummary, ProposalSummary } from '../../shared/contracts';
import type { NavSection } from '../navSections';

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
      { name: 'buscar_catalogo', description: 'Procura itens no catálogo por código, descrição ou fabricante. Mostra até 10.',
        parameters: S.object({ properties: { busca: S.string({ description: 'ao menos 2 letras' }) } }) },
    ] }];
  }

  return {
    run,
    declarations,
    /** Entrega (e esquece) a tela que a IA pediu para abrir. */
    takePending(): PendingNav | null { const found = pending; pending = null; return found; },
    clearPending() { pending = null; },
    toolNames: Object.keys(RUN),
  };
}

export type AssistantTools = ReturnType<typeof createAssistantTools>;
