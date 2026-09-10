import assert from 'node:assert/strict';
import { test } from 'node:test';
import { multiplyDecimal, roundDecimal, sumDecimal } from './decimal';
import { calculateLaborItem } from './labor';
import { calculateProposalTotals } from './proposalFinancials';
import { canChangeProposalStatus } from './proposalStatus';

test('HALF_UP decimal, soma exata e divisão antes do arredondamento', () => {
  assert.equal(roundDecimal('1.005'), 1.01);
  assert.equal(roundDecimal('-1.005'), -1.01);
  assert.equal(sumDecimal([0.1, 0.2]), 0.3);
  assert.equal(multiplyDecimal(['0.5', '0.01']), 0.01);
  assert.equal(multiplyDecimal(['1e-7', '10000000']), 1);
  assert.equal(multiplyDecimal([2, 3500, 44], 176), 1750);
  assert.throws(() => roundDecimal(Infinity), /FINANCIAL_VALUE_INVALID/);
  assert.throws(() => multiplyDecimal([1], 0), /FINANCIAL_VALUE_INVALID/);
  assert.throws(() => roundDecimal('999999999999999999'), /FINANCIAL_TOTAL_TOO_LARGE/);
});

test('horas por profissional e horas da equipe são distintas', () => {
  const result = calculateLaborItem({ professionalCount: 2, monthlySalary: 2500, monthlyFood: 600,
    monthlyTransport: 300, monthlyOtherCosts: 100, standardMonthlyHours: 176, plannedHours: 44 });
  assert.equal(result.plannedHoursPerProfessional, 44);
  assert.equal(result.plannedTeamHours, 88);
  assert.equal(result.hourlyRate, 19.8864);
  assert.equal(result.totalCost, 1750);
  assert.deepEqual(calculateProposalTotals(1000, 1760, 1.25), {
    materials: 1000, labor: 1760, baseCost: 2760, finalValue: 3450, additions: 690,
  });
});

test('aprovação é terminal e repetir o mesmo estado é idempotente', () => {
  for (const next of ['draft', 'review', 'sent', 'rejected'] as const) {
    assert.equal(canChangeProposalStatus('approved', next), false);
  }
  assert.equal(canChangeProposalStatus('approved', 'approved'), true);
  assert.equal(canChangeProposalStatus('draft', 'approved'), true);
  assert.equal(canChangeProposalStatus('sent', 'review'), true);
});
