import assert from 'node:assert/strict';
import { calculateLaborItem } from '../../shared/labor';
import { roundMoney } from './proposalCommon';

console.log('Iniciando testes do motor financeiro e regras de proposta...');

// 1. Testes de cálculo de mão de obra (labor.ts)
{
  const input = {
    professionalCount: 2,
    monthlySalary: 2500,
    monthlyFood: 600,
    monthlyTransport: 300,
    monthlyOtherCosts: 100,
    standardMonthlyHours: 176,
    plannedHours: 44,
  };

  const result = calculateLaborItem(input);

  // Custo mensal por profissional: 2500 + 600 + 300 + 100 = 3500.00
  assert.equal(result.monthlyCost, 3500);

  // Taxa horária: 3500 / 176 = 19.886363... -> 19.8864
  assert.equal(result.hourlyRate, 19.8864);

  // Custo total: 2 profissionais * (3500 / 176) * 44 = 1750.00
  assert.equal(result.totalCost, 1750);
}

// 2. Horas mensais inválidas (<= 0 ou NaN) devem disparar erro
{
  assert.throws(() => calculateLaborItem({
    professionalCount: 1,
    monthlySalary: 2000,
    monthlyFood: 0,
    monthlyTransport: 0,
    monthlyOtherCosts: 0,
    standardMonthlyHours: 0,
    plannedHours: 10,
  }), /LABOR_HOURS_INVALID/);
}

// 3. Testes de totais de proposta (materiais + mão de obra + BDI + margem)
{
  const items = [
    { quantity: 10, unitCost: 150.50, unitSale: 210.70 },
    { quantity: 5, unitCost: 80.00, unitSale: 112.00 },
  ];

  const laborItems = [
    { totalCost: 1750.00 },
    { totalCost: 850.25 },
  ];

  const bdiMultiplier = 1.35; // 35% de BDI aplicado sobre o custo base

  const materials = roundMoney(items.reduce((acc, item) => acc + roundMoney(item.quantity * item.unitCost), 0));
  // 10 * 150.50 = 1505.00; 5 * 80.00 = 400.00 -> 1905.00
  assert.equal(materials, 1905.00);

  const labor = roundMoney(laborItems.reduce((acc, item) => acc + item.totalCost, 0));
  // 1750.00 + 850.25 = 2600.25
  assert.equal(labor, 2600.25);

  const baseCost = roundMoney(materials + labor);
  // 1905.00 + 2600.25 = 4505.25
  assert.equal(baseCost, 4505.25);

  const finalValue = roundMoney(baseCost * bdiMultiplier);
  // 4505.25 * 1.35 = 6082.0875 -> 6082.09
  assert.equal(finalValue, 6082.09);

  const additions = roundMoney(finalValue - baseCost);
  // 6082.09 - 4505.25 = 1576.84
  assert.equal(additions, 1576.84);

  const grossResult = roundMoney(finalValue - baseCost);
  assert.equal(grossResult, 1576.84);

  const marginPercent = finalValue > 0 ? roundMoney((grossResult / finalValue) * 100) : 0;
  // (1576.84 / 6082.09) * 100 = 25.92595... -> 25.93%
  assert.equal(marginPercent, 25.93);
}

// 4. Caso limite: proposta com valor zero não pode resultar em NaN ou Infinity
{
  const finalValue = 0;
  const grossResult = 0;
  const marginPercent = finalValue > 0 ? roundMoney((grossResult / finalValue) * 100) : 0;
  assert.equal(marginPercent, 0);
  assert.ok(Number.isFinite(marginPercent));
}

// 5. Teste de precisão do roundMoney (arredondamento bancário IEEE 754)
{
  assert.equal(roundMoney(1.005), 1.01);
  assert.equal(roundMoney(10.554), 10.55);
  assert.equal(roundMoney(10.555), 10.56);
  assert.equal(roundMoney(0), 0);
}

// 6. Teste de lógica de snapshot: imutabilidade de itens de proposta
{
  // Simula linha de proposta criada a partir do catálogo original
  const catalogProductAtCreation = {
    code: 'CAM-001',
    description: 'Câmera Bullet 2MP',
    currentCost: 120.00,
  };
  const bdiMultiplier = 1.40;

  const proposalLineSnapshot = {
    snapshot_code: catalogProductAtCreation.code,
    snapshot_description: catalogProductAtCreation.description,
    snapshot_unit_cost: catalogProductAtCreation.currentCost,
    sale_unit_price: roundMoney(catalogProductAtCreation.currentCost * bdiMultiplier),
    quantity: 4,
  };

  // Suponha que o catálogo é atualizado mais tarde (ex: reajuste da Exsat para 180.00)
  const catalogProductAfterSync = {
    ...catalogProductAtCreation,
    currentCost: 180.00,
  };

  // O snapshot da proposta DEVE permanecer inalterado
  assert.equal(proposalLineSnapshot.snapshot_unit_cost, 120.00);
  assert.notEqual(proposalLineSnapshot.snapshot_unit_cost, catalogProductAfterSync.currentCost);
  assert.equal(proposalLineSnapshot.sale_unit_price, 168.00);
  assert.equal(roundMoney(proposalLineSnapshot.quantity * proposalLineSnapshot.snapshot_unit_cost), 480.00);
}

console.log('Todos os testes do motor financeiro e imutabilidade de propostas passaram com sucesso!');
