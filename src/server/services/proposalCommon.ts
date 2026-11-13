import { randomUUID } from 'node:crypto';
import { roundDecimal } from '../../shared/decimal';
import type { ProposalDetail } from '../../shared/contracts';
import type { LocalDatabase } from './database';

export type Queryable = Pick<LocalDatabase, 'query'>;

export const roundMoney = (value: number) => roundDecimal(value);

// Numeros ja usados, inclusive os de propostas descartadas: um numero descartado nao volta a ser emitido.
export const PROPOSAL_NUMBERS_SQL = 'SELECT proposal_number FROM proposals UNION ALL SELECT proposal_number FROM discarded_proposals';

export const getLatestProposal = async (database: Queryable, proposalId: string) => {
  const result = await database.query<{
    status: ProposalDetail['status'];
    bdi_multiplier: string;
    proposal_number: string;
    revision: number;
    tax_percentage?: string | null;
    superseded: boolean;
  }>(`
    SELECT p.status, p.bdi_multiplier::text, p.proposal_number, p.revision,
      COALESCE(p.tax_percentage, 0)::text AS tax_percentage,
      EXISTS (
        SELECT 1 FROM proposals newer
        WHERE newer.proposal_number = p.proposal_number AND newer.revision > p.revision
      ) AS superseded
    FROM proposals p
    WHERE p.id = $1
    FOR UPDATE
  `, [proposalId]);
  const proposal = result.rows[0];
  if (!proposal) throw new Error('PROPOSAL_NOT_FOUND');
  if (proposal.superseded) throw new Error('PROPOSAL_LOCKED');
  return proposal;
};

export const getEditableProposal = async (database: Queryable, proposalId: string) => {
  const proposal = await getLatestProposal(database, proposalId);
  if (proposal.status !== 'draft' && proposal.status !== 'review') throw new Error('PROPOSAL_LOCKED');
  return proposal;
};

export type ProposalItemInsert = {
  catalogProductId: string | null; position: number; code: string; manufacturer: string | null; model: string | null;
  description: string; category: string; unit: string; unitCost: number; quantity: number; saleUnitPrice: number;
};

const ITEM_INSERT_CHUNK = 100;

// Grava os itens em blocos, uma consulta por bloco e nao uma por item: na nuvem a transacao segura a trava de escrita.
export const insertProposalItems = async (database: Queryable, proposalId: string, items: ProposalItemInsert[]) => {
  for (let start = 0; start < items.length; start += ITEM_INSERT_CHUNK) {
    const params: unknown[] = [proposalId];
    const values = items.slice(start, start + ITEM_INSERT_CHUNK).map((item) => {
      const first = params.length + 1;
      params.push(randomUUID(), item.catalogProductId, item.position, item.code, item.manufacturer, item.model,
        item.description, item.category, item.unit, item.unitCost, item.quantity, item.saleUnitPrice);
      return `($${first}, $1, ${Array.from({ length: 11 }, (_, offset) => `$${first + 1 + offset}`).join(', ')})`;
    });
    await database.query(`
      INSERT INTO proposal_items (
        id, proposal_id, catalog_product_id, position, snapshot_code,
        snapshot_manufacturer, snapshot_model, snapshot_description,
        snapshot_category, snapshot_unit, snapshot_unit_cost, quantity,
        sale_unit_price
      ) VALUES ${values.join(', ')}
    `, params);
  }
};
