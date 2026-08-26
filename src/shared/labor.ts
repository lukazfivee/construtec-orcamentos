export type LaborCalculationInput = {
  professionalCount: number;
  monthlySalary: number;
  monthlyFood: number;
  monthlyTransport: number;
  monthlyOtherCosts: number;
  standardMonthlyHours: number;
  plannedHours: number;
};

const round = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export const calculateLaborItem = (input: LaborCalculationInput) => {
  if (!Number.isFinite(input.standardMonthlyHours) || input.standardMonthlyHours <= 0) {
    throw new Error('LABOR_HOURS_INVALID');
  }
  const monthlyCost = input.monthlySalary
    + input.monthlyFood
    + input.monthlyTransport
    + input.monthlyOtherCosts;
  const hourlyRateRaw = monthlyCost / input.standardMonthlyHours;
  const totalCostRaw = input.professionalCount * hourlyRateRaw * input.plannedHours;

  return {
    monthlyCost: round(monthlyCost, 2),
    hourlyRate: round(hourlyRateRaw, 4),
    totalCost: round(totalCostRaw, 2),
  };
};
