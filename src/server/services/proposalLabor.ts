import { randomUUID } from 'node:crypto';
import type { ProposalLaborInput, ProposalLaborItem } from '../../shared/contracts';
import { calculateLaborItem } from '../../shared/labor';
import type { LocalDatabase } from './database';

type LaborRow = {
  id: string;
  description: string;
  professional_count: string;
  monthly_salary: string;
  monthly_food: string;
  monthly_transport: string;
  monthly_other_costs: string;
  standard_monthly_hours: string;
  planned_hours: string;
};

const mapLaborItem = (row: LaborRow): ProposalLaborItem => {
  const input = {
    professionalCount: Number(row.professional_count),
    monthlySalary: Number(row.monthly_salary),
    monthlyFood: Number(row.monthly_food),
    monthlyTransport: Number(row.monthly_transport),
    monthlyOtherCosts: Number(row.monthly_other_costs),
    standardMonthlyHours: Number(row.standard_monthly_hours),
    plannedHours: Number(row.planned_hours),
  };
  return {
    id: row.id,
    description: row.description,
    ...input,
    ...calculateLaborItem(input),
  };
};

export const listProposalLaborItems = async (database: Pick<LocalDatabase, 'query'>, proposalId: string) => {
  const result = await database.query<LaborRow>(`
    SELECT id, description, professional_count::text, monthly_salary::text, monthly_food::text,
      monthly_transport::text, monthly_other_costs::text, standard_monthly_hours::text, planned_hours::text
    FROM proposal_labor_items
    WHERE proposal_id = $1
    ORDER BY position, created_at
  `, [proposalId]);
  return result.rows.map(mapLaborItem);
};

export const getProposalStandardMonthlyHours = async (database: Pick<LocalDatabase, 'query'>, proposalId: string) => {
  const result = await database.query<{ standard_monthly_hours: string }>(
    'SELECT standard_monthly_hours::text FROM proposals WHERE id = $1', [proposalId],
  );
  return Number(result.rows[0]?.standard_monthly_hours ?? 176);
};

const assertEditable = async (database: Pick<LocalDatabase, 'query'>, proposalId: string) => {
  const result = await database.query<{ status: string; superseded: boolean }>(`
    SELECT p.status,
      EXISTS (SELECT 1 FROM proposals newer WHERE newer.proposal_number = p.proposal_number AND newer.revision > p.revision) AS superseded
    FROM proposals p WHERE p.id = $1 FOR UPDATE
  `, [proposalId]);
  const proposal = result.rows[0];
  if (!proposal) throw new Error('PROPOSAL_NOT_FOUND');
  if (proposal.superseded || !['draft', 'review'].includes(proposal.status)) throw new Error('PROPOSAL_LOCKED');
};

const selectLaborItemForUpdate = async (database: Pick<LocalDatabase, 'query'>, proposalId: string, itemId: string) => {
  const result = await database.query<LaborRow>(`
    SELECT id, description, professional_count::text, monthly_salary::text, monthly_food::text,
      monthly_transport::text, monthly_other_costs::text, standard_monthly_hours::text, planned_hours::text
    FROM proposal_labor_items
    WHERE proposal_id = $1 AND id = $2
    FOR UPDATE
  `, [proposalId, itemId]);
  if (!result.rows[0]) throw new Error('LABOR_ITEM_NOT_FOUND');
  return mapLaborItem(result.rows[0]);
};

export const createProposalLaborItem = async (
  database: LocalDatabase,
  proposalId: string,
  input: ProposalLaborInput,
  userId: string,
) => {
  await database.transaction(async (transaction) => {
    await assertEditable(transaction, proposalId);
    calculateLaborItem(input);
    const next = await transaction.query<{ position: number }>(
      'SELECT COALESCE(max(position), 0) + 1 AS position FROM proposal_labor_items WHERE proposal_id = $1', [proposalId],
    );
    const itemId = randomUUID();
    await transaction.query(`
      INSERT INTO proposal_labor_items
        (id, proposal_id, position, description, professional_count, monthly_salary, monthly_food,
         monthly_transport, monthly_other_costs, standard_monthly_hours, planned_hours)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    `, [itemId, proposalId, next.rows[0]?.position ?? 1, input.description.trim(), input.professionalCount,
      input.monthlySalary, input.monthlyFood, input.monthlyTransport, input.monthlyOtherCosts,
      input.standardMonthlyHours, input.plannedHours]);
    await transaction.query('UPDATE proposals SET updated_at = now() WHERE id = $1', [proposalId]);
    await transaction.query(`
      INSERT INTO audit_events (id, user_id, entity_type, entity_id, action, after_data)
      VALUES ($1, $2, 'proposal_labor_item', $3, 'created', $4::jsonb)
    `, [randomUUID(), userId, itemId, JSON.stringify({ proposalId, ...input })]);
  });
};

export const updateProposalLaborItem = async (
  database: LocalDatabase,
  proposalId: string,
  itemId: string,
  input: ProposalLaborInput,
  userId: string,
) => {
  await database.transaction(async (transaction) => {
    await assertEditable(transaction, proposalId);
    calculateLaborItem(input);
    const before = await selectLaborItemForUpdate(transaction, proposalId, itemId);
    const result = await transaction.query(`
      UPDATE proposal_labor_items
      SET description=$3, professional_count=$4, monthly_salary=$5, monthly_food=$6,
          monthly_transport=$7, monthly_other_costs=$8, standard_monthly_hours=$9,
          planned_hours=$10, updated_at=now()
      WHERE proposal_id=$1 AND id=$2
      RETURNING id
    `, [proposalId, itemId, input.description.trim(), input.professionalCount, input.monthlySalary,
      input.monthlyFood, input.monthlyTransport, input.monthlyOtherCosts, input.standardMonthlyHours, input.plannedHours]);
    if (result.rows.length === 0) throw new Error('LABOR_ITEM_NOT_FOUND');
    await transaction.query('UPDATE proposals SET updated_at = now() WHERE id = $1', [proposalId]);
    await transaction.query(`
      INSERT INTO audit_events (id, user_id, entity_type, entity_id, action, before_data, after_data)
      VALUES ($1, $2, 'proposal_labor_item', $3, 'updated', $4::jsonb, $5::jsonb)
    `, [randomUUID(), userId, itemId, JSON.stringify(before), JSON.stringify({ proposalId, ...input })]);
  });
};

export const removeProposalLaborItem = async (
  database: LocalDatabase,
  proposalId: string,
  itemId: string,
  userId: string,
) => {
  await database.transaction(async (transaction) => {
    await assertEditable(transaction, proposalId);
    const before = await selectLaborItemForUpdate(transaction, proposalId, itemId);
    const result = await transaction.query('DELETE FROM proposal_labor_items WHERE proposal_id=$1 AND id=$2 RETURNING id', [proposalId, itemId]);
    if (result.rows.length === 0) throw new Error('LABOR_ITEM_NOT_FOUND');
    await transaction.query('UPDATE proposals SET updated_at = now() WHERE id = $1', [proposalId]);
    await transaction.query(`
      INSERT INTO audit_events (id, user_id, entity_type, entity_id, action, before_data)
      VALUES ($1, $2, 'proposal_labor_item', $3, 'removed', $4::jsonb)
    `, [randomUUID(), userId, itemId, JSON.stringify({ proposalId, ...before })]);
  });
};

export const updateProposalStandardMonthlyHours = async (
  database: LocalDatabase,
  proposalId: string,
  hours: number,
  userId: string,
) => {
  await database.transaction(async (transaction) => {
    await assertEditable(transaction, proposalId);
    const before = await transaction.query<{ standard_monthly_hours: string }>(
      'SELECT standard_monthly_hours::text FROM proposals WHERE id=$1 FOR UPDATE', [proposalId],
    );
    await transaction.query('UPDATE proposals SET standard_monthly_hours=$2, updated_at=now() WHERE id=$1', [proposalId, hours]);
    await transaction.query(`
      INSERT INTO audit_events (id, user_id, entity_type, entity_id, action, before_data, after_data)
      VALUES ($1, $2, 'proposal', $3, 'labor_settings_updated', $4::jsonb, $5::jsonb)
    `, [randomUUID(), userId, proposalId,
      JSON.stringify({ standardMonthlyHours: Number(before.rows[0]?.standard_monthly_hours ?? 176) }),
      JSON.stringify({ standardMonthlyHours: hours })]);
  });
};

export const copyProposalLabor = async (database: LocalDatabase, sourceProposalId: string, targetProposalId: string) => {
  const items = await listProposalLaborItems(database, sourceProposalId);
  const hours = await getProposalStandardMonthlyHours(database, sourceProposalId);
  await database.query('UPDATE proposals SET standard_monthly_hours=$2 WHERE id=$1', [targetProposalId, hours]);
  for (const [index, item] of items.entries()) {
    await database.query(`
      INSERT INTO proposal_labor_items
        (id, proposal_id, position, description, professional_count, monthly_salary, monthly_food,
         monthly_transport, monthly_other_costs, standard_monthly_hours, planned_hours)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    `, [randomUUID(), targetProposalId, index + 1, item.description, item.professionalCount, item.monthlySalary,
      item.monthlyFood, item.monthlyTransport, item.monthlyOtherCosts, item.standardMonthlyHours, item.plannedHours]);
  }
};
