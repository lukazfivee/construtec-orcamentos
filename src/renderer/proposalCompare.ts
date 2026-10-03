// Comparativo de revisoes (Rodada 23, telas 23q a 23t): mesma conta do celular. Usa so o que a API entrega:
// sem p10 o servidor zera custo e BDI, e aqui os valores sao de venda. A mao de obra entra como uma linha por revisao.
import type { ProposalDetail } from '../shared/contracts';
import { laborSale } from './proposalPdfPages';

export type CompareLine = { code: string; description: string; category: string; quantity: number; unit: string; unitSale: number; totalSale: number };
export type CompareKind = 'add' | 'del' | 'qty' | 'price' | 'same';
export type CompareRow = { kind: CompareKind; item: CompareLine; before?: CompareLine; qtyChanged: boolean; priceChanged: boolean; delta: number };
export type CompareGroup = { system: string; rows: CompareRow[]; changed: number; delta: number };
export type CompareResult = {
  rows: CompareRow[];
  groups: CompareGroup[];
  finalFrom: number;
  finalTo: number;
  finalDelta: number;
  percent: number;
  itemsDelta: number;
  // Parte do valor final que nao veio dos itens: BDI, impostos ou ajuste geral de preco.
  generalDelta: number;
  counts: { add: number; del: number; qty: number; price: number };
  changedCount: number;
  bdiChanged: boolean;
};

const same = (a: number, b: number) => Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.005;
const keyOf = (item: CompareLine) => `${(item.code || '').trim().toLowerCase()}|${(item.description || '').trim().toLowerCase()}`;

export const compareLines = (proposal: ProposalDetail): CompareLine[] => {
  const lines: CompareLine[] = proposal.items.map((item) => ({
    code: item.code || '', description: item.description, category: item.category || 'Itens', quantity: item.quantity, unit: item.unit,
    unitSale: item.unitSale, totalSale: item.totalSale,
  }));
  const labor = laborSale(proposal);
  if (labor > 0) lines.push({ code: '', description: 'Mão de obra e serviços técnicos', category: 'Mão de obra', quantity: 1, unit: 'vb', unitSale: labor, totalSale: labor });
  return lines;
};

export const compareProposals = (from: ProposalDetail, to: ProposalDetail): CompareResult => {
  const before = new Map(compareLines(from).map((item) => [keyOf(item), item]));
  const rows: CompareRow[] = [];
  for (const item of compareLines(to)) {
    const old = before.get(keyOf(item));
    before.delete(keyOf(item));
    if (!old) { rows.push({ kind: 'add', item, qtyChanged: false, priceChanged: false, delta: item.totalSale || 0 }); continue; }
    const qtyChanged = !same(old.quantity, item.quantity);
    const priceChanged = !same(old.unitSale, item.unitSale);
    rows.push({ kind: qtyChanged ? 'qty' : priceChanged ? 'price' : 'same', item, before: old, qtyChanged, priceChanged, delta: (item.totalSale || 0) - (old.totalSale || 0) });
  }
  before.forEach((old) => rows.push({ kind: 'del', item: old, qtyChanged: false, priceChanged: false, delta: -(old.totalSale || 0) }));

  const finalFrom = from.totals.finalValue ?? 0;
  const finalTo = to.totals.finalValue ?? 0;
  const itemsDelta = rows.reduce((sum, row) => sum + row.delta, 0);
  const systems = [...new Set(rows.map((row) => row.item.category || 'Itens'))];
  const groups = systems.map((system) => {
    const own = rows.filter((row) => (row.item.category || 'Itens') === system);
    const changedRows = own.filter((row) => row.kind !== 'same');
    return { system, rows: own, changed: changedRows.length, delta: own.reduce((sum, row) => sum + row.delta, 0) };
  });
  const count = (kind: 'add' | 'del' | 'qty' | 'price') => rows.filter((row) => (kind === 'price' ? row.kind === 'price' || (row.kind === 'qty' && row.priceChanged) : row.kind === kind)).length;
  return {
    rows,
    groups,
    finalFrom,
    finalTo,
    finalDelta: finalTo - finalFrom,
    percent: finalFrom ? ((finalTo - finalFrom) / finalFrom) * 100 : 0,
    itemsDelta,
    generalDelta: finalTo - finalFrom - itemsDelta,
    counts: { add: count('add'), del: count('del'), qty: count('qty'), price: count('price') },
    changedCount: rows.filter((row) => row.kind !== 'same').length,
    bdiChanged: Math.abs((from.bdiMultiplier || 0) - (to.bdiMultiplier || 0)) > 1e-6,
  };
};

export const rowTag = (row: CompareRow) =>
  row.kind === 'add' ? 'Incluído' : row.kind === 'del' ? 'Removido' : row.kind === 'same' ? 'Igual'
    : row.qtyChanged && row.priceChanged ? 'Qtd. e preço' : row.qtyChanged ? 'Quantidade' : 'Preço';

export const deltaDirection = (value: number): 'up' | 'down' | 'eq' => (value > 0.5 ? 'up' : value < -0.5 ? 'down' : 'eq');
export const rowDirection = (row: CompareRow): 'up' | 'down' | 'eq' => (row.delta > 0.004 ? 'up' : row.delta < -0.004 ? 'down' : 'eq');
