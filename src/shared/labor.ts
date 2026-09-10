import { multiplyDecimal, sumDecimal } from './decimal';
export type LaborCalculationInput = {
  professionalCount: number;
  monthlySalary: number;
  monthlyFood: number;
  monthlyTransport: number;
  monthlyOtherCosts: number;
  standardMonthlyHours: number;
  /** Horas previstas por profissional; não são as horas somadas da equipe. */
  plannedHours: number;
};

export const calculateLaborItem = (input: LaborCalculationInput) => {
  if (!Number.isFinite(input.standardMonthlyHours) || input.standardMonthlyHours <= 0) {
    throw new Error('LABOR_HOURS_INVALID');
  }
  const monthlyCost = sumDecimal([input.monthlySalary, input.monthlyFood,
    input.monthlyTransport, input.monthlyOtherCosts]);
  return {
    monthlyCost,
    hourlyRate: multiplyDecimal([monthlyCost], input.standardMonthlyHours, 4),
    plannedHoursPerProfessional: input.plannedHours,
    plannedTeamHours: multiplyDecimal([input.professionalCount, input.plannedHours], 1, 4),
    totalCost: multiplyDecimal([input.professionalCount, monthlyCost, input.plannedHours], input.standardMonthlyHours),
  };
};
