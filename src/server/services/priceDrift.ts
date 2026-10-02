// Preco do catalogo que mudou depois que o item entrou na proposta (aviso "Atualizar precos desta proposta?" do celular).
// So propostas em edicao (draft) e na revisao mais recente; em revisao, enviada ou aprovada os precos ficam congelados.
// O custo (de e para) so sai quando o chamador pode ver custo (p10); o efeito no valor final sai sempre.
import { randomUUID } from 'node:crypto';
import { multiplyDecimal, sumDecimal } from '../../shared/decimal';
import { calculateProposalTotals } from '../../shared/proposalFinancials';
import type { LocalDatabase } from './database';
import { getEditableProposal, roundMoney } from './proposalCommon';
import { getProposalById } from './proposals';

export type PriceDriftItem = {
  id: string;
  code: string;
  description: string;
  quantity: number;
  unit: string;
  changePercent: number;
  finalDelta: number;
  // Somente com p10.
  fromUnit?: number;
  toUnit?: number;
  costDelta?: number;
};

export type PriceDriftProposal = {
  id: string;
  number: string;
  revision: number;
  clientName: string;
  workName: string;
  status: string;
  // false quando a proposta nao esta em edicao: os precos ficam como estao.
  frozen: boolean;
  items: PriceDriftItem[];
  finalBefore: number;
  finalAfter: number;
  finalDelta: number;
  costDelta?: number;
};

const MIN_DIFF = 0.01;

export const getProposalPriceDrift = async (database: LocalDatabase, proposalId: string, withCost: boolean): Promise<PriceDriftProposal | null> => {
  const proposal = await getProposalById(database, proposalId);
  if (!proposal) return null;
  const frozen = proposal.status !== 'draft' || !proposal.isLatest;
  const base = {
    id: proposal.id, number: proposal.number, revision: proposal.revision, clientName: proposal.clientName,
    workName: proposal.workName, status: proposal.status, frozen,
  };
  const finalBefore = proposal.totals.finalValue ?? 0;
  if (frozen) return { ...base, items: [], finalBefore, finalAfter: finalBefore, finalDelta: 0, ...(withCost ? { costDelta: 0 } : {}) };

  const factor = proposal.bdiMultiplier;
  const taxFactor = 1 + (proposal.taxPercentage ?? 0) / 100;
  const items: PriceDriftItem[] = [];
  const costDeltas: number[] = [];
  for (const line of proposal.items) {
    const now = line.catalogCurrentCost;
    if (now === null || now === undefined || Math.abs(now - line.unitCost) < MIN_DIFF) continue;
    const costDelta = multiplyDecimal([sumDecimal([now, -line.unitCost]), line.quantity]);
    costDeltas.push(costDelta);
    items.push({
      id: line.id, code: line.code, description: line.description, quantity: line.quantity, unit: line.unit,
      changePercent: line.unitCost > 0 ? roundMoney((now / line.unitCost - 1) * 100) : 0,
      finalDelta: multiplyDecimal([costDelta, factor, taxFactor]),
      ...(withCost ? { fromUnit: line.unitCost, toUnit: now, costDelta } : {}),
    });
  }
  const materialsDelta = sumDecimal(costDeltas);
  const after = calculateProposalTotals(sumDecimal([proposal.totals.materials ?? 0, materialsDelta]), proposal.totals.labor ?? 0, proposal.bdiMultiplier, proposal.taxPercentage ?? 0);
  return {
    ...base, items, finalBefore, finalAfter: after.finalValue, finalDelta: sumDecimal([after.finalValue, -finalBefore]),
    ...(withCost ? { costDelta: materialsDelta } : {}),
  };
};

// Propostas em edicao (ultima revisao) com ao menos um item cujo preco do catalogo mudou.
export const listPriceDriftProposals = async (database: LocalDatabase, withCost: boolean): Promise<PriceDriftProposal[]> => {
  const ids = await database.query<{ id: string }>(`
    SELECT DISTINCT p.id, p.updated_at
    FROM proposals p
    JOIN proposal_items pi ON pi.proposal_id = p.id
    JOIN products pr ON pr.code = pi.snapshot_code AND pr.active = true
    WHERE p.status = 'draft'
      AND NOT EXISTS (SELECT 1 FROM proposals newer WHERE newer.proposal_number = p.proposal_number AND newer.revision > p.revision)
      AND abs(pr.current_cost - pi.snapshot_unit_cost) >= $1
    ORDER BY p.updated_at DESC
    LIMIT 50
  `, [MIN_DIFF]);
  const out: PriceDriftProposal[] = [];
  for (const row of ids.rows) {
    const drift = await getProposalPriceDrift(database, row.id, withCost);
    if (drift && drift.items.length > 0) out.push(drift);
  }
  return out;
};

// Grava o custo do catalogo nos itens com preco diferente (todos, ou so os informados).
export const applyProposalPriceDrift = async (database: LocalDatabase, proposalId: string, itemIds?: string[]) => {
  const updated = await database.transaction(async (transaction) => {
    const proposal = await getEditableProposal(transaction, proposalId);
    if (proposal.status !== 'draft') throw new Error('PROPOSAL_LOCKED');
    const rows = await transaction.query<{ id: string; before: string; after: string }>(`
      SELECT pi.id, pi.snapshot_unit_cost::text AS before, pr.current_cost::text AS after
      FROM proposal_items pi
      JOIN products pr ON pr.code = pi.snapshot_code AND pr.active = true
      WHERE pi.proposal_id = $1 AND abs(pr.current_cost - pi.snapshot_unit_cost) >= $2
        AND ($3::uuid[] IS NULL OR pi.id = ANY($3::uuid[]))
      FOR UPDATE OF pi
    `, [proposalId, MIN_DIFF, itemIds && itemIds.length ? itemIds : null]);
    for (const row of rows.rows) {
      await transaction.query('UPDATE proposal_items SET snapshot_unit_cost = $3 WHERE proposal_id = $1 AND id = $2', [proposalId, row.id, row.after]);
    }
    if (rows.rows.length > 0) {
      await transaction.query('UPDATE proposals SET updated_at = now() WHERE id = $1', [proposalId]);
      await transaction.query(`
        INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data)
        VALUES ($1, 'proposal', $2, 'price_drift_applied', $3::jsonb, $4::jsonb)
      `, [randomUUID(), proposalId,
        JSON.stringify(rows.rows.map((row) => ({ itemId: row.id, unitCost: Number(row.before) }))),
        JSON.stringify(rows.rows.map((row) => ({ itemId: row.id, unitCost: Number(row.after) })))]);
    }
    return rows.rows.length;
  });
  return updated;
};
