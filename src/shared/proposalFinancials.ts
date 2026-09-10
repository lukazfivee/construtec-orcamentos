import type { ProposalDetail } from './contracts';
import { multiplyDecimal, sumDecimal } from './decimal';

export const calculateProposalTotals = (materials: number, labor: number, bdiMultiplier: number) => {
  const baseCost = sumDecimal([materials, labor]);
  const finalValue = multiplyDecimal([baseCost, bdiMultiplier]);
  return { materials, labor, baseCost, finalValue, additions: sumDecimal([finalValue, -baseCost]) };
};

// Os aliases legados cost/sale representam somente materiais.
export const getProposalFinancials = (proposal: ProposalDetail) => {
  const materials = proposal.totals.materials ?? sumDecimal(proposal.items.map(item => item.totalCost));
  const labor = proposal.totals.labor ?? sumDecimal((proposal.laborItems ?? []).map(item => item.totalCost));
  const calculated = calculateProposalTotals(materials, labor, proposal.bdiMultiplier);
  return {
    ...calculated,
    baseCost: proposal.totals.baseCost ?? calculated.baseCost,
    finalValue: proposal.totals.finalValue ?? calculated.finalValue,
    additions: proposal.totals.additions ?? calculated.additions,
  };
};
