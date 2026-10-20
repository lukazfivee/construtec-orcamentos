// Edicao de proposta existente pela IA (regra pura). A IA abre uma proposta editavel (ultima revisao, em edicao ou em
// revisao), anota as mudancas num plano em memoria e mostra um cartao com a lista; so o botao "Aplicar alteracoes"
// grava, pelas mesmas rotas do editor. Numeros de item e de mao de obra seguem a lista mostrada ao abrir e nao mudam
// ate o fim (remover o item 2 nao renumera o 3). A IA nao altera status, cliente, obra, kits nem envia ou aprova.
import type { ProposalDetail } from '../../shared/contracts';
import { addItems, findOne, normalizeLabor, packScope, parseScope, refIndexes, setFields, validUntil } from './proposalDraft';
import type { CatalogHit, DraftItem, DraftLabor, FieldsInput, ItemInput, LaborInput, ScopeParts } from './proposalDraft';

export interface EditBase {
  id: string;
  number: string;
  revision: number;
  status: string;
  clientName: string;
  workName: string;
  scope: string;
  validUntil: string | null;
  bdiMultiplier: number | null;
  taxPercentage: number | null;
  standardMonthlyHours: number;
  items: Array<{ id: string; code: string; description: string; unit: string; quantity: number; unitCost: number; unitSale: number; inCatalog: boolean }>;
  labor: Array<DraftLabor & { id: string; standardMonthlyHours: number }>;
}

export interface ItemPatch { quantity?: number; unit?: string; description?: string; unitCost?: number }

export interface EditPlan {
  base: EditBase;
  /** Escopo e condicoes ja mesclados com o que a proposta tinha; so existe se algum texto mudou. */
  scopeParts?: ScopeParts;
  validUntil?: string;
  bdi?: number;
  tax?: number;
  itemUpdates: Array<{ id: string; patch: ItemPatch }>;
  itemRemovals: string[];
  itemAdds: DraftItem[];
  laborUpdates: Array<{ id: string; labor: DraftLabor }>;
  laborRemovals: string[];
  laborAdds: DraftLabor[];
}

const DEFAULT_STANDARD_HOURS = 176;
const LABOR_ADD_MAX = 20;

/** So a ultima revisao, em edicao ou em revisao, aceita mudanca (mesma regra do servidor e do editor). */
export const isEditable = (p: Pick<ProposalDetail, 'status' | 'isLatest'>): boolean => p.isLatest !== false && (p.status === 'draft' || p.status === 'review');

export function toEditBase(p: ProposalDetail): EditBase {
  const standard = Number(p.standardMonthlyHours) > 0 ? Number(p.standardMonthlyHours) : DEFAULT_STANDARD_HOURS;
  return {
    id: p.id, number: p.number, revision: p.revision, status: p.status, clientName: p.clientName, workName: p.workName, scope: p.scope ?? '',
    validUntil: p.validUntil ?? null, bdiMultiplier: p.bdiMultiplier ?? null, taxPercentage: p.taxPercentage ?? null, standardMonthlyHours: standard,
    items: (p.items ?? []).map((i) => ({ id: i.id, code: i.code, description: i.description, unit: i.unit, quantity: Number(i.quantity), unitCost: Number(i.unitCost) || 0, unitSale: Number(i.unitSale) || 0, inCatalog: i.inCatalog !== false })),
    labor: (p.laborItems ?? []).map((l) => ({
      id: l.id, description: l.description, professionalCount: Number(l.professionalCount), monthlySalary: Number(l.monthlySalary), monthlyFood: Number(l.monthlyFood),
      monthlyTransport: Number(l.monthlyTransport), monthlyOtherCosts: Number(l.monthlyOtherCosts), plannedHours: Number(l.plannedHoursPerProfessional ?? l.plannedHours),
      standardMonthlyHours: Number(l.standardMonthlyHours) > 0 ? Number(l.standardMonthlyHours) : standard,
    })),
  };
}

export const startPlan = (base: EditBase): EditPlan => ({ base, itemUpdates: [], itemRemovals: [], itemAdds: [], laborUpdates: [], laborRemovals: [], laborAdds: [] });

export const planIsEmpty = (plan: EditPlan): boolean => !plan.scopeParts && plan.validUntil === undefined && plan.bdi === undefined && plan.tax === undefined
  && !plan.itemUpdates.length && !plan.itemRemovals.length && !plan.itemAdds.length && !plan.laborUpdates.length && !plan.laborRemovals.length && !plan.laborAdds.length;

const itemText = (item: { code?: string; description: string }) => `${item.code ?? ''} ${item.description}`;

/** Escopo, condicoes, validade (em dias a partir de hoje), BDI e imposto. */
export function planFields(plan: EditPlan, input: FieldsInput, now: Date = new Date()): { plan: EditPlan; erros: string[] } {
  const scratch = setFields({ items: [] }, input);
  const d = scratch.draft;
  const next: EditPlan = { ...plan };
  let parts = plan.scopeParts ?? parseScope(plan.base.scope);
  let touched = false;
  if (input.escopo !== undefined && d.scope !== undefined) { parts = { ...parts, scope: d.scope }; touched = true; }
  if (input.prazo_execucao !== undefined) { parts = { ...parts, executionTerm: d.executionTerm ?? '' }; touched = true; }
  if (input.pagamento !== undefined) { parts = { ...parts, paymentTerms: d.paymentTerms ?? '' }; touched = true; }
  if (input.garantia !== undefined) { parts = { ...parts, warranty: d.warranty ?? '' }; touched = true; }
  if (touched) next.scopeParts = parts;
  if (input.validade_dias !== undefined && d.validityDays) next.validUntil = validUntil(d, now) as string;
  if (input.bdi !== undefined && d.bdiMultiplier !== undefined) next.bdi = d.bdiMultiplier;
  if (input.imposto_pct !== undefined && d.taxPercentage !== undefined) next.tax = d.taxPercentage;
  return { plan: next, erros: scratch.erros };
}

export interface ItemChange { item?: unknown; quantidade?: unknown; unidade?: unknown; descricao?: unknown; custo_unitario?: unknown }

export function planItems(plan: EditPlan, input: { alterar?: ItemChange[]; remover?: unknown[]; adicionar?: Array<{ input: ItemInput; hit?: CatalogHit }> }): { plan: EditPlan; erros: string[] } {
  const erros: string[] = [];
  let updates = plan.itemUpdates.map((u) => ({ id: u.id, patch: { ...u.patch } }));
  let removals = [...plan.itemRemovals];
  for (const change of input.alterar ?? []) {
    const found = findOne(plan.base.items, change.item, itemText, 'item');
    if (!('index' in found)) { erros.push(found.erro); continue; }
    const target = plan.base.items[found.index];
    if (removals.includes(target.id)) { erros.push(`O item ${found.index + 1} já está marcado para remoção.`); continue; }
    const patch: ItemPatch = {};
    if (change.quantidade !== undefined) {
      const q = Number(change.quantidade);
      if (Number.isFinite(q) && q > 0 && q <= 1_000_000) patch.quantity = Math.round(q * 1000) / 1000; else { erros.push(`Quantidade inválida no item ${found.index + 1}.`); continue; }
    }
    if (change.unidade !== undefined) {
      const u = typeof change.unidade === 'string' ? change.unidade.trim().slice(0, 24) : '';
      if (u) patch.unit = u; else { erros.push(`Unidade inválida no item ${found.index + 1}.`); continue; }
    }
    if (change.descricao !== undefined) {
      const t = typeof change.descricao === 'string' ? change.descricao.trim().replace(/\s+/g, ' ').slice(0, 240) : '';
      if (t.length >= 2) patch.description = t; else { erros.push(`Descrição inválida no item ${found.index + 1}.`); continue; }
    }
    if (change.custo_unitario !== undefined) {
      const c = Number(change.custo_unitario);
      if (Number.isFinite(c) && c >= 0 && c <= 100_000_000) patch.unitCost = Math.round(c * 100) / 100; else { erros.push(`Custo inválido no item ${found.index + 1}.`); continue; }
    }
    if (!Object.keys(patch).length) { erros.push(`Nada para alterar no item ${found.index + 1}.`); continue; }
    const existing = updates.find((u) => u.id === target.id);
    if (existing) existing.patch = { ...existing.patch, ...patch }; else updates.push({ id: target.id, patch });
  }
  const drop = refIndexes(plan.base.items, input.remover ?? [], itemText);
  for (const index of drop) {
    const id = plan.base.items[index].id;
    if (!removals.includes(id)) removals.push(id);
    updates = updates.filter((u) => u.id !== id);
  }
  removals = [...new Set(removals)];
  const added = input.adicionar?.length ? addItems({ items: plan.itemAdds }, input.adicionar) : { draft: { items: plan.itemAdds }, erros: [] as string[] };
  return { plan: { ...plan, itemUpdates: updates, itemRemovals: removals, itemAdds: added.draft.items }, erros: [...erros, ...added.erros] };
}

export interface LaborChange extends LaborInput { item?: unknown }

export function planLabor(plan: EditPlan, input: { adicionar?: LaborInput[]; alterar?: LaborChange[]; remover?: unknown[] }): { plan: EditPlan; erros: string[] } {
  const erros: string[] = [];
  const updates = plan.laborUpdates.map((u) => ({ id: u.id, labor: { ...u.labor } }));
  let removals = [...plan.laborRemovals];
  const adds = [...plan.laborAdds];
  const text = (l: { description: string }) => l.description;
  for (const change of input.alterar ?? []) {
    const found = findOne(plan.base.labor, change.item, text, 'mão de obra');
    if (!('index' in found)) { erros.push(found.erro); continue; }
    const target = plan.base.labor[found.index];
    if (removals.includes(target.id)) { erros.push(`A mão de obra ${found.index + 1} já está marcada para remoção.`); continue; }
    const existing = updates.find((u) => u.id === target.id);
    const result = normalizeLabor(change, existing?.labor ?? target);
    if (!result.labor) { erros.push(result.erro as string); continue; }
    if (existing) existing.labor = result.labor; else updates.push({ id: target.id, labor: result.labor });
  }
  for (const index of refIndexes(plan.base.labor, input.remover ?? [], text)) {
    const id = plan.base.labor[index].id;
    if (!removals.includes(id)) removals.push(id);
  }
  removals = [...new Set(removals)];
  for (const raw of input.adicionar ?? []) {
    const result = normalizeLabor(raw);
    if (!result.labor) { erros.push(result.erro as string); continue; }
    const key = result.labor.description.toLowerCase();
    const same = adds.findIndex((l) => l.description.toLowerCase() === key);
    if (same >= 0) { adds[same] = result.labor; continue; }
    // O limite avisa em vez de descartar em silencio: o cartao final nao pode omitir trabalho pedido.
    if (adds.length >= LABOR_ADD_MAX) { erros.push(`Limite de ${LABOR_ADD_MAX} inclusões de mão de obra por alteração; "${result.labor.description}" não entrou.`); continue; }
    adds.push(result.labor);
  }
  return { plan: { ...plan, laborUpdates: updates.filter((u) => !removals.includes(u.id)), laborRemovals: removals, laborAdds: adds }, erros };
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (n: number) => String(n).replace('.', ',');
const dateBr = (iso: string) => iso.split('-').reverse().join('/');

/** Lista legivel das mudancas (vai para o cartao e para o modelo). */
export function describePlan(plan: EditPlan): string[] {
  const lines: string[] = [];
  if (plan.scopeParts) {
    const before = parseScope(plan.base.scope);
    const now = plan.scopeParts;
    if (now.scope !== before.scope) lines.push(`Escopo: ${now.scope}`);
    if (now.executionTerm !== before.executionTerm) lines.push(`Prazo de execução: ${now.executionTerm || '(removido)'}`);
    if (now.paymentTerms !== before.paymentTerms) lines.push(`Pagamento: ${now.paymentTerms || '(removido)'}`);
    if (now.warranty !== before.warranty) lines.push(`Garantia: ${now.warranty || '(removida)'}`);
  }
  if (plan.validUntil !== undefined) lines.push(`Validade: até ${dateBr(plan.validUntil)}`);
  if (plan.bdi !== undefined) lines.push(`BDI: ${num(plan.bdi)}`);
  if (plan.tax !== undefined) lines.push(`Imposto: ${num(plan.tax)}%`);
  const itemRef = (id: string) => { const index = plan.base.items.findIndex((i) => i.id === id); return `item ${index + 1} (${plan.base.items[index]?.description ?? '?'})`; };
  for (const { id, patch } of plan.itemUpdates) {
    const was = plan.base.items.find((i) => i.id === id);
    const changes: string[] = [];
    if (patch.quantity !== undefined) changes.push(`quantidade ${num(was?.quantity ?? 0)} → ${num(patch.quantity)}`);
    if (patch.unit !== undefined) changes.push(`unidade ${was?.unit ?? ''} → ${patch.unit}`);
    if (patch.description !== undefined) changes.push(`descrição → ${patch.description}`);
    if (patch.unitCost !== undefined) changes.push(`custo ${brl(was?.unitCost ?? 0)} → ${brl(patch.unitCost)}`);
    lines.push(`Alterar ${itemRef(id)}: ${changes.join('; ')}`);
  }
  for (const id of plan.itemRemovals) lines.push(`Remover ${itemRef(id)}`);
  for (const item of plan.itemAdds) lines.push(`Adicionar ${num(item.quantity)} ${item.unit} · ${item.description}${item.code ? ' (catálogo)' : item.unitCost !== undefined ? ` (custo ${brl(item.unitCost)})` : ' (sem preço)'}`);
  const laborRef = (id: string) => { const index = plan.base.labor.findIndex((l) => l.id === id); return `mão de obra ${index + 1} (${plan.base.labor[index]?.description ?? '?'})`; };
  for (const { id, labor } of plan.laborUpdates) lines.push(`Alterar ${laborRef(id)}: ${labor.description}, ${num(labor.professionalCount)} prof., salário ${brl(labor.monthlySalary)}, ${num(labor.plannedHours)} h cada`);
  for (const id of plan.laborRemovals) lines.push(`Remover ${laborRef(id)}`);
  for (const labor of plan.laborAdds) lines.push(`Adicionar mão de obra: ${labor.description}, ${num(labor.professionalCount)} prof., salário ${brl(labor.monthlySalary)}, ${num(labor.plannedHours)} h cada`);
  return lines;
}

/** Visao para o modelo ao abrir: numeros das listas; custos so quando a pessoa pode ve-los. */
export function describeBase(base: EditBase, seesCost: boolean) {
  return {
    proposta: { numero: base.number, revisao: base.revision, situacao: base.status, cliente: base.clientName, obra: base.workName, validade: base.validUntil },
    ...(({ scope, executionTerm, paymentTerms, warranty, notes }) => ({ escopo: scope, prazo_execucao: executionTerm, pagamento: paymentTerms, garantia: warranty, observacoes: seesCost ? notes : undefined }))(parseScope(base.scope)),
    bdi: seesCost ? base.bdiMultiplier : undefined,
    imposto_pct: seesCost ? base.taxPercentage : undefined,
    itens: base.items.map((i, index) => ({ numero: index + 1, codigo: i.inCatalog ? i.code : null, descricao: i.description, unidade: i.unit, quantidade: i.quantity, custo_unitario: seesCost ? i.unitCost : undefined })),
    mao_de_obra: base.labor.map((l, index) => ({
      numero: index + 1, descricao: l.description, profissionais: l.professionalCount, horas_por_profissional: l.plannedHours,
      salario_mensal: seesCost ? l.monthlySalary : undefined,
    })),
  };
}

export interface EditApi {
  details(proposalId: string, input: { scope?: string; validUntil?: string | null }): Promise<unknown>;
  updateBdi(proposalId: string, bdiMultiplier: number): Promise<unknown>;
  updateTax(proposalId: string, taxPercentage: number): Promise<unknown>;
  updateItem(proposalId: string, itemId: string, patch: ItemPatch): Promise<unknown>;
  removeItems(proposalId: string, itemIds: string[]): Promise<unknown>;
  importItems(proposalId: string, items: Array<{ code?: string; description: string; unit?: string; quantity: number; unitCost?: number; unitSale?: number }>): Promise<unknown>;
  addLabor(proposalId: string, input: LaborApiInput): Promise<unknown>;
  updateLabor(proposalId: string, laborId: string, input: LaborApiInput): Promise<unknown>;
  removeLabor(proposalId: string, laborId: string): Promise<unknown>;
}

export interface LaborApiInput {
  description: string; professionalCount: number; monthlySalary: number; monthlyFood: number; monthlyTransport: number;
  monthlyOtherCosts: number; standardMonthlyHours: number; plannedHours: number;
}

export interface ApplyResult {
  /** O que sobrou (tudo, se falhou no primeiro passo; vazio se deu certo): tentar de novo nao repete o que ja foi feito. */
  plan: EditPlan;
  aplicado: string[];
  erro?: string;
}

const message = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

/** Grava o plano na ordem certa (BDI antes dos itens novos) e para no primeiro erro, devolvendo o que falta. */
export async function applyPlan(api: EditApi, input: EditPlan): Promise<ApplyResult> {
  let plan = input;
  const id = plan.base.id;
  const aplicado: string[] = [];
  type Step = { label: string; run: () => Promise<unknown>; strip: (p: EditPlan) => EditPlan };
  const steps: Step[] = [];
  if (plan.scopeParts || plan.validUntil !== undefined) {
    const { scopeParts, validUntil: until } = plan;
    steps.push({ label: 'Escopo, condições e validade', run: () => api.details(id, { ...(scopeParts ? { scope: packScope(scopeParts) } : {}), ...(until !== undefined ? { validUntil: until } : {}) }),
      strip: (p) => ({ ...p, scopeParts: undefined, validUntil: undefined }) });
  }
  if (plan.bdi !== undefined) { const v = plan.bdi; steps.push({ label: 'BDI', run: () => api.updateBdi(id, v), strip: (p) => ({ ...p, bdi: undefined }) }); }
  if (plan.tax !== undefined) { const v = plan.tax; steps.push({ label: 'Imposto', run: () => api.updateTax(id, v), strip: (p) => ({ ...p, tax: undefined }) }); }
  for (const update of plan.itemUpdates) {
    steps.push({ label: 'Alterar item', run: () => api.updateItem(id, update.id, update.patch), strip: (p) => ({ ...p, itemUpdates: p.itemUpdates.filter((u) => u.id !== update.id) }) });
  }
  if (plan.itemRemovals.length) {
    const ids = plan.itemRemovals;
    steps.push({ label: 'Remover itens', run: () => api.removeItems(id, ids), strip: (p) => ({ ...p, itemRemovals: [] }) });
  }
  if (plan.itemAdds.length) {
    const adds = plan.itemAdds;
    steps.push({ label: 'Adicionar itens', strip: (p) => ({ ...p, itemAdds: [] }), run: () => api.importItems(id, adds.map((item) => (item.code
      ? { code: item.code, description: item.description, quantity: item.quantity }
      : item.unitCost !== undefined
        ? { description: item.description, unit: item.unit, quantity: item.quantity, unitCost: item.unitCost }
        : { description: item.description, unit: item.unit, quantity: item.quantity, unitCost: 0, unitSale: 0 }))) });
  }
  const laborInput = (l: DraftLabor, hours: number): LaborApiInput => ({
    description: l.description, professionalCount: l.professionalCount, monthlySalary: l.monthlySalary, monthlyFood: l.monthlyFood,
    monthlyTransport: l.monthlyTransport, monthlyOtherCosts: l.monthlyOtherCosts, standardMonthlyHours: hours, plannedHours: l.plannedHours,
  });
  for (const update of plan.laborUpdates) {
    const hours = plan.base.labor.find((l) => l.id === update.id)?.standardMonthlyHours ?? plan.base.standardMonthlyHours;
    steps.push({ label: 'Alterar mão de obra', run: () => api.updateLabor(id, update.id, laborInput(update.labor, hours)), strip: (p) => ({ ...p, laborUpdates: p.laborUpdates.filter((u) => u.id !== update.id) }) });
  }
  for (const laborId of plan.laborRemovals) {
    steps.push({ label: 'Remover mão de obra', run: () => api.removeLabor(id, laborId), strip: (p) => ({ ...p, laborRemovals: p.laborRemovals.filter((x) => x !== laborId) }) });
  }
  for (const labor of plan.laborAdds) {
    steps.push({ label: 'Adicionar mão de obra', run: () => api.addLabor(id, laborInput(labor, plan.base.standardMonthlyHours)), strip: (p) => ({ ...p, laborAdds: p.laborAdds.filter((l) => l !== labor) }) });
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
}
