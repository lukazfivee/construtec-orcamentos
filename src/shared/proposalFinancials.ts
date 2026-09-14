import type { ProposalDetail } from './contracts';
import { multiplyDecimal, sumDecimal } from './decimal';

export const calculateProposalTotals = (
  materials: number,
  labor: number,
  bdiMultiplier: number,
  taxPercentage = 0
) => {
  const baseCost = sumDecimal([materials, labor]);
  const subtotalWithBdi = multiplyDecimal([baseCost, bdiMultiplier]);
  const taxAmount = taxPercentage > 0 ? multiplyDecimal([subtotalWithBdi, taxPercentage], 100) : 0;
  const finalValue = sumDecimal([subtotalWithBdi, taxAmount]);
  const additions = sumDecimal([finalValue, -baseCost]);

  if (taxPercentage > 0) {
    return {
      materials,
      labor,
      baseCost,
      subtotalWithBdi,
      taxPercentage,
      taxAmount,
      finalValue,
      additions,
    };
  }

  return { materials, labor, baseCost, finalValue, additions };
};

// Os aliases legados cost/sale representam somente materiais.
export const getProposalFinancials = (proposal: ProposalDetail) => {
  const materials = proposal.totals.materials ?? sumDecimal(proposal.items.map(item => item.totalCost));
  const labor = proposal.totals.labor ?? sumDecimal((proposal.laborItems ?? []).map(item => item.totalCost));
  const taxPercentage = proposal.taxPercentage ?? 0;
  const calculated = calculateProposalTotals(materials, labor, proposal.bdiMultiplier, taxPercentage);
  return {
    ...calculated,
    baseCost: proposal.totals.baseCost ?? calculated.baseCost,
    finalValue: proposal.totals.finalValue ?? calculated.finalValue,
    additions: proposal.totals.additions ?? calculated.additions,
    taxPercentage,
    taxAmount: proposal.totals.taxAmount ?? calculated.taxAmount ?? 0,
  };
};
