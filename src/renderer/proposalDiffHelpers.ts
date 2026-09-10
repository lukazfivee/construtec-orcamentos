import { getProposalFinancials } from '../shared/proposalFinancials';
import type { ProposalDetail, ProposalLaborItem, ProposalLine } from '../shared/contracts';

export type DiffStatus = 'added' | 'removed' | 'changed' | 'unchanged';

export interface ProposalItemDiff {
  key: string;
  status: DiffStatus;
  code: string;
  description: string;
  unit: string;
  category: string;
  qtyA: number | null;
  qtyB: number | null;
  unitCostA: number | null;
  unitCostB: number | null;
  unitSaleA: number | null;
  unitSaleB: number | null;
  totalSaleA: number | null;
  totalSaleB: number | null;
  deltaQty: number;
  deltaSale: number;
}

export interface ProposalLaborDiff {
  description: string;
  status: DiffStatus;
  countA: number | null;
  countB: number | null;
  hoursA: number | null;
  hoursB: number | null;
  rateA: number | null;
  rateB: number | null;
  costA: number | null;
  costB: number | null;
  deltaHours: number;
  deltaCost: number;
}

export interface FinancialDelta {
  saleA: number;
  saleB: number;
  deltaSale: number;
  percentSale: number;
  costA: number;
  costB: number;
  deltaCost: number;
  itemCountA: number;
  itemCountB: number;
  bdiA: number;
  bdiB: number;
}

export interface DiffSummaryStats {
  addedCount: number;
  removedCount: number;
  changedCount: number;
  unchangedCount: number;
}

const areFloatsEqual = (a: number, b: number, epsilon = 0.005): boolean => {
  return Math.abs(a - b) < epsilon;
};

const getItemMatchKey = (item: ProposalLine): string => {
  const code = item.code?.trim();
  if (code && code.length > 0) {
    return `code:${code.toUpperCase()}`;
  }
  return `desc:${item.description.trim().toLowerCase()}`;
};

export function computeProposalItemsDiff(
  itemsA: ProposalLine[],
  itemsB: ProposalLine[]
): { diffs: ProposalItemDiff[]; stats: DiffSummaryStats } {
  const mapA = new Map<string, ProposalLine>();
  itemsA.forEach((it) => mapA.set(getItemMatchKey(it), it));

  const diffs: ProposalItemDiff[] = [];
  const handledKeysInA = new Set<string>();

  // Process items in B (current or target)
  for (const itemB of itemsB) {
    const key = getItemMatchKey(itemB);
    const itemA = mapA.get(key);

    if (!itemA) {
      diffs.push({
        key,
        status: 'added',
        code: itemB.code || '',
        description: itemB.description,
        unit: itemB.unit,
        category: itemB.category,
        qtyA: null,
        qtyB: itemB.quantity,
        unitCostA: null,
        unitCostB: itemB.unitCost,
        unitSaleA: null,
        unitSaleB: itemB.unitSale,
        totalSaleA: null,
        totalSaleB: itemB.totalSale,
        deltaQty: itemB.quantity,
        deltaSale: itemB.totalSale,
      });
    } else {
      handledKeysInA.add(key);
      const qtyChanged = !areFloatsEqual(itemA.quantity, itemB.quantity);
      const priceChanged = !areFloatsEqual(itemA.unitSale, itemB.unitSale);
      const isChanged = qtyChanged || priceChanged;

      diffs.push({
        key,
        status: isChanged ? 'changed' : 'unchanged',
        code: itemB.code || itemA.code || '',
        description: itemB.description,
        unit: itemB.unit,
        category: itemB.category,
        qtyA: itemA.quantity,
        qtyB: itemB.quantity,
        unitCostA: itemA.unitCost,
        unitCostB: itemB.unitCost,
        unitSaleA: itemA.unitSale,
        unitSaleB: itemB.unitSale,
        totalSaleA: itemA.totalSale,
        totalSaleB: itemB.totalSale,
        deltaQty: itemB.quantity - itemA.quantity,
        deltaSale: itemB.totalSale - itemA.totalSale,
      });
    }
  }

  // Process items in A that are missing in B (removed)
  for (const itemA of itemsA) {
    const key = getItemMatchKey(itemA);
    if (!handledKeysInA.has(key)) {
      diffs.push({
        key,
        status: 'removed',
        code: itemA.code || '',
        description: itemA.description,
        unit: itemA.unit,
        category: itemA.category,
        qtyA: itemA.quantity,
        qtyB: null,
        unitCostA: itemA.unitCost,
        unitCostB: null,
        unitSaleA: itemA.unitSale,
        unitSaleB: null,
        totalSaleA: itemA.totalSale,
        totalSaleB: null,
        deltaQty: -itemA.quantity,
        deltaSale: -itemA.totalSale,
      });
    }
  }

  const stats: DiffSummaryStats = {
    addedCount: diffs.filter((d) => d.status === 'added').length,
    removedCount: diffs.filter((d) => d.status === 'removed').length,
    changedCount: diffs.filter((d) => d.status === 'changed').length,
    unchangedCount: diffs.filter((d) => d.status === 'unchanged').length,
  };

  return { diffs, stats };
}

export function computeProposalLaborDiff(
  laborA: ProposalLaborItem[],
  laborB: ProposalLaborItem[]
): ProposalLaborDiff[] {
  const mapA = new Map<string, ProposalLaborItem>();
  laborA.forEach((l) => mapA.set(l.description.trim().toLowerCase(), l));

  const diffs: ProposalLaborDiff[] = [];
  const handledKeysInA = new Set<string>();

  for (const lb of laborB) {
    const key = lb.description.trim().toLowerCase();
    const la = mapA.get(key);

    if (!la) {
      diffs.push({
        description: lb.description,
        status: 'added',
        countA: null,
        countB: lb.professionalCount,
        hoursA: null,
        hoursB: lb.plannedHours,
        rateA: null,
        rateB: lb.hourlyRate,
        costA: null,
        costB: lb.totalCost,
        deltaHours: lb.plannedHours,
        deltaCost: lb.totalCost,
      });
    } else {
      handledKeysInA.add(key);
      const changed =
        !areFloatsEqual(la.professionalCount, lb.professionalCount) ||
        !areFloatsEqual(la.plannedHours, lb.plannedHours) ||
        !areFloatsEqual(la.hourlyRate, lb.hourlyRate);

      diffs.push({
        description: lb.description,
        status: changed ? 'changed' : 'unchanged',
        countA: la.professionalCount,
        countB: lb.professionalCount,
        hoursA: la.plannedHours,
        hoursB: lb.plannedHours,
        rateA: la.hourlyRate,
        rateB: lb.hourlyRate,
        costA: la.totalCost,
        costB: lb.totalCost,
        deltaHours: lb.plannedHours - la.plannedHours,
        deltaCost: lb.totalCost - la.totalCost,
      });
    }
  }

  for (const la of laborA) {
    const key = la.description.trim().toLowerCase();
    if (!handledKeysInA.has(key)) {
      diffs.push({
        description: la.description,
        status: 'removed',
        countA: la.professionalCount,
        countB: null,
        hoursA: la.plannedHours,
        hoursB: null,
        rateA: la.hourlyRate,
        rateB: null,
        costA: la.totalCost,
        costB: null,
        deltaHours: -la.plannedHours,
        deltaCost: -la.totalCost,
      });
    }
  }

  return diffs;
}

export function computeFinancialDelta(
  propA: ProposalDetail,
  propB: ProposalDetail
): FinancialDelta {
  const saleA = getProposalFinancials(propA).finalValue;
  const saleB = getProposalFinancials(propB).finalValue;
  const costA = getProposalFinancials(propA).baseCost;
  const costB = getProposalFinancials(propB).baseCost;
  const deltaSale = saleB - saleA;
  const percentSale = saleA > 0 ? (deltaSale / saleA) * 100 : 0;

  return {
    saleA,
    saleB,
    deltaSale,
    percentSale,
    costA,
    costB,
    deltaCost: costB - costA,
    itemCountA: propA.items.length,
    itemCountB: propB.items.length,
    bdiA: propA.bdiMultiplier,
    bdiB: propB.bdiMultiplier,
  };
}
