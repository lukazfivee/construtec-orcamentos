// Ferramentas de edicao de proposta existente do assistente. Nada e gravado aqui: elas montam o plano de
// `proposalEdit.ts` e `finalizar_edicao` so liga o cartao de conferencia (o botao "Aplicar alteracoes" grava).
import type { ProposalDetail } from '../../shared/contracts';
import { describeBase, describePlan, isEditable, planFields, planIsEmpty, planItems, planLabor, startPlan, toEditBase } from './proposalEdit';
import type { EditPlan, ItemChange, LaborChange } from './proposalEdit';
import type { CatalogHit, ItemInput, LaborInput } from './proposalDraft';
import type { SchemaBuilder } from './assistantTools';

export interface EditToolDeps {
  proposal(id: string): Promise<{ proposal: ProposalDetail }>;
  catalogHit(code: string): Promise<CatalogHit | undefined>;
  seesCost(): boolean;
  canEdit(): boolean;
}

type Args = Record<string, unknown>;
const ID = /^[A-Za-z0-9-]{1,64}$/;
const STATUS: Record<string, string> = { draft: 'em edição', review: 'em revisão', sent: 'enviada', approved: 'aprovada', rejected: 'recusada' };
const NO_EDIT = { erro: 'Seu perfil só consulta; não edita propostas.' };
const NO_COST = 'Seu perfil não vê nem define custo, BDI e imposto; esses valores se alteram no editor.';
const NO_LABOR = 'Seu perfil não vê nem define custo, e a mão de obra é custo; ela se cadastra no editor.';
const NO_PLAN = { erro: 'Abra uma proposta primeiro com editar_abrir (use listar_propostas para achar o id).' };

export function createEditTools(deps: EditToolDeps) {
  let plan: EditPlan | null = null;
  let confirm = false;
  const hasCost = (list: unknown, key: string) => Array.isArray(list) && list.some((raw) => raw && typeof raw === 'object' && (raw as Args)[key] != null);

  const RUN: Record<string, (a: Args) => Promise<unknown>> = {
    async editar_abrir(a) {
      if (!deps.canEdit()) return NO_EDIT;
      const id = typeof a.proposta_id === 'string' ? a.proposta_id : '';
      if (!ID.test(id)) return { erro: 'Informe proposta_id (use listar_propostas).' };
      const p = (await deps.proposal(id)).proposal;
      if (!isEditable(p)) {
        return { erro: `A proposta ${p.number} (REV ${String(p.revision).padStart(2, '0')}) está ${STATUS[p.status] ?? p.status}${p.isLatest === false ? ' e não é a revisão atual' : ''}: só a revisão atual em edição ou em revisão pode ser alterada por aqui. Peça para reabrir ou criar uma revisão no editor.` };
      }
      plan = startPlan(toEditBase(p));
      confirm = false;
      return { ok: true, ...describeBase(plan.base, deps.seesCost()) };
    },
    async editar_campos(a) {
      if (!deps.canEdit()) return NO_EDIT;
      if (!plan) return NO_PLAN;
      if ((a.bdi !== undefined || a.imposto_pct !== undefined) && !deps.seesCost()) return { erro: NO_COST };
      const result = planFields(plan, { escopo: a.escopo, prazo_execucao: a.prazo_execucao, pagamento: a.pagamento, garantia: a.garantia, validade_dias: a.validade_dias, bdi: a.bdi, imposto_pct: a.imposto_pct });
      plan = result.plan; confirm = false;
      return { ok: true, ...(result.erros.length ? { erros: result.erros } : {}), mudancas: describePlan(plan) };
    },
    async editar_itens(a) {
      if (!deps.canEdit()) return NO_EDIT;
      if (!plan) return NO_PLAN;
      if ((hasCost(a.alterar, 'custo_unitario') || hasCost(a.adicionar, 'custo_unitario')) && !deps.seesCost()) return { erro: NO_COST };
      const erros: string[] = [];
      const wanted: Array<{ input: ItemInput; hit?: CatalogHit }> = [];
      for (const raw of Array.isArray(a.adicionar) ? a.adicionar.slice(0, 30) : []) {
        const input = (raw && typeof raw === 'object' ? raw : {}) as ItemInput;
        const code = typeof input.codigo === 'string' ? input.codigo.trim() : '';
        if (!code) { wanted.push({ input }); continue; }
        const hit = await deps.catalogHit(code);
        if (hit) wanted.push({ input, hit }); else erros.push(`Código "${code}" não existe no catálogo. Use buscar_catalogo ou envie só a descrição para entrar como item avulso sem preço.`);
      }
      const result = planItems(plan, { alterar: (Array.isArray(a.alterar) ? a.alterar.slice(0, 30) : []) as ItemChange[], remover: Array.isArray(a.remover) ? a.remover.slice(0, 30) : [], adicionar: wanted });
      plan = result.plan; confirm = false;
      const all = [...erros, ...result.erros];
      return { ok: true, ...(all.length ? { erros: all } : {}), mudancas: describePlan(plan) };
    },
    async editar_mao_de_obra(a) {
      if (!deps.canEdit()) return NO_EDIT;
      if (!plan) return NO_PLAN;
      if (!deps.seesCost()) return { erro: NO_LABOR };
      const list = (value: unknown) => (Array.isArray(value) ? value.slice(0, 20) : []);
      const result = planLabor(plan, { adicionar: list(a.adicionar) as LaborInput[], alterar: list(a.alterar) as LaborChange[], remover: list(a.remover) });
      plan = result.plan; confirm = false;
      return { ok: true, ...(result.erros.length ? { erros: result.erros } : {}), mudancas: describePlan(plan) };
    },
    async editar_ver() {
      if (!plan) return NO_PLAN;
      return { proposta: `${plan.base.number} REV ${String(plan.base.revision).padStart(2, '0')}`, mudancas: describePlan(plan) };
    },
    async editar_descartar() {
      plan = null; confirm = false;
      return { ok: true };
    },
    async finalizar_edicao() {
      if (!deps.canEdit()) return NO_EDIT;
      if (!plan) return NO_PLAN;
      if (planIsEmpty(plan)) return { erro: 'Ainda não há nenhuma mudança anotada. Pergunte à pessoa o que alterar.' };
      confirm = true;
      return { ok: true, aviso: 'Nada foi alterado ainda. Um cartão com a lista de mudanças aparece quando você terminar de responder. Peça que a pessoa confira e toque em Aplicar alterações.' };
    },
  };

  function declarations(S: SchemaBuilder) {
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
  }

  return {
    run: RUN,
    declarations,
    clearConfirm() { confirm = false; },
    takeConfirm(): EditPlan | null { const out = confirm ? plan : null; confirm = false; return out; },
    getPlan(): EditPlan | null { return plan; },
    /** Depois de aplicar: guarda o que sobrou (nova tentativa nao repete) ou, com `done`, fecha a edicao. */
    setPlan(next: EditPlan | null, done = false) { plan = done ? null : next; },
    reset() { plan = null; confirm = false; },
  };
}
