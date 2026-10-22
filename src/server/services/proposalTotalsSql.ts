// Expressões internas com alias fixo p; nunca interpolar entrada de usuário.
// Custo: arredondar cada linha e somar, como no detalhe.
export const materialsCostSql = `COALESCE((
  SELECT SUM(ROUND(pi.quantity * pi.snapshot_unit_cost, 2))
  FROM proposal_items pi WHERE pi.proposal_id = p.id
), 0)`;

export const laborCostSql = `COALESCE((
  SELECT SUM(ROUND(pli.professional_count
    * (pli.monthly_salary + pli.monthly_food + pli.monthly_transport + pli.monthly_other_costs)
    * pli.planned_hours / NULLIF(pli.standard_monthly_hours, 0), 2))
  FROM proposal_labor_items pli WHERE pli.proposal_id = p.id
), 0)`;

export const baseCostSql = `(${materialsCostSql} + ${laborCostSql})`;
// Venda de um item sem imposto, sem arredondar (mesma regra de lineSaleBase em src/shared/proposalFinancials.ts):
// venda automatica (= round(custo x BDI) com folga de 0,011) vale custo do item x BDI; venda digitada vale qtd x venda.
// item e bdi sao aliases/colunas fixos do codigo, nunca entrada de usuario.
export const itemSaleBaseSql = (item: string, bdi: string) => `(CASE
    WHEN ABS(${item}.sale_unit_price - ROUND(${item}.snapshot_unit_cost * ${bdi}, 2)) < 0.011
      THEN ROUND(${item}.quantity * ${item}.snapshot_unit_cost, 2) * ${bdi}
    ELSE ${item}.quantity * ${item}.sale_unit_price
  END)`;

export const itemsSaleBaseSql = `COALESCE((
  SELECT SUM(${itemSaleBaseSql('pi', 'p.bdi_multiplier')})
  FROM proposal_items pi WHERE pi.proposal_id = p.id
), 0)`;

// Valor final = (venda dos itens + mao de obra x BDI) x (1 + imposto%), arredondado uma vez.
export const finalValueSql = `ROUND((${itemsSaleBaseSql} + ${laborCostSql} * p.bdi_multiplier) * (1 + COALESCE(p.tax_percentage, 0) / 100), 2)`;
