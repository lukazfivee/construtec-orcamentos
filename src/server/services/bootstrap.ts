import { randomUUID } from 'node:crypto';
import { hash } from 'bcryptjs';
import type { LocalDatabase } from './database';

const demoUserId = '00000000-0000-4000-8000-000000000001';
const demoClientId = '00000000-0000-4000-8000-000000000002';
const demoProposalId = '00000000-0000-4000-8000-000000000003';
const demoWorkId = '00000000-0000-4000-8000-000000000004';

const demoProducts = [
  ['MAT-AC-001', 'Controladora de acesso 2 portas TCP/IP', 'Controle de acesso', 'un', 1250],
  ['LEI-AC-002', 'Leitor facial IP Wiegand', 'Controle de acesso', 'un', 1150],
  ['LEI-AC-003', 'Leitor de cartão proximidade 13,56 MHz', 'Controle de acesso', 'un', 210],
  ['BTA-AC-004', 'Botoeira de saída inox', 'Controle de acesso', 'un', 65],
  ['FEC-AC-005', 'Fechadura eletromagnética 280 kgf', 'Controle de acesso', 'un', 320],
  ['FON-AC-006', 'Fonte 12V 5A com nobreak', 'Fontes', 'un', 260],
  ['CAB-UTP-001', 'Cabo de rede Cat.6 U/UTP 305m', 'Cabeamento', 'cx', 950],
  ['CAB-2P-001', 'Cabo 2x18 AWG blindado', 'Cabeamento', 'm', 6.2],
  ['CON-DIN-001', 'Conector RJ45 Cat.6', 'Cabeamento', 'un', 4.5],
  ['INF-ELE-001', 'Eletroduto corrugado 3/4”', 'Infraestrutura', 'm', 3.8],
  ['INF-CAI-001', 'Caixa 4x2 de embutir', 'Infraestrutura', 'un', 2.6],
  ['SER-INST-001', 'Instalação e configuração do sistema', 'Serviços', 'sv', 6800],
  ['SER-TRE-001', 'Treinamento de usuários (até 8h)', 'Serviços', 'sv', 350],
  ['SER-DOC-001', 'Documentação técnica e as-built', 'Serviços', 'sv', 120],
  ['LEI-QR-004', 'Leitor de QR Code para acesso', 'Controle de acesso', 'un', 485],
] as const;

const quantities = [1, 2, 4, 2, 2, 2, 1, 100, 20, 50, 10, 1, 1, 1];

export const ensureFirstRunData = async (database: LocalDatabase) => {
  const existing = await database.query<{ count: string }>('SELECT count(*)::text AS count FROM proposals');
  if (Number(existing.rows[0]?.count ?? 0) > 0) {
    const proposalsWithoutWork = await database.query<{
      id: string; client_id: string; work_name: string; snapshot_client_name: string | null;
    }>(`
      SELECT p.id, p.client_id, p.work_name, p.snapshot_client_name
      FROM proposals p
      WHERE p.work_id IS NULL
      ORDER BY p.created_at
    `);
    for (const proposal of proposalsWithoutWork.rows) {
      const existingWork = await database.query<{ id: string }>(
        'SELECT id FROM works WHERE client_id = $1 AND name = $2 LIMIT 1',
        [proposal.client_id, proposal.work_name],
      );
      const workId = existingWork.rows[0]?.id ?? randomUUID();
      if (!existingWork.rows[0]) {
        await database.query('INSERT INTO works (id, client_id, name) VALUES ($1, $2, $3)', [workId, proposal.client_id, proposal.work_name]);
      }
      await database.query(`
        UPDATE proposals p
        SET work_id = $2,
            snapshot_client_name = COALESCE(p.snapshot_client_name, COALESCE(c.trade_name, c.legal_name)),
            snapshot_work_name = COALESCE(p.snapshot_work_name, p.work_name)
        FROM clients c
        WHERE p.id = $1 AND c.id = p.client_id
      `, [proposal.id, workId]);
    }
    return;
  }

  const passwordHash = await hash(randomUUID(), 12);

  await database.transaction(async (transaction) => {
    await transaction.query(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'admin') ON CONFLICT DO NOTHING`,
      [demoUserId, 'Marcos Ribeiro', 'marcos.demo@construtec.local', passwordHash],
    );
    await transaction.query(
      `INSERT INTO clients (id, legal_name, trade_name)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [demoClientId, 'Edifício Horizonte SPE Ltda.', 'Edifício Horizonte'],
    );
    await transaction.query(
      `INSERT INTO works (id, client_id, name, address)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [demoWorkId, demoClientId, 'Edifício Horizonte', 'Endereço demonstrativo'],
    );

    for (const [index, product] of demoProducts.entries()) {
      const [code, description, category, unit, currentCost] = product;
      const productId = `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
      await transaction.query(
        `INSERT INTO products (id, code, description, category, unit, current_cost, source)
         VALUES ($1, $2, $3, $4, $5, $6, 'DEMONSTRAÇÃO') ON CONFLICT (code) DO NOTHING`,
        [productId, code, description, category, unit, currentCost],
      );
    }

    await transaction.query(
      `INSERT INTO proposals
        (id, proposal_number, revision, client_id, work_id, work_name, snapshot_client_name,
         snapshot_work_name, scope, status, bdi_multiplier, valid_until, created_by)
       VALUES ($1, 'PA-1054', 0, $2, $3, 'Edifício Horizonte', 'Edifício Horizonte',
         'Edifício Horizonte', 'Controle de acesso', 'draft', 1.45, '2025-06-15', $4)`,
      [demoProposalId, demoClientId, demoWorkId, demoUserId],
    );

    for (const [index, quantity] of quantities.entries()) {
      const [code, description, , unit, currentCost] = demoProducts[index];
      const productId = `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
      await transaction.query(
        `INSERT INTO proposal_items
          (id, proposal_id, catalog_product_id, position, snapshot_code, snapshot_description,
           snapshot_unit, snapshot_unit_cost, quantity, sale_unit_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [randomUUID(), demoProposalId, productId, index + 1, code, description, unit, currentCost, quantity, Math.round(currentCost * 1.45 * 100) / 100],
      );
    }
  });
};
