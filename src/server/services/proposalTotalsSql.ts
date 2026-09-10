// Expressões internas com alias fixo p; nunca interpolar entrada de usuário.
// Mesma regra do detalhe: arredondar cada linha, somar, aplicar BDI uma vez.
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
export const finalValueSql = `ROUND(${baseCostSql} * p.bdi_multiplier, 2)`;
