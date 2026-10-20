// Rascunho de proposta montado pela IA (conversa). Fica so na memoria do assistente: nada e gravado ate a
// pessoa tocar em "Criar proposta". Aqui so ha regra pura (validar, juntar, dizer o que falta); quem fala
// com a API e `assistantCommit.ts`. A IA nunca define preco, custo, BDI nem imposto: vem dos padroes da empresa.
export type DraftModel = 'servico' | 'fornecimento';

export interface DraftItem {
  /** Codigo do catalogo; sem ele a linha e avulsa (entra sem preco). */
  code?: string;
  description: string;
  unit: string;
  quantity: number;
  /** Custo unitario dito pela pessoa (so item avulso, so com permissao de custo); o preco de venda sai do BDI e do imposto. */
  unitCost?: number;
}

export interface ProposalDraft {
  clientId?: string;
  clientName?: string;
  newClient?: boolean;
  workId?: string;
  workName?: string;
  workAddress?: string;
  newWork?: boolean;
  scope?: string;
  executionTerm?: string;
  paymentTerms?: string;
  warranty?: string;
  validityDays?: number;
  model?: DraftModel;
  /** Multiplicador (25% = 1,25) e imposto em %; so quando a pessoa informa e pode ver custo. Sem eles valem os padroes da empresa. */
  bdiMultiplier?: number;
  taxPercentage?: number;
  items: DraftItem[];
}

export const MAX_ITEMS = 60;
const SCOPE_MIN = 3;
const SCOPE_MAX = 1200;
const SHORT_MAX = 300;
const DEFAULT_UNIT = 'un';

export const emptyDraft = (): ProposalDraft => ({ items: [] });

const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const plain = (value: string): string => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export interface FieldsInput {
  escopo?: unknown; prazo_execucao?: unknown; pagamento?: unknown; garantia?: unknown; validade_dias?: unknown; modelo?: unknown;
  bdi?: unknown; imposto_pct?: unknown;
}

export function setFields(draft: ProposalDraft, input: FieldsInput): { draft: ProposalDraft; erros: string[] } {
  const next: ProposalDraft = { ...draft };
  const erros: string[] = [];
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
}

export function withClient(draft: ProposalDraft, client: { id: string; name: string } | { newName: string }): ProposalDraft {
  // Repetir o mesmo cliente (a IA costuma reenviar) nao pode apagar a obra ja escolhida.
  if ('id' in client && draft.clientId === client.id) return { ...draft, clientName: client.name };
  const base: ProposalDraft = { ...draft, clientId: undefined, clientName: undefined, newClient: undefined };
  // Trocar de cliente invalida a obra escolhida para o anterior.
  const cleared = { ...base, workId: undefined, workName: undefined, workAddress: undefined, newWork: undefined };
  return 'id' in client ? { ...cleared, clientId: client.id, clientName: client.name } : { ...cleared, clientName: client.newName, newClient: true };
}

export function withWork(draft: ProposalDraft, work: { id: string; name: string } | { newName: string; address?: string }): ProposalDraft {
  const base: ProposalDraft = { ...draft, workId: undefined, workName: undefined, workAddress: undefined, newWork: undefined };
  return 'id' in work ? { ...base, workId: work.id, workName: work.name } : { ...base, workName: work.newName, workAddress: work.address || undefined, newWork: true };
}

export interface ItemInput { codigo?: unknown; descricao?: unknown; unidade?: unknown; quantidade?: unknown; custo_unitario?: unknown }
/** Item ja resolvido no catalogo (a ferramenta consulta a API e passa o que achou). */
export interface CatalogHit { code: string; description: string; unit: string }

export function addItems(draft: ProposalDraft, inputs: Array<{ input: ItemInput; hit?: CatalogHit }>): { draft: ProposalDraft; erros: string[] } {
  const items = [...draft.items];
  const erros: string[] = [];
  for (const { input, hit } of inputs) {
    const quantity = Number(input.quantidade);
    const label = text(input.codigo, 80) || text(input.descricao, 80) || 'item';
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) { erros.push(`Quantidade inválida em "${label}".`); continue; }
    const qty = Math.round(quantity * 1000) / 1000;
    const description = hit?.description ?? text(input.descricao, 240);
    if (description.length < 2) { erros.push(`Informe a descrição de "${label}".`); continue; }
    const unit = (hit?.unit ?? text(input.unidade, 24)) || DEFAULT_UNIT;
    const code = hit?.code;
    let unitCost: number | undefined;
    if (input.custo_unitario !== undefined && input.custo_unitario !== null) {
      const cost = Number(input.custo_unitario);
      if (hit) { erros.push(`"${label}" é do catálogo e usa o custo do catálogo; o custo informado foi ignorado.`); } else if (Number.isFinite(cost) && cost >= 0 && cost <= 100_000_000) unitCost = Math.round(cost * 100) / 100;
      else { erros.push(`Custo inválido em "${label}".`); continue; }
    }
    const same = items.findIndex((item) => (code ? item.code === code : !item.code && plain(item.description) === plain(description)));
    // Item que ja esta no rascunho: a quantidade dita agora vale ("na verdade sao 6"), nao soma com a anterior.
    if (same >= 0) { items[same] = { ...items[same], quantity: qty, ...(unitCost !== undefined ? { unitCost } : {}) }; continue; }
    if (items.length >= MAX_ITEMS) { erros.push(`Limite de ${MAX_ITEMS} itens por rascunho.`); break; }
    items.push({ code, description, unit, quantity: qty, ...(unitCost !== undefined ? { unitCost } : {}) });
  }
  return { draft: { ...draft, items }, erros };
}

/** Remove por numero (1, 2...) como mostrado em `summary`, ou por trecho da descricao/codigo. */
export function removeItems(draft: ProposalDraft, refs: unknown[]): { draft: ProposalDraft; removidos: number } {
  const drop = new Set<number>();
  for (const ref of refs) {
    // O modelo manda o numero como texto ("2") ou numero: os dois valem.
    const asNumber = typeof ref === 'string' && /^\s*\d{1,3}\s*$/.test(ref) ? Number(ref) : ref;
    if (typeof asNumber === 'number' && Number.isInteger(asNumber)) { if (asNumber >= 1 && asNumber <= draft.items.length) drop.add(asNumber - 1); continue; }
    const term = plain(typeof ref === 'string' ? ref : '');
    if (term.length < 2) continue;
    draft.items.forEach((item, index) => { if (plain(`${item.code ?? ''} ${item.description}`).includes(term)) drop.add(index); });
  }
  return { draft: { ...draft, items: draft.items.filter((_, index) => !drop.has(index)) }, removidos: drop.size };
}

/** O que ainda falta para criar (em portugues, para a IA perguntar). */
export function missing(draft: ProposalDraft): string[] {
  const out: string[] = [];
  if (!draft.clientName) out.push('cliente');
  if (!draft.workName) out.push('obra');
  if (!draft.scope) out.push('escopo');
  return out;
}

/** Texto do campo `scope` da proposta: puro se so ha escopo; JSON de condicoes quando ha prazo, pagamento ou garantia. */
export function scopeForSave(draft: ProposalDraft): string {
  const scope = draft.scope ?? '';
  if (!draft.executionTerm && !draft.paymentTerms && !draft.warranty) return scope;
  const parts = { scope, executionTerm: draft.executionTerm ?? '', paymentTerms: draft.paymentTerms ?? '', warranty: draft.warranty ?? '', notes: '' };
  // O campo guarda ate 1200 caracteres do JSON JA escapado (aspas e barras crescem): corta o maior texto ate caber.
  // O escopo nunca passa de SCOPE_MIN letras; as condicoes podem ir a zero.
  for (let json = JSON.stringify(parts); json.length > SCOPE_MAX; json = JSON.stringify(parts)) {
    const overflow = json.length - SCOPE_MAX;
    const cut = Math.max(1, Math.ceil(overflow / 2));
    const longest = (['scope', 'executionTerm', 'paymentTerms', 'warranty'] as const)
      .filter((key) => parts[key].length > (key === 'scope' ? SCOPE_MIN : 0))
      .sort((a, b) => parts[b].length - parts[a].length)[0];
    parts[longest] = parts[longest].slice(0, Math.max(longest === 'scope' ? SCOPE_MIN : 0, parts[longest].length - cut));
  }
  return JSON.stringify(parts);
}

/** Data de validade (yyyy-mm-dd, horario de Brasilia) ou null se a pessoa nao informou dias. */
export function validUntil(draft: ProposalDraft, now: Date = new Date()): string | null {
  if (!draft.validityDays) return null;
  const brasilia = new Date(now.getTime() - 3 * 3_600_000);
  brasilia.setUTCDate(brasilia.getUTCDate() + draft.validityDays);
  return brasilia.toISOString().slice(0, 10);
}

/** Resumo para o modelo e para o cartao de confirmacao (sem valores: o rascunho nao tem preco). */
export function summary(draft: ProposalDraft) {
  return {
    cliente: draft.clientName ? { nome: draft.clientName, situacao: draft.newClient ? 'novo cadastro' : 'já cadastrado' } : null,
    obra: draft.workName ? { nome: draft.workName, endereco: draft.workAddress ?? null, situacao: draft.newWork ? 'nova obra' : 'já cadastrada' } : null,
    escopo: draft.scope ?? null,
    prazo_execucao: draft.executionTerm ?? null,
    pagamento: draft.paymentTerms ?? null,
    garantia: draft.warranty ?? null,
    validade_dias: draft.validityDays ?? null,
    modelo: draft.model ?? null,
    bdi: draft.bdiMultiplier ?? null,
    imposto_pct: draft.taxPercentage ?? null,
    itens: draft.items.map((item, index) => ({
      numero: index + 1, codigo: item.code ?? null, descricao: item.description, unidade: item.unit, quantidade: item.quantity,
      custo_unitario: item.unitCost ?? null, preco: item.code ? 'do catálogo' : item.unitCost !== undefined ? 'custo informado' : 'sem preço (avulso)',
    })),
    falta: missing(draft),
  };
}
