import { createHash, randomUUID } from 'node:crypto';
import type { LocalDatabase } from '../database';
import { getIntegrationIdentity } from '../settings';
import { roundMoney } from '../proposalCommon';

export function canonicalJsonStringify(object: unknown): string {
  if (object === null || typeof object !== 'object') {
    return JSON.stringify(object);
  }
  if (Array.isArray(object)) {
    return '[' + object.map(item => canonicalJsonStringify(item)).join(',') + ']';
  }
  const keys = Object.keys(object as Record<string, unknown>).sort();
  const pairs = keys.map(key => `${JSON.stringify(key)}:${canonicalJsonStringify((object as Record<string, unknown>)[key])}`);
  return '{' + pairs.join(',') + '}';
}

export function computeSha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export interface SealEvidence {
  evidenceKind?: string;
  evidenceReference?: string;
}

export const buildApprovedProposalEnvelope = async (
  database: Pick<LocalDatabase, 'query' | 'exec'>,
  proposalId: string,
  userId?: string,
  evidence?: SealEvidence,
) => {
  const proposalResult = await database.query<{
    id: string;
    series_id: string;
    proposal_number: string;
    revision: number;
    client_id: string;
    work_id: string | null;
    work_name: string;
    scope: string;
    status: string;
    bdi_multiplier: string;
    valid_until: string | null;
    updated_at: string;
    client_legal_name: string;
    client_trade_name: string | null;
    client_document: string | null;
    work_address: string | null;
    creator_name: string;
  }>(`
    SELECT p.id, p.series_id, p.proposal_number, p.revision, p.client_id, p.work_id,
      p.work_name, p.scope, p.status, p.bdi_multiplier::text, p.valid_until::text,
      p.updated_at::text, c.legal_name AS client_legal_name, c.trade_name AS client_trade_name,
      c.document AS client_document, w.address AS work_address, u.name AS creator_name
    FROM proposals p
    JOIN clients c ON c.id = p.client_id
    JOIN users u ON u.id = p.created_by
    LEFT JOIN works w ON w.id = p.work_id
    WHERE p.id = $1
  `, [proposalId]);

  const p = proposalResult.rows[0];
  if (!p) throw new Error('PROPOSAL_NOT_FOUND');

  const identity = await getIntegrationIdentity(database);
  const bdiMultiplier = Number(p.bdi_multiplier);

  // Materials
  const itemsResult = await database.query<{
    id: string;
    position: number;
    snapshot_code: string;
    snapshot_description: string;
    snapshot_category: string;
    snapshot_unit: string;
    snapshot_unit_cost: string;
    quantity: string;
    sale_unit_price: string;
  }>(`
    SELECT id, position, snapshot_code, snapshot_description, snapshot_category,
      snapshot_unit, snapshot_unit_cost::text, quantity::text, sale_unit_price::text
    FROM proposal_items
    WHERE proposal_id = $1
    ORDER BY position ASC
  `, [proposalId]);

  const materials = itemsResult.rows.map((item, idx) => {
    const qtyNum = Number(item.quantity);
    const costNum = Number(item.snapshot_unit_cost);
    const totalCostNum = roundMoney(qtyNum * costNum);
    const allocatedSaleNum = roundMoney(totalCostNum * bdiMultiplier);
    return {
      id: item.id,
      position: idx + 1,
      code: item.snapshot_code,
      description: item.snapshot_description,
      category: item.snapshot_category || 'Geral',
      unit: item.snapshot_unit,
      quantity: qtyNum.toFixed(4),
      unitCost: costNum.toFixed(4),
      totalCost: totalCostNum.toFixed(2),
      sourceUnitSale: Number(item.sale_unit_price).toFixed(2),
      sourceTotalSale: roundMoney(qtyNum * Number(item.sale_unit_price)).toFixed(2),
      allocatedSale: allocatedSaleNum.toFixed(2),
    };
  });

  // Labor
  const laborResult = await database.query<{
    id: string;
    position: number;
    description: string;
    professional_count: string;
    planned_hours: string;
    monthly_salary: string;
    monthly_food: string;
    monthly_transport: string;
    monthly_other_costs: string;
    standard_monthly_hours: string;
  }>(`
    SELECT id, position, description, professional_count::text, planned_hours::text,
      monthly_salary::text, monthly_food::text, monthly_transport::text,
      monthly_other_costs::text, standard_monthly_hours::text
    FROM proposal_labor_items
    WHERE proposal_id = $1
    ORDER BY position ASC
  `, [proposalId]);

  const labor = laborResult.rows.map((l, idx) => {
    const countNum = Number(l.professional_count);
    const plannedHoursNum = Number(l.planned_hours);
    const salary = Number(l.monthly_salary || 0);
    const food = Number(l.monthly_food || 0);
    const transport = Number(l.monthly_transport || 0);
    const other = Number(l.monthly_other_costs || 0);
    const monthlyTotal = salary + food + transport + other;
    const stdHours = Number(l.standard_monthly_hours || 176);
    const teamHoursNum = countNum * plannedHoursNum;
    const totalCostNum = roundMoney(countNum * monthlyTotal * (plannedHoursNum / stdHours));
    const allocatedSaleNum = roundMoney(totalCostNum * bdiMultiplier);
    return {
      id: l.id,
      position: idx + 1,
      roleName: l.description,
      costBasis: 'composition' as const,
      professionalCount: countNum.toFixed(2),
      plannedHoursPerProfessional: plannedHoursNum.toFixed(2),
      plannedTeamHours: teamHoursNum.toFixed(4),
      monthlySalary: salary.toFixed(2),
      monthlyFood: food.toFixed(2),
      monthlyTransport: transport.toFixed(2),
      monthlyOtherCosts: other.toFixed(2),
      standardMonthlyHours: stdHours.toFixed(2),
      hourlyRate: (monthlyTotal / stdHours).toFixed(4),
      totalCost: totalCostNum.toFixed(2),
      allocatedSale: allocatedSaleNum.toFixed(2),
    };
  });

  const materialsCost = roundMoney(materials.reduce((sum, m) => sum + Number(m.totalCost), 0));
  const laborCost = roundMoney(labor.reduce((sum, l) => sum + Number(l.totalCost), 0));
  const baseCost = roundMoney(materialsCost + laborCost);
  const contractValue = roundMoney(baseCost * bdiMultiplier);
  const additions = roundMoney(contractValue - baseCost);
  const totalAllocated = roundMoney(
    materials.reduce((sum, m) => sum + Number(m.allocatedSale), 0) +
    labor.reduce((sum, l) => sum + Number(l.allocatedSale), 0)
  );
  const salesRoundingAdjustment = roundMoney(contractValue - totalAllocated);

  let baseRevision: number | null = null;
  let basePayloadSha256: string | null = null;
  if (p.revision > 0) {
    baseRevision = p.revision - 1;
    const prevSnapshot = await database.query<{ payload_sha256: string }>(`
      SELECT s.payload_sha256
      FROM proposal_approval_snapshots s
      JOIN proposals pr ON pr.id = s.proposal_id
      WHERE pr.proposal_number = $1 AND pr.revision = $2
    `, [p.proposal_number, baseRevision]);
    basePayloadSha256 = prevSnapshot.rows[0]?.payload_sha256 ?? null;
  }

  const nowIso = new Date().toISOString();
  const payload = {
    source: {
      system: 'construtec-orcamentos',
      namespaceId: identity.namespaceId,
      installationId: identity.installationId,
      version: '1.0.5',
    },
    proposal: {
      id: p.id,
      seriesId: p.series_id,
      number: p.proposal_number,
      revision: p.revision,
      status: 'approved' as const,
      approval: {
        approvedAt: nowIso,
        recordedAt: nowIso,
        recordedBy: p.creator_name,
        evidenceKind: evidence?.evidenceKind || 'client_acceptance',
        evidenceReference: evidence?.evidenceReference || `ACEITE-${p.proposal_number}`,
      },
      validUntil: p.valid_until ? p.valid_until.slice(0, 10) : null,
      responsibleName: p.creator_name,
      change: {
        kind: p.revision === 0 ? 'initial' as const : 'replacement' as const,
        baseRevision,
        basePayloadSha256,
      },
    },
    client: {
      sourceId: p.client_id,
      legalName: p.client_legal_name,
      tradeName: p.client_trade_name || null,
      document: p.client_document || null,
      contacts: [],
    },
    work: {
      sourceId: p.work_id || `work-${p.id}`,
      name: p.work_name,
      address: p.work_address || null,
      scope: p.scope,
    },
    pricing: {
      currency: 'BRL',
      calculationVersion: 'construtec-decimal-v1',
      method: 'bdi_multiplier' as const,
      bdiMultiplier: bdiMultiplier.toFixed(4),
    },
    materials,
    labor,
    totals: {
      materialsCost: materialsCost.toFixed(2),
      laborCost: laborCost.toFixed(2),
      baseCost: baseCost.toFixed(2),
      contractValue: contractValue.toFixed(2),
      additions: additions.toFixed(2),
      salesRoundingAdjustment: salesRoundingAdjustment.toFixed(2),
    },
  };

  const canonical = canonicalJsonStringify(payload);
  const payloadSha256 = computeSha256(canonical);

  const envelope = {
    schemaVersion: '1.0.0',
    eventId: randomUUID(),
    emittedAt: nowIso,
    payloadSha256,
    payload,
  };

  return envelope;
};

export const sealProposalInTransaction = async (
  transaction: Pick<LocalDatabase, 'query' | 'exec'>,
  proposalId: string,
  userId?: string,
  evidence?: SealEvidence,
) => {
  const tableCheck = await transaction.query<{ exists: boolean }>(
    "SELECT to_regclass('public.proposal_approval_snapshots') IS NOT NULL AS exists"
  );
  if (!tableCheck.rows[0]?.exists) {
    return null;
  }

  const existing = await transaction.query<{ id: string; payload_sha256: string }>(
    'SELECT id, payload_sha256 FROM proposal_approval_snapshots WHERE proposal_id = $1',
    [proposalId]
  );
  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const envelope = await buildApprovedProposalEnvelope(transaction, proposalId, userId, evidence);
  const snapshotId = randomUUID();

  await transaction.query(`
    INSERT INTO proposal_approval_snapshots
      (id, proposal_id, series_id, revision, payload, payload_sha256, sealed_at, sealed_by)
    VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
  `, [
    snapshotId,
    proposalId,
    envelope.payload.proposal.seriesId,
    envelope.payload.proposal.revision,
    JSON.stringify(envelope.payload),
    envelope.payloadSha256,
    envelope.emittedAt,
    userId ?? null,
  ]);

  await transaction.query(`
    INSERT INTO integration_outbox
      (id, snapshot_id, destination, status, attempts, created_at)
    VALUES ($1, $2, 'centro-de-custos', 'pending', 0, $3)
  `, [randomUUID(), snapshotId, envelope.emittedAt]);

  return { id: snapshotId, payloadSha256: envelope.payloadSha256, envelope };
};
